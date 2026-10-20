package com.margelo.nitro.test

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.test.views.HybridRecyclableTestViewManager
import com.margelo.nitro.test.views.HybridTestViewManager

class NitroTestPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext,
  ): NativeModule? = null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider { HashMap() }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    val viewManagers = ArrayList<ViewManager<*, *>>()
    viewManagers.add(HybridTestViewManager())
    viewManagers.add(HybridRecyclableTestViewManager())
    return viewManagers
  }

  companion object {
    init {
      NitroTestOnLoad.initializeNative()
    }
  }
}
