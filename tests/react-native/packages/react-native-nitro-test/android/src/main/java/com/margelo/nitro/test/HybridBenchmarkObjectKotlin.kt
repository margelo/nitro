package com.margelo.nitro.test

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.resolved
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Keep
@DoNotStrip
class HybridBenchmarkObjectKotlin : HybridBenchmarkObjectSwiftKotlinSpec() {
  private var pendingPromise: Promise<Double>? = null

  private companion object {
    val promiseScope = CoroutineScope(Dispatchers.Default)
  }

  override var numberValue: Double = 0.0
  override val thisObject: HybridBenchmarkObjectSwiftKotlinSpec
    get() = this

  override fun simpleFunc() {
    // do nothing
  }

  override fun addNumbers(
    a: Double,
    b: Double,
  ): Double {
    return a + b
  }

  override fun addStrings(
    a: String,
    b: String,
  ): String {
    return a + b
  }

  override fun bounceNumbers(array: DoubleArray): DoubleArray {
    return array
  }

  override fun bounceCar(car: Car): Car {
    return car
  }

  override fun bounceSimpleMap(map: Map<String, Double>): Map<String, Double> {
    return map
  }

  override fun tryOptionalParams(
    num: Double,
    boo: Boolean,
    str: String?,
  ): String {
    return str ?: "value omitted!"
  }

  override fun passVariant(either: Variant_Boolean_DoubleArray_Array_String__Double_String): Variant_Double_String {
    return either.match(
      { bool -> Variant_Double_String.create("holds something else!") },
      { doubleArray -> Variant_Double_String.create("holds something else!") },
      { stringArray -> Variant_Double_String.create("holds something else!") },
      { double -> Variant_Double_String.create(double) },
      { string -> Variant_Double_String.create(string) },
    )
  }

  override fun newBenchmarkObject(): HybridBenchmarkObjectSwiftKotlinSpec {
    return HybridBenchmarkObjectKotlin()
  }

  override fun bounceArrayBuffer(buffer: ArrayBuffer): ArrayBuffer {
    return buffer
  }

  override fun copyBuffer(buffer: ArrayBuffer): ArrayBuffer {
    return ArrayBuffer.copy(buffer)
  }

  override fun callbackSync(callback: () -> Double): Double {
    val value = callback()
    return value
  }

  override fun promiseReturnsInstantly(): Promise<Double> {
    return Promise.resolved(55.0)
  }

  override fun createPendingPromise(): Promise<Double> {
    check(pendingPromise == null) { "A pending Promise is already waiting for completion." }
    val promise = Promise<Double>()
    pendingPromise = promise
    return promise
  }

  override fun resolvePendingPromiseOnWorker() {
    val promise = checkNotNull(pendingPromise) { "No pending Promise is waiting for completion." }
    // Only JS calls access the slot; the worker owns the extracted Promise.
    pendingPromise = null
    promiseScope.launch {
      promise.resolve(55.0)
    }
  }
}
