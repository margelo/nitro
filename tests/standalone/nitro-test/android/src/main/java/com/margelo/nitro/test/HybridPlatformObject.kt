package com.margelo.nitro.test

import android.os.Build
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

@Keep
@DoNotStrip
class HybridPlatformObject : HybridPlatformObjectSpec() {
  override fun getOSVersion(): String {
    return Build.VERSION.RELEASE
  }
}
