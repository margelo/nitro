package com.nitroexample.exampleturbomodule

import com.facebook.react.bridge.ReactApplicationContext

class ExampleTurboModuleModule(reactContext: ReactApplicationContext) : NativeExampleTurboModuleSpec(reactContext) {
    override fun getName() = NAME

    override fun addNumbers(a: Double, b: Double): Double {
        return a + b
    }

    override fun collectGarbage(): Boolean {
        // Hermes collection alone cannot reclaim Java-backed direct buffers.
        // Return a value so React Native codegen makes this call synchronous.
        System.gc()
        System.runFinalization()
        System.gc()
        return true
    }

    companion object {
        const val NAME = "ExampleTurboModule"
    }
}
