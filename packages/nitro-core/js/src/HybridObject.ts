/**
 * Describes the languages this component will be implemented in.
 *
 * By default, everything has a C++ base, and can optionally be bridged down
 * to platform-specific languages like Swift or Kotlin
 */
export interface PlatformSpec {
  ios?: 'c++' | 'swift'
  android?: 'c++' | 'kotlin'
}

/**
 * Represents a Nitro `HybridObject` which is implemented in a native language like
 * C++, Swift or Kotlin.
 * Every Nitro `HybridObject` has a C++ base, and can optionally be bridged down to Swift or Kotlin.
 *
 * `HybridObject`s use the Nitro Tunnel for efficient, low-overhead JS <-> Native communication.
 *
 * All `HybridObject`s are implemented using `NativeState`, and inherit their properties
 * and methods from their prototype, so the actual JS object is empty.
 *
 * @type Platforms: The type of platforms this HybridObject will be implemented in.
 * @example
 * ```ts
 * interface Photo extends HybridObject<{ ios: 'swift', android: 'kotlin' }> {
 *   readonly width: number
 *   readonly height: number
 *   toArrayBuffer(): ArrayBuffer
 *   saveToFile(path: string): Promise<void>
 * }
 * ```
 */
export interface HybridObject<Platforms extends PlatformSpec> {
  /**
   * Holds a type-name describing the native `HybridObject` instance.
   *
   * This is the only property actually present on the actual JavaScript object,
   * because all other properties and methods are inherited from a shared Prototype.
   *
   * Nitro prototypes also have a `__type`.
   *
   * - For actual HybridObject instances, this is `HybridObject<...>`
   * - For prototypes this is `Prototype<...>`.
   *
   * @internal
   * @private
   * @note This value is available in debug only.
   */
  readonly __type?: string
  /**
   * The `HybridObject`'s name.
   */
  readonly name: string
  /**
   * Returns a string representation of the given `HybridObject`.
   *
   * Unless overridden by the `HybridObject`, this will return the name of the object.
   *
   * @example
   * ```ts
   * const hybridA = SomeModule.getExistingHybridInstance()
   * console.log(hybridA.toString()) // [HybridObject HybridA]
   * ```
   */
  toString(): string
  /**
   * Returns whether this `HybridObject` is the same object as {@linkcode other}.
   *
   * While two `HybridObject`s might not be equal when compared with `==`, they might still
   * hold the same underlying `HybridObject`, in which case {@linkcode equals | equals(other)}
   * will return `true`.
   *
   * @example
   * ```ts
   * const hybridA = SomeModule.getExistingHybridInstance()
   * const hybridB = SomeModule.getExistingHybridInstance()
   * console.log(hybridA.equals(hybridB)) // true
   * ```
   */
  equals(other: HybridObject<Platforms>): boolean
  /**
   * Disposes any resources this {@linkcode HybridObject} might hold natively,
   * and releases this {@linkcode HybridObject}'s `NativeState`.
   *
   * After calling {@linkcode dispose()}, this object can no longer be used.
   *
   * Eagerly disposing a {@linkcode HybridObject} could be beneficial for a queue-/handler-architecture
   * where a bunch of Hybrid Objects are allocated, and later deallocated once a callback (e.g. a render function)
   * completes.
   *
   * @note It is **NOT** required to call {@linkcode dispose()} manually, as the JavaScript
   * Garbage Collector automatically disposes and releases any resources when needed.
   * It is purely optional to eagerly-, and manually-, call {@linkcode dispose()} here - **use with caution!**
   */
  dispose(): void
}
