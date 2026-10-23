import type { Type, GetCodeOptions, TypeContext } from '../../types/Type.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceFile } from '../../SourceFile.js'
import { RecordType } from '../../types/RecordType.js'
import { createSwiftRecordBridge, createSwiftRecordCppConverter } from '../SwiftRecord.js'
import { wrapSwiftType } from '../wrapSwiftType.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../../c++/getForwardDeclaration.js'
import type { SourceImport } from '../../SourceFile.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'
import type { SwiftCppConverter } from '../SwiftConverter.js'

export class SwiftRecordType extends RecordType implements SwiftType {
  override readonly keyType: SwiftType
  override readonly valueType: SwiftType

  constructor(
    readonly type: RecordType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    const keyType = wrapSwiftType(type.keyType, config)
    const valueType = wrapSwiftType(type.valueType, config)
    super(keyType, valueType)
    this.keyType = keyType
    this.valueType = valueType
  }

  getCppConverter(cppType: Type): SwiftCppConverter {
    return createSwiftRecordCppConverter({ type: this, cppType: cppType })
  }

  get name(): string {
    return this.specializationName
  }
  readonly requiresExplicitSwiftTarget = true

  get needsSwiftConversion(): boolean {
    return true
  }
  fromSwift(value: string): string {
    return `${this.name}(${value})`
  }
  toSwift(value: string): string {
    return `${value}.dictionary`
  }

  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) return []
    return [...this.keyType.getExtraFiles(), ...this.valueType.getExtraFiles(), ...createSwiftRecordBridge(this)]
  }

  get isHashable(): boolean {
    return this.keyType.isHashable && this.valueType.isHashable
  }

  get isSendable(): boolean {
    return this.keyType.isSendable && this.valueType.isSendable
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
    return [...this.keyType.requiredCppHelpers, ...this.valueType.requiredCppHelpers]
  }

  override getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push(...this.keyType.getRequiredImports(language, context), ...this.valueType.getRequiredImports(language, context), {
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
        break
      case 'kotlin':
        imports.push(...super.getRequiredImports(language))
        break
    }
    return imports
  }
}
