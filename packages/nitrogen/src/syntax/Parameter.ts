import type { ParameterDeclaration } from 'ts-morph'
import type { CodeNode } from './CodeNode.js'
import { escapeCppName, toReferenceType } from './helpers.js'
import type { Language } from '../getPlatformSpecs.js'
import { type SourceFile, type SourceImport } from './SourceFile.js'
import type { NamedType, Type } from './types/Type.js'
import { NamedWrappingType } from './types/NamedWrappingType.js'
import { createNamedType } from './createType.js'

export class Parameter implements CodeNode {
  readonly type: NamedType

  constructor(name: string, type: Type)
  constructor(parameter: ParameterDeclaration, language: Language)
  constructor(...args: [string, Type] | [ParameterDeclaration, Language]) {
    if (typeof args[0] === 'string' && typeof args[1] === 'object') {
      // constructor(...) #1
      if (args.length !== 2)
        throw new Error(`Missing arguments for new Parameter(...) overload #1!`)
      const [name, type] = args
      this.type = new NamedWrappingType(name, type)
    } else if (typeof args[0] === 'object' && typeof args[1] === 'string') {
      // constructor(...) #2
      const [param, language] = args
      const name = param.getSymbolOrThrow().getEscapedName()
      const type = param.getType()
      const isOptional =
        param.hasQuestionToken() || param.isOptional() || type.isNullable()
      this.type = createNamedType(
        language,
        name,
        type,
        isOptional,
        param.getTypeNode()
      )
    } else {
      // constructor(...)???
      throw new Error(`Invalid constructor! Arguments: ${args}`)
    }
    if (this.type.name.startsWith('__')) {
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
        let cppType = this.type.getCode('c++')
        if (this.type.canBePassedByReference) {
          // T -> const T&
          cppType = toReferenceType(cppType)
        }
        return `${cppType} ${name}`
      case 'swift':
        let flags = ''
        if (this.type.kind === 'function') {
          flags = '@escaping '
        }
        return `${name}: ${flags + this.type.getCode('swift')}`
      case 'kotlin':
        return `${name}: ${this.type.getCode('kotlin')}`
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
