import type { Language } from '../../../getPlatformSpecs.js'
import type { NitroConfig } from '../../../config/NitroConfig.js'
import type { KotlinCppConverter } from '../KotlinConverter.js'
import type { SourceImport } from '../../SourceFile.js'
import type { GetCodeOptions, Type } from '../../types/Type.js'

/** A generated JNI class whose native methods must be registered by its module. */
export interface JNINativeRegistration {
  readonly namespace: readonly string[]
  readonly className: string
  readonly import: SourceImport<'c++'>
}

export interface KotlinTypeOptions {
  /** The owning module for generated nested JNI facades, such as callbacks and variants. */
  config?: NitroConfig
  /**
   * Whether JNI holds the value as an object, as in optionals, records, promise
   * results and callback results. Only primitives box, e.g. `double` as `jni::JDouble`.
   */
  boxed?: boolean
  /**
   * Whether the JVM erases the value to an `Object`, as for record values and promise results.
   * `Array<T>` elements are not erased, since the JVM array type names `T`. Kotlin value classes
   * such as `ULong` then keep their public box, which JNI converts without naming its class.
   */
  erasedToObject?: boolean
}

/** A conversion of a value across JNI, written in either language. */
export type KotlinConversion = ({ from: 'c++'; to: 'kotlin' } | { from: 'kotlin'; to: 'c++' }) & {
  /**
   * The language the conversion is written in. In C++, it converts between the
   * C++ value and its fbjni representation. In Kotlin, it converts between the
   * public Kotlin value and the Kotlin type JNI uses.
   */
  in: 'c++' | 'kotlin'
}

/**
 * How fbjni holds a value of a type, e.g. as an array element:
 * - `primitive`: a JNI primitive such as `double`.
 * - `object`: a `jni::JavaClass` such as `jni::JString`. References give it with `*ref`.
 */
export type JniValueKind = 'primitive' | 'object'

export interface GetKotlinCodeOptions extends GetCodeOptions {
  /** Whether a parameter borrows a JNI input or owns a freshly decoded JS value. */
  ownership?: 'owned' | 'borrowed'
}

/**
 * A Kotlin representation that crosses JNI.
 *
 * `getCode('kotlin')` renders the Kotlin type JNI calls use, which can differ from
 * the public Kotlin type of the original `Type` (e.g. `Long` for `ULong`).
 * `getCode('c++', { context })` renders its fbjni type: `jni::alias_ref<T>` for
 * `parameter`, `jni::local_ref<T>` for `return`, `value` and `parameter-type`, and the class `T`
 * for `type-argument` and `property` (template arguments and
 * JNI field or method signatures). Scalars retain their native semantics, such as
 * `uint64_t`; `getJniCode` prints the JVM ABI when it differs, such as `jlong`.
 *
 * `getExtraFiles()` returns only the Kotlin and fbjni files;
 * the original type provides its C++ declarations.
 */
export interface KotlinType extends Type {
  getCode(language: Language, options: GetKotlinCodeOptions): string
  readonly jniValueKind: JniValueKind
  /** Whether the public Kotlin API needs conversion to this representation. */
  readonly needsKotlinConversion: boolean
  /** Whether borrowed JNI values have immutable owners lasting for the process lifetime. */
  readonly hasStaticJNIReference?: boolean
  /** Whether a generated Kotlin backing field already has this JNI representation. */
  readonly isKotlinFieldCompatible?: boolean
  /**
   * Whether `Objects.deepEquals` and `contentDeepHashCode` compare the public Kotlin value
   * by its contents. Otherwise, generated structs compare its JNI representation.
   */
  readonly isKotlinEqualityCompatible?: boolean
  /** Overrides a native value's printer only when its JVM signature differs. */
  getJniCode?(options: GetKotlinCodeOptions): string
  /** Adapts a native scalar at the JNI boundary when its JVM ABI differs. */
  convertJniValue?(value: string, direction: JniValueDirection): string
  /** Native conversion requirements requested only by a C++ consumer. */
  getCppConverter(cppType: Type): KotlinCppConverter
  /** Native methods required by this type, owned by the module that declares them. */
  getJniNativeRegistrations?(): readonly JNINativeRegistration[]
  /** Converts `value` across JNI, see `KotlinConversion`. */
  convert(value: string, conversion: KotlinConversion): string
}

/** Renders an fbjni object reference for the context it is used in. */
export function getJniReferenceCode(jniType: string, { context, ownership }: GetKotlinCodeOptions): string {
  switch (context) {
    case 'parameter':
      if (ownership === 'owned') return `const jni::local_ref<${jniType}>&`
      return `jni::alias_ref<${jniType}>`
    case 'return':
    case 'value':
    case 'parameter-type':
      return `jni::local_ref<${jniType}>`
    case 'property':
    case 'type-argument':
      return jniType
  }
}

interface JniPrimitive {
  /** The object that boxes the primitive, e.g. `jni::JDouble`. */
  boxedType: string
  boxed: boolean
}

/** Renders a JNI primitive, or the object that boxes it. */
export function getJniPrimitiveCode(jniType: string, options: GetKotlinCodeOptions, { boxedType, boxed }: JniPrimitive): string {
  if (boxed) return getJniReferenceCode(boxedType, options)
  return jniType
}

/** Prints the JVM method or field ABI; most native values already match it. */
export function getJniCode(type: KotlinType, options: GetKotlinCodeOptions): string {
  return type.getJniCode?.(options) ?? type.getCode('c++', options)
}

export type JniValueDirection = 'to-jni' | 'from-jni'

/** Adapts only values whose native scalar type differs from the JVM ABI. */
export function convertJniValue(type: KotlinType, value: string, direction: JniValueDirection): string {
  return type.convertJniValue?.(value, direction) ?? value
}
