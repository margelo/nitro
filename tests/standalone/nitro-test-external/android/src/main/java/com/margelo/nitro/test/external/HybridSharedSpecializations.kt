package com.margelo.nitro.test.external

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import com.margelo.nitro.core.resolved

@Keep
@DoNotStrip
class HybridSharedSpecializations : HybridSharedSpecializationsSpec() {
  override var numberCallback: (value: Double) -> Unit = {}

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

  override fun callVoid(callback: () -> Unit) {
    callback()
  }

  override fun callWithNumber(
    value: Double,
    callback: (value: Double) -> Unit,
  ) {
    callback(value)
  }

  override fun callWithString(
    value: String,
    callback: (value: String) -> Unit,
  ) {
    callback(value)
  }

  override fun mapNumber(
    value: Double,
    callback: (value: Double) -> Double,
  ): Promise<Double> {
    return asPromise { callback(value) }
  }

  override fun wrapNumberCallback(callback: (value: Double) -> Unit): (value: Double) -> Unit {
    return { value -> callback(value) }
  }

  override fun callVoidPromiseCallback(callback: () -> Promise<Unit>): Promise<Unit> {
    return try {
      callback()
    } catch (error: Throwable) {
      Promise.rejected(error)
    }
  }

  override fun callNumberPromiseCallback(callback: () -> Promise<Double>): Promise<Double> {
    return try {
      callback()
    } catch (error: Throwable) {
      Promise.rejected(error)
    }
  }

  override fun callInline(callback: () -> Unit) {
    callback()
  }

  override fun callInlineWithNumber(
    value: Double,
    callback: (value: Double) -> Double,
  ): Double {
    return callback(value)
  }

  private inline fun <T> asPromise(action: () -> T): Promise<T> {
    return try {
      Promise.resolved(action())
    } catch (error: Throwable) {
      Promise.rejected(error)
    }
  }
}
