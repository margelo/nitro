package com.margelo.nitro.test

import android.graphics.Color
import android.view.ViewGroup
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.views.NitroViewGroup

@Keep
@DoNotStrip
class HybridChildrenTestView(
  val context: ThemedReactContext,
) : HybridChildrenTestViewSpec() {
  // View - React children are mounted into it
  override val view: ViewGroup = NitroViewGroup(context)

  // Props
  override var isBlue: Boolean = false
    set(value) {
      field = value
      view.setBackgroundColor(if (value) Color.BLUE else Color.RED)
    }

  // Methods
  override fun getNativeChildCount(): Double = view.childCount.toDouble()
}
