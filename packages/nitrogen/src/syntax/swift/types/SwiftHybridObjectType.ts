import type { Type, GetCodeOptions, TypeContext } from '../../types/Type.js'
import { indent } from '../../../utils.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceFile } from '../../SourceFile.js'
import { getHybridObjectName } from '../../getHybridObjectName.js'
import { HybridObjectType } from '../../types/HybridObjectType.js'
import {
  createSwiftHybridObjectConverter,
  createSwiftHybridObjectCppConverter,
  getHybridObjectBridgeNames,
} from '../SwiftHybridObjectHelpers.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../../c++/getForwardDeclaration.js'
import type { SourceImport } from '../../SourceFile.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import { SwiftRetainedPointerType } from './SwiftRetainedPointerType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'
import type { SwiftCppConverter } from '../SwiftConverter.js'

export class SwiftHybridObjectType extends HybridObjectType implements SwiftType {
  override readonly baseTypes: SwiftHybridObjectType[]

  constructor(readonly type: HybridObjectType) {
    const baseTypes = type.baseTypes.map((base) => new SwiftHybridObjectType(base))
    super(type.hybridObjectName, type.platforms, baseTypes, type.sourceConfig)
    this.baseTypes = baseTypes
  }

  getCppConverter(cppType: Type): SwiftCppConverter {
    return createSwiftHybridObjectCppConverter({ type: this, cppType: cppType })
  }

  getProtocolConformances(): ProtocolConformance[] {
    const apple = this.platforms.apple
    if (apple?.language !== 'swift') {
      throw new Error(`${this.hybridObjectName}: Swift protocol conformances require an \`@Apple(...)\` declaration with language 'swift'.`)
    }
    const conformances: ProtocolConformance[] = [
      {
        name: 'HybridObject',
        requiredImport: {
          language: 'swift',
          name: 'NitroModules',
          access: 'public',
        },
      },
    ]
    for (const base of this.baseTypes) {
      const name = getHybridObjectName(base.hybridObjectName)
      const conformance: ProtocolConformance = {
        name: `${name.HybridTSpec}_protocol`,
      }
      if (base.sourceConfig.isExternalConfig) {
        conformance.requiredImport = {
          language: 'swift',
          name: base.sourceConfig.getAppleModuleName(),
          access: 'public',
        }
      }
      conformances.push(conformance)
    }
    for (const protocol of apple.protocolConformances) {
      const conformance: ProtocolConformance = { name: protocol.protocol }
      let module = protocol.module
      if (module == null && this.sourceConfig.isExternalConfig) {
        module = this.sourceConfig.getAppleModuleName()
      }
      if (module != null) {
        conformance.requiredImport = {
          language: 'swift',
          name: module,
          access: 'public',
        }
      }
      conformances.push(conformance)
    }
    return conformances
  }

  get name(): string {
    return getHybridObjectName(this.type.hybridObjectName).HybridTSpecCxx
  }
  override get isEquatable(): boolean {
    // HybridObject protocol existentials do not conform to Equatable.
    return false
  }
  get moduleName(): string {
    return this.type.sourceConfig.getAppleModuleName()
  }
  readonly requiresExplicitSwiftTarget = false

  get needsSwiftConversion(): boolean {
    return true
  }
  fromSwift(value: string): string {
    return `${value}.getCxxWrapper()`
  }
  toSwift(value: string): string {
    return `${value}.get${getHybridObjectName(this.type.hybridObjectName).HybridTSpec}()`
  }

  override getExtraFiles(): SourceFile[] {
    // External converters are provided by their module's private umbrella.
    if (this.sourceConfig.isExternalConfig) return []
    return createSwiftHybridObjectConverter(this)
  }

  readonly isHashable = false
  readonly isSendable = false

  get isReferenceType(): boolean {
    return true
  }
  readonly requiresSwiftGenericContext = true
  get containsSwiftGenerics(): boolean {
    return false
  }

  readonly canImportFromCpp = false
  get forwardDeclaration(): string {
    return getForwardDeclaration('class', this.name, this.moduleName)
  }

  /** The header declaring the C++ class that wraps this Swift implementation. */
  getCxxPartHeader(): { header: string; space: 'user' | 'system' } {
    const { HybridTSpecSwift } = getHybridObjectName(this.hybridObjectName)
    return this.sourceConfig.getCxxHeader(`${HybridTSpecSwift}.hpp`, 'private')
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    const apple = this.platforms.apple
    if (apple == null) {
      throw new Error(`HybridObject "${this.hybridObjectName}" is not implemented on Apple platforms and cannot be referenced from Swift.`)
    }
    if (apple.language !== 'swift') {
      throw new Error(
        `HybridObject "${this.hybridObjectName}" is implemented in ${apple.language} on Apple platforms, but this reference requires Swift. Cross-language HybridObject references are currently supported only in C++ APIs.`
      )
    }

    switch (language) {
      case 'c++': {
        const type = `::${this.moduleName}::${this.name}`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return this.name
      default:
        return super.getCode(language, options)
    }
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(context: TypeContext): string {
    return getClangImporterReferenceName(`${this.moduleName}.${this.name}`, context)
  }

  get requiredCppHelpers(): CppHelper[] {
    return [...this.baseTypes.flatMap((base) => base.requiredCppHelpers), ...this.createCppHelpers()]
  }

  override getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language: language,
          declaration: { forwardDeclaration: this.forwardDeclaration },
        })
        if (context === 'implementation') {
          imports.push({
            language: language,
            declaration: this.sourceConfig.getCxxHeader(`${this.name}-Swift.hpp`, 'private'),
          })
        }
        break
      case 'swift':
      case 'kotlin':
        imports.push(...super.getRequiredImports(language))
        break
    }
    return imports
  }
  private createCppHelpers(): CppHelper[] {
    const type = this.type
    const bridge = getHybridObjectBridgeNames(type)
    const names = getHybridObjectName(type.hybridObjectName)
    const headerImports: SourceImport[] = [
      {
        language: 'c++',
        declaration: { header: 'NitroModules/HybridObject.hpp', space: 'system' },
      },
      {
        language: 'c++',
        declaration: {
          forwardDeclaration: getForwardDeclaration('class', names.HybridTSpecSwift, type.sourceConfig.getCxxNamespace('c++')),
        },
      },
      {
        language: 'c++',
        declaration: {
          header: 'NitroModules/NitroDefines.hpp',
          space: 'system',
        },
      },
    ]
    const pointer = new SwiftRetainedPointerType(this)
    const pointerParameterType = pointer.getCode('c++', {
      context: 'parameter',
    })
    const pointerReturnType = pointer.getCode('c++', { context: 'return' })
    const createSignature = `${bridge.strong} ${bridge.create}(${pointerParameterType} pointer)`
    const getSignature = `${pointerReturnType} ${bridge.get}(const std::shared_ptr<HybridObject>& value)`
    let createBody: string
    let getBody: string
    let implementationImports: SourceImport[]
    if (type.sourceConfig.isExternalConfig) {
      const namespace = type.sourceConfig.getSwiftBridgeNamespace('c++')
      const localNames = getHybridObjectBridgeNames(type)
      createBody = `
return ${namespace}::${localNames.create}(pointer);
`.trim()
      getBody = `
return ${namespace}::${localNames.get}(value);
`.trim()
      implementationImports = [
        {
          language: 'c++',
          declaration: type.sourceConfig.getAppleCxxHeader(),
        },
      ]
    } else {
      const implementation = type.sourceConfig.getCxxNamespace('c++', names.HybridTSpecSwift)
      const swiftPart = pointer.take('c++', 'pointer')
      const swiftPartPointer = pointer.retain('c++', 'wrapper->getSwiftPart()')
      createBody = `
return std::make_shared<${implementation}>(${swiftPart});
`.trim()
      getBody = `
auto wrapper = std::dynamic_pointer_cast<${implementation}>(value);
if (!wrapper) throw std::runtime_error("${names.HybridTSpec} is not implemented in Swift");
return ${swiftPartPointer};
`.trim()
      implementationImports = [{ language: 'c++', declaration: this.getCxxPartHeader() }]
    }
    const createImplementation = `
${createSignature} {
  ${indent(createBody, '  ')}
}
`.trim()
    const getImplementation = `
${getSignature} {
  ${indent(getBody, '  ')}
}
`.trim()
    const weakifyImplementation = `
inline ${bridge.weak} ${bridge.weakify}(const ${bridge.strong}& value) {
  return value;
}
`.trim()
    return [
      {
        header: {
          code: `using ${bridge.strong} = std::shared_ptr<${type.sourceConfig.getCxxNamespace('c++', names.HybridTSpecSwift)}>;`,
          requiredImports: headerImports,
        },
      },
      {
        header: {
          code: `using ${bridge.weak} = std::weak_ptr<${type.sourceConfig.getCxxNamespace('c++', names.HybridTSpecSwift)}>;`,
          requiredImports: headerImports,
        },
      },
      {
        header: {
          code: weakifyImplementation,
          requiredImports: [],
        },
      },
      {
        header: { code: `${createSignature};`, requiredImports: [] },
        implementation: {
          code: createImplementation,
          requiredImports: implementationImports,
        },
      },
      {
        header: { code: `${getSignature};`, requiredImports: [] },
        implementation: {
          code: getImplementation,
          requiredImports: implementationImports,
        },
      },

      ...type.baseTypes.map((base): CppHelper => {
        const baseNames = getHybridObjectName(base.hybridObjectName)
        const baseType = `std::shared_ptr<${base.sourceConfig.getCxxNamespace('c++', baseNames.HybridTSpecSwift)}>`
        const signature = `${baseType} upcast_${type.hybridObjectName}_to_${base.hybridObjectName}(const ${bridge.strong}& value)`
        const implementation = `
${signature} {
  return value;
}
`.trim()
        const baseImport: SourceImport = {
          language: 'c++',
          declaration: {
            forwardDeclaration: getForwardDeclaration('class', baseNames.HybridTSpecSwift, base.sourceConfig.getCxxNamespace('c++')),
          },
        }
        return {
          header: {
            code: `${signature};`,
            requiredImports: [...headerImports, baseImport],
          },
          implementation: {
            code: implementation,
            requiredImports: [{ language: 'c++', declaration: this.getCxxPartHeader() }],
          },
        }
      }),
    ]
  }
}
