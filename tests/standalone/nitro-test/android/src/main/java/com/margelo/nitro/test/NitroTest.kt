package com.margelo.nitro.test

import com.margelo.nitro.testing.NitroCore

object NitroTest {
  init {
    NitroCore.initialize()
    System.loadLibrary("NitroTestExternal")
    NitroTestOnLoad.initializeNative()
  }

  /** Loads both fixture libraries and registers their HybridObjects once. */
  fun initialize() = Unit
}
