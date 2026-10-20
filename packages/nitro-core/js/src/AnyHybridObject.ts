import type { HybridObject } from './HybridObject.js'

/**
 * Represents a value of the base `HybridObject` type all other
 * HybridObjects inherit from.
 * This is not type-checked to an actual `HybridObject` (boxed).
 */
export interface AnyHybridObject extends HybridObject {
  __anyHybridObjectTag?: never
}
