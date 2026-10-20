package com.margelo.nitro.test

import android.graphics.Color
import android.util.Log
import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.views.RecyclableView
import java.util.concurrent.atomic.AtomicInteger

@Keep
@DoNotStrip
class HybridRecyclableTestView(
  val context: ThemedReactContext,
) : HybridRecyclableTestViewSpec(),
  RecyclableView {
  // View
  override val view: View = View(context)
  private var isRecycled = false
  private val invalidLifecycleOrderCount = AtomicInteger()
  private val onDropViewCount = AtomicInteger()
  private val prepareForRecycleCount = AtomicInteger()
  private var nativeDefaultValueSetterCallCount = 0.0
  private var nativeDefaultValueStorage: Double? = 42.0

  // Props
  override var isBlue: Boolean = false
    set(value) {
      field = value
      if (!isRecycled) {
        val color = if (value) Color.BLUE else Color.RED
        view.setBackgroundColor(color)
      }
    }
  override var nativeDefaultValue: Double?
    get() = nativeDefaultValueStorage
    set(value) {
      nativeDefaultValueStorage = value
      nativeDefaultValueSetterCallCount += 1
    }

  override fun onDropView() {
    Log.i(TAG, "View dropped!")
    onDropViewCount.incrementAndGet()
  }

  override fun getOnDropViewCount(): Double = onDropViewCount.get().toDouble()

  override fun getInvalidLifecycleOrderCount(): Double = invalidLifecycleOrderCount.get().toDouble()

  override fun getPrepareForRecycleCount(): Double = prepareForRecycleCount.get().toDouble()

  override fun getNativeDefaultValueSetterCallCount(): Double = nativeDefaultValueSetterCallCount

  override fun beforeUpdate() {
    isRecycled = false
  }

  // Recycling conformance
  override fun prepareForRecycle() {
    if (onDropViewCount.get() != prepareForRecycleCount.get() + 1) {
      invalidLifecycleOrderCount.incrementAndGet()
    }
    nativeDefaultValueStorage = 42.0
    nativeDefaultValueSetterCallCount = 0.0
    view.setBackgroundColor(Color.YELLOW)
    isRecycled = true
    prepareForRecycleCount.incrementAndGet()
  }
}
