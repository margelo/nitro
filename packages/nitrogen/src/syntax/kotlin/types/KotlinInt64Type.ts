import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import { Int64Type } from '../../types/Int64Type.js'
import {
  convertJniPrimitive,
  getJniPrimitiveCode,
  type JniValueKind,
  type KotlinConversion,
  type KotlinType,
  type KotlinTypeOptions,
} from './KotlinType.js'

export class KotlinInt64Type extends Int64Type implements KotlinType {
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
    return { boxedType: 'jni::JLong', boxed: this.boxed }
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniPrimitiveCode(
          super.getCode(language, options),
          options.context,
          this.jniPrimitive
        )
      default:
        return super.getCode(language, options)
    }
  }

  convert(value: string, conversion: KotlinConversion): string {
    return convertJniPrimitive(value, conversion, this.jniPrimitive)
  }
}
