package com.margelo.nitro.test.external

import android.graphics.Color
import android.view.View
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

@Keep
@DoNotStrip
class HybridTestView(
  context: ThemedReactContext,
) : HybridTestViewSpec() {
  companion object : HybridTestViewSpec.Companion {}

  override val view: View = View(context)

  override var isBlue: Boolean = false
    set(value) {
      field = value
      view.setBackgroundColor(if (value) Color.BLUE else Color.RED)
    }
  override var someCallback: () -> Unit = {}

  override fun someMethod() {
    someCallback()
  }

  override fun getModuleName(): String = "NitroTestExternal"
}
