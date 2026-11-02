import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { StructType } from '../../types/StructType.js'
import { createKotlinStruct } from '../KotlinStruct.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import { KotlinNamedType } from './KotlinNamedType.js'
import { KotlinCxxStructType } from './KotlinCxxStructType.js'
import { getKotlinConverter, type KotlinCppConverter } from '../KotlinConverter.js'
import { getJniReferenceCode, type KotlinConversion, type KotlinType } from './KotlinType.js'

export class KotlinStructType extends StructType implements KotlinType {
  override readonly properties: KotlinNamedType[]
  readonly jniValueKind = 'object'

  constructor(
    readonly type: StructType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    const properties = type.properties.map((p) => new KotlinNamedType(p.name, wrapKotlinType(p, { config: config })))
    super(type.structName, properties, type.sourceConfig)
    this.properties = properties
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxStructType(cppType, this).getConverter()
  }

  get jniName(): string {
    return `J${this.structName}`
  }

  convert(value: string, { from, in: language }: KotlinConversion): string {
    switch (language) {
      case 'c++': {
        switch (from) {
          case 'c++':
            return `${getKotlinConverter({ cppType: this.type, kotlinType: this })}::toJNI(${value})`
          case 'kotlin':
            return `${getKotlinConverter({ cppType: this.type, kotlinType: this })}::fromJNI(${value})`
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
        let name = this.jniName
        if (options.fullyQualified || this.config.isExternalConfig) name = this.config.getCxxNamespace('c++', name)
        return getJniReferenceCode(name, options)
      }
      default:
        return super.getCode(language, options)
    }
  }

  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) return []
    return [...this.properties.flatMap((p) => p.getExtraFiles()), ...createKotlinStruct(this)]
  }

  override getRequiredImports(language: Language): SourceImport[] {
    switch (language) {
      case 'c++':
        return [{ language: 'c++', declaration: this.config.getCxxHeader(`${this.jniName}.hpp`, 'private') }]
      case 'kotlin':
        if (this.config.isExternalConfig) {
          return [{ language: 'kotlin', name: `${this.config.getAndroidPackage('java/kotlin')}.${this.structName}` }]
        }
        return []
      default:
        return super.getRequiredImports(language)
    }
  }
}
