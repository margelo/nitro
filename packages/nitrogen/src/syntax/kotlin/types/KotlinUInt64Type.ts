import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceImport } from '../../SourceFile.js'
import type { Type } from '../../types/Type.js'
import { UInt64Type } from '../../types/UInt64Type.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { KotlinCxxUInt64Type } from './KotlinCxxUInt64Type.js'
import { getKotlinConverter } from '../KotlinConverter.js'
import {
  getJniPrimitiveCode,
  type GetKotlinCodeOptions,
  type JniValueKind,
  type KotlinConversion,
  type JniValueDirection,
  type KotlinType,
  type KotlinTypeOptions,
} from './KotlinType.js'

/**
 * JNI carries ULong bits as Long; the boxed facade preserves unsigned JS semantics.
 * A ULong erased to an `Object` stays boxed as `kotlin.ULong`, which JNI sees as a `JULong`.
 */
export class KotlinUInt64Type extends UInt64Type implements KotlinType {
  readonly boxed: boolean
  readonly erasedToObject: boolean

  get isKotlinFieldCompatible(): boolean {
    return !this.boxed
  }

  get needsKotlinConversion(): boolean {
    return !this.erasedToObject
  }

  constructor({ boxed, erasedToObject }: KotlinTypeOptions = {}) {
    super()
    this.boxed = boxed === true
    this.erasedToObject = this.boxed && erasedToObject === true
  }

  get jniValueKind(): JniValueKind {
    return this.boxed ? 'object' : 'primitive'
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxUInt64Type(cppType, this).getConverter()
  }

  override getCode(language: Language, options: GetKotlinCodeOptions): string {
    switch (language) {
      case 'c++':
        if (!this.boxed) return super.getCode(language, options)
        return this.getJniCode(options)
      case 'kotlin':
        return this.erasedToObject ? 'ULong' : 'Long'
      case 'swift':
        return super.getCode(language, options)
    }
  }

  getJniCode(options: GetKotlinCodeOptions): string {
    const boxedType = this.erasedToObject ? 'JULong' : 'JUInt64'
    return getJniPrimitiveCode('jlong', options, { boxedType: boxedType, boxed: this.boxed })
  }

  convertJniValue(value: string, direction: JniValueDirection): string {
    if (this.boxed) return value
    switch (direction) {
      case 'to-jni':
        return `JNIConverter<uint64_t, jlong>::toJNI(${value})`
      case 'from-jni':
        return `JNIConverter<uint64_t, jlong>::fromJNI(${value})`
    }
  }

  convert(value: string, conversion: KotlinConversion): string {
    switch (conversion.in) {
      case 'kotlin':
        if (this.erasedToObject) return value
        return conversion.from === 'kotlin' ? `${value}.toLong()` : `${value}.toULong()`
      case 'c++': {
        const converter = getKotlinConverter({ cppType: new UInt64Type(), kotlinType: this })
        switch (conversion.from) {
          case 'c++':
            return `${converter}::toJNI(${value})`
          case 'kotlin':
            return `${converter}::fromJNI(${value})`
        }
      }
    }
  }

  override getRequiredImports(language: Language = 'c++'): SourceImport[] {
    const imports = super.getRequiredImports()
    switch (language) {
      case 'c++':
        if (this.boxed) {
          imports.push({ language: language, declaration: { header: 'NitroModules/JUInt64.hpp', space: 'system' } })
        }
        imports.push(
          { language: language, declaration: { header: 'NitroModules/JNIConverter+Primitives.hpp', space: 'system' } },
          { language: language, declaration: { header: 'NitroModules/JSIConverter+JNIPrimitives.hpp', space: 'system' } }
        )
        break
      case 'kotlin':
      case 'swift':
        break
    }
    return imports
  }
}
