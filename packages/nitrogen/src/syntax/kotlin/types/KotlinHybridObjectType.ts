import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import { getHybridObjectName } from '../../getHybridObjectName.js'
import type { SourceImport } from '../../SourceFile.js'
import { HybridObjectType } from '../../types/HybridObjectType.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { KotlinCxxHybridObjectType } from './KotlinCxxHybridObjectType.js'
import { getJniReferenceCode, type JNINativeRegistration, type KotlinConversion, type KotlinType } from './KotlinType.js'

export class KotlinHybridObjectType extends HybridObjectType implements KotlinType {
  readonly jniValueKind = 'object'

  constructor(readonly type: HybridObjectType) {
    super(type.hybridObjectName, type.platforms, type.baseTypes, type.sourceConfig)
  }

  /** An exact implementation can skip JVM virtual dispatch for its direct members. */
  get canUseNonvirtualJniCalls(): boolean {
    const android = this.platforms.android
    return (
      android?.language === 'kotlin' && android.implementation != null && !android.allowInheritance && !android.allowMultipleImplementations
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

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxHybridObjectType(cppType, this).getConverter()
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    const android = this.platforms.android
    if (android == null) {
      throw new Error(`HybridObject "${this.hybridObjectName}" is not implemented on Android and cannot be referenced from Kotlin.`)
    }
    if (android.language !== 'kotlin') {
      throw new Error(
        `HybridObject "${this.hybridObjectName}" is implemented in ${android.language} on Android, but this reference requires Kotlin. Cross-language HybridObject references are currently supported only in C++ APIs.`
      )
    }

    switch (language) {
      case 'c++': {
        const name = getHybridObjectName(this.hybridObjectName)
        const fullyQualified = options.fullyQualified ?? this.sourceConfig.isExternalConfig
        const jniName = fullyQualified ? this.sourceConfig.getCxxNamespace('c++', name.JHybridTSpecJavaPart) : name.JHybridTSpecJavaPart
        return getJniReferenceCode(jniName, options)
      }
      case 'kotlin':
      case 'swift':
        return super.getCode(language, options)
    }
  }

  convert(value: string, { from, in: language }: KotlinConversion): string {
    switch (language) {
      case 'c++': {
        const nativeType = `std::shared_ptr<${this.jniName}>`
        const jniType = this.getCode('c++', { context: 'value' })
        const converter = `JNIConverter<${nativeType}, ${jniType}>`
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

  getJniNativeRegistrations(): readonly JNINativeRegistration[] {
    if (this.sourceConfig.isExternalConfig) return []
    const name = getHybridObjectName(this.hybridObjectName)
    return [
      {
        namespace: this.sourceConfig.getCxxNamespace('c++').split('::'),
        className: `${name.JHybridTSpec}::CxxPart`,
        import: {
          language: 'c++',
          declaration: this.sourceConfig.getCxxHeader(`${name.JHybridTSpec}.hpp`, 'private'),
        },
      },
    ]
  }

  override getRequiredImports(language: Language): SourceImport[] {
    switch (language) {
      case 'c++': {
        const name = getHybridObjectName(this.hybridObjectName)
        return [
          {
            language: language,
            declaration: this.sourceConfig.getCxxHeader(`${name.JHybridTSpecJavaPart}.hpp`, 'private'),
            implementation: this.sourceConfig.getCxxHeader(`${name.JHybridTSpec}.hpp`, 'private'),
          },
          { language: language, declaration: { header: 'NitroModules/JNIConverter+HybridObject.hpp', space: 'system' } },
          { language: language, declaration: { header: 'NitroModules/JSIConverter+JHybridObject.hpp', space: 'system' } },
        ]
      }
      case 'kotlin':
      case 'swift':
        return this.type.getRequiredImports(language)
    }
  }
}
