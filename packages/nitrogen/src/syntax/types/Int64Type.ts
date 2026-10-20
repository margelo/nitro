import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class Int64Type implements Type {
  get kind(): TypeKind {
    return 'int64'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, _options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return 'int64_t'
      case 'swift':
        return 'Int64'
      case 'kotlin':
        return 'Long'
      default:
        throw new Error(
          `Language ${language} is not yet supported for Int64Type!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return []
  }
  getRequiredImports(): SourceImport[] {
    return []
  }
}
