import { Android, iOS } from 'nitro-core'
import type { HybridObject, Int64, UInt64 } from 'nitro-core'

export * from '#nitro/SomeExternalObject'

// A Type specifically testing optional primitives
export interface OptionalPrimitivesHolder {
  optionalNumber?: number
  optionalBoolean?: boolean
  optionalUInt64?: UInt64
  optionalInt64?: Int64
}

/**
 * This hybrid object is implemented in Swift and Kotlin.
 * It can be called from Swift/Kotlin, as well as C++ directly.
 * `nitro-test`'s `SomeExternalObjectChild` inherits from it.
 */
@iOS({
  language: 'swift',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
@Android({
  language: 'kotlin',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
export declare class SomeExternalObject extends HybridObject {
  getValue(): string

  // This tests a weird Swift bug: when a Hybrid Object imported in another
  // module (aka an "external HybridObject") uses optional primitives (here
  // bool or double), the Swift compiler fails because the optional's `.value`
  // accessor seems to not be generated properly.
  // See https://github.com/swiftlang/swift/issues/84848
  createOptionalPrimitivesHolder(
    optionalNumber?: number,
    optionalBoolean?: boolean,
    optionalUInt64?: UInt64,
    optionalInt64?: Int64
  ): OptionalPrimitivesHolder

  // `nitro-test` calls this through its C++ adapter. Its Swift bridge must not
  // redeclare this module's callback helpers, which use this module's
  // `ResultTag`.
  numberCallback: (value: number) => void
}
