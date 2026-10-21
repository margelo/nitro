package com.margelo.nitro.test

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.resolved
import com.margelo.nitro.test.external.HybridSomeExternalObjectSpec

@Keep
@DoNotStrip
open class HybridBase : HybridBaseSpec() {
  companion object : HybridBaseSpec.Companion {
    override fun constructor(): HybridBase = HybridBase()

    @JvmStatic
    override fun createAlternativeBase(): HybridBaseSpec = HybridAlternativeBase()

    @JvmStatic
    override fun createInternalExternalObject(): HybridSomeExternalObjectSpec = HybridSomeInternalObject()
  }

  override val baseValue: Double
    get() = 10.0

  override fun bounceSize(size: Size): Size = size

  override fun bounceSizeUnit(unit: SizeUnit): SizeUnit = unit

  override fun mapSize(
    size: Size,
    callback: (Size) -> Size,
  ): Promise<Size> {
    return Promise.resolved(callback(size))
  }
}

private class HybridAlternativeBase : HybridBase() {
  override val baseValue: Double
    get() = 11.0
}
