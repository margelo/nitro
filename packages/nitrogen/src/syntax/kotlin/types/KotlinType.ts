import type { Type, TypeContext } from '../../types/Type.js'

export interface KotlinTypeOptions {
  /**
   * Whether JNI holds the value as an object, as in optionals, records, promise
   * results and callback results. Only primitives box, e.g. `double` as `jni::JDouble`.
   */
  boxed?: boolean
}

/** A conversion of a value across JNI, written in either language. */
export type KotlinConversion = (
  | { from: 'c++'; to: 'kotlin' }
  | { from: 'kotlin'; to: 'c++' }
) & {
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
 * - `wrapper`: a `jni::JavaClass` such as `jni::JString`. References give it with `*ref`.
 * - `pointer`: a raw `javaobject` pointer such as `JArrayBuffer::javaobject`.
 *   References give it with `ref.get()`.
 */
export type JniValueKind = 'primitive' | 'wrapper' | 'pointer'

/**
 * A Kotlin representation that crosses JNI.
 *
 * `getCode('kotlin')` renders the Kotlin type JNI calls use, which can differ from
 * the public Kotlin type of the original `Type` (e.g. `Long` for `ULong`).
 * `getCode('c++', { context })` renders its fbjni type: `jni::alias_ref<T>` for
 * `parameter`, `jni::local_ref<T>` for `return` and `value`, and the class `T`
 * for `type-argument`, `property` and `parameter-type` (template arguments and
 * JNI field or method signatures). Primitives render their JNI type in every context.
 *
 * `getExtraFiles()` returns only the Kotlin and fbjni files;
 * the original type provides its C++ declarations.
 */
export interface KotlinType extends Type {
  readonly jniValueKind: JniValueKind
  /**
   * The fbjni type a native method returns for a value converted from C++,
   * if it is not `getCode('c++', { context: 'return' })`.
   */
  readonly fromCppReturnType?: string
  /** Whether the public Kotlin API needs conversion to this representation. */
  readonly needsKotlinConversion: boolean
  /** Converts `value` across JNI, see `KotlinConversion`. */
  convert(value: string, conversion: KotlinConversion): string
}

/** Renders an fbjni object reference for the context it is used in. */
export function getJniReferenceCode(
  jniType: string,
  context: TypeContext
): string {
  switch (context) {
    case 'parameter':
      return `jni::alias_ref<${jniType}>`
    case 'return':
    case 'value':
      return `jni::local_ref<${jniType}>`
    case 'parameter-type':
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
export function getJniPrimitiveCode(
  jniType: string,
  context: TypeContext,
  { boxedType, boxed }: JniPrimitive
): string {
  if (boxed) return getJniReferenceCode(boxedType, context)
  return jniType
}

/** Boxes or unboxes a JNI primitive in C++ where JNI requires an object. */
export function convertJniPrimitive(
  value: string,
  { from, in: language }: KotlinConversion,
  { boxedType, boxed }: JniPrimitive
): string {
  if (language !== 'c++' || !boxed) return value
  switch (from) {
    case 'c++':
      return `${boxedType}::valueOf(${value})`
    case 'kotlin':
      return `${value}->value()`
  }
}
