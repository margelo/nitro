package com.margelo.nitro

import android.util.Log
import androidx.annotation.Keep
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.common.annotations.FrameworkAPI
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl
import com.facebook.react.turbomodule.core.interfaces.CallInvokerHolder
import dalvik.annotation.optimization.FastNative

@DoNotStrip
@Keep
@OptIn(FrameworkAPI::class)
@Suppress("KotlinJniMissingFunction")
class NitroModules internal constructor(
  val context: ReactApplicationContext,
) : NitroModulesSpec(context) {
  private val mHybridData: HybridData

  init {
    mHybridData = initHybrid()
    applicationContext = context
  }

  override fun getName(): String {
    return NAME
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun install(): String? {
    try {
      // 1. Get jsi::Runtime pointer
      val jsContext =
        context.javaScriptContextHolder
          ?: return "ReactApplicationContext.javaScriptContextHolder is null!"

      // 2. Get CallInvokerHolder
      val callInvokerHolder =
        context.jsCallInvokerHolder as? CallInvokerHolderImpl
          ?: return "ReactApplicationContext.jsCallInvokerHolder is null!"

      // 3. Install Nitro
      install(jsContext.get(), callInvokerHolder)

      return null
    } catch (e: Throwable) {
      // ?. Something went wrong! Maybe a JNI error?
      Log.e(NAME, "Failed to install Nitro!", e)
      return e.message
    }
  }

  @FastNative
  private external fun initHybrid(): HybridData

  private external fun install(
    jsRuntimePointer: Long,
    callInvokerHolder: CallInvokerHolderImpl,
  )

  companion object {
    /**
     * The TurboModule's name.
     */
    const val NAME = "NitroModules"

    /**
     * Get the current `ReactApplicationContext`, or `null` if none is available.
     */
    @JvmStatic
    var applicationContext: ReactApplicationContext? = null

    init {
      // Make sure Nitro's C++ library is loaded
      JNIOnLoad.initializeNativeNitro()
    }
  }
}
