import type { Language } from '../../getPlatformSpecs.js'
import { escapeCppName, isNotDuplicate } from '../helpers.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export const VariantLabels = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eigth',
  'ninth',
  'tenth',
] as const
type VariantLabel = (typeof VariantLabels)[number]

export class VariantType implements Type {
  readonly variants: Type[]
  readonly aliasName?: string

  constructor(variants: Type[], aliasName?: string) {
    this.variants = variants
    this.aliasName = aliasName
  }

  get kind(): TypeKind {
    return 'variant'
  }
  get isEquatable(): boolean {
    return this.variants.every((v) => v.isEquatable)
  }

  get jsType(): string {
    return this.variants.map((v) => v.kind).join(' | ')
  }

  get cases(): [VariantLabel, Type][] {
    return this.variants.map((v, i) => {
      const label = VariantLabels[i]
      if (label == null)
        throw new Error(
          `Variant<...> (\`${this.jsType}\`) does not support ${i} cases!`
        )
      return [label, v]
    })
  }

  getAliasName(language: Language, options?: GetCodeOptions): string {
    if (this.aliasName == null) {
      const variants = this.variants.map((v) =>
        v.getCode(language, { ...options, context: 'type-argument' })
      )
      return escapeCppName(`Variant_${variants.join('_')}`)
    }
    return this.aliasName
  }

  getCode(language: Language, options: GetCodeOptions): string {
    const types = this.variants
      .map((v) => v.getCode(language, { ...options, context: 'type-argument' }))
      .filter(isNotDuplicate)

    switch (language) {
      case 'c++': {
        const type = `std::variant<${types.join(', ')}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
      case 'kotlin':
        return this.getAliasName(language, options)
      default:
        throw new Error(
          `Language ${language} is not yet supported for VariantType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return this.variants.flatMap((v) => v.getExtraFiles())
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports = this.variants.flatMap((v) => v.getRequiredImports(language))
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { name: 'variant', space: 'system' },
        })
        break
    }
    return imports
  }
}
