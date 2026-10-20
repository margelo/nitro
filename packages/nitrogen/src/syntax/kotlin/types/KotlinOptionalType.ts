import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { OptionalType } from '../../types/OptionalType.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import type {
  JniValueKind,
  KotlinConversion,
  KotlinType,
} from './KotlinType.js'

/** JNI represents an optional as a nullable reference to its boxed value. */
export class KotlinOptionalType extends OptionalType implements KotlinType {
  override readonly wrappingType: KotlinType

  constructor(readonly type: OptionalType) {
    const wrappingType = wrapKotlinType(type.wrappingType, { boxed: true })
    super(wrappingType)
    this.wrappingType = wrappingType
  }

  get jniValueKind(): JniValueKind {
    return this.wrappingType.jniValueKind
  }
  get needsKotlinConversion(): boolean {
    return this.wrappingType.needsKotlinConversion
  }
  /** Callbacks cross JNI as named interfaces, which need no braces. */
  override get needsBraces(): boolean {
    return false
  }

  convert(value: string, conversion: KotlinConversion): string {
    switch (conversion.in) {
      case 'kotlin': {
        if (!this.needsKotlinConversion) return value
        const wrappedValue = this.wrappingType.convert('it', conversion)
        return `${value}?.let { ${wrappedValue} }`
      }
      case 'c++': {
        switch (conversion.from) {
          case 'c++': {
            const jniValue = this.wrappingType.convert(
              `${value}.value()`,
              conversion
            )
            return `${value}.has_value() ? ${jniValue} : nullptr`
          }
          case 'kotlin': {
            const cppValue = this.wrappingType.convert(value, conversion)
            return `${value} != nullptr ? std::make_optional(${cppValue}) : std::nullopt`
          }
        }
      }
    }
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++':
        return this.wrappingType.getCode(language, options)
      default:
        return super.getCode(language, options)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    return [
      ...this.type.getRequiredImports(language),
      ...this.wrappingType.getRequiredImports(language),
    ]
  }
}
