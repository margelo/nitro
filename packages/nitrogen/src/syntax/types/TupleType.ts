import type { Language } from '../../getPlatformSpecs.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class TupleType implements Type {
  readonly itemTypes: Type[]

  constructor(itemTypes: Type[]) {
    this.itemTypes = itemTypes
  }

  get kind(): TypeKind {
    return 'tuple'
  }
  get isEquatable(): boolean {
    return this.itemTypes.every((t) => t.isEquatable)
  }

  getCode(language: Language, options: GetCodeOptions): string {
    const types = this.itemTypes.map((t) =>
      t.getCode(language, { ...options, context: 'type-argument' })
    )

    switch (language) {
      case 'c++': {
        const type = `std::tuple<${types.join(', ')}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return `(${types.join(', ')})`
      default:
        throw new Error(
          `Language ${language} is not yet supported for TupleType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return this.itemTypes.flatMap((t) => t.getExtraFiles())
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports = this.itemTypes.flatMap((t) =>
      t.getRequiredImports(language)
    )
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { name: 'tuple', space: 'system' },
        })
        break
    }
    return imports
  }
}
