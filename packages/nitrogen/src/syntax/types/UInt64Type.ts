import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class UInt64Type implements Type {
  get kind(): TypeKind {
    return 'uint64'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, _options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return 'uint64_t'
      case 'swift':
        return 'UInt64'
      case 'kotlin':
        return 'ULong'
      default:
        throw new Error(
          `Language ${language} is not yet supported for UInt64Type!`
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
