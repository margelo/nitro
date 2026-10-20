import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import { UInt64Type } from '../../types/UInt64Type.js'
import {
  convertJniPrimitive,
  getJniPrimitiveCode,
  type JniValueKind,
  type KotlinConversion,
  type KotlinType,
  type KotlinTypeOptions,
} from './KotlinType.js'

/** JNI has no unsigned 64-bit integer, so `ULong` crosses it as a reinterpreted `Long`. */
export class KotlinUInt64Type extends UInt64Type implements KotlinType {
  readonly needsKotlinConversion = true
  readonly boxed: boolean

  constructor({ boxed }: KotlinTypeOptions = {}) {
    super()
    this.boxed = boxed === true
  }

  get jniValueKind(): JniValueKind {
    return this.boxed ? 'wrapper' : 'primitive'
  }
  private get jniPrimitive() {
    return { boxedType: 'jni::JLong', boxed: this.boxed }
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniPrimitiveCode('jlong', options.context, this.jniPrimitive)
      case 'kotlin':
        return 'Long'
      default:
        return super.getCode(language, options)
    }
  }

  convert(value: string, conversion: KotlinConversion): string {
    switch (conversion.in) {
      case 'kotlin':
        return conversion.from === 'kotlin'
          ? `${value}.toLong()`
          : `${value}.toULong()`
      case 'c++': {
        const jniValue = convertJniPrimitive(
          value,
          conversion,
          this.jniPrimitive
        )
        switch (conversion.from) {
          case 'kotlin':
            // jlong is signed in Java.
            return `static_cast<uint64_t>(${jniValue})`
          case 'c++':
            return jniValue
        }
      }
    }
  }
}
