import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import { getHybridObjectName } from '../../getHybridObjectName.js'
import type { SourceImport } from '../../SourceFile.js'
import { HybridObjectType } from '../../types/HybridObjectType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export class KotlinHybridObjectType
  extends HybridObjectType
  implements KotlinType
{
  readonly jniValueKind = 'wrapper'
  readonly needsKotlinConversion = false

  constructor(type: HybridObjectType) {
    super(
      type.hybridObjectName,
      type.implementationLanguage,
      type.baseTypes,
      type.sourceConfig,
      type.swiftProtocolConformances
    )
  }

  /** The C++ class holding the Kotlin instance, e.g. `JHybridImageSpec`. */
  get jniName(): string {
    const name = getHybridObjectName(this.hybridObjectName)
    if (this.sourceConfig.isExternalConfig) {
      // fully qualified name like "margelo::nitro::image::JHybridImageSpec"
      return this.sourceConfig.getCxxNamespace('c++', name.JHybridTSpec)
    }
    return name.JHybridTSpec
  }
  get fromCppReturnType(): string {
    // Converting from C++ returns the global reference the C++ part already holds.
    const jniType = this.getCode('c++', { context: 'type-argument' })
    return `jni::global_ref<${jniType}>`
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode(`${this.jniName}::JavaPart`, options.context)
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
            return `std::dynamic_pointer_cast<${this.jniName}>(${value})->getJavaPart()`
          case 'kotlin': {
            const name = getHybridObjectName(this.hybridObjectName)
            return `${value}->get${name.JHybridTSpec}()`
          }
        }
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = super.getRequiredImports(language)
    switch (language) {
      case 'c++': {
        const name = getHybridObjectName(this.hybridObjectName)
        imports.push({
          language: language,
          declaration: this.sourceConfig.getCxxHeader(
            `${name.JHybridTSpec}.hpp`,
            'private'
          ),
        })
        break
      }
    }
    return imports
  }
}
