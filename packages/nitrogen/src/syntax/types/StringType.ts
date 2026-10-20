import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class StringType implements Type {
  get kind(): TypeKind {
    return 'string'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = 'std::string'
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return 'String'
      case 'kotlin':
        return 'String'
      default:
        throw new Error(
          `Language ${language} is not yet supported for StringType!`
        )
    }
  }

  getExtraFiles(): SourceFile[] {
    return []
  }

  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { name: 'string', space: 'system' },
        })
        break
    }
    return imports
  }
}
