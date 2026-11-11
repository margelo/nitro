import type { Language } from '../../getPlatformSpecs.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class ArrayType implements Type {
  readonly itemType: Type

  constructor(itemType: Type) {
    this.itemType = itemType
  }

  get canBePassedByReference(): boolean {
    // It's a vector<..>, heavy to copy
    return true
  }

  get kind(): TypeKind {
    return 'array'
  }
  get isEquatable(): boolean {
    return this.itemType.isEquatable
  }

  getCode(language: Language, options?: GetCodeOptions): string {
    const itemCode = this.itemType.getCode(language, options)

    switch (language) {
      case 'c++':
        return `std::vector<${itemCode}>`
      case 'swift':
        return `[${itemCode}]`
      case 'kotlin':
        switch (this.itemType.kind) {
          case 'number':
            return 'DoubleArray'
          case 'boolean':
            return 'BooleanArray'
          case 'int64':
            return 'LongArray'
          case 'uint64':
            // ULong is just interpret as LongArray in Java.
            return 'LongArray'
          default:
            return `Array<${itemCode}>`
        }
      default:
        throw new Error(
          `Language ${language} is not yet supported for ArrayType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return this.itemType.getExtraFiles()
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = [
      ...this.itemType.getRequiredImports(language),
    ]
    if (language === 'c++') {
      imports.push({
        name: 'vector',
        language: 'c++',
        space: 'system',
      })
    }
    return imports
  }
}
