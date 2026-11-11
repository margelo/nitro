package com.margelo.nitro.core

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.NullType.Companion.NULL

@DoNotStrip
@Keep
class NullType private constructor() {
  companion object {
    /**
     * Represents an explicit `null` from JS.
     * This is a singleton.
     */
    @DoNotStrip
    @Keep
    @JvmField
    val NULL = NullType()
  }

  override fun hashCode(): Int {
    return 0
  }

  override fun equals(other: Any?): Boolean {
    return other is NullType
  }
}
