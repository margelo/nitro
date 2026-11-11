package com.margelo.nitro.test

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridChild : HybridChildSpec() {
  override val baseValue: Double
    get() = 20.0
  override val childValue: Double
    get() = 30.0

  override fun bounceVariant(variant: NamedVariant): NamedVariant {
    return variant
  }

  override fun toString(): String {
    return "HybridChild custom toString() :)"
  }
}
