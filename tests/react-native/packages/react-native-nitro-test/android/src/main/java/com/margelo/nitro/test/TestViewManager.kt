package com.margelo.nitro.test

import android.view.View
import com.margelo.nitro.test.views.HybridTestViewManager

// Regression test: generated ViewManagers must support subclassing and overriding React Native methods.
class TestViewManager : HybridTestViewManager() {
  override fun setPadding(
    view: View,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    super.setPadding(view, left, top, right, bottom)
  }
}
