import type { ParameterDeclaration } from 'ts-morph'
import type { CodeNode } from './CodeNode.js'
import { escapeCppName } from './helpers.js'
import type { Language } from '../getPlatformSpecs.js'
import { type SourceFile, type SourceImport } from './SourceFile.js'
import type { NamedType, Type } from './types/Type.js'
import { NamedWrappingType } from './types/NamedWrappingType.js'
import { createNamedType } from './createType.js'

export class Parameter implements CodeNode {
  readonly type: NamedType

  constructor(name: string, type: Type, options?: { generated: boolean })
  constructor(parameter: ParameterDeclaration, language: Language)
  constructor(
    ...args:
      | [string, Type, { generated: boolean }?]
      | [ParameterDeclaration, Language]
  ) {
    if (typeof args[0] === 'string' && typeof args[1] === 'object') {
      // constructor(...) #1
      const [name, type] = args
      this.type = new NamedWrappingType(name, type)
    } else if (typeof args[0] === 'object' && typeof args[1] === 'string') {
      // constructor(...) #2
      const [param, language] = args
      const name = param.getSymbolOrThrow().getEscapedName()
      const type = param.getType()
      const isOptional =
        param.hasQuestionToken() ||
        param.isOptional() ||
        type.getUnionTypes().some((t) => t.isUndefined())
      this.type = createNamedType(
        language,
        name,
        type,
        isOptional,
        param.getTypeNode(),
        { isParameter: true }
      )
    } else {
      // constructor(...)???
      throw new Error(`Invalid constructor! Arguments: ${args}`)
    }
    if (this.type.name.startsWith('__') && args[2]?.generated !== true) {
      throw new Error(
        `Parameter names are not allowed to start with two underscores (__)! (In ${this.jsSignature})`
      )
    }
  }

  get jsSignature(): string {
    return `${this.type.name}: ${this.type.kind}`
  }

  get name(): string {
    return this.type.name
  }

  getCode(language: Language): string {
    const name = escapeCppName(this.name)
    switch (language) {
      case 'c++':
        const cppType = this.type.getCode('c++', { context: 'parameter' })
        return `${cppType} ${name}`
      case 'swift':
        return `${name}: ${this.type.getCode('swift', { context: 'parameter' })}`
      case 'kotlin':
        return `${name}: ${this.type.getCode('kotlin', { context: 'parameter' })}`
      default:
        throw new Error(
          `Language ${language} is not yet supported for parameters!`
        )
    }
  }

  getExtraFiles(): SourceFile[] {
    return this.type.getExtraFiles()
  }

  getRequiredImports(language: Language): SourceImport[] {
    return this.type.getRequiredImports(language)
  }
}
