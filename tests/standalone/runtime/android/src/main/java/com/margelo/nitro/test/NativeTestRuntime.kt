package com.margelo.nitro.test

import com.margelo.nitro.testing.NitroCore

internal object NativeTestRuntime {
  init {
    NitroCore.initialize()
    System.loadLibrary("NitroTestExternal")
    System.loadLibrary("NitroRuntimeTests")
  }

  /** Returns an empty string on success, or the JavaScript failure and its stack. */
  external fun runTest(
    bundle: String,
    name: String,
    timeoutMs: Int = 10_000,
  ): String
}
