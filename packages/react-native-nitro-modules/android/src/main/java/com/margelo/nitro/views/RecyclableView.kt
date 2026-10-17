package com.margelo.nitro.views

/**
 * A `HybridView` that can also be recycled.
 */
interface RecyclableView {
  /**
   * Called when the view is going to be recycled to
   * be re-used later on with different props.
   *
   * This is a good place to reset any internal state
   * to it's default value.
   */
  fun prepareForRecycle()
}
