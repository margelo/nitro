import type { Type } from '../../types/Type.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { NamedWrappingType } from '../../types/NamedWrappingType.js'
import {
  convertJniValue,
  getJniCode,
  type GetKotlinCodeOptions,
  type JniValueDirection,
  type JniValueKind,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export class KotlinNamedType extends NamedWrappingType<KotlinType> implements KotlinType {
  get hasStaticJNIReference(): boolean {
    return this.type.hasStaticJNIReference ?? false
  }

  get jniValueKind(): JniValueKind {
    return this.type.jniValueKind
  }
  get isKotlinFieldCompatible(): boolean {
    return this.type.isKotlinFieldCompatible ?? !this.type.needsKotlinConversion
  }
  get isKotlinEqualityCompatible(): boolean {
    return this.type.isKotlinEqualityCompatible ?? true
  }

  get needsKotlinConversion(): boolean {
    return this.type.needsKotlinConversion
  }

  getJniCode(options: GetKotlinCodeOptions): string {
    return getJniCode(this.type, options)
  }

  convertJniValue(value: string, direction: JniValueDirection): string {
    return convertJniValue(this.type, value, direction)
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return this.type.getCppConverter(cppType)
  }

  convert(value: string, conversion: KotlinConversion): string {
    return this.type.convert(value, conversion)
  }
}
