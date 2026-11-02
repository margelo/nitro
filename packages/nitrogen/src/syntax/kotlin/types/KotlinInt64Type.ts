import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import { Int64Type } from '../../types/Int64Type.js'
import { KotlinCxxPrimitiveType } from './KotlinCxxPrimitiveType.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { getJniPrimitiveCode, type JniValueKind, type KotlinConversion, type KotlinType, type KotlinTypeOptions } from './KotlinType.js'

export class KotlinInt64Type extends Int64Type implements KotlinType {
  readonly boxed: boolean

  constructor({ boxed }: KotlinTypeOptions = {}) {
    super()
    this.boxed = boxed === true
  }

  get jniValueKind(): JniValueKind {
    return this.boxed ? 'object' : 'primitive'
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxPrimitiveType(cppType, this).getConverter()
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniPrimitiveCode('jlong', options, { boxedType: 'jni::JLong', boxed: this.boxed })
      case 'kotlin':
      case 'swift':
        return super.getCode(language, options)
    }
  }

  convert(value: string, { from, in: language }: KotlinConversion): string {
    switch (language) {
      case 'c++': {
        const jniType = this.getCode('c++', { context: 'value' })
        const converter = `JNIConverter<int64_t, ${jniType}>`
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

  override getRequiredImports(language: Language = 'c++'): SourceImport[] {
    const imports = super.getRequiredImports()
    switch (language) {
      case 'c++':
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
