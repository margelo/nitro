package com.margelo.nitro.core

import android.hardware.HardwareBuffer
import android.os.Build
import android.util.Log
import androidx.annotation.Keep
import androidx.annotation.RequiresApi
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.utils.HardwareBufferUtils
import dalvik.annotation.optimization.FastNative
import java.nio.ByteBuffer
import java.nio.ByteOrder

private fun ByteBuffer.arrayBufferView(): ByteBuffer {
  val view = duplicate()
  view.order(ByteOrder.nativeOrder())
  // This only resets the view's cursor; it does not clear or overwrite bytes.
  view.clear()
  return view
}

// AHardwareBuffer* needs to be boxed in jobject*
typealias BoxedHardwareBuffer = Any

/**
 * An ArrayBuffer instance shared between native (Kotlin/C++) and JS.
 *
 * A `ByteBuffer` will be used as the underlying `ArrayBuffer`'s data,
 * which has to remain valid for as long as the `ArrayBuffer` is alive.
 *
 * An `ArrayBuffer` holds a reference to its memory until the Java garbage collector frees it.
 * Call [close] (or use [use]) to release it right away.
 */
@Suppress("KotlinJniMissingFunction")
@Keep
@DoNotStrip
class ArrayBuffer : AutoCloseable {
  /**
   * Holds the native C++ instance of the `ArrayBuffer`.
   */
  private val mHybridData: HybridData

  /**
   * Whether this `ArrayBuffer` is an **owning-**, or a **non-owning-** `ArrayBuffer`.
   * - **Owning** ArrayBuffers can safely be held in memory for longer, and accessed at any point.
   * - **Non-owning** ArrayBuffers can not be held in memory for longer, and can only be safely
   * accessed within the synchronous function's scope (aka on the JS Thread). Once you switch Threads,
   * data access is not safe anymore. If you need to access data longer, copy the data.
   */
  val isOwner: Boolean
    get() {
      checkNotClosed()
      return getIsOwner()
    }

  /**
   * Whether this `ArrayBuffer` has been closed with [close].
   * A closed `ArrayBuffer` can no longer be accessed.
   */
  val isClosed: Boolean
    get() = !mHybridData.isValid

  /**
   * Whether this `ArrayBuffer` is holding a `ByteBuffer`, or not.
   * - If the `ArrayBuffer` holds a `ByteBuffer`, `getBuffer(false)` can safely be called to
   * get shared access to the underlying data, without performing any copies.
   * - If the `ArrayBuffer` doesn't hold a `ByteBuffer`, it can still be accessed via `getBuffer(false)`,
   * but the returned `ByteBuffer` is only valid as long as its parent `ArrayBuffer` is alive and not closed.
   */
  val isByteBuffer: Boolean

  /**
   * Whether this `ArrayBuffer` is holding a `HardwareBuffer`, or not.
   * - If the `ArrayBuffer` holds a `HardwareBuffer`, `getHardwareBuffer()` can safely be called without copy.
   * - If the `ArrayBuffer` doesn't hold a `HardwareBuffer`, `getHardwareBuffer()` will throw.
   * You will need to call `getByteBuffer(copyIfNeeded)` instead.
   */
  val isHardwareBuffer: Boolean
    get() {
      checkNotClosed()
      return getIsHardwareBuffer()
    }

  /**
   * Get the size of bytes in this `ArrayBuffer`.
   */
  val size: Int
    get() {
      checkNotClosed()
      return getBufferSize()
    }

  /**
   * Get a `ByteBuffer` that holds- or wraps- the underlying data.
   * - If this `ArrayBuffer` has been created from Kotlin/Java, it is already holding a
   * `ByteBuffer` (`isByteBuffer == true`). In this case, the returned buffer is safe to access,
   * even after the `ArrayBuffer` has already been destroyed in JS.
   * - If this `ArrayBuffer` has been created elsewhere (C++/JS), it is not holding a
   * `ByteBuffer` (`isByteBuffer == false`). In this case, the returned buffer will either be a copy
   * of the data (`copyIfNeeded == true`), or just wrapping the data (`copyIfNeeded == false`).
   *
   * @param copyIfNeeded If this `ArrayBuffer` is not holding a `ByteBuffer` (`isByteBuffer == false`),
   * the foreign data needs to be either _wrapped_, or _copied_ to be represented as a `ByteBuffer`.
   * This flag controls that behaviour.
   *
   * The returned `ByteBuffer` shares the underlying bytes, uses native byte order, but has its own
   * cursor state. Reading from or writing to the returned buffer can change the bytes, but changing
   * its `position`, `limit`, or `mark` will not affect the `ArrayBuffer`'s internal `ByteBuffer`.
   */
  fun getBuffer(copyIfNeeded: Boolean): ByteBuffer {
    checkNotClosed()
    val buffer = getByteBuffer(copyIfNeeded)
    return if (isByteBuffer) buffer.arrayBufferView() else buffer
  }

  /**
   * Get the underlying `HardwareBuffer` if this `ArrayBuffer` was created with one.
   * @throws Error if this `ArrayBuffer` was not created with a `HardwareBuffer`.
   */
  @RequiresApi(Build.VERSION_CODES.O)
  fun getHardwareBuffer(): HardwareBuffer {
    checkNotClosed()
    val boxed = getHardwareBufferBoxed()
    return boxed as HardwareBuffer
  }

  /**
   * Copies the underlying data into a `ByteArray`.
   * If this `ArrayBuffer` is backed by a GPU-HardwareBuffer,
   * this performs a GPU-download.
   * This does not mutate the underlying `ByteBuffer`'s cursor state.
   */
  fun toByteArray(): ByteArray {
    val buffer = this.getBuffer(false)
    if (buffer.hasArray()) {
      // It's a CPU-backed array - we can return this directly if the size matches
      val array = buffer.array()
      if (array.size == this.size && buffer.arrayOffset() == 0) {
        // The ByteBuffer is 1:1 mapped to a byte array - return as is!
        return array
      }
      // we had a CPU-backed array, but its size differs from our ArrayBuffer size.
      // This might be because the ArrayBuffer has a smaller view of the data, so we need
      // to resort back to a good ol' copy.
    }
    // It's not a 1:1 mapped array (e.g. HardwareBuffer) - we need to copy to the CPU.
    val copy = ByteArray(this.size)
    buffer.get(copy)
    return copy
  }

  /**
   * Returns an **owning** version of this `ArrayBuffer`.
   * If this `ArrayBuffer` already is **owning**, it is returned as-is.
   * If this `ArrayBuffer` is **non-owning**, it is _copied_.
   */
  fun asOwning(): ArrayBuffer {
    if (!isOwner) {
      return ArrayBuffer.copy(this)
    }
    return this
  }

  /**
   * Releases this `ArrayBuffer`'s reference to its memory right away, without waiting for the
   * Java garbage collector.
   *
   * - For **owning** `ArrayBuffer`s, the memory is freed once every other owner (e.g. JS, or
   * other native references) has released it too.
   * - For **non-owning** `ArrayBuffer`s, this releases the reference to the JS `ArrayBuffer`.
   *
   * Accessing this `ArrayBuffer` after closing it throws an [IllegalStateException].
   * If this `ArrayBuffer` does not hold a `ByteBuffer` (`isByteBuffer == false`), `ByteBuffer`s
   * previously returned by `getBuffer(false)` must not be used after closing it either.
   * Closing an `ArrayBuffer` that has already been closed has no effect.
   * Do not close an `ArrayBuffer` while another thread is still accessing it.
   */
  override fun close() {
    mHybridData.resetNative()
  }

  private fun checkNotClosed() {
    check(mHybridData.isValid) { "This ArrayBuffer has already been closed!" }
  }

  /**
   * Create a new **owning-** `ArrayBuffer` that holds the given `ByteBuffer`.
   * The `ByteBuffer` needs to remain valid for as long as the `ArrayBuffer` is alive.
   * [onDelete] runs once the last owner released the `ArrayBuffer`.
   */
  internal constructor(byteBuffer: ByteBuffer, onDelete: Runnable? = null) {
    if (!byteBuffer.isDirect) {
      throw Error(
        "ArrayBuffers can only be created from direct ByteBuffers, " +
          "and the given ByteBuffer is not direct!",
      )
    }
    mHybridData = initHybrid(byteBuffer, onDelete)
    isByteBuffer = true
  }

  /**
   * Create a new **owning-** `ArrayBuffer` that holds the given `HardwareBuffer`.
   * The `HardwareBuffer` needs to remain valid for as long as the `ArrayBuffer` is alive.
   * [onDelete] runs once the last owner released the `ArrayBuffer`.
   */
  @RequiresApi(Build.VERSION_CODES.O)
  internal constructor(hardwareBuffer: HardwareBuffer, onDelete: Runnable? = null) {
    if (hardwareBuffer.isClosed) {
      throw Error("Cannot create ArrayBuffer from an already-closed HardwareBuffer!")
    }
    mHybridData = initHybridBoxedHardwareBuffer(hardwareBuffer, onDelete)
    isByteBuffer = false
  }

  /**
   * Create a new **non-owning-** `ArrayBuffer` that holds foreign data, potentially coming from JS.
   */
  @Suppress("unused")
  @Keep
  @DoNotStrip
  private constructor(hybridData: HybridData) {
    mHybridData = hybridData
    isByteBuffer = getIsByteBuffer()
  }

  @FastNative
  private external fun initHybrid(
    buffer: ByteBuffer,
    onDelete: Runnable?,
  ): HybridData

  @RequiresApi(Build.VERSION_CODES.O)
  @FastNative
  private external fun initHybridBoxedHardwareBuffer(
    hardwareBufferBoxed: BoxedHardwareBuffer,
    onDelete: Runnable?,
  ): HybridData

  private external fun getByteBuffer(copyIfNeeded: Boolean): ByteBuffer

  @FastNative
  private external fun getHardwareBufferBoxed(): BoxedHardwareBuffer

  @FastNative
  private external fun getIsOwner(): Boolean

  @FastNative
  private external fun getIsByteBuffer(): Boolean

  @FastNative
  private external fun getIsHardwareBuffer(): Boolean

  @FastNative
  private external fun getBufferSize(): Int

  companion object {
    /**
     * Allocate a new `ArrayBuffer` with the given [size].
     */
    fun allocate(size: Int): ArrayBuffer {
      val buffer = ByteBuffer.allocateDirect(size)
      return ArrayBuffer(buffer)
    }

    /**
     * Copy the given `ArrayBuffer` into a new **owning** `ArrayBuffer`.
     */
    fun copy(other: ArrayBuffer): ArrayBuffer {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && other.isHardwareBuffer) {
        // Fast Path: Try copying the C++ HardwareBuffer
        try {
          val hardwareBuffer = other.getHardwareBuffer()
          try {
            return copy(hardwareBuffer)
          } finally {
            hardwareBuffer.close()
          }
        } catch (error: Throwable) {
          Log.w("ArrayBuffer", "Failed to copy HardwareBuffer, falling back to ByteBuffer copy...", error)
          // fallthrough
        }
      }

      val byteBuffer = other.getBuffer(false)
      return copy(byteBuffer)
    }

    /**
     * Copy the given `ByteBuffer` into a new **owning** `ArrayBuffer`.
     * This copies from the start of the buffer up to its current `limit`, and does not mutate the
     * given `ByteBuffer`'s cursor state.
     */
    fun copy(byteBuffer: ByteBuffer): ArrayBuffer {
      // 1. Find out size
      val source = byteBuffer.duplicate()
      source.rewind()
      val size = source.remaining()
      // 2. Create a new buffer with the same size as the other
      val newBuffer = ByteBuffer.allocateDirect(size)
      // 3. Copy over the source buffer into the new buffer
      newBuffer.put(source)
      // 4. Flip the new buffer for reads
      newBuffer.flip()
      // 5. Create a new `ArrayBuffer`
      return ArrayBuffer(newBuffer)
    }

    /**
     * Copy the given `ByteArray` into a new **owning** `ArrayBuffer`.
     */
    fun copy(byteArray: ByteArray): ArrayBuffer {
      val byteBuffer = ByteBuffer.allocateDirect(byteArray.size)
      byteBuffer.put(byteArray)
      return ArrayBuffer.wrap(byteBuffer)
    }

    /**
     * Copy the given `HardwareBuffer` into a new **owning** `ArrayBuffer`.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    fun copy(hardwareBuffer: HardwareBuffer): ArrayBuffer {
      val copy = HardwareBufferUtils.copyHardwareBuffer(hardwareBuffer)
      try {
        return ArrayBuffer(copy)
      } finally {
        copy.close()
      }
    }

    /**
     * Wrap the given `ByteBuffer` in a new **owning** `ArrayBuffer`.
     * This wraps the whole direct buffer capacity, and does not mutate the given `ByteBuffer`'s
     * cursor state.
     */
    fun wrap(byteBuffer: ByteBuffer): ArrayBuffer {
      return ArrayBuffer(byteBuffer.arrayBufferView())
    }

    /**
     * Wrap the given `ByteBuffer` in a new **owning** `ArrayBuffer` without copying it, and
     * call [onDelete] once the last owner (JS or native) released the `ArrayBuffer`.
     *
     * The bytes need to stay valid until [onDelete] runs. Use it to release the memory, e.g.
     * by closing an `Image`, calling `MediaCodec.releaseOutputBuffer(...)`, or returning the
     * `ByteBuffer` to a pool.
     *
     * [onDelete] runs once, on whichever thread released the last owner. Errors it throws are
     * reported to Nitro's global error handler. If this function throws, [onDelete] never runs.
     */
    fun wrap(
      byteBuffer: ByteBuffer,
      onDelete: () -> Unit,
    ): ArrayBuffer {
      return ArrayBuffer(byteBuffer.arrayBufferView(), onDeleteRunnable(onDelete))
    }

    /**
     * Wrap the given `HardwareBuffer` in a new **owning** `ArrayBuffer`.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    fun wrap(hardwareBuffer: HardwareBuffer): ArrayBuffer {
      return ArrayBuffer(hardwareBuffer)
    }

    /**
     * Wrap the given `HardwareBuffer` in a new **owning** `ArrayBuffer` without copying it, and
     * call [onDelete] once the last owner (JS or native) released the `ArrayBuffer`.
     *
     * The `ArrayBuffer` retains the `HardwareBuffer` itself, so the given `HardwareBuffer`
     * object can be closed right away. Use [onDelete] to release what owns its contents, e.g.
     * by closing the `Image` it came from.
     *
     * [onDelete] runs once, on whichever thread released the last owner. Errors it throws are
     * reported to Nitro's global error handler. If this function throws, [onDelete] never runs.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    fun wrap(
      hardwareBuffer: HardwareBuffer,
      onDelete: () -> Unit,
    ): ArrayBuffer {
      return ArrayBuffer(hardwareBuffer, onDeleteRunnable(onDelete))
    }

    private fun onDeleteRunnable(onDelete: () -> Unit): Runnable = Runnable { callNativeAndForget(onDelete) }
  }
}
