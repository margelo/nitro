import type { GetCodeOptions, TypeContext } from '../../types/Type.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import { indent } from '../../../utils.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceFile } from '../../SourceFile.js'
import { getHybridObjectName } from '../../getHybridObjectName.js'
import { HybridObjectType } from '../../types/HybridObjectType.js'
import {
  createSwiftHybridObjectConverter,
  getHybridObjectBridgeNames,
} from '../SwiftHybridObjectHelpers.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../../c++/getForwardDeclaration.js'
import type { SourceImport } from '../../SourceFile.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import { SwiftRetainedPointerType } from './SwiftRetainedPointerType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

export class SwiftHybridObjectType
  extends HybridObjectType
  implements SwiftType
{
  override readonly baseTypes: SwiftHybridObjectType[]

  constructor(readonly type: HybridObjectType) {
    const baseTypes = type.baseTypes.map(
      (base) => new SwiftHybridObjectType(base)
    )
    super(
      type.hybridObjectName,
      type.implementationLanguage,
      baseTypes,
      type.sourceConfig,
      type.swiftProtocolConformances
    )
    this.baseTypes = baseTypes
  }

  getProtocolConformances(): ProtocolConformance[] {
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
          name: base.sourceConfig.getIosModuleName(),
          access: 'public',
        }
      }
      conformances.push(conformance)
    }
    for (const protocol of this.swiftProtocolConformances) {
      const conformance: ProtocolConformance = { name: protocol.protocol }
      let module = protocol.module
      if (module == null && this.sourceConfig.isExternalConfig) {
        module = this.sourceConfig.getIosModuleName()
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
    return this.type.sourceConfig.getIosModuleName()
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
  getCxxPartHeader(): { name: string; space: 'user' | 'system' } {
    const { HybridTSpecSwift } = getHybridObjectName(this.hybridObjectName)
    return this.sourceConfig.getCxxHeader(`${HybridTSpecSwift}.hpp`, 'private')
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = `${this.moduleName}::${this.name}`
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
    return getClangImporterReferenceName(
      `${this.moduleName}.${this.name}`,
      context
    )
  }

  get requiredCppHelpers(): CppHelper[] {
    return [
      ...this.baseTypes.flatMap((base) => base.requiredCppHelpers),
      ...this.createCppHelpers(),
    ]
  }

  override getRequiredImports(
    language: Language,
    context: 'declaration' | 'implementation' = 'implementation'
  ): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { forwardDeclaration: this.forwardDeclaration },
        })
        if (context === 'implementation') {
          imports.push(...this.type.getRequiredImports(language))
          if (!this.sourceConfig.isExternalConfig) {
            imports.push({
              language: language,
              declaration: this.sourceConfig.getCxxHeader(
                `${this.name}-Swift.hpp`,
                'private'
              ),
            })
          }
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
      ...type.getRequiredImports('c++'),
      {
        language: 'c++',
        declaration: {
          name: 'NitroModules/NitroDefines.hpp',
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
    const getSignature = `${pointerReturnType} ${bridge.get}(const ${bridge.strong}& value)`
    let createBody: string
    let getBody: string
    let implementationImports: SourceImport[]
    if (type.sourceConfig.isExternalConfig) {
      const namespace = type.sourceConfig.getSwiftBridgeNamespace('c++')
      const localNames = getHybridObjectBridgeNames(
        new HybridObjectType(
          type.hybridObjectName,
          type.implementationLanguage,
          [],
          NitroConfig.current
        )
      )
      createBody = `return ${namespace}::${localNames.create}(pointer);`
      getBody = `return ${namespace}::${localNames.get}(value);`
      implementationImports = [
        {
          language: 'c++',
          declaration: type.sourceConfig.getAppleCxxHeader(),
        },
      ]
    } else {
      const implementation = type.sourceConfig.getCxxNamespace(
        'c++',
        names.HybridTSpecSwift
      )
      const swiftPart = pointer.take('c++', 'pointer')
      const swiftPartPointer = pointer.retain('c++', 'wrapper->getSwiftPart()')
      createBody = `return std::make_shared<${implementation}>(${swiftPart});`
      getBody = `auto wrapper = std::dynamic_pointer_cast<${implementation}>(value);
if (!wrapper) throw std::runtime_error("${names.HybridTSpec} is not implemented in Swift");
return ${swiftPartPointer};`
      implementationImports = [
        { language: 'c++', declaration: this.getCxxPartHeader() },
      ]
    }
    return [
      {
        header: {
          code: `using ${bridge.strong} = ${type.getCode('c++', { context: 'value' })};`,
          requiredImports: headerImports,
        },
      },
      {
        header: {
          code: `using ${bridge.weak} = ${type.getCode('c++', { context: 'value', mode: 'weak' })};`,
          requiredImports: headerImports,
        },
      },
      {
        header: {
          code: `inline ${bridge.weak} ${bridge.weakify}(const ${bridge.strong}& value) { return value; }`,
          requiredImports: [],
        },
      },
      {
        header: { code: `${createSignature};`, requiredImports: [] },
        implementation: {
          code: `${createSignature} {\n  ${indent(createBody, '  ')}\n}`,
          requiredImports: implementationImports,
        },
      },
      {
        header: { code: `${getSignature};`, requiredImports: [] },
        implementation: {
          code: `${getSignature} {\n  ${indent(getBody, '  ')}\n}`,
          requiredImports: implementationImports,
        },
      },
      ...type.baseTypes.map((base): CppHelper => {
        const signature = `${base.getCode('c++', { context: 'value' })} upcast_${type.hybridObjectName}_to_${base.hybridObjectName}(const ${bridge.strong}& value)`
        const imports = [...headerImports, ...base.getRequiredImports('c++')]
        return {
          header: {
            code: `${signature};`,
            requiredImports: imports,
          },
          implementation: {
            code: `${signature} { return value; }`,
            requiredImports: imports,
          },
        }
      }),
    ]
  }
}
