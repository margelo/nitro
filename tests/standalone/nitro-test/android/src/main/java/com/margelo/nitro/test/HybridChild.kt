package com.margelo.nitro.test

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Callback
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.invoke

@Keep
@DoNotStrip
class HybridChild : HybridChildSpec() {
  override fun bounceSize(size: Size): Size = size

  override fun bounceSizeUnit(unit: SizeUnit): SizeUnit = unit

  override fun mapSize(
    size: Size,
    callback: Callback<(size: Size) -> Size>,
  ): Promise<Size> {
    return callback(size)
  }

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
