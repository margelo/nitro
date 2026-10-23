package com.margelo.nitro.core

import androidx.annotation.Keep
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip

/**
 * The base class of generated callback classes, which hold a C++ `Callback<...>`.
 *
 * Each module generates its own class for a callback signature. Through this base class,
 * a module calls the JS function of a callback that another module created.
 */
@Suppress("unused")
@Keep
@DoNotStrip
abstract class CxxCallback protected constructor(
  hybridData: HybridData,
) {
  @Keep
  @DoNotStrip
  private val mHybridData: HybridData = hybridData
}
