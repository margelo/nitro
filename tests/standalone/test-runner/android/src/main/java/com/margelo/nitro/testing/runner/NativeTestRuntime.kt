package com.margelo.nitro.testing.runner

import com.margelo.nitro.test.NitroTest

internal object NativeTestRuntime {
  init {
    NitroTest.initialize()
    System.loadLibrary("NitroTestRunner")
  }

  /** Returns an empty string on success, or the JavaScript failure and its stack. */
  external fun runTest(
    bundle: String,
    name: String,
    timeoutMs: Int = 10_000,
  ): String
}
