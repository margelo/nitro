import type { Language } from '../../getPlatformSpecs.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class OptionalType implements Type {
  readonly wrappingType: Type

  constructor(wrappingType: Type) {
    this.wrappingType = wrappingType
  }

  get kind(): TypeKind {
    return 'optional'
  }
  get isEquatable(): boolean {
    return this.wrappingType.isEquatable
  }
  get needsBraces(): boolean {
    switch (this.wrappingType.kind) {
      case 'callback':
        return true
      default:
        return false
    }
  }

  getCode(language: Language, options: GetCodeOptions): string {
    const wrapping = this.wrappingType.getCode(language, {
      ...options,
      context: 'type-argument',
    })
    switch (language) {
      case 'c++': {
        const type = `std::optional<${wrapping}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        if (this.needsBraces) {
          return `(${wrapping})?`
        } else {
          return `${wrapping}?`
        }
      case 'kotlin':
        if (this.needsBraces) {
          return `(${wrapping})?`
        } else {
          return `${wrapping}?`
        }
      default:
        throw new Error(
          `Language ${language} is not yet supported for OptionalType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return this.wrappingType.getExtraFiles()
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] =
      this.wrappingType.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { name: 'optional', space: 'system' },
        })
        break
    }
    return imports
  }
}
