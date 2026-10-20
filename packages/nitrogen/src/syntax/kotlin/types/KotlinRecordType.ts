import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import { indent } from '../../../utils.js'
import type { SourceImport } from '../../SourceFile.js'
import { RecordType } from '../../types/RecordType.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

/** JNI represents a record as a `java.util.Map` of boxed keys and values. */
export class KotlinRecordType extends RecordType implements KotlinType {
  override readonly keyType: KotlinType
  override readonly valueType: KotlinType
  readonly jniValueKind = 'wrapper'

  constructor(readonly type: RecordType) {
    const keyType = wrapKotlinType(type.keyType, { boxed: true })
    const valueType = wrapKotlinType(type.valueType, { boxed: true })
    super(keyType, valueType)
    this.keyType = keyType
    this.valueType = valueType
  }

  get needsKotlinConversion(): boolean {
    return (
      this.keyType.needsKotlinConversion || this.valueType.needsKotlinConversion
    )
  }
  private get jniKeyType(): string {
    return this.keyType.getCode('c++', { context: 'type-argument' })
  }
  private get jniValueType(): string {
    return this.valueType.getCode('c++', { context: 'type-argument' })
  }

  convert(value: string, conversion: KotlinConversion): string {
    switch (conversion.in) {
      case 'kotlin':
        // Kotlin passes its public Map through JNI without converting entries.
        return value
      case 'c++':
        switch (conversion.from) {
          case 'c++':
            return this.getCppToJniCode(value)
          case 'kotlin':
            return this.getJniToCppCode(value)
        }
    }
  }

  private getCppToJniCode(value: string): string {
    const conversion: KotlinConversion = {
      from: 'c++',
      to: 'kotlin',
      in: 'c++',
    }
    const jniKey = this.keyType.convert('__entry.first', conversion)
    const jniValue = this.valueType.convert('__entry.second', conversion)
    const javaMapType = `jni::JMap<${this.jniKeyType}, ${this.jniValueType}>`
    const javaHashMapType = `jni::JHashMap<${this.jniKeyType}, ${this.jniValueType}>`
    return `
[&]() -> jni::local_ref<${javaMapType}> {
  auto __map = ${javaHashMapType}::create(${value}.size());
  for (const auto& __entry : ${value}) {
    __map->put(${indent(jniKey, '    ')}, ${indent(jniValue, '    ')});
  }
  return __map;
}()
`.trim()
  }

  private getJniToCppCode(value: string): string {
    const conversion: KotlinConversion = {
      from: 'kotlin',
      to: 'c++',
      in: 'c++',
    }
    const cppKey = this.keyType.convert('__entry.first', conversion)
    const cppValue = this.valueType.convert('__entry.second', conversion)
    const cxxType = this.type.getCode('c++', { context: 'value' })
    return `
[&]() {
  ${cxxType} __map;
  __map.reserve(${value}->size());
  for (const auto& __entry : *${value}) {
    __map.emplace(${indent(cppKey, '    ')}, ${indent(cppValue, '    ')});
  }
  return __map;
}()
`.trim()
  }

  override getCode(language: Language, options: GetCodeOptions): string {
    switch (language) {
      case 'c++': {
        const mapType = `jni::JMap<${this.jniKeyType}, ${this.jniValueType}>`
        return getJniReferenceCode(mapType, options.context)
      }
      case 'kotlin':
        // Kotlin passes its public Map through JNI without converting entries.
        return this.type.getCode(language, options)
      default:
        return super.getCode(language, options)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    return [
      ...this.type.getRequiredImports(language),
      ...this.keyType.getRequiredImports(language),
      ...this.valueType.getRequiredImports(language),
    ]
  }
}
