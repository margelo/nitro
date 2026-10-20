import type { Language } from '../../getPlatformSpecs.js'
import { escapeCppName } from '../helpers.js'
import { type SourceFile, type SourceImport } from '../SourceFile.js'
import type { GetCodeOptions, Type, TypeKind } from './Type.js'

export class RecordType implements Type {
  readonly keyType: Type
  readonly valueType: Type

  constructor(keyType: Type, valueType: Type) {
    this.keyType = keyType
    this.valueType = valueType
  }

  get specializationName(): string {
    const keyType = this.keyType.getCode('c++', { context: 'type-argument' })
    const valueType = this.valueType.getCode('c++', {
      context: 'type-argument',
    })
    const keyName = escapeCppName(keyType)
    const valueName = escapeCppName(valueType)
    return `Record_${keyName}_${valueName}`
  }

  get kind(): TypeKind {
    return 'record'
  }
  get isEquatable(): boolean {
    return this.keyType.isEquatable && this.valueType.isEquatable
  }

  getCode(language: Language, options: GetCodeOptions): string {
    const keyCode = this.keyType.getCode(language, {
      ...options,
      context: 'type-argument',
    })
    const valueCode = this.valueType.getCode(language, {
      ...options,
      context: 'type-argument',
    })

    switch (language) {
      case 'c++': {
        const type = `std::unordered_map<${keyCode}, ${valueCode}>`
        return options.context === 'parameter' ? `const ${type}&` : type
      }
      case 'swift':
        return `Dictionary<${keyCode}, ${valueCode}>`
      case 'kotlin':
        return `Map<${keyCode}, ${valueCode}>`
      default:
        throw new Error(
          `Language ${language} is not yet supported for RecordType!`
        )
    }
  }
  getExtraFiles(): SourceFile[] {
    return [...this.keyType.getExtraFiles(), ...this.valueType.getExtraFiles()]
  }
  getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = [
      ...this.keyType.getRequiredImports(language),
      ...this.valueType.getRequiredImports(language),
    ]
    switch (language) {
      case 'c++':
        imports.push({
          language,
          declaration: { name: 'unordered_map', space: 'system' },
        })
        break
    }
    return imports
  }
}
