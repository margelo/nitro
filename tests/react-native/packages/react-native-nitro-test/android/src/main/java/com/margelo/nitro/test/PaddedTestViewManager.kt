package com.margelo.nitro.test

import android.view.View
import com.margelo.nitro.test.views.HybridPaddedTestViewManager

// Regression test: generated ViewManagers must support subclassing and overriding React Native methods.
class PaddedTestViewManager : HybridPaddedTestViewManager() {
  override fun setPadding(
    view: View,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    view.setPadding(left, top, right, bottom)
  }
}
