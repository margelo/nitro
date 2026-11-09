package com.margelo.nitro.test

import android.view.View
import com.facebook.react.uimanager.PixelUtil
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.test.views.HybridPaddedTestViewManager
import kotlin.math.roundToInt

// Regression test: generated ViewManagers must support subclassing and overriding React Native methods.
class PaddedTestViewManager : HybridPaddedTestViewManager() {
  override fun createViewInstance(reactContext: ThemedReactContext): View {
    val view = super.createViewInstance(reactContext)
    setPadding(view, 0, 0, 0, 0)
    return view
  }

  override fun setPadding(
    view: View,
    left: Int,
    top: Int,
    right: Int,
    bottom: Int,
  ) {
    val padding = PixelUtil.toPixelFromDIP(7f).roundToInt()
    view.setPadding(padding, padding, padding, padding)
  }
}
