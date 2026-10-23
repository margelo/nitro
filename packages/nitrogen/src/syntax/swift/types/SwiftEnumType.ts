import type { Type, GetCodeOptions } from '../../types/Type.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceFile } from '../../SourceFile.js'
import { EnumType } from '../../types/EnumType.js'
import { createSwiftEnumBridge, createSwiftEnumCppConverter } from '../SwiftEnum.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../../c++/getForwardDeclaration.js'
import type { SourceImport } from '../../SourceFile.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'
import type { SwiftCppConverter } from '../SwiftConverter.js'

export class SwiftEnumType extends EnumType implements SwiftType {
  constructor(
    readonly type: EnumType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    super(type)
  }

  getCppConverter(cppType: Type): SwiftCppConverter {
    return createSwiftEnumCppConverter({ type: this, cppType: cppType })
  }

  get name(): string {
    return this.type.enumName
  }
  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) {
      return []
    }
    return createSwiftEnumBridge(this)
  }

  readonly isHashable = true
  readonly isSendable = true

  getProtocolConformances(): ProtocolConformance[] {
    return [{ name: 'CaseIterable' }, { name: 'Sendable' }, { name: 'CustomStringConvertible' }]
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
      case 'c++':
        return `::${this.moduleName}::${this.name}`
      case 'swift':
        return this.config.isExternalConfig ? `${this.moduleName}.${this.name}` : this.name
      default:
        return super.getCode(language, options)
    }
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(): string {
    return `${this.moduleName}.${this.name}`
  }

  get requiredCppHelpers(): CppHelper[] {
    return []
  }

  override getRequiredImports(language: Language, context: 'declaration' | 'implementation' = 'implementation'): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
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
