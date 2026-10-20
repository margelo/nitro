import type { Language } from '../getPlatformSpecs.js'
import {
  Method,
  type MethodArguments,
  type MethodOptions,
  type MethodSignatureOptions,
} from './Method.js'

export interface InstanceMethodOptions extends MethodOptions {
  readonly virtual?: boolean
  readonly override?: boolean
  readonly final?: boolean
  readonly pureVirtual?: boolean
}

export class InstanceMethod extends Method<InstanceMethodOptions> {
  readonly kind = 'instance'

  constructor(...args: MethodArguments<InstanceMethodOptions>) {
    super(...args)
    if (this.name === 'dispose') {
      // dispose() manages the JSI NativeState and cannot be replaced by a spec method.
      throw new Error(
        `\`dispose()\` must not be overridden from TypeScript! You can override \`dispose()\` natively.`
      )
    }
  }

  protected getSignature(
    language: Language,
    { isDefinition, className }: MethodSignatureOptions
  ): string {
    const parameters = this.parameters.map((parameter) =>
      parameter.getCode(language)
    )
    const returnType = this.returnType.getCode(language, { context: 'return' })
    const options = this.options
    switch (language) {
      case 'c++': {
        let name = this.name
        if (className != null) name = `${className}::${name}`
        let signature = `${returnType} ${name}(${parameters.join(', ')})`
        if (options.inline) signature = `inline ${signature}`
        if (className == null && (options.virtual || options.pureVirtual)) {
          signature = `virtual ${signature}`
        }
        if (options.noexcept) signature = `${signature} noexcept`
        if (className == null) {
          if (options.override) signature = `${signature} override`
          if (options.final) signature = `${signature} final`
          if (!isDefinition && options.pureVirtual)
            signature = `${signature} = 0`
        }
        return signature
      }
      case 'swift': {
        let throws = ''
        if (options.throwing !== false) throws = ' throws'
        let signature = `func ${this.name}(${parameters.join(', ')})${throws} -> ${returnType}`
        if (options.override) signature = `override ${signature}`
        if (options.final) signature = `final ${signature}`
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
        let signature = `fun ${this.name}(${parameters.join(', ')}): ${returnType}`
        if (options.inline) signature = `inline ${signature}`
        if (options.override) signature = `override ${signature}`
        if (options.pureVirtual && !isDefinition) {
          signature = `abstract ${signature}`
        } else if (options.virtual && !options.final) {
          signature = `open ${signature}`
        }
        if (options.final) signature = `final ${signature}`
        if (options.access != null) signature = `${options.access} ${signature}`
        return [...annotations, signature].join('\n')
      }
      default:
        throw new Error(
          `Language ${language} is not yet supported for methods!`
        )
    }
  }
}
