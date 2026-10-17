package com.margelo.nitro.test

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridBase : HybridBaseSpec() {
  override val baseValue: Double
    get() = 10.0
}
