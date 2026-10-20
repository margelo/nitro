import type { Language } from '../../getPlatformSpecs.js'
import { escapeCppName } from '../helpers.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class PromiseType implements Type {
  readonly resultingType: Type

  constructor(resultingType: Type) {
    this.resultingType = resultingType
  }

  get specializationName(): string {
    const resultingType = this.resultingType.getCode('c++', {
      context: 'type-argument',
    })
    return `Promise_${escapeCppName(resultingType)}`
  }

  get kind(): TypeKind {
    return 'promise'
  }
  get isEquatable(): boolean {
    return false
  }

  getCode(language: Language, options: GetCodeOptions): string {
    const resultingCode = this.resultingType.getCode(language, {
      ...options,
      context: 'type-argument',
    })
    switch (language) {
      case 'c++': {
        const type = `Promise<${resultingCode}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return `any Promise<${resultingCode}>`
      case 'kotlin':
        return `Promise<${resultingCode}>`
      default:
        throw new Error(
          `Language ${language} is not yet supported for PromiseType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return this.resultingType.getExtraFiles()
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] =
      this.resultingType.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { name: 'NitroModules/Promise.hpp', space: 'system' },
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
          name: 'com.margelo.nitro.core.Promise',
          language,
        })
        break
    }
    return imports
  }
}
