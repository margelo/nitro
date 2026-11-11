package com.margelo.nitro.test

import android.graphics.Color
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.FrameLayout
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.uimanager.ThemedReactContext

@Keep
@DoNotStrip
class HybridPaddedTestView(
  context: ThemedReactContext,
) : HybridPaddedTestViewSpec() {
  override val view =
    FrameLayout(context).apply {
      val content = View(context).apply { setBackgroundColor(Color.BLUE) }
      addView(content, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
    }
}
