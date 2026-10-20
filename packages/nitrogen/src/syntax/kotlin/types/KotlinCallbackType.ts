import { NitroConfig } from '../../../config/NitroConfig.js'
import type { Language } from '../../../getPlatformSpecs.js'
import type { SourceFile, SourceImport } from '../../SourceFile.js'
import {
  CallbackType,
  type GetCallbackCodeOptions,
} from '../../types/CallbackType.js'
import { createKotlinCallback } from '../KotlinCallback.js'
import { wrapKotlinType } from '../wrapKotlinType.js'
import { KotlinNamedType } from './KotlinNamedType.js'
import {
  getJniReferenceCode,
  type KotlinConversion,
  type KotlinType,
} from './KotlinType.js'

/**
 * JNI represents a callback as a Kotlin `fun interface`.
 * C++ callbacks implement it in `<name>_cxx`, and Kotlin lambdas in `<name>_java`.
 */
export class KotlinCallbackType extends CallbackType implements KotlinType {
  override readonly returnType: KotlinType
  /** The result `invoke()` returns through JNI. It overrides `FunctionN.invoke`, so primitives are boxed. */
  readonly boxedReturnType: KotlinType
  override readonly parameters: KotlinNamedType[]
  readonly jniValueKind = 'pointer'
  readonly needsKotlinConversion = true

  constructor(readonly type: CallbackType) {
    const returnType = wrapKotlinType(type.returnType)
    const parameters = type.parameters.map(
      (p) => new KotlinNamedType(p.name, wrapKotlinType(p))
    )
    super(returnType, parameters, type.isInline)
    this.returnType = returnType
    this.boxedReturnType = wrapKotlinType(type.returnType, { boxed: true })
    this.parameters = parameters
  }

  /** The interface name, derived from the C++ callback signature. */
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
        return from === 'kotlin'
          ? `${this.specializationName}_java(${value})`
          : value
      case 'c++':
        switch (from) {
          case 'c++':
            return `${this.jniName}_cxx::fromCpp(${value})`
          case 'kotlin':
            return this.getJniToCppCode(value)
        }
    }
  }

  private getJniToCppCode(value: string): string {
    const returnType = this.type.returnType.getCode('c++', {
      context: 'return',
    })
    const paramTypes = this.type.parameters.map((p) =>
      p.getCode('c++', { context: 'parameter' })
    )
    const jniType = `${this.jniName}_cxx`
    const cppCallbackType = this.type.getCode('c++', { context: 'return' })
    return `
[&]() -> ${cppCallbackType} {
  if (${value}->isInstanceOf(${jniType}::javaClassStatic())) [[likely]] {
    auto downcast = jni::static_ref_cast<${jniType}::javaobject>(${value});
    return downcast->cthis()->getCallback();
  } else {
    auto __callbackRef = jni::make_global(${value});
    return ${cppCallbackType}::make(JNICallable<${this.jniName}, ${returnType}(${paramTypes.join(', ')})>(std::move(__callbackRef)));
  }
}()
`.trim()
  }
  override getCode(
    language: Language,
    options: GetCallbackCodeOptions
  ): string {
    switch (language) {
      case 'c++':
        return getJniReferenceCode(
          `${this.jniName}::javaobject`,
          options.context
        )
      case 'kotlin':
        return this.specializationName
      default:
        return super.getCode(language, options)
    }
  }

  override getExtraFiles(): SourceFile[] {
    return [...super.getExtraFiles(), ...createKotlinCallback(this)]
  }

  override getRequiredImports(language: Language): SourceImport[] {
    const imports = this.type.getRequiredImports(language)
    switch (language) {
      case 'c++':
        imports.push(
          {
            language: language,
            declaration: NitroConfig.current.getCxxHeader(
              `${this.jniName}.hpp`,
              'private'
            ),
          },
          {
            language: language,
            declaration: {
              name: 'NitroModules/JNICallable.hpp',
              space: 'system',
            },
          }
        )
        break
    }
    imports.push(
      ...this.returnType.getRequiredImports(language),
      ...this.parameters.flatMap((p) => p.getRequiredImports(language))
    )
    return imports
  }
}
