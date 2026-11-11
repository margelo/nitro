package com.margelo.nitro.utils

import androidx.annotation.Keep
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip

@Suppress("unused", "KotlinJniMissingFunction")
@DoNotStrip
@Keep
class NativeRunnable : Runnable {
  private var mHybridData: HybridData

  private constructor(hybridData: HybridData) {
    mHybridData = hybridData
  }

  external override fun run()
}
