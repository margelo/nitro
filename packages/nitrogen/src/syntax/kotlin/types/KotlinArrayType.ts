import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { ArrayType } from '../../types/ArrayType.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { KotlinCxxArrayType } from './KotlinCxxArrayType.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinEqualityOptions,
  type KotlinType,
  type KotlinTypeOptions,
} from './KotlinType.js'

export class KotlinArrayType extends ArrayType implements KotlinType {
  override readonly itemType: KotlinType
  readonly jniValueKind = 'object'

  constructor(
    readonly type: ArrayType,
    options: KotlinTypeOptions = {}
  ) {
    const itemType = wrapKotlinType(type.itemType, { boxed: type.itemType.kind === 'uint64', config: options.config })
    super(itemType)
    this.itemType = itemType
  }

  getEqualityCode({ left, right }: KotlinEqualityOptions): string {
    const method = this.itemType.jniValueKind === 'primitive' ? 'contentEquals' : 'contentDeepEquals'
    return `
${left}.${method}(${right})
`.trim()
  }

  getHashCode(value: string): string {
    const method = this.itemType.jniValueKind === 'primitive' ? 'contentHashCode' : 'contentDeepHashCode'
    return `
${value}.${method}()
`.trim()
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxArrayType(getTypeAs(cppType, ArrayType), this).getConverter()
  }

  convert(value: string, { from, in: language }: KotlinConversion): string {
    switch (language) {
      case 'c++': {
        const cppType = this.type.getCode('c++', { context: 'value' })
        const jniType = this.getCode('c++', { context: 'value' })
        const converter = `JNIConverter<${cppType}, ${jniType}>`
        switch (from) {
          case 'c++':
            return `${converter}::toJNI(${value})`
          case 'kotlin':
            return `${converter}::fromJNI(${value})`
          default:
            throw new Error(`Unsupported Kotlin conversion source: ${from}`)
        }
      }
      default:
        throw new Error(`Unsupported Kotlin conversion language: ${language}`)
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
        imports.push(...this.type.getRequiredImports(language))
        break
      case 'swift':
        imports.push(...this.type.getRequiredImports(language))
        break
    }
    return imports
  }
}
