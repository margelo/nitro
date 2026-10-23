import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { ArrayType } from '../../types/ArrayType.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { KotlinCxxArrayType } from './KotlinCxxArrayType.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import { getJniReferenceCode, type KotlinConversion, type KotlinType, type KotlinTypeOptions } from './KotlinType.js'

export class KotlinArrayType extends ArrayType implements KotlinType {
  override readonly itemType: KotlinType
  readonly jniValueKind = 'object'
  /** A `ULongArray` erased to an `Object` keeps its box, which JNI sees as a `JULongArray`. */
  readonly erasedToObject: boolean

  constructor(
    readonly type: ArrayType,
    options: KotlinTypeOptions = {}
  ) {
    const itemType = wrapKotlinType(type.itemType, { config: options.config })
    super(itemType)
    this.itemType = itemType
    this.erasedToObject = options.erasedToObject === true
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxArrayType(getTypeAs(cppType, ArrayType), this).getConverter()
  }

  get needsKotlinConversion(): boolean {
    if (this.isULongArray && this.erasedToObject) return false
    return this.itemType.needsKotlinConversion
  }
  /** `ULongArray` is a value class, so its field holds the `long[]` JNI uses. */
  get isKotlinFieldCompatible(): boolean {
    return this.isULongArray || !this.needsKotlinConversion
  }
  /** `ULongArray` boxes compare by identity, so compare their `long[]`s instead. */
  get isKotlinEqualityCompatible(): boolean {
    return !this.isULongArray && (this.itemType.isKotlinEqualityCompatible ?? true)
  }
  private get isULongArray(): boolean {
    return this.itemType.kind === 'uint64'
  }
  convert(value: string, conversion: KotlinConversion): string {
    switch (conversion.in) {
      case 'kotlin': {
        if (!this.needsKotlinConversion) return value
        if (this.isULongArray) {
          // Both reinterpret the same array without copying it.
          return conversion.from === 'kotlin' ? `${value}.asLongArray()` : `${value}.asULongArray()`
        }
        const item = this.itemType.convert('__item', conversion)
        const sourceType = conversion.from === 'c++' ? this.itemType : this.type.itemType
        const resultType = conversion.from === 'c++' ? this.type.itemType : this.itemType
        const sourceCode = sourceType.getCode('kotlin', { context: 'type-argument' })
        const resultCode = resultType.getCode('kotlin', { context: 'type-argument' })
        return `
${value}.mapToArray<${sourceCode}, ${resultCode}> { __item -> ${item} }
`.trim()
      }
      case 'c++': {
        const cppType = this.type.getCode('c++', { context: 'value' })
        const jniType = this.getCode('c++', { context: 'value' })
        const converter = `JNIConverter<${cppType}, ${jniType}>`
        switch (conversion.from) {
          case 'c++':
            return `${converter}::toJNI(${value})`
          case 'kotlin':
            return `${converter}::fromJNI(${value})`
        }
      }
    }
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        let jniType: string
        switch (this.itemType.kind) {
          case 'number':
            jniType = 'jni::JArrayDouble'
            break
          case 'boolean':
            jniType = 'jni::JArrayBoolean'
            break
          case 'int64':
            jniType = 'jni::JArrayLong'
            break
          case 'uint64':
            jniType = this.erasedToObject ? 'JULongArray' : 'JArrayUInt64'
            break
          default: {
            const item = this.itemType.getCode(language, { ...options, context: 'type-argument' })
            jniType = `jni::JArrayClass<${item}>`
            break
          }
        }
        return getJniReferenceCode(jniType, options)
      }
      case 'kotlin':
        switch (this.itemType.kind) {
          case 'number':
            return 'DoubleArray'
          case 'boolean':
            return 'BooleanArray'
          case 'int64':
            return 'LongArray'
          case 'uint64':
            return this.erasedToObject ? 'ULongArray' : 'LongArray'
          default: {
            const item = this.itemType.getCode(language, { ...options, context: 'type-argument' })
            return `Array<${item}>`
          }
        }
      case 'swift':
        return super.getCode(language, options)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = this.itemType.getRequiredImports(language)
    switch (language) {
      case 'c++': {
        let jsiConverterHeader: string
        switch (this.itemType.kind) {
          case 'number':
          case 'boolean':
          case 'int64':
          case 'uint64':
            jsiConverterHeader = 'NitroModules/JSIConverter+JPrimitiveArray.hpp'
            break
          default:
            jsiConverterHeader = 'NitroModules/JSIConverter+JArrayClass.hpp'
            break
        }
        imports.push(
          { language: language, declaration: { header: 'NitroModules/JNIConverter+Array.hpp', space: 'system' } },
          { language: language, declaration: { header: jsiConverterHeader, space: 'system' } }
        )
        break
      }
      case 'kotlin':
        if (this.needsKotlinConversion && !this.isULongArray) {
          imports.push({ language: language, name: 'com.margelo.nitro.utils.mapToArray' })
        }
        imports.push(...this.type.getRequiredImports(language))
        break
      case 'swift':
        imports.push(...this.type.getRequiredImports(language))
        break
    }
    return imports
  }
}
