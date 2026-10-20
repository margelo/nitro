import type { GetCodeOptions, TypeContext } from '../../types/Type.js'
import type { CppHelper } from '../../c++/CppHelper.js'
import type { SourceFile } from '../../SourceFile.js'
import { VariantType } from '../../types/VariantType.js'
import { createSwiftVariant } from '../SwiftVariant.js'
import { wrapSwiftType } from '../wrapSwiftType.js'
import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import { getForwardDeclaration } from '../../c++/getForwardDeclaration.js'
import type { SourceImport } from '../../SourceFile.js'
import { getClangImporterReferenceName } from '../ImportedCxxRecord.js'
import type { SwiftType } from './SwiftType.js'
import type { ProtocolConformance } from '../ProtocolConformance.js'

export class SwiftVariantType extends VariantType implements SwiftType {
  override readonly variants: SwiftType[]

  constructor(readonly type: VariantType) {
    const variants = type.variants.map(wrapSwiftType)
    super(variants, type.aliasName)
    this.variants = variants
  }

  get name(): string {
    return this.type.getAliasName('swift')
  }
  override getExtraFiles(): SourceFile[] {
    return [
      ...this.variants.flatMap((v) => v.getExtraFiles()),
      ...createSwiftVariant(this),
    ]
  }

  get isHashable(): boolean {
    return this.variants.every((variant) => variant.isHashable)
  }

  get isSendable(): boolean {
    return this.variants.every((variant) => variant.isSendable)
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
  readonly needsSwiftConversion = true
  readonly requiresExplicitSwiftTarget = true
  fromSwift(value: string): string {
    return `${this.name}_cxx(${value})`
  }
  toSwift(value: string): string {
    return `${value}.value`
  }

  get moduleName(): string {
    return NitroConfig.current.getIosModuleName()
  }
  get forwardDeclaration(): string {
    return getForwardDeclaration('class', `${this.name}_cxx`, this.moduleName)
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = `${this.moduleName}::${this.name}_cxx`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return `${this.name}_cxx`
      default:
        return super.getCode(language, options)
    }
  }
  // TODO: Remove with ImportedCxxRecord.ts once our minimum Xcode includes
  // https://github.com/swiftlang/swift/pull/93293.
  getClangImporterName(context: TypeContext): string {
    return getClangImporterReferenceName(
      `${this.moduleName}.${this.name}_cxx`,
      context
    )
  }

  get requiredCppHelpers(): CppHelper[] {
    return this.variants.flatMap((v) => v.requiredCppHelpers)
  }

  override getRequiredImports(
    language: Language,
    context: 'declaration' | 'implementation' = 'implementation'
  ): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push(
          ...this.variants.flatMap((v) =>
            v.getRequiredImports(language, context)
          ),
          {
            language,
            declaration: { forwardDeclaration: this.forwardDeclaration },
          }
        )
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
        break
      case 'kotlin':
        imports.push(...super.getRequiredImports(language))
        break
    }
    return imports
  }
}
