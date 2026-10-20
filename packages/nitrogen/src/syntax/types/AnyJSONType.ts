import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class AnyJSONType implements Type {
  get kind(): TypeKind {
    return 'any-json'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = 'AnyJSON'
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return 'AnyJSON'
      default:
        throw new Error(
          `Language ${language} is not yet supported for AnyJSONType!`
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
          declaration: { name: 'NitroModules/AnyJSON.hpp', space: 'system' },
        })
        break
      case 'swift':
        imports.push({
          name: 'NitroModules',
          language,
          access: 'public',
        })
        break
      case 'kotlin':
        imports.push({
          name: 'com.margelo.nitro.core.AnyJSON',
          language,
        })
        break
    }
    return imports
  }
}
