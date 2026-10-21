package com.margelo.nitro.test.external

import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.resolved

class HybridBase : HybridBaseSpec() {
  companion object : HybridBaseSpec.Companion {
    override fun constructor(): HybridBase = HybridBase()
  }

  override val baseValue: Double
    get() = 20.0

  override fun bounceSize(size: Size): Size = size

  override fun bounceSizeUnit(unit: SizeUnit): SizeUnit = unit

  override fun mapSize(
    size: Size,
    callback: (Size) -> Size,
  ): Promise<Size> {
    return Promise.resolved(callback(size))
  }
}
