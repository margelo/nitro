import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class ArrayBufferType implements Type {
  get kind(): TypeKind {
    return 'array-buffer'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = 'ArrayBuffer'
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return 'ArrayBuffer'
      case 'kotlin':
        return 'ArrayBuffer'
      default:
        throw new Error(
          `Language ${language} is not yet supported for ArrayBufferType!`
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
          declaration: {
            name: 'NitroModules/ArrayBuffer.hpp',
            space: 'system',
          },
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
          name: 'com.margelo.nitro.core.ArrayBuffer',
          language,
        })
        break
    }
    return imports
  }
}
