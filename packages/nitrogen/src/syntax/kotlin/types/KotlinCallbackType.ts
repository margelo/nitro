import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import type { Type } from '../../types/Type.js'
import { KotlinCxxCallbackType } from './KotlinCxxCallbackType.js'
import { getTypeAs } from '../../types/getTypeAs.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import { getKotlinConverter } from '../KotlinConverter.js'
import { CallbackType } from '../../types/CallbackType.js'
import { createKotlinCallback } from '../KotlinCallback.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import { KotlinNamedType } from './KotlinNamedType.js'
import {
  getJniReferenceCode,
  type GetKotlinCodeOptions,
  type JNINativeRegistration,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

/** nitro-core defines `Callback.Arity0` to `Callback.Arity22`, so a Kotlin callback has at most 22 parameters. */
const MAX_KOTLIN_CALLBACK_PARAMETERS = 22

/**
 * Kotlin APIs and JNI use the generic `Callback<(...) -> R>`, which JNI declares as nitro-core's
 * `Callback` interface. The generated `<name>` class holds a C++ `Callback<...>` and implements it,
 * and C++ wraps a callback implemented in Kotlin in one.
 */
export class KotlinCallbackType extends CallbackType implements KotlinType {
  override readonly returnType: KotlinType
  override readonly parameters: KotlinNamedType[]
  readonly jniValueKind = 'object'
  readonly needsKotlinConversion = false

  constructor(
    readonly type: CallbackType,
    readonly config: NitroConfig = NitroConfig.current
  ) {
    if (type.parameters.length > MAX_KOTLIN_CALLBACK_PARAMETERS) {
      throw new Error(
        `The callback \`${type.jsName}\` has ${type.parameters.length} parameters, but Kotlin callbacks support at most ${MAX_KOTLIN_CALLBACK_PARAMETERS}.`
      )
    }
    const returnType = wrapKotlinType(type.returnType, { config: config })
    const parameters = type.parameters.map((p) => new KotlinNamedType(p.name, wrapKotlinType(p, { config: config })))
    super(returnType, parameters, type.isInline)
    this.returnType = returnType
    this.parameters = parameters
  }

  /** The generated class name, derived from the C++ callback signature. */
  override get specializationName(): string {
    return this.type.specializationName
  }
  override get jsName(): string {
    return this.type.jsName
  }
  get jniName(): string {
    return `J${this.specializationName}`
  }

  convert(value: string, { from, in: language }: KotlinConversion): string {
    switch (language) {
      case 'kotlin':
        return value
      case 'c++': {
        const converter = getKotlinConverter({ cppType: this.type, kotlinType: this })
        switch (from) {
          case 'c++':
            return `${converter}::toJNI(${value})`
          case 'kotlin':
            return `${converter}::fromJNI(${value})`
        }
      }
    }
  }

  getCppConverter(cppType: Type): KotlinCppConverter {
    return new KotlinCxxCallbackType(getTypeAs(cppType, CallbackType), this).getConverter()
  }

  override getCode(language: Language, options: GetKotlinCodeOptions): string {
    switch (language) {
      case 'c++': {
        // Kotlin has no borrowed callbacks, so `Inline<...>` uses the same escaped type.
        const jniClass = this.config.getCxxNamespace('c++', this.jniName)
        return getJniReferenceCode(`JTypedCallback<${jniClass}::JavaPart>`, options)
      }
      case 'kotlin':
        return this.type.getCode(language, options)
      default:
        return super.getCode(language, options)
    }
  }

  getJniNativeRegistrations(): readonly JNINativeRegistration[] {
    if (this.config.isExternalConfig) return []
    return [
      {
        namespace: this.config.getCxxNamespace('c++').split('::'),
        className: this.jniName,
        import: {
          language: 'c++',
          declaration: this.config.getCxxHeader(`${this.jniName}.hpp`, 'private'),
        },
      },
    ]
  }

  override getExtraFiles(): SourceFile[] {
    if (this.config.isExternalConfig) return []
    return [
      ...this.returnType.getExtraFiles(),
      ...this.parameters.flatMap((parameter) => parameter.getExtraFiles()),
      ...createKotlinCallback(this),
    ]
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports: SourceImport[] = []
    switch (language) {
      case 'kotlin':
      case 'swift':
        imports.push(...this.type.getRequiredImports(language))
        break
      case 'c++':
        break
    }
    switch (language) {
      case 'c++':
        imports.push(
          {
            language: language,
            declaration: this.config.getCxxHeader(`${this.jniName}.hpp`, 'private'),
          },
          {
            language: language,
            declaration: {
              header: 'NitroModules/JNIConverter+Callback.hpp',
              space: 'system',
            },
          }
        )
        break
    }
    imports.push(...this.returnType.getRequiredImports(language), ...this.parameters.flatMap((p) => p.getRequiredImports(language)))
    return imports
  }
}
