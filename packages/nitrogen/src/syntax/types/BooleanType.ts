import type { Language } from '../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class BooleanType implements Type {
  get kind(): TypeKind {
    return 'boolean'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, _options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return 'bool'
      case 'swift':
        return 'Bool'
      case 'kotlin':
        return 'Boolean'
      default:
        throw new Error(
          `Language ${language} is not yet supported for BooleanType!`
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
