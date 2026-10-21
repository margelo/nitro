import type { Language } from '../getPlatformSpecs.js'
import { Method, type MethodOptions, type MethodSignatureOptions } from './Method.js'
import type { Parameter } from './Parameter.js'
import type { SourceFile, SourceImport } from './SourceFile.js'
import { StaticMethod, type StaticMethodOptions } from './StaticMethod.js'
import type { Type } from './types/Type.js'

export interface ConstructorOptions extends MethodOptions {
  readonly explicit?: boolean
  readonly virtual?: never
  readonly override?: never
  readonly final?: never
  readonly pureVirtual?: never
}

/** A native constructor; bridges can lower it to a separate static factory. */
export class Constructor extends Method<ConstructorOptions> {
  readonly kind = 'constructor'

  constructor(name: string, constructedType: Type, parameters: Parameter[], options: ConstructorOptions = {}) {
    super(name, constructedType, parameters, options)
  }

  toStaticMethod(returnType: Type = this.returnType, name: string = 'constructor', options: StaticMethodOptions = {}): StaticMethod {
    return new StaticMethod(name, returnType, this.parameters, {
      documentation: this.documentation,
      ...options,
      generated: true,
    })
  }

  protected getSignature(language: Language, { className }: MethodSignatureOptions): string {
    const parameters = this.parameters.map((parameter) => parameter.getCode(language))
    const options = this.options
    switch (language) {
      case 'c++': {
        let name = this.name
        if (className != null) name = `${className}::${name}`
        let signature = `${name}(${parameters.join(', ')})`
        if (options.explicit && className == null) signature = `explicit ${signature}`
        if (options.inline) signature = `inline ${signature}`
        if (options.noexcept) signature = `${signature} noexcept`
        return signature
      }
      case 'swift': {
        let signature = `init(${parameters.join(', ')})`
        if (options.throwing !== false) signature = `${signature} throws`
        if (options.access != null) signature = `${options.access} ${signature}`
        if (options.inline) {
          signature = `
@inline(__always)
${signature}
`.trim()
        }
        return signature
      }
      case 'kotlin': {
        const annotations: string[] = []
        if (options.doNotStrip) annotations.push('@DoNotStrip', '@Keep')
        const signature = `constructor(${parameters.join(', ')})`
        return [...annotations, signature].join('\n')
      }
      default:
        throw new Error(`Language ${language} is not yet supported for constructors!`)
    }
  }

  override getExtraFiles(): SourceFile[] {
    return this.parameters.flatMap((parameter) => parameter.getExtraFiles())
  }

  override getRequiredImports(language: Language): SourceImport[] {
    return this.parameters.flatMap((parameter) => parameter.getRequiredImports(language))
  }
}
