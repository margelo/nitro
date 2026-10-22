package com.margelo.nitro.test

import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.resolved

class HybridGrandchild : HybridGrandchildSpec() {
  companion object : HybridGrandchildSpec.Companion {
    override fun constructor(): HybridGrandchild = HybridGrandchild()
  }

  override val baseValue: Double
    get() = 20.0
  override val childValue: Double
    get() = 30.0
  override val grandchildValue: Double
    get() = 40.0

  override fun bounceSize(size: Size): Size = size

  override fun bounceSizeUnit(unit: SizeUnit): SizeUnit = unit

  override fun mapSize(
    size: Size,
    callback: (Size) -> Size,
  ): Promise<Size> {
    return Promise.resolved(callback(size))
  }

  override fun bounceVariant(variant: NamedVariant): NamedVariant = variant

  override fun toString(): String = "HybridChild custom toString() :)"
}
