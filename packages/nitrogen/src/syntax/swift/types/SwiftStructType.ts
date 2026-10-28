import type { Type, GetCodeOptions, TypeContext } from '../../types/Type.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceFile } from '../../SourceFile.js'
import { StructType } from '../../types/StructType.js'
import { createSwiftStructBridge, createSwiftStructCppConverter } from '../SwiftStruct.js'
import { wrapSwiftType } from '../wrapSwiftType.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../../c++/getForwardDeclaration.js'
import type { SourceImport } from '../../SourceFile.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'
import type { SwiftCppConverter } from '../SwiftConverter.js'
import { SwiftNamedType } from './SwiftNamedType.js'

export class SwiftStructType extends StructType implements SwiftType {
  override readonly properties: SwiftNamedType[]

  constructor(
    readonly type: StructType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    const properties = type.properties.map((p) => new SwiftNamedType(p.name, wrapSwiftType(p, config)))
    super(type.structName, properties, type.sourceConfig)
    this.properties = properties
  }

  getCppConverter(cppType: Type): SwiftCppConverter {
    return createSwiftStructCppConverter({ type: this, cppType: cppType })
  }

  get name(): string {
    return this.type.structName
  }
  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) {
      return []
    }
    return [...this.properties.flatMap((p) => p.getExtraFiles()), ...createSwiftStructBridge(this)]
  }

  get isHashable(): boolean {
    return this.properties.every((property) => property.isHashable)
  }

  get isSendable(): boolean {
    return this.properties.every((property) => property.isSendable)
  }

  getProtocolConformances(): ProtocolConformance[] {
    const conformances: ProtocolConformance[] = []
    if (this.isEquatable) conformances.push({ name: 'Equatable' })
    if (this.isHashable) conformances.push({ name: 'Hashable' })
    if (this.isSendable) conformances.push({ name: 'Sendable' })
    return conformances
  }

  get isReferenceType(): boolean {
    return false
  }
  readonly requiresSwiftGenericContext = true
  get containsSwiftGenerics(): boolean {
    return false
  }

  readonly canImportFromCpp = false
  readonly needsSwiftConversion = false
  get requiresExplicitSwiftTarget(): boolean {
    return this.config.isExternalConfig
  }
  fromSwift(value: string): string {
    return value
  }
  toSwift(value: string): string {
    return value
  }

  get moduleName(): string {
    return this.config.getAppleModuleName()
  }
  get forwardDeclaration(): string {
    return getForwardDeclaration('class', this.name, this.moduleName)
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = `::${this.moduleName}::${this.name}`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return this.config.isExternalConfig ? `${this.moduleName}.${this.name}` : this.name
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
    return this.properties.flatMap((p) => p.requiredCppHelpers)
  }

  override getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push(...this.properties.flatMap((p) => p.getRequiredImports(language, context)), {
          language,
          declaration: { forwardDeclaration: this.forwardDeclaration },
        })
        if (context === 'implementation') {
          imports.push({
            language: language,
            declaration: this.config.getCxxHeader(`${this.name}-Swift.hpp`, 'private'),
          })
        }
        break
      case 'swift':
        if (this.config.isExternalConfig) {
          imports.push({ language: 'swift', name: this.moduleName, access: 'public' })
        }
        break
      case 'kotlin':
        imports.push(...super.getRequiredImports(language))
        break
    }
    return imports
  }
}
