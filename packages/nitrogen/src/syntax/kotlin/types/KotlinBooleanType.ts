import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import { BooleanType } from '../../types/BooleanType.js'
import {
  convertJniPrimitive,
  getJniPrimitiveCode,
  type JniValueKind,
  type KotlinConversion,
  type KotlinType,
  type KotlinTypeOptions,
} from './KotlinType.js'

export class KotlinBooleanType extends BooleanType implements KotlinType {
  readonly needsKotlinConversion = false
  readonly boxed: boolean

  constructor({ boxed }: KotlinTypeOptions = {}) {
    super()
    this.boxed = boxed === true
  }

  get jniValueKind(): JniValueKind {
    return this.boxed ? 'wrapper' : 'primitive'
  }
  private get jniPrimitive() {
    return { boxedType: 'jni::JBoolean', boxed: this.boxed }
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniPrimitiveCode(
          'jboolean',
          options.context,
          this.jniPrimitive
        )
      default:
        return super.getCode(language, options)
    }
  }

  convert(value: string, conversion: KotlinConversion): string {
    const jniValue = convertJniPrimitive(value, conversion, this.jniPrimitive)
    if (conversion.in === 'c++' && conversion.from === 'kotlin') {
      // jboolean is not bool; Java stores it as an unsigned char.
      return `static_cast<bool>(${jniValue})`
    }
    return jniValue
  }
}
