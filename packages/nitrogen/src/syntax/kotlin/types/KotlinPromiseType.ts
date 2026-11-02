import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { PromiseType } from '../../types/PromiseType.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { KotlinCxxPromiseType } from './KotlinCxxPromiseType.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import { getJniReferenceCode, type KotlinConversion, type KotlinType, type KotlinTypeOptions } from './KotlinType.js'

export class KotlinPromiseType extends PromiseType implements KotlinType {
  override readonly resultingType: KotlinType
  readonly jniValueKind = 'object'

  constructor(
    readonly type: PromiseType,
    options: KotlinTypeOptions = {}
  ) {
    // JNI resolves promises with objects, so primitive results are boxed.
    const resultingType = wrapKotlinType(type.resultingType, { boxed: true, config: options.config })
    super(resultingType)
    this.resultingType = resultingType
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxPromiseType(getTypeAs(cppType, PromiseType), this).getConverter()
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
        const result = this.resultingType.getCode(language, { ...options, context: 'value' })
        return getJniReferenceCode(`JTypedPromise<${result}>`, options)
      }
      case 'kotlin':
        return super.getCode(language, options)
      case 'swift':
        return super.getCode(language, options)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = this.resultingType.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push(
          { language: language, declaration: { header: 'NitroModules/JNIConverter+Promise.hpp', space: 'system' } },
          { language: language, declaration: { header: 'NitroModules/JSIConverter+JTypedPromise.hpp', space: 'system' } }
        )
        break
      case 'kotlin':
      case 'swift':
        imports.push(...this.type.getRequiredImports(language))
        break
    }
    return imports
  }
}
