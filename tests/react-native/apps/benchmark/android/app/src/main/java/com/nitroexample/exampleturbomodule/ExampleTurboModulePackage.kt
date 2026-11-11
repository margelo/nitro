package com.nitroexample.exampleturbomodule

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class ExampleTurboModulePackage: BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        if (name == ExampleTurboModuleModule.NAME) {
            return ExampleTurboModuleModule(reactContext)
        } else {
            return null
        }
    }
    override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
        mapOf(
            ExampleTurboModuleModule.NAME to ReactModuleInfo(
                ExampleTurboModuleModule.NAME,
                ExampleTurboModuleModule.NAME,
                false, // canOverrideExistingModule
                false, // needsEagerInit
                false, // isCxxModule
                true // isTurboModule
            )
        )
    }
}
