package com.margelo.nitro.core

import androidx.annotation.CallSuper
import androidx.annotation.Keep
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
import dalvik.annotation.optimization.FastNative

/**
 * A base class for all Kotlin-based HybridObjects.
 */
@Keep
@DoNotStrip
abstract class HybridObject {
  /**
   * Get the memory size of the Kotlin instance (plus any external heap allocations),
   * in bytes.
   *
   * Override this to allow tracking heap allocations such as buffers or images,
   * which will help the JS GC be more efficient in deleting large unused objects.
   *
   * @example
   * ```kotlin
   * override val memorySize: ULong
   *   get() {
   *     val imageSize = this.bitmap.bytesPerRow * this.bitmap.height
   *     return imageSize
   *   }
   * ```
   */
  @get:DoNotStrip
  @get:Keep
  open val memorySize: Long
    get() = 0L

  /**
   * Eagerly- (and manually-) dispose all native resources this `HybridObject` holds.
   * This method can only be manually called from JS using `dispose()`.
   *
   * If this method is never manually called, a `HybridObject` is expected to disposes its
   * resources as usual via the object's destructor (`~HybridObject()`, `deinit` or `finalize()`).
   *
   * By default, this method only destroys the connected C++ part.
   * It can be overridden to perform actual disposing/cleanup if required.
   * This method must not throw.
   */
  @DoNotStrip
  @Keep
  @CallSuper
  open fun dispose() {
    synchronized(this) {
      cxxPart?.destroy()
      cxxPart = null
    }
  }

  /**
   * Get a string representation of this `HybridObject` - useful for logging or debugging.
   */
  @DoNotStrip
  @Keep
  override fun toString(): String {
    val ownName = this::class.simpleName
    return "[HybridObject $ownName]"
  }

  /**
   * Override this method for each class in the inheritance
   * chain to connect it to a different C++ class.
   */
  protected open fun createCxxPart(): CxxPart {
    return CxxPart(this)
  }

  /**
   * Java `HybridObject` owns a (lazy) reference to Java `CxxPart`,
   * which itself owns the C++ `CxxPart`.
   * The C++ `CxxPart` must NOT have a reference back to Java,
   * otherwise a cyclic reference outside of JVM is created (= mem leak)
   */
  private var cxxPart: CxxPart? = null

  @Suppress("unused")
  @DoNotStrip
  @Keep
  private fun getCxxPart(): CxxPart {
    synchronized(this) {
      val currentCxxPart = this.cxxPart
      if (currentCxxPart != null) {
        return currentCxxPart
      } else {
        val newCxxPart = createCxxPart()
        this.cxxPart = newCxxPart
        return newCxxPart
      }
    }
  }

  @Keep
  @DoNotStrip
  @Suppress("KotlinJniMissingFunction")
  protected open class CxxPart(
    @Keep
    @DoNotStrip
    val javaPart: HybridObject,
  ) {
    @DoNotStrip
    @Keep
    private var mHybridData: HybridData

    init {
      mHybridData = initHybrid()
    }

    /**
     * Eagerly destroy the `CxxPart` and it's backing
     * C++ class.
     * If this is not called manually, the Java Garbage Collector
     * will eventually destroy the object (and it's backing C++
     * class) automatically.
     */
    fun destroy() {
      mHybridData.resetNative()
    }

    @FastNative
    protected open external fun initHybrid(): HybridData
  }
}
