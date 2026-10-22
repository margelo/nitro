package com.margelo.nitro.$$androidNamespace$$

class HybridExample : HybridExampleSpec() {
  companion object : HybridExampleSpec.Companion {
    override fun constructor(): HybridExample = HybridExample()
  }

  override fun add(a: Double, b: Double): Double = a + b
}
