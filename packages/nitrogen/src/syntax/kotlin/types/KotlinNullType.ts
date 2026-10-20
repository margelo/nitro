import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { NullType } from '../../types/NullType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export class KotlinNullType extends NullType implements KotlinType {
  readonly jniValueKind = 'wrapper'
  readonly needsKotlinConversion = false

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode('JNull', options.context)
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
            return `JNull::null()`
          case 'kotlin':
            return `nitro::null`
        }
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = super.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push({
          language: language,
          declaration: { name: 'NitroModules/JNull.hpp', space: 'system' },
        })
        break
    }
    return imports
  }
}
