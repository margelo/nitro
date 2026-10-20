import type { Language } from '../../getPlatformSpecs.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class ErrorType implements Type {
  constructor() {}

  get kind(): TypeKind {
    return 'error'
  }
  get isEquatable(): boolean {
    return true
  }

  getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const type = `std::exception_ptr`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return `any Error`
      case 'kotlin':
        return `Throwable`
      default:
        throw new Error(
          `Language ${language} is not yet supported for ThrowableType!`
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
          declaration: { name: 'exception', space: 'system' },
        })
        break
    }
    return imports
  }
}
