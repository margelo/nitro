import { indent } from '../../../utils.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { escapeCppName } from '../../helpers.js'
import type { Type, TypeContext } from '../../types/Type.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { CallbackType, type GetCallbackCodeOptions } from '../../types/CallbackType.js'
import { PromiseType } from '../../types/PromiseType.js'
import { createSwiftCallbackBridge, createSwiftInlineCallbackBridge } from '../SwiftCallback.js'
import { getClangImporterReferenceName, getQualifiedSwiftName, type ImportedCxxRecord } from '../ImportedCxxRecord.js'
import { wrapSwiftTypeForBridge } from '../wrapSwiftType.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'
import { combineSwiftCppConverters, type SwiftCppConverter } from '../SwiftConverter.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import { SwiftNamedType } from './SwiftNamedType.js'
import { SwiftPromiseType } from './SwiftPromiseType.js'
import type { SwiftResultType } from './SwiftResultType.js'
import { SwiftBorrowedPointerType } from './SwiftBorrowedPointerType.js'
import { SwiftOutPointerType } from './SwiftOutPointerType.js'
import { SwiftPointerType } from './SwiftPointerType.js'
import {
  createCppToSwiftCall,
  getSwiftBridgeParameters,
  getSwiftResultType,
  SWIFT_RESULT_STORAGE,
  type SwiftBridgeParameter,
} from '../SwiftMethodHelpers.js'

interface CppCallHelperOptions {
  name: string
  callbackAlias: string
  invocation: string
}

function getCppParameterDeclaration({ name, type }: SwiftBridgeParameter): string {
  const cppType = type.getCode('c++', { context: 'parameter' })
  return `${cppType} ${name}`
}

export class SwiftCallbackType extends CallbackType implements SwiftType {
  override readonly returnType: SwiftType
  override readonly parameters: SwiftNamedType[]
  readonly asyncResult: SwiftPromiseType

  constructor(
    readonly type: CallbackType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    const asyncResult = new SwiftPromiseType(new PromiseType(type.returnType), config)
    const returnType = asyncResult.resultingType
    const parameters = type.parameters.map((p, index) => new SwiftNamedType(`param${index}`, wrapSwiftTypeForBridge(p, config)))
    super(returnType, parameters, type.isInline)
    this.returnType = returnType
    this.parameters = parameters
    this.asyncResult = asyncResult
  }

  getCppConverter(cppType: Type): SwiftCppConverter {
    const callback = getTypeAs(cppType, CallbackType)
    const parameters = this.parameters.map((parameter, index) => {
      const nativeParameter = callback.parameters[index]
      if (nativeParameter == null) throw new Error(`Missing C++ callback parameter ${index}`)
      return parameter.getCppConverter(nativeParameter)
    })
    return combineSwiftCppConverters([this.returnType.getCppConverter?.(callback.returnType), ...parameters])
  }

  override get specializationName(): string {
    return (
      'Callback_' +
      [this.returnType, ...this.parameters].map((t) => escapeCppName(t.getCode('c++', { context: 'type-argument' }))).join('_')
    )
  }
  /** The bridge alias of the borrowed `Inline<...>` parameter. */
  get inlineSpecializationName(): string {
    return `Inline${this.specializationName}`
  }
  readonly isHashable = false
  get isSendable(): boolean {
    return !this.isInline
  }

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }

  get isReferenceType(): boolean {
    return false
  }
  readonly requiresSwiftGenericContext = true
  get containsSwiftGenerics(): boolean {
    return [this.returnType, ...this.parameters].some((type) => type.containsSwiftGenerics)
  }

  readonly canImportFromCpp = true

  // TODO: Remove once our minimum Xcode includes https://github.com/swiftlang/swift/pull/93321.
  // Two generated Swift headers must not both export this imported C++ record.
  // Inline callbacks use a module-owned facade instead; see createInlineCppHelpers().
  get requiresOpaqueCxxBridge(): boolean {
    return !this.isInline
  }

  get requiresExplicitSwiftTarget(): boolean {
    return this.returnType.requiresExplicitSwiftTarget || this.parameters.some((p) => p.requiresExplicitSwiftTarget)
  }
  get needsSwiftConversion(): boolean {
    return true
  }
  toSwift(value: string): string {
    return value
  }
  fromSwift(value: string): string {
    return `${value}.toCpp()`
  }

  override getCode(language: Language, options: GetCallbackCodeOptions): string {
    switch (language) {
      case 'c++':
        // Swift signatures omit the JS parameter names.
        return super.getCode(language, { ...options, includeNameInfo: false })
      case 'swift': {
        const namespace = this.config.getSwiftBridgeNamespace('swift')
        if (!this.isBorrowed(options)) {
          return `${namespace}.${this.specializationName}`
        }
        const type = `${namespace}.${this.inlineSpecializationName}`
        // Noncopyable parameters must state their ownership.
        return options.context === 'parameter' ? `borrowing ${type}` : type
      }
      default:
        return super.getCode(language, options)
    }
  }

  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  get importedCxxRecord(): ImportedCxxRecord {
    const parameters = this.parameters.map((p) => p.getClangImporterName('parameter')).join(', ')
    const returnType = this.returnType.getClangImporterName('return')
    // The C++ `Callback<R(Args...)>` has one function type argument, which Swift
    // names `((Args) -> R)`. The Swift protocol `Callback<Arguments, Return>` is unrelated.
    return {
      namespaces: ['margelo', 'nitro'],
      swiftName: `Callback<((${parameters}) -> ${returnType})>`,
      identifier: this.specializationName,
    }
  }
  getClangImporterName(context: TypeContext): string {
    const name = getQualifiedSwiftName(this.importedCxxRecord)
    return getClangImporterReferenceName(name, context)
  }

  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) return []
    const files = [
      ...this.parameters.flatMap((p) => p.getExtraFiles()),
      ...this.asyncResult.getExtraFiles(),
      ...createSwiftCallbackBridge(this),
    ]
    if (this.isInline) files.push(...createSwiftInlineCallbackBridge(this))
    return files
  }

  get requiredCppHelpers(): CppHelper[] {
    const helpers = [
      ...this.parameters.flatMap((p) => p.requiredCppHelpers),
      ...this.asyncResult.requiredCppHelpers,
      ...this.syncResult.requiredCppHelpers,
      ...this.createCppHelpers(),
    ]
    if (this.isInline) helpers.push(...this.createInlineCppHelpers())
    return helpers
  }

  override getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push(
          ...this.returnType.getRequiredImports(language, context),
          ...this.parameters.flatMap((p) => p.getRequiredImports(language, context)),
          {
            language: language,
            declaration: { header: 'NitroModules/Callback.hpp', space: 'system' },
          }
        )
        if (this.isInline) {
          imports.push({
            language: language,
            declaration: {
              header: 'NitroModules/InlineCallback.hpp',
              space: 'system',
            },
          })
        }
        break
      case 'swift':
        imports.push({
          language: language,
          name: `${NitroConfig.current.getIosModuleName()}AppleCxx`,
          access: 'internal',
        })
        break
      case 'kotlin':
        imports.push(...super.getRequiredImports(language))
        break
    }
    return imports
  }
  get syncResult(): SwiftResultType {
    return getSwiftResultType(this.adapterReturnType, this.config)
  }

  /** How the adapters pass parameters; Swift borrows those it cannot import. */
  get adapterParameters(): SwiftBridgeParameter[] {
    return this.parameters.map((parameter) => {
      let type: SwiftType
      if (parameter.canImportFromCpp) {
        type = parameter.type
      } else {
        type = new SwiftBorrowedPointerType(parameter.type)
      }
      return { name: parameter.escapedName, type: type }
    })
  }
  /** How the adapters return results; Swift provides storage for those it cannot import. */
  get adapterReturnType(): SwiftType {
    if (this.returnType.canImportFromCpp) return this.returnType
    return new SwiftOutPointerType(this.returnType)
  }
  /** Arguments the C++ adapters pass on, after loading borrowed Swift values. */
  private get cppAdapterArguments(): string[] {
    return this.adapterParameters.map(({ name, type }) => {
      if (type instanceof SwiftBorrowedPointerType) return type.load('c++', name)
      return name
    })
  }
  get needsAdapter(): boolean {
    // TODO: Remove this Promise-result workaround once our minimum supported
    // Swift toolchain includes https://github.com/swiftlang/swift/pull/93329.
    // Swift can omit std::function copy constructors when it instantiates the
    // Promise's JSI callbacks, so compile those calls in the C++ adapters.
    if (this.returnType.kind === 'promise') return true
    const adapterTypes = [this.adapterReturnType, ...this.adapterParameters.map((parameter) => parameter.type)]
    if (adapterTypes.some((type) => type instanceof SwiftPointerType)) {
      return true
    }
    // Swift's importer only sees forward declarations of swift::Optional and
    // swift::Array, so their JSI conversions must be compiled in C++ adapters.
    return this.containsSwiftGenerics
  }

  private createCppHelpers(): CppHelper[] {
    const alias = this.specializationName
    const callbackType = this.getCode('c++', { context: 'value' })
    const callbackAliasCode = `
using ${alias} = ${callbackType};
`.trim()
    const helpers: CppHelper[] = [
      {
        header: {
          code: callbackAliasCode,
          requiredImports: this.getRequiredImports('c++', 'declaration'),
        },
      },
    ]

    const returnType = this.returnType.getCode('c++', { context: 'return' })
    const adapterReturnType = this.adapterReturnType
    const adapterParameters = this.adapterParameters
    const parameters = this.parameters.map((p) => {
      const type = p.getCode('c++', { context: 'parameter' })
      return `${type} ${p.escapedName}`
    })
    const adapterParameterDeclarations = adapterParameters.map(getCppParameterDeclaration)
    const bridgeParameterDeclarations = getSwiftBridgeParameters(adapterParameters, adapterReturnType).map(getCppParameterDeclaration)
    const argumentsCpp = this.cppAdapterArguments
    const callParameters = [`const ${alias}& callback`, ...adapterParameterDeclarations]
    const imports = this.getRequiredImports('c++', 'implementation')
    const syncResultType = this.syncResult.getCode('c++', { context: 'return' })
    const isVoid = this.returnType.kind === 'void'
    const swiftToCppSyncInvocation = `callback.callSync(${argumentsCpp.join(', ')})`
    helpers.push(
      this.createCppCallHelper({
        name: `callSync_${alias}`,
        callbackAlias: alias,
        invocation: swiftToCppSyncInvocation,
      })
    )
    if (this.needsAdapter) {
      const asyncSignature = `Promise<${returnType}> callAsync_${alias}(${callParameters.join(', ')})`
      const forgetSignature = `void callAndForget_${alias}(${callParameters.join(', ')})`
      const swiftToCppAsyncDeclarationCode = `
${asyncSignature};
`.trim()
      const swiftToCppAsyncImplementationCode = `
${asyncSignature} {
  return callback.callAsync(${argumentsCpp.join(', ')});
}
`.trim()
      const swiftToCppForgetDeclarationCode = `
${forgetSignature};
`.trim()
      const swiftToCppForgetImplementationCode = `
${forgetSignature} {
  callback.callAndForget(${argumentsCpp.join(', ')});
}
`.trim()
      helpers.push(
        {
          header: { code: swiftToCppAsyncDeclarationCode, requiredImports: [] },
          implementation: {
            code: swiftToCppAsyncImplementationCode,
            requiredImports: imports,
          },
        },
        {
          header: {
            code: swiftToCppForgetDeclarationCode,
            requiredImports: [],
          },
          implementation: {
            code: swiftToCppForgetImplementationCode,
            requiredImports: imports,
          },
        }
      )
    }

    const cppToSwiftBody = createCppToSwiftCall({
      parameters: adapterParameters,
      returnType: adapterReturnType,
      returnsVoid: isVoid,
      getCppInvocation: (args) => `closure(${args.join(', ')})`,
    })
    const signature = `${alias} create_${alias}(std::function<${syncResultType}(${bridgeParameterDeclarations.join(', ')})> closure)`
    const cppToSwiftDeclarationCode = `
${signature};
`.trim()
    const cppToSwiftImplementationCode = `
${signature} {
  return ${alias}::make([closure = std::move(closure)](${parameters.join(', ')}) -> ${returnType} {
    ${indent(cppToSwiftBody, '    ')}
  });
}
`.trim()
    const cppToSwiftImports = [...imports]
    if (this.needsAdapter) {
      cppToSwiftImports.push({
        language: 'c++',
        declaration: {
          header: 'NitroModules/SwiftResult.hpp',
          space: 'system',
        },
      })
    }
    helpers.push({
      header: { code: cppToSwiftDeclarationCode, requiredImports: [] },
      implementation: {
        code: cppToSwiftImplementationCode,
        requiredImports: cppToSwiftImports,
      },
    })
    return helpers
  }
  /** Aliases the borrowed callback and lets Swift call it through a `Result`. */
  private createInlineCppHelpers(): CppHelper[] {
    const alias = this.inlineSpecializationName
    const owningAlias = this.specializationName
    const callbackType = this.getCode('c++', { context: 'parameter-type' })
    const callbackAliasCode = `
// TODO: Replace this borrowing facade with a typealias once our minimum Xcode includes
// https://github.com/swiftlang/swift/pull/93321, which fixes https://github.com/swiftlang/swift/issues/93318.
// Exporting the same imported InlineCallback specialization from two Swift headers duplicates its traits.
class SWIFT_NONCOPYABLE SWIFT_NONESCAPABLE SWIFT_CONFORMS_TO_PROTOCOL(NitroModules.CxxInlineCallback) ${alias} final {
public:
  ${alias}(const ${callbackType}& callback [[clang::lifetimebound]]) : _callback(std::addressof(callback)) {}
  ${alias}(const ${alias}&) = delete;
  ${alias}(${alias}&&) = default;

  const ${callbackType}& get() const SWIFT_PRIVATE {
    return *_callback;
  }
  ${owningAlias} escape() const;

private:
  const ${callbackType}* NON_NULL _callback;
};
`.trim()
    const escapeCode = `
${owningAlias} ${alias}::escape() const {
  return get().escape();
}
`.trim()
    const argumentsCpp = this.cppAdapterArguments
    const swiftToCppInlineInvocation = `callback.get().call(${argumentsCpp.join(', ')})`
    return [
      {
        header: {
          code: callbackAliasCode,
          requiredImports: [
            ...this.getRequiredImports('c++', 'declaration'),
            { language: 'c++', declaration: { header: 'memory', space: 'system' } },
          ],
        },
        implementation: {
          code: escapeCode,
          requiredImports: this.getRequiredImports('c++', 'implementation'),
        },
      },
      this.createCppCallHelper({
        name: `call_${alias}`,
        callbackAlias: alias,
        invocation: swiftToCppInlineInvocation,
      }),
    ]
  }

  /** Swift calls a callback synchronously through a noexcept `Result` bridge. */
  private createCppCallHelper({ name, callbackAlias, invocation }: CppCallHelperOptions): CppHelper {
    // TODO: Replace this Result bridge with SWIFT_THROWS once
    // https://github.com/swiftlang/swift/pull/92569 and its dependencies are
    // merged, available in our minimum Swift toolchain, and support our reference
    // and aggregate callback signatures. Native Swift callbacks still need the
    // reverse error bridge in createCppHelpers().
    const adapterReturnType = this.adapterReturnType
    const bridgeParameterDeclarations = getSwiftBridgeParameters(this.adapterParameters, adapterReturnType).map(getCppParameterDeclaration)
    const syncResultType = this.syncResult.getCode('c++', { context: 'return' })
    const syncParameters = [`const ${callbackAlias}& callback`, ...bridgeParameterDeclarations]
    const syncSignature = `${syncResultType} ${name}(${syncParameters.join(', ')}) noexcept`
    let swiftToCppSyncBody: string
    if (this.returnType.kind === 'void') {
      swiftToCppSyncBody = `
${invocation};
return ${syncResultType}::withValue();
`.trim()
    } else if (adapterReturnType instanceof SwiftOutPointerType) {
      const initializeCode = adapterReturnType.initialize('c++', SWIFT_RESULT_STORAGE, invocation)
      swiftToCppSyncBody = `
${initializeCode};
return ${syncResultType}::withValue();
`.trim()
    } else {
      swiftToCppSyncBody = `
return ${syncResultType}::withValue(${invocation});
`.trim()
    }
    const swiftToCppSyncDeclarationCode = `
${syncSignature};
`.trim()
    const swiftToCppSyncImplementationCode = `
${syncSignature} {
  try {
    ${indent(swiftToCppSyncBody, '    ')}
  } catch (...) {
    return ${syncResultType}::withError(std::current_exception());
  }
}
`.trim()
    return {
      header: { code: swiftToCppSyncDeclarationCode, requiredImports: [] },
      implementation: {
        code: swiftToCppSyncImplementationCode,
        requiredImports: this.getRequiredImports('c++', 'implementation'),
      },
    }
  }
}
