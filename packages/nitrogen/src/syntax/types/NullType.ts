import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class NullType implements Type {
  get kind(): TypeKind {
    return 'null'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, _options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return 'nitro::NullType'
      case 'swift':
        return 'NullType'
      case 'kotlin':
        return 'NullType'
      default:
        throw new Error(
          `Language ${language} is not yet supported for NullType!`
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
          declaration: { name: 'NitroModules/Null.hpp', space: 'system' },
        })
        break
      case 'swift':
        imports.push({
          language,
          name: 'NitroModules',
          access: 'public',
        })
        break
      case 'kotlin':
        imports.push({
          language,
          name: 'com.margelo.nitro.core.NullType',
        })
        break
    }
    return imports
  }
}
