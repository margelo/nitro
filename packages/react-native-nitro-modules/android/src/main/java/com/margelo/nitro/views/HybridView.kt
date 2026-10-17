package com.margelo.nitro.views

import android.view.View
import com.margelo.nitro.core.HybridObject

/**
 * A base class for all Kotlin-based Hybrid Views.
 */
abstract class HybridView : HybridObject() {
  /**
   * Get the `View` this HybridView is holding.
   *
   * This value should not change during the lifetime of this `HybridView`.
   */
  abstract val view: View

  /**
   * Called right before updating props.
   * React props are updated in a single batch/transaction.
   */
  open fun beforeUpdate() { /* noop */ }

  /**
   * Called right after updating props.
   * React props are updated in a single batch/transaction.
   */
  open fun afterUpdate() { /* noop */ }

  /**
   * Called when the [HybridView] is about
   * to be dropped and unmounted.
   * This is a good place to clean up view-related
   * resources.
   */
  open fun onDropView() { /* noop */ }
}
