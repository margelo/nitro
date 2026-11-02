import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { NullType } from '../../types/NullType.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { KotlinCxxNullType } from './KotlinCxxNullType.js'
import { getJniReferenceCode, type KotlinConversion, type KotlinType } from './KotlinType.js'

export class KotlinNullType extends NullType implements KotlinType {
  readonly jniValueKind = 'object'

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxNullType(cppType, this).getConverter()
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode('JNull', options)
      case 'kotlin':
      case 'swift':
        return super.getCode(language, options)
    }
  }

  convert(value: string, { from, in: language }: KotlinConversion): string {
    switch (language) {
      case 'c++': {
        switch (from) {
          case 'c++':
            return `JNIConverter<NullType, jni::local_ref<JNull>>::toJNI(${value})`
          case 'kotlin':
            return `JNIConverter<NullType, jni::local_ref<JNull>>::fromJNI(${value})`
          default:
            throw new Error(`Unsupported Kotlin conversion source: ${from}`)
        }
      }
      default:
        throw new Error(`Unsupported Kotlin conversion language: ${language}`)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = super.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push(
          { language: language, declaration: { header: 'NitroModules/JNIConverter+Null.hpp', space: 'system' } },
          { language: language, declaration: { header: 'NitroModules/JSIConverter+JNull.hpp', space: 'system' } }
        )
        break
      case 'kotlin':
      case 'swift':
        break
    }
    return imports
  }
}
