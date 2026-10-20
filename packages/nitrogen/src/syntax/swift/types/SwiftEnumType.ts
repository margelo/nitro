import type { GetCodeOptions } from '../../types/Type.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceFile } from '../../SourceFile.js'
import { EnumType } from '../../types/EnumType.js'
import { createSwiftEnumBridge } from '../SwiftEnum.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../../c++/getForwardDeclaration.js'
import type { SourceImport } from '../../SourceFile.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

export class SwiftEnumType extends EnumType implements SwiftType {
  constructor(readonly type: EnumType) {
    super(type)
  }

  get name(): string {
    return this.type.enumName
  }
  override getExtraFiles(): SourceFile[] {
    return createSwiftEnumBridge(this)
  }

  readonly isHashable = true
  readonly isSendable = true

  getProtocolConformances(): ProtocolConformance[] {
    return [
      { name: 'CaseIterable' },
      { name: 'Sendable' },
      { name: 'CustomStringConvertible' },
    ]
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
  readonly requiresExplicitSwiftTarget = false
  fromSwift(value: string): string {
    return value
  }
  toSwift(value: string): string {
    return value
  }

  get moduleName(): string {
    return NitroConfig.current.getIosModuleName()
  }
  get forwardDeclaration(): string {
    return getForwardDeclaration('class', this.name, this.moduleName)
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return `${this.moduleName}::${this.name}`
      case 'swift':
        return this.name
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
          imports.push({
            language: language,
            declaration: NitroConfig.current.getCxxHeader(
              `${this.name}-Swift.hpp`,
              'private'
            ),
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
}
