import type { MethodDeclaration } from 'ts-morph'
import type { Language } from '../getPlatformSpecs.js'
import { indent } from '../utils.js'
import type { CodeNode } from './CodeNode.js'
import { createType } from './createType.js'
import { Parameter } from './Parameter.js'
import type { SourceFile, SourceImport } from './SourceFile.js'
import type { Type } from './types/Type.js'

export type MethodBody = string

export interface MethodOptions {
  readonly inline?: boolean
  readonly noexcept?: boolean
  readonly doNotStrip?: boolean
  readonly access?: 'public' | 'private'
  readonly throwing?: boolean
  /** Internal generated names may use the reserved __ prefix. */
  readonly generated?: boolean
}

export type MethodArguments<Options extends MethodOptions = MethodOptions> =
  | [name: string, returnType: Type, parameters: Parameter[], options?: Options]
  | [declaration: MethodDeclaration, language: Language, options?: Options]

export interface MethodDefinitionOptions {
  body: MethodBody
  placement?: never
  className?: never
}

export type CppMethodDefinitionOptions = { body: MethodBody } & (
  | { placement: 'in-class'; className?: never }
  | { placement: 'out-of-class'; className: string }
)

export type MethodDefinitionArguments =
  | [language: 'c++', options: CppMethodDefinitionOptions]
  | [language: 'swift' | 'kotlin', options: MethodDefinitionOptions]

export interface MethodSignatureOptions {
  isDefinition: boolean
  className?: string
}

/** Copies and freezes the options, which are all optional. */
function freezeOptions<Options extends MethodOptions>(
  options: Options | undefined
): Readonly<Partial<Options>> {
  if (options == null) return Object.freeze({})
  return Object.freeze({ ...options })
}

/** Signature data and formatting shared by native callable declarations. */
export abstract class Method<
  Options extends MethodOptions = MethodOptions,
> implements CodeNode {
  readonly name: string
  readonly returnType: Type
  readonly parameters: Parameter[]
  readonly options: Readonly<Partial<Options>>

  constructor(...args: MethodArguments<Options>) {
    if (typeof args[0] === 'string' && typeof args[1] === 'object') {
      const [name, returnType, parameters, options] = args
      this.name = name
      this.returnType = returnType
      this.parameters = parameters
      this.options = freezeOptions(options)
    } else if (typeof args[0] === 'object' && typeof args[1] === 'string') {
      const [declaration, language, options] = args
      const name = declaration.getSymbolOrThrow().getName()
      if (declaration.getOverloads().length > 1) {
        throw new Error(
          `Function overloading is not supported, but \`${name}(...)\` is declared multiple times!`
        )
      }
      const returnType = declaration.getReturnType()
      const isOptional = returnType
        .getUnionTypes()
        .some((type) => type.isUndefined())
      this.name = name
      this.returnType = createType(
        language,
        returnType,
        isOptional,
        declaration.getReturnTypeNode()
      )
      this.parameters = declaration
        .getParameters()
        .map((parameter) => new Parameter(parameter, language))
      this.options = freezeOptions(options)
    } else {
      throw new Error('Invalid method constructor arguments.')
    }
    if (!this.options.generated && this.name.startsWith('__')) {
      throw new Error(
        `Method names are not allowed to start with two underscores (__)! (In ${this.jsSignature})`
      )
    }
  }

  protected abstract getSignature(
    language: Language,
    options: MethodSignatureOptions
  ): string

  getCode(language: Language): string {
    return this.getDeclaration(language)
  }

  getDeclaration(language: Language): string {
    const signature = this.getSignature(language, { isDefinition: false })
    switch (language) {
      case 'c++':
        return `${signature};`
      case 'swift':
      case 'kotlin':
        return signature
      default:
        throw new Error(
          `Language ${language} is not yet supported for methods!`
        )
    }
  }

  getDefinition(language: 'c++', options: CppMethodDefinitionOptions): string
  getDefinition(
    language: 'swift' | 'kotlin',
    options: MethodDefinitionOptions
  ): string
  getDefinition(...args: MethodDefinitionArguments): string {
    const [language, options] = args
    let className: string | undefined
    if (language === 'c++' && options.placement === 'out-of-class') {
      className = options.className
    }
    const signature = this.getSignature(language, {
      isDefinition: true,
      className: className,
    })
    return this.getCodeWithBody(signature, options.body)
  }

  protected getCodeWithBody(signature: string, body: MethodBody): string {
    return `
${signature} {
  ${indent(body.trim(), '  ')}
}
`.trim()
  }

  get jsSignature(): string {
    const returnType = this.returnType.kind
    const parameters = this.parameters.map(
      (parameter) => `${parameter.name}: ${parameter.type.kind}`
    )
    return `${this.name}(${parameters.join(', ')}): ${returnType}`
  }

  getExtraFiles(): SourceFile[] {
    const returnTypeFiles = this.returnType.getExtraFiles()
    const parameterFiles = this.parameters.flatMap((parameter) =>
      parameter.getExtraFiles()
    )
    return [...returnTypeFiles, ...parameterFiles]
  }

  getRequiredImports(language: Language): SourceImport[] {
    const returnTypeImports = this.returnType.getRequiredImports(language)
    const parameterImports = this.parameters.flatMap((parameter) =>
      parameter.getRequiredImports(language)
    )
    return [...returnTypeImports, ...parameterImports]
  }
}
