package com.margelo.nitro.test.external

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Callback

@Keep
@DoNotStrip
class HybridSomeExternalObject : HybridSomeExternalObjectSpec() {
  override var numberCallback: Callback<(value: Double) -> Unit> = Callback.native { _ -> }

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
