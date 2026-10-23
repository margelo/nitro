package com.margelo.nitro.test

import com.margelo.nitro.core.Callback
import com.margelo.nitro.test.external.OptionalPrimitivesHolder

class HybridSomeExternalObjectChild : HybridSomeExternalObjectChildSpec() {
  companion object : HybridSomeExternalObjectChildSpec.Companion {
    override fun constructor(): HybridSomeExternalObjectChild = HybridSomeExternalObjectChild()
  }

  override var numberCallback: Callback<(value: Double) -> Unit> = Callback.native { _ -> }

  override val childValue: Double
    get() = 42.0

  override fun getValue(): String {
    return "Hello from SomeExternalObjectChild!"
  }

  override fun createOptionalPrimitivesHolder(
    optionalNumber: Double?,
    optionalBoolean: Boolean?,
    optionalUInt64: ULong?,
    optionalInt64: Long?,
  ): OptionalPrimitivesHolder {
    return OptionalPrimitivesHolder(optionalNumber, optionalBoolean, optionalUInt64, optionalInt64)
  }
}
