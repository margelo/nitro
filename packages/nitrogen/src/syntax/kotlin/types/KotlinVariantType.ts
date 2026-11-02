import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import { VariantType } from '../../types/VariantType.js'
import { createKotlinVariant } from '../KotlinVariant.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import { KotlinCxxVariantType } from './KotlinCxxVariantType.js'
import { getJniReferenceCode, type KotlinConversion, type KotlinType } from './KotlinType.js'

export interface KotlinVariantCase {
  readonly label: string
  /** The public Kotlin type of this case. */
  readonly publicType: Type
  readonly type: KotlinType
}

/** JNI represents a variant as a Kotlin sealed class. */
export class KotlinVariantType extends VariantType implements KotlinType {
  override readonly variants: KotlinType[]
  readonly kotlinCases: KotlinVariantCase[]
  readonly jniValueKind = 'object'

  constructor(
    readonly type: VariantType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    const kotlinCases = type.cases.map(([label, publicType]) => ({
      label: label,
      publicType: publicType,
      type: wrapKotlinType(publicType, { config: config }),
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

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxVariantType(getTypeAs(cppType, VariantType), this).getConverter()
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
        let name: string
        if (options.fullyQualified || this.config.isExternalConfig) {
          name = this.config.getCxxNamespace('c++', this.jniName)
        } else {
          name = this.jniName
        }
        return getJniReferenceCode(name, options)
      }
      case 'kotlin':
      case 'swift':
        return super.getCode(language, options)
    }
  }

  override getAliasName(language: Language, options?: GetCodeOptions): string {
    return this.type.getAliasName(language, options)
  }

  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) return []
    return [...this.variants.flatMap((v) => v.getExtraFiles()), ...createKotlinVariant(this)]
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'c++':
        imports.push({
          language: language,
          declaration: this.config.getCxxHeader(`${this.jniName}.hpp`, 'private'),
        })
        break
      case 'kotlin':
      case 'swift':
        imports.push(...this.type.getRequiredImports(language))
        break
    }
    imports.push(...this.variants.flatMap((v) => v.getRequiredImports(language)))
    return imports
  }
}
