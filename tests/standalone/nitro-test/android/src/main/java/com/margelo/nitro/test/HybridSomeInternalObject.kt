package com.margelo.nitro.test

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.test.external.HybridSomeExternalObjectSpec
import com.margelo.nitro.test.external.OptionalPrimitivesHolder

class HybridSomeInternalObject : HybridSomeExternalObjectSpec() {
  override fun getValue(): String {
    return "This is overridden!"
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
