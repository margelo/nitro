package com.margelo.nitro.test.external

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridSomeExternalObject : HybridSomeExternalObjectSpec() {
  companion object : HybridSomeExternalObjectSpec.Companion {
    override fun constructor(): HybridSomeExternalObject = HybridSomeExternalObject()
  }

  override fun getValue(): String {
    return "Hello world!"
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
