import type { Language } from '../getPlatformSpecs.js'
import {
  Method,
  type MethodOptions,
  type MethodSignatureOptions,
} from './Method.js'

export interface StaticMethodOptions extends MethodOptions {
  /** Swift only: overrides the superclass's `class func` with the same signature. */
  readonly override?: boolean
  readonly virtual?: never
  readonly final?: never
  readonly pureVirtual?: never
}

export class StaticMethod extends Method<StaticMethodOptions> {
  readonly kind = 'static'

  protected getSignature(
    language: Language,
    { className }: MethodSignatureOptions
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
        if (className == null) signature = `static ${signature}`
        if (options.inline) signature = `inline ${signature}`
        if (options.noexcept) signature = `${signature} noexcept`
        return signature
      }
      case 'swift': {
        let throws = ''
        if (options.throwing !== false) throws = ' throws'
        // Swift only declares static methods on classes, where a subclass can
        // override a `class func` with the same signature.
        let signature = `class func ${this.name}(${parameters.join(', ')})${throws} -> ${returnType}`
        if (options.override) signature = `override ${signature}`
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
        // Kotlin declares statics in a companion object. @JvmStatic also emits them
        // as static methods on the outer class, where JNI looks them up.
        const annotations = ['@JvmStatic']
        if (options.doNotStrip) annotations.push('@DoNotStrip', '@Keep')
        let signature = `fun ${this.name}(${parameters.join(', ')}): ${returnType}`
        if (options.inline) signature = `inline ${signature}`
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
