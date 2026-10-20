export interface HybridObjectName {
  /**
   * The raw name of the Hybrid Object (same as the TypeScript class name).
   * @example "Image"
   */
  T: string
  /**
   * The debug-only description name of the Hybrid Object as it can be described in natively.
   * @example "HybridImage"
   */
  HybridT: string
  /**
   * The name of the C++ class, Kotlin interface or Swift protocol that represents the
   * specification (all of its virtual properties and methods) of the Hybrid Object.
   * @example "HybridImageSpec"
   */
  HybridTSpec: string
  /**
   * The name of the Swift class that bridges any types from
   * {@linkcode HybridTSpec} over to C++.
   * This includes a few type conversions or result/exception wrapping.
   * @example "HybridImage_cxx"
   */
  HybridTSpecCxx: string
  /**
   * The name of the C++ class that actually bridges to the Java Hybrid Object.
   * @example "JHybridImage"
   */
  JHybridTSpec: string
  /**
   * The name of the C++ class that extends the Hybrid Object and bridges over to the Swift C++ wrapper class.
   * @example "HybridImageSwift"
   */
  HybridTSpecSwift: string
}

export function getHybridObjectName(
  hybridObjectName: string
): HybridObjectName {
  return {
    T: hybridObjectName,
    HybridT: `Hybrid${hybridObjectName}`,
    HybridTSpec: `Hybrid${hybridObjectName}Spec`,
    HybridTSpecCxx: `Hybrid${hybridObjectName}Spec_cxx`,
    JHybridTSpec: `JHybrid${hybridObjectName}Spec`,
    HybridTSpecSwift: `Hybrid${hybridObjectName}SpecSwift`,
  }
}
