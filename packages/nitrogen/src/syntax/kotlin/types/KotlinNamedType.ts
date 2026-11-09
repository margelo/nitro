import type { Type } from '../../types/Type.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { NamedWrappingType } from '../../types/NamedWrappingType.js'
import {
  convertJniValue,
  getJniCode,
  getKotlinEqualityCode,
  getKotlinHashCode,
  type GetKotlinCodeOptions,
  type JniValueDirection,
  type JniValueKind,
  type KotlinConversion,
  type KotlinEqualityOptions,
  type KotlinType,
} from './KotlinType.js'

export class KotlinNamedType extends NamedWrappingType<KotlinType> implements KotlinType {
  getEqualityCode(options: KotlinEqualityOptions): string {
    return getKotlinEqualityCode(this.type, options)
  }

  getHashCode(value: string): string {
    return getKotlinHashCode(this.type, value)
  }

  get hasStaticJNIReference(): boolean {
    return this.type.hasStaticJNIReference ?? false
  }

  get jniValueKind(): JniValueKind {
    return this.type.jniValueKind
  }

  get requiresKotlinJvmName(): boolean {
    return this.type.requiresKotlinJvmName ?? false
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
