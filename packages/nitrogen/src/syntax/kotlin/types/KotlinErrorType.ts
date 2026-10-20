import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import { ErrorType } from '../../types/ErrorType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export class KotlinErrorType extends ErrorType implements KotlinType {
  readonly jniValueKind = 'wrapper'
  readonly needsKotlinConversion = false

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode('jni::JThrowable', options.context)
      default:
        return super.getCode(language, options)
    }
  }

  convert(value: string, { from, in: language }: KotlinConversion): string {
    switch (language) {
      case 'kotlin':
        return value
      case 'c++':
        switch (from) {
          case 'c++':
            return `jni::getJavaExceptionForCppException(${value})`
          case 'kotlin':
            return `std::make_exception_ptr(jni::JniException(${value}))`
        }
    }
  }
}
