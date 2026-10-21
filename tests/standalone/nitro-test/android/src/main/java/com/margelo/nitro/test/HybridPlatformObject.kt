package com.margelo.nitro.test

import android.os.Build
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridPlatformObject private constructor() : HybridPlatformObjectSpec() {
  companion object : HybridPlatformObjectSpec.Companion {
    override fun constructor(): HybridPlatformObject = HybridPlatformObject()
  }

  override fun getOSVersion(): String {
    return Build.VERSION.RELEASE
  }
}
