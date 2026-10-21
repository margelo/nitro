package com.margelo.nitro.test

import android.os.Build
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.test.external.HybridSomeExternalObjectSpec

@Keep
@DoNotStrip
class HybridPlatformObject private constructor() : HybridPlatformObjectSpec() {
  companion object : HybridPlatformObjectSpec.Companion {
    override fun constructor(): HybridPlatformObject = HybridPlatformObject()
  }

  override fun createBase(): HybridBaseSpec = HybridBase()

  override fun createChild(): HybridChildSpec = HybridChild()

  override fun createAlternativeBase(): HybridBaseSpec = HybridBase.createAlternativeBase()

  override fun createInternalObject(): HybridSomeExternalObjectSpec = HybridSomeInternalObject()

  override fun getOSVersion(): String {
    return Build.VERSION.RELEASE
  }
}
