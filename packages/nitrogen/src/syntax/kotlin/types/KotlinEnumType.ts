import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { EnumType } from '../../types/EnumType.js'
import { createKotlinEnum } from '../KotlinEnum.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export class KotlinEnumType extends EnumType implements KotlinType {
  readonly jniValueKind = 'wrapper'
  readonly needsKotlinConversion = false

  get jniName(): string {
    return `J${this.enumName}`
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode(this.jniName, options.context)
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
            return `${this.jniName}::fromCpp(${value})`
          case 'kotlin':
            return `${value}->toCpp()`
        }
    }
  }

  override getExtraFiles(): SourceFile[] {
    return createKotlinEnum(this)
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = super.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push({
          language: language,
          declaration: NitroConfig.current.getCxxHeader(
            `${this.jniName}.hpp`,
            'private'
          ),
        })
        break
    }
    return imports
  }
}
