import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { OptionalType } from '../../types/OptionalType.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { KotlinCxxOptionalType } from './KotlinCxxOptionalType.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import { getJniReferenceCode, type JniValueKind, type KotlinConversion, type KotlinType, type KotlinTypeOptions } from './KotlinType.js'

/** JNI represents an optional as a nullable reference to its boxed value. */
export class KotlinOptionalType extends OptionalType implements KotlinType {
  override readonly wrappingType: KotlinType

  constructor(
    readonly type: OptionalType,
    options: KotlinTypeOptions = {}
  ) {
    const wrappingType = wrapKotlinType(type.wrappingType, { boxed: true, config: options.config })
    super(wrappingType)
    this.wrappingType = wrappingType
  }

  get hasStaticJNIReference(): boolean {
    return this.wrappingType.hasStaticJNIReference ?? false
  }

  get jniValueKind(): JniValueKind {
    return this.wrappingType.jniValueKind
  }

  get isKotlinEqualityCompatible(): boolean {
    return this.wrappingType.isKotlinEqualityCompatible ?? true
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxOptionalType(getTypeAs(cppType, OptionalType), this).getConverter()
  }

  get needsKotlinConversion(): boolean {
    return this.wrappingType.needsKotlinConversion
  }
  convert(value: string, conversion: KotlinConversion): string {
    switch (conversion.in) {
      case 'kotlin': {
        if (!this.needsKotlinConversion) return value
        const wrappedValue = this.wrappingType.convert('it', conversion)
        return `${value}?.let { ${wrappedValue} }`
      }
      case 'c++': {
        const cppType = this.type.getCode('c++', { context: 'value' })
        const jniType = this.getCode('c++', { context: 'value' })
        const converter = `JNIConverter<${cppType}, ${jniType}>`
        switch (conversion.from) {
          case 'c++':
            return `${converter}::toJNI(${value})`
          case 'kotlin':
            return `${converter}::fromJNI(${value})`
        }
      }
    }
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const wrapping = this.wrappingType.getCode(language, { ...options, context: 'type-argument' })
        return getJniReferenceCode(`JOptional<${wrapping}>`, options)
      }
      default:
        return super.getCode(language, options)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = this.wrappingType.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push(
          { language: language, declaration: { header: 'NitroModules/JNIConverter+Optional.hpp', space: 'system' } },
          { language: language, declaration: { header: 'NitroModules/JSIConverter+JOptional.hpp', space: 'system' } }
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
