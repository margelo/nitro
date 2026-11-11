package com.margelo.nitro.test

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import androidx.annotation.Keep
import androidx.core.graphics.toColorInt
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.views.NitroViewGroup

class GradientView(context: Context) : NitroViewGroup(context) {
  private var gradientColors: IntArray = intArrayOf()
  private val paint = Paint()

  init {
    setWillNotDraw(false)
  }

  fun setGradientColors(colors: IntArray) {
    gradientColors = colors
    updateShader()
    invalidate()
  }

  override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
    super.onSizeChanged(w, h, oldw, oldh)
    updateShader()
  }

  private fun updateShader() {
    paint.shader = if (gradientColors.size >= 2 && width > 0 && height > 0) {
      LinearGradient(
        0f,
        0f,
        width.toFloat(),
        height.toFloat(),
        gradientColors,
        null,
        Shader.TileMode.CLAMP,
      )
    } else {
      null
    }
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    if (paint.shader != null) {
      canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), paint)
    }
  }
}

@Keep
@DoNotStrip
class HybridGradientView(
  val context: ThemedReactContext,
) : HybridGradientViewSpec() {
  // View
  override val view: GradientView = GradientView(context)

  // Props
  override var colors: Array<String> = arrayOf()
    set(value) {
      field = value
      val parsed = value.mapNotNull { runCatching { it.toColorInt() }.getOrNull() }
      view.setGradientColors(parsed.toIntArray())
    }
}
