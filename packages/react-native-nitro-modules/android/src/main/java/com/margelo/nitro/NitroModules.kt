package com.margelo.nitro

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.turbomodule.core.interfaces.BindingsInstallerHolder
import com.facebook.react.turbomodule.core.interfaces.TurboModuleWithJSIBindings

@DoNotStrip
@Keep
@Suppress("KotlinJniMissingFunction")
class NitroModules internal constructor(
  val context: ReactApplicationContext,
) : NativeNitroModulesSpec(context),
  TurboModuleWithJSIBindings {
  init {
    applicationContext = context
  }

  override fun getName(): String {
    return NAME
  }

  @DoNotStrip
  external override fun getBindingsInstaller(): BindingsInstallerHolder

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
