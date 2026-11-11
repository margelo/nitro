import type { Type } from '../types/Type.js'

/**
 * Returns a boxed version of the given primitive type.
 * In JNI/Kotlin, primitive types (like `double` or `boolean`)
 * cannot be nullable, so we need to box them - e.g. as `JDouble` or `JBoolean`.
 */
export function getKotlinBoxedPrimitiveType(type: Type): string {
  switch (type.kind) {
    case 'number':
      return 'jni::JDouble'
    case 'boolean':
      return 'jni::JBoolean'
    case 'int64':
      return 'jni::JLong'
    case 'uint64':
      // this sucks, but ULong is actually Long in JNI. We have to reinterpret it.
      return 'jni::JLong'
    default:
      throw new Error(`Type ${type.kind} is not a primitive!`)
  }
}
