package com.margelo.nitro.test

import android.content.Context
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.views.NitroViewGroup

/** A [NitroViewGroup] that keeps a single container child at its own size. */
private class ContainerHostView(
  context: Context,
) : NitroViewGroup(context) {
  val childrenContainer = NitroViewGroup(context)

  init {
    addView(childrenContainer)
  }

  override fun onSizeChanged(
    width: Int,
    height: Int,
    oldWidth: Int,
    oldHeight: Int,
  ) {
    super.onSizeChanged(width, height, oldWidth, oldHeight)
    // [NitroViewGroup] doesn't lay out its children, so place the container here.
    childrenContainer.measure(
      View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
      View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY),
    )
    childrenContainer.layout(0, 0, width, height)
  }
}

@Keep
@DoNotStrip
class HybridChildrenContainerTestView(
  val context: ThemedReactContext,
) : HybridChildrenContainerTestViewSpec() {
  private val hostView = ContainerHostView(context)

  // View
  override val view: ViewGroup = hostView

  // React children are mounted into this sub-view instead of `view`
  override val childrenContainer: ViewGroup = hostView.childrenContainer

  // Props
  override var isBlue: Boolean = false
    set(value) {
      field = value
      hostView.setBackgroundColor(if (value) Color.BLUE else Color.RED)
    }

  // Methods
  override fun getNativeChildCount(): Double = hostView.childrenContainer.childCount.toDouble()

  override fun getViewChildCount(): Double = hostView.childCount.toDouble()
}
