import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import { VariantType } from '../../types/VariantType.js'
import { createKotlinVariant } from '../KotlinVariant.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export interface KotlinVariantCase {
  label: string
  /** The public Kotlin type of this case. */
  publicType: Type
  type: KotlinType
}

/** JNI represents a variant as a Kotlin sealed class. */
export class KotlinVariantType extends VariantType implements KotlinType {
  override readonly variants: KotlinType[]
  readonly kotlinCases: KotlinVariantCase[]
  readonly jniValueKind = 'wrapper'
  readonly needsKotlinConversion = false

  constructor(readonly type: VariantType) {
    const kotlinCases = type.cases.map(([label, publicType]) => ({
      label: label,
      publicType: publicType,
      type: wrapKotlinType(publicType),
    }))
    const variants = kotlinCases.map((c) => c.type)
    super(variants, type.aliasName)
    this.variants = variants
    this.kotlinCases = kotlinCases
  }

  /** The sealed class name, derived from the public Kotlin types. */
  get name(): string {
    return this.getAliasName('kotlin')
  }
  get jniName(): string {
    return `J${this.name}`
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

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode(this.jniName, options.context)
      default:
        return super.getCode(language, options)
    }
  }

  override getAliasName(language: Language, options?: GetCodeOptions): string {
    return this.type.getAliasName(language, options)
  }

  override getExtraFiles(): SourceFile[] {
    return [
      ...this.variants.flatMap((v) => v.getExtraFiles()),
      ...createKotlinVariant(this),
    ]
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = this.type.getRequiredImports(language)
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
    imports.push(
      ...this.variants.flatMap((v) => v.getRequiredImports(language))
    )
    return imports
  }
}
