import type { Type, GetCodeOptions, TypeContext } from '../../types/Type.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { escapeCppName } from '../../helpers.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { PromiseType } from '../../types/PromiseType.js'
import { createSwiftPromiseBridge } from '../SwiftPromise.js'
import { getClangImporterReferenceName, getQualifiedSwiftName, type ImportedCxxRecord } from '../ImportedCxxRecord.js'
import { wrapSwiftTypeForBridge } from '../wrapSwiftType.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'
import { combineSwiftCppConverters, type SwiftCppConverter } from '../SwiftConverter.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import { SwiftBorrowedPointerType } from './SwiftBorrowedPointerType.js'
import { indent } from '../../../utils.js'

export class SwiftPromiseType extends PromiseType implements SwiftType {
  override readonly resultingType: SwiftType

  constructor(
    readonly type: PromiseType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    const resultingType = wrapSwiftTypeForBridge(type.resultingType, config)
    super(resultingType)
    this.resultingType = resultingType
  }

  override get specializationName(): string {
    return `Promise_${escapeCppName(this.resultingType.getCode('c++', { context: 'type-argument' }))}`
  }
  readonly isHashable = false
  readonly isSendable = true

  getProtocolConformances(): ProtocolConformance[] {
    return []
  }

  getCppConverter(cppType: Type): SwiftCppConverter {
    const nativeType = getTypeAs(cppType, PromiseType)
    return combineSwiftCppConverters([this.resultingType.getCppConverter?.(nativeType.resultingType)])
  }

  get isReferenceType(): boolean {
    return false
  }
  readonly requiresSwiftGenericContext = true
  get containsSwiftGenerics(): boolean {
    return this.resultingType.containsSwiftGenerics
  }

  readonly canImportFromCpp = true
  // TODO: Remove once our minimum Xcode includes https://github.com/swiftlang/swift/pull/93321.
  readonly requiresOpaqueCxxBridge = true

  get requiresExplicitSwiftTarget(): boolean {
    return this.resultingType.requiresExplicitSwiftTarget
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

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const resultingCode = this.resultingType.getCode(language, {
          ...options,
          context: 'type-argument',
        })
        const type = `Promise<${resultingCode}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return `${this.config.getSwiftBridgeNamespace('swift')}.${this.specializationName}`
      default:
        return super.getCode(language, options)
    }
  }

  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  get importedCxxRecord(): ImportedCxxRecord {
    const resultingType = this.resultingType.getClangImporterName('type-argument')
    return {
      namespaces: ['margelo', 'nitro'],
      swiftName: `Promise<${resultingType}>`,
      identifier: this.specializationName,
    }
  }
  getClangImporterName(context: TypeContext): string {
    const name = getQualifiedSwiftName(this.importedCxxRecord)
    return getClangImporterReferenceName(name, context)
  }

  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) return []
    return [...this.resultingType.getExtraFiles(), ...createSwiftPromiseBridge(this)]
  }

  get requiredCppHelpers(): CppHelper[] {
    return [...this.resultingType.requiredCppHelpers, ...this.createCppHelpers()]
  }

  override getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push(...this.resultingType.getRequiredImports(language, context), {
          language,
          declaration: { header: 'NitroModules/Promise.hpp', space: 'system' },
        })
        break
      case 'swift':
        imports.push({
          language,
          name: `${NitroConfig.current.getAppleModuleName()}AppleCxx`,
          access: 'internal',
        })
        break
      case 'kotlin':
        imports.push(...super.getRequiredImports(language))
        break
    }
    return imports
  }
  /** How the adapters pass resolved values; Swift borrows those it cannot import. */
  get adapterResultingType(): SwiftType {
    if (this.resultingType.canImportFromCpp) return this.resultingType
    return new SwiftBorrowedPointerType(this.resultingType)
  }

  private createCppHelpers(): CppHelper[] {
    const alias = this.specializationName
    const helpers: CppHelper[] = [
      {
        header: {
          code: `using ${alias} = ${this.getCode('c++', { context: 'value' })};`,
          requiredImports: this.getRequiredImports('c++', 'declaration'),
        },
      },
    ]
    const resolvedType = this.adapterResultingType
    if (!(resolvedType instanceof SwiftBorrowedPointerType)) return helpers

    const imports = this.getRequiredImports('c++', 'implementation')
    const pointerType = resolvedType.getCode('c++', { context: 'parameter' })
    const createSignature = `${alias} create_${alias}()`
    const rejectSignature = `void reject_${alias}(const ${alias}& promise, std::exception_ptr error)`
    const rejectedSignature = `void listenRejected_${alias}(const ${alias}& promise, std::function<void(const std::exception_ptr&)> listener)`
    const resolveSignature = `void resolve_${alias}(const ${alias}& promise, ${pointerType} value)`
    const listenSignature = `void listen_${alias}(const ${alias}& promise, std::function<void(${pointerType})> listener)`
    const payload = this.resultingType.getCode('c++', {
      context: 'type-argument',
    })
    const resolvedValue = resolvedType.load('c++', 'value')
    const listenerCode = resolvedType.borrow('c++', {
      value: 'value',
      pointer: 'pointer',
      body: 'listener(pointer);',
    })
    helpers.push(
      {
        header: { code: `${createSignature};`, requiredImports: [] },
        implementation: {
          code: `${createSignature} { return ${alias}::pending(); }`,
          requiredImports: imports,
        },
      },
      {
        header: { code: `${rejectSignature};`, requiredImports: [] },
        implementation: {
          code: `${rejectSignature} { promise.reject(std::move(error)); }`,
          requiredImports: imports,
        },
      },
      {
        header: { code: `${rejectedSignature};`, requiredImports: [] },
        implementation: {
          code: `${rejectedSignature} { promise.addOnRejectedListener(std::move(listener)); }`,
          requiredImports: imports,
        },
      },
      {
        header: { code: `${resolveSignature};`, requiredImports: [] },
        implementation: {
          code: `${resolveSignature} {
  promise.resolve(${resolvedValue});
}`,
          requiredImports: imports,
        },
      },
      {
        header: { code: `${listenSignature};`, requiredImports: [] },
        implementation: {
          code: `${listenSignature} {
  promise.addOnResolvedListener([listener = std::move(listener)](const ${payload}& value) {
    ${indent(listenerCode, '    ')}
  });
}`,
          requiredImports: imports,
        },
      }
    )
    return helpers
  }
}
