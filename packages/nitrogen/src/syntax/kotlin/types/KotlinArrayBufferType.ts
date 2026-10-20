import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { ArrayBufferType } from '../../types/ArrayBufferType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export class KotlinArrayBufferType
  extends ArrayBufferType
  implements KotlinType
{
  readonly jniValueKind = 'pointer'
  readonly needsKotlinConversion = false

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode('JArrayBuffer::javaobject', options.context)
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
            return `JArrayBuffer::wrap(${value})`
          case 'kotlin':
            return `${value}->cthis()->getArrayBuffer()`
        }
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = super.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push({
          language: language,
          declaration: {
            name: 'NitroModules/JArrayBuffer.hpp',
            space: 'system',
          },
        })
        break
    }
    return imports
  }
}
