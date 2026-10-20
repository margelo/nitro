import type { HybridObject } from './HybridObject.js'

/**
 * Represents a boxed {@linkcode HybridObject} that can later be unboxed again.
 * This is implemented as a `jsi::HostObject`.
 */
export interface BoxedHybridObject<T extends HybridObject> {
  /**
   * Unboxes the {@linkcode HybridObject}.
   * This can be called from a different Runtime than the one it was boxed in.
   */
  unbox(): T
}
