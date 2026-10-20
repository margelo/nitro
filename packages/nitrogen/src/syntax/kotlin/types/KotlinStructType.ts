import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { GetCodeOptions } from '../../types/Type.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import { StructType } from '../../types/StructType.js'
import { createKotlinStruct } from '../KotlinStruct.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import { KotlinNamedType } from './KotlinNamedType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

export class KotlinStructType extends StructType implements KotlinType {
  override readonly properties: KotlinNamedType[]
  readonly jniValueKind = 'wrapper'
  readonly needsKotlinConversion = false

  constructor(readonly type: StructType) {
    const properties = type.properties.map(
      (p) => new KotlinNamedType(p.name, wrapKotlinType(p))
    )
    super(type.structName, properties)
    this.properties = properties
  }

  get jniName(): string {
    return `J${this.structName}`
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

  override getExtraFiles(): SourceFile[] {
    return [
      ...this.properties.flatMap((p) => p.getExtraFiles()),
      ...createKotlinStruct(this),
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
      ...this.properties.flatMap((p) => p.getRequiredImports(language))
    )
    return imports
  }
}
