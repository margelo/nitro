package com.margelo.nitro.test.external

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Callback
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.callSync
import com.margelo.nitro.core.invoke
import com.margelo.nitro.core.resolved

@Keep
@DoNotStrip
class HybridSharedSpecializations : HybridSharedSpecializationsSpec() {
  companion object : HybridSharedSpecializationsSpec.Companion {
    override fun constructor(): HybridSharedSpecializations = HybridSharedSpecializations()
  }

  override var numberCallback: Callback<(value: Double) -> Unit> = Callback.native { _ -> }

  override fun resolveVoid(): Promise<Unit> {
    return Promise.resolved()
  }

  override fun resolveNumber(value: Double): Promise<Double> {
    return Promise.async {
      return@async value
    }
  }

  override fun resolveString(value: String): Promise<String> {
    return Promise.resolved(value)
  }

  override fun awaitVoid(promise: Promise<Unit>): Promise<Unit> {
    return Promise.async {
      promise.await()
    }
  }

  override fun awaitNumber(promise: Promise<Double>): Promise<Double> {
    return Promise.async {
      return@async promise.await()
    }
  }

  override fun callVoid(callback: Callback<() -> Unit>) {
    callback()
  }

  override fun callWithNumber(
    value: Double,
    callback: Callback<(value: Double) -> Unit>,
  ) {
    callback(value)
  }

  override fun callWithString(
    value: String,
    callback: Callback<(value: String) -> Unit>,
  ) {
    callback(value)
  }

  override fun mapNumber(
    value: Double,
    callback: Callback<(value: Double) -> Double>,
  ): Promise<Double> {
    return Promise.async {
      callback(value).await()
    }
  }

  override fun wrapNumberCallback(callback: Callback<(value: Double) -> Unit>): Callback<(value: Double) -> Unit> {
    return Callback.native { value -> callback(value) }
  }

  override fun callVoidPromiseCallback(callback: Callback<() -> Promise<Unit>>): Promise<Unit> {
    return Promise.async {
      callback().await().await()
    }
  }

  override fun callNumberPromiseCallback(callback: Callback<() -> Promise<Double>>): Promise<Double> {
    return Promise.async {
      callback().await().await()
    }
  }

  override fun callInline(callback: Callback<() -> Unit>) {
    callback.callSync()
  }

  override fun callInlineWithNumber(
    value: Double,
    callback: Callback<(value: Double) -> Double>,
  ): Double {
    return callback.callSync(value)
  }
}
