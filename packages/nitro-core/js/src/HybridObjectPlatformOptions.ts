/**
 * Identifies the concrete Swift class implementing a HybridObject spec.
 */
export interface SwiftHybridObjectImplementation {
  /**
   * The concrete Swift class you wrote to implement this HybridObject spec.
   * Must be defined in the same Swift module as the generated spec.
   * @example "HybridImage"
   */
  className: string
}

/**
 * Identifies the concrete C++ class implementing a HybridObject spec.
 */
export interface CppHybridObjectImplementation {
  /**
   * The implementation's sub-namespace within the declaring spec's `cxxNamespace` in nitro.json.
   * Omit this or use an empty array to select that project's namespace.
   * @example ["internal"] // margelo::nitro::<project namespace>::internal
   */
  namespace?: string[]
  /**
   * The header declaring the implementation class, including angle brackets or quotes.
   * @example "<NitroImage/HybridImage.hpp>"
   */
  include: `<${string}>` | `"${string}"`
  /**
   * The concrete C++ class you wrote to implement this HybridObject spec.
   * @example "HybridImage"
   */
  className: string
}

/**
 * Identifies the concrete Kotlin class implementing a HybridObject spec.
 */
export interface KotlinHybridObjectImplementation {
  /**
   * The implementation's sub-package within the declaring spec's `android.namespace` in nitro.json.
   * Omit this or use an empty array to select that project's package.
   * @example ["internal"] // com.margelo.nitro.<project package>.internal
   */
  package?: string[]
  /**
   * The concrete Kotlin class you wrote to implement this HybridObject spec.
   * @example "HybridImage"
   */
  className: string
}

/**
 * A Swift protocol that the generated Swift spec protocol inherits from.
 */
export interface SwiftProtocolConformance {
  /**
   * The Swift protocol to inherit from. It must be public.
   * Without `module`, the generated spec adds no import, so declare it in the spec's own Swift module or use a Swift standard library protocol.
   * @example "View"
   */
  protocol: string
  /**
   * The Swift module declaring the protocol, if it is not the spec's own module.
   * The generated spec imports it publicly.
   * @example "MyViews"
   */
  module?: string
}

/**
 * A Kotlin interface that the generated Kotlin spec class implements.
 */
export interface KotlinImplementedInterface {
  /**
   * The simple name of the Kotlin interface to implement, without type arguments.
   * @example "View"
   */
  interface: string
  /**
   * The full package declaring the interface, not relative to `android.namespace`.
   * For a nested interface, this includes its outer class, e.g. "android.view.SurfaceHolder".
   * The generated spec imports the interface from there.
   * @example "com.margelo.nitro.renderer"
   */
  package: string
}

interface HybridObjectImplementations {
  'c++': CppHybridObjectImplementation
  'swift': SwiftHybridObjectImplementation
  'kotlin': KotlinHybridObjectImplementation
}

interface HybridObjectLanguageOptions {
  'c++': {}
  'swift': {
    /**
     * Extra Swift protocols the generated spec protocol inherits from, in this order.
     * Implementations must satisfy their requirements.
     * Defaults to none.
     * @example [{ protocol: "View" }]
     */
    protocolConformances?: SwiftProtocolConformance[]
  }
  'kotlin': {
    /**
     * Extra Kotlin interfaces the generated spec class implements, in this order.
     * Implementations must implement their abstract members.
     * Defaults to none.
     * @example [{ interface: "View", package: "com.margelo.nitro.renderer" }]
     */
    implementedInterfaces?: KotlinImplementedInterface[]
  }
}

/**
 * Selects a platform's language, implementation mode, spec inheritance, and extra Swift protocols or Kotlin interfaces for the generated spec.
 *
 * @example
 * ```ts
 * @Apple({
 *   language: 'swift',
 *   implementation: { className: 'HybridImage' },
 * })
 * export declare class Image extends HybridObject {
 *   readonly width: number
 *   readonly height: number
 * }
 * ```
 */
export type HybridObjectPlatformOptions<Language extends keyof HybridObjectImplementations> = {
  [L in Language]: {
    /**
     * The native language used to implement this spec on the selected platform.
     * @example "swift"
     */
    language: L
  } & HybridObjectLanguageOptions[L] &
    (
      | {
          /**
           * The native class implementing every instance of this spec.
           * @example { className: "HybridImage" }
           */
          implementation: HybridObjectImplementations[L]
          /**
           * Cannot be combined with a concrete implementation.
           */
          allowMultipleImplementations?: never
          /**
           * Specs with a concrete implementation cannot be extended.
           * Omit this option or set it to false.
           */
          allowInheritance?: false
        }
      | {
          /**
           * Allows different native classes to implement this spec.
           * @example true
           */
          allowMultipleImplementations: true
          /**
           * Cannot select a concrete implementation when multiple implementations are allowed.
           * Create instances through another HybridObject's factory methods.
           */
          implementation?: never
          /**
           * Allows other HybridObject specs to extend this spec on this platform.
           * Defaults to false.
           * @example true
           */
          allowInheritance?: boolean
        }
    )
}[Language]
