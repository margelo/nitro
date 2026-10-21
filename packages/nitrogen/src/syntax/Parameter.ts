import type { ParameterDeclaration } from 'ts-morph'
import type { CodeNode } from './CodeNode.js'
import { escapeCppName } from './helpers.js'
import type { Language } from '../getPlatformSpecs.js'
import { type SourceFile, type SourceImport } from './SourceFile.js'
import type { GetCodeOptions, NamedType, Type } from './types/Type.js'
import { NamedWrappingType } from './types/NamedWrappingType.js'
import { createNamedType, type TypeParsingTarget } from './createType.js'
import { SourceError, withSourceLocation } from '../SourceError.js'

interface ParameterOptions {
  generated?: boolean
  codeOptions?: GetCodeOptions
}

type ParameterArguments = [string, Type, ParameterOptions?] | [ParameterDeclaration, TypeParsingTarget]

function isDeclarationArguments(args: ParameterArguments): args is [ParameterDeclaration, TypeParsingTarget] {
  return typeof args[0] !== 'string'
}

export class Parameter implements CodeNode {
  readonly type: NamedType
  private readonly codeOptions: GetCodeOptions

  constructor(name: string, type: Type, options?: ParameterOptions)
  constructor(parameter: ParameterDeclaration, target: TypeParsingTarget)
  constructor(...args: ParameterArguments) {
    this.codeOptions = args[2]?.codeOptions ?? { context: 'parameter' }
    if (!isDeclarationArguments(args)) {
      // constructor(...) #1
      const [name, type] = args
      this.type = new NamedWrappingType(name, type)
    } else {
      // constructor(...) #2
      const [param, target] = args
      if (param.isRestParameter()) {
        throw new SourceError(param, 'Rest parameters are not supported by Nitrogen. Declare a single array parameter instead.')
      }
      const name = param.getSymbolOrThrow().getEscapedName()
      const type = param.getType()
      const isOptional = param.hasQuestionToken() || param.isOptional() || type.getUnionTypes().some((t) => t.isUndefined())
      this.type = withSourceLocation(param, () =>
        createNamedType(target, name, type, isOptional, param.getTypeNode(), { isParameter: true })
      )
    }
    if (this.type.name.startsWith('__') && args[2]?.generated !== true) {
      throw new Error(`Parameter names are not allowed to start with two underscores (__)! (In ${this.jsSignature})`)
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
        const cppType = this.type.getCode('c++', this.codeOptions)
        return `${cppType} ${name}`
      case 'swift':
        return `${name}: ${this.type.getCode('swift', { context: 'parameter' })}`
      case 'kotlin':
        return `${name}: ${this.type.getCode('kotlin', { context: 'parameter' })}`
      default:
        throw new Error(`Language ${language} is not yet supported for parameters!`)
    }
  }

  getExtraFiles(): SourceFile[] {
    return this.type.getExtraFiles()
  }

  getRequiredImports(language: Language): SourceImport[] {
    return this.type.getRequiredImports(language)
  }
}
