import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import type { SourceImport } from '../../SourceFile.js'
import { RecordType } from '../../types/RecordType.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { KotlinCxxRecordType } from './KotlinCxxRecordType.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import { getJniReferenceCode, type KotlinConversion, type KotlinType, type KotlinTypeOptions } from './KotlinType.js'

/** JNI represents a record as a `java.util.Map` of boxed keys and values. */
export class KotlinRecordType extends RecordType implements KotlinType {
  override readonly keyType: KotlinType
  override readonly valueType: KotlinType
  readonly jniValueKind = 'object'

  constructor(
    readonly type: RecordType,
    options: KotlinTypeOptions = {}
  ) {
    if (type.keyType.kind !== 'string') {
      throw new Error('Kotlin records require string keys.')
    }
    const keyType = wrapKotlinType(type.keyType, { boxed: true, config: options.config })
    const valueType = wrapKotlinType(type.valueType, { boxed: true, erasedToObject: true, config: options.config })
    super(keyType, valueType)
    this.keyType = keyType
    this.valueType = valueType
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxRecordType(getTypeAs(cppType, RecordType), this).getConverter()
  }

  get needsKotlinConversion(): boolean {
    return this.keyType.needsKotlinConversion || this.valueType.needsKotlinConversion
  }
  convert(value: string, conversion: KotlinConversion): string {
    switch (conversion.in) {
      case 'kotlin': {
        if (!this.needsKotlinConversion) return value
        const item = this.valueType.convert('__value', conversion)
        return `
${value}.mapValues { (_, __value) -> ${item} }
`.trim()
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
        const keyType = this.keyType.getCode(language, { ...options, context: 'type-argument' })
        const valueType = this.valueType.getCode(language, { ...options, context: 'type-argument' })
        const mapType = `jni::JMap<${keyType}, ${valueType}>`
        return getJniReferenceCode(mapType, options)
      }
      case 'kotlin':
        return super.getCode(language, options)
      default:
        return super.getCode(language, options)
    }
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = [...this.keyType.getRequiredImports(language), ...this.valueType.getRequiredImports(language)]
    switch (language) {
      case 'c++':
        imports.push(
          { language: language, declaration: { header: 'NitroModules/JNIConverter+Map.hpp', space: 'system' } },
          { language: language, declaration: { header: 'NitroModules/JSIConverter+JMap.hpp', space: 'system' } }
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
