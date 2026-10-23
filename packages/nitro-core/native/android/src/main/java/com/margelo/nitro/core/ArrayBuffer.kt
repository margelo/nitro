package com.margelo.nitro.core

import android.hardware.HardwareBuffer
import android.os.Build
import android.util.Log
import androidx.annotation.Keep
import androidx.annotation.RequiresApi
import com.facebook.jni.DestructorThread
import com.facebook.jni.HybridData
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.utils.HardwareBufferUtils
import dalvik.annotation.optimization.FastNative
import java.lang.ref.Reference
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
 * Its data can live in native memory, a `ByteBuffer`, a `HardwareBuffer`, or a JS `ArrayBuffer`.
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
   * which wraps the data without copying it.
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
   * Get a `ByteBuffer` that shares the underlying data without copying it.
   * - If this `ArrayBuffer` holds a `ByteBuffer` (`isByteBuffer == true`), the returned buffer
   * shares that `ByteBuffer`.
   * - Otherwise, the returned buffer wraps the data.
   *
   * The returned buffer keeps the data alive for as long as it is reachable, even if this
   * `ArrayBuffer` is closed. A `wrap(..., onDelete)` callback does not run before that.
   *
   * @param copyIfNeeded If this `ArrayBuffer` is **non-owning** (`isOwner == false`), its data is
   * only valid during the synchronous call it was passed to. Pass `true` to copy the data into a
   * new buffer that can be used later and on any thread. **Owning** `ArrayBuffer`s are never copied.
   *
   * The returned `ByteBuffer` shares the underlying bytes, uses native byte order, but has its own
   * cursor state. Reading from or writing to the returned buffer can change the bytes, but changing
   * its `position`, `limit`, or `mark` will not affect the `ArrayBuffer`'s internal `ByteBuffer`.
   *
   * Buffers derived from the returned buffer (e.g. with `slice()` or `duplicate()`) do not always
   * keep the data alive on their own, so keep the returned buffer reachable while using them.
   *
   * For temporary access, prefer [withByteBuffer], which does not keep the data alive until the
   * Java garbage collector frees the returned buffer.
   */
  fun getBuffer(copyIfNeeded: Boolean): ByteBuffer {
    checkNotClosed()
    if (copyIfNeeded && !getIsOwner()) {
      // The view keeps the copy alive, so this reference can go right away.
      return copyNative().use { it.getBuffer(false) }
    }
    val view = getScopedByteBuffer()
    if (view.capacity() > 0) {
      // Registers itself with fbjni's DestructorThread, which keeps it until `view` is collected.
      ViewOwner(view, retainArrayBuffer())
    }
    return view
  }

  /**
   * Calls [block] with a `ByteBuffer` that wraps this `ArrayBuffer`'s data, without copying it.
   *
   * The `ByteBuffer` is only valid within [block]. Do not let it escape, and do not close this
   * `ArrayBuffer` within [block]. This `ArrayBuffer` stays reachable until [block] returns.
   * Unlike [getBuffer], this does not allocate anything to keep the data alive.
   *
   * **Non-owning** `ArrayBuffer`s (`isOwner == false`) can only be accessed synchronously
   * during the call they were passed to.
   *
   * The `ByteBuffer` uses native byte order and has its own cursor state.
   */
  inline fun <R> withByteBuffer(block: (ByteBuffer) -> R): R {
    val buffer = getScopedByteBuffer()
    try {
      return block(buffer)
    } finally {
      keepAlive()
    }
  }

  @PublishedApi
  internal fun getScopedByteBuffer(): ByteBuffer {
    checkNotClosed()
    val buffer = getByteBuffer()
    return if (isByteBuffer) buffer.arrayBufferView() else buffer
  }

  /**
   * Keeps this `ArrayBuffer` reachable up to this call, so the Java garbage collector cannot free
   * its data while [withByteBuffer]'s block is still running.
   */
  @PublishedApi
  internal fun keepAlive() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      Reference.reachabilityFence(this)
    } else {
      // ART does not remove monitors, so this also keeps `this` reachable.
      synchronized(this) {}
    }
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
  fun toByteArray(): ByteArray =
    withByteBuffer { buffer ->
      if (buffer.hasArray()) {
        // It's a CPU-backed array - we can return this directly if the size matches
        val array = buffer.array()
        if (array.size == buffer.capacity() && buffer.arrayOffset() == 0) {
          // The ByteBuffer is 1:1 mapped to a byte array - return as is!
          return@withByteBuffer array
        }
        // we had a CPU-backed array, but its size differs from our ArrayBuffer size.
        // This might be because the ArrayBuffer has a smaller view of the data, so we need
        // to resort back to a good ol' copy.
      }
      // It's not a 1:1 mapped array (e.g. HardwareBuffer) - we need to copy to the CPU.
      val copy = ByteArray(buffer.capacity())
      buffer.get(copy)
      copy
    }

  /**
   * Returns an **owning** version of this `ArrayBuffer`.
   * If this `ArrayBuffer` already is **owning**, it is returned as-is.
   * If this `ArrayBuffer` is **non-owning**, it is _copied_.
   */
  fun asOwning(): ArrayBuffer {
    if (!isOwner) {
      return copyNative()
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
   * `ByteBuffer`s previously returned by [getBuffer] keep the data alive and stay valid.
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

  private external fun getByteBuffer(): ByteBuffer

  private external fun copyNative(): ArrayBuffer

  @FastNative
  private external fun retainArrayBuffer(): Long

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

  /**
   * Keeps a native reference to an `ArrayBuffer`'s data until [view] has been garbage collected.
   * Like any `PhantomReference`, it tracks [view] by identity, not by `equals`.
   */
  private class ViewOwner(
    view: ByteBuffer,
    private val reference: Long,
  ) : DestructorThread.Destructor(view) {
    override fun destruct() {
      releaseArrayBuffer(reference)
    }
  }

  companion object {
    /**
     * Releases a reference created with [retainArrayBuffer].
     */
    @JvmStatic
    private external fun releaseArrayBuffer(reference: Long)

    @JvmStatic
    private external fun allocateNative(size: Int): ArrayBuffer

    /**
     * Allocate a new **owning** `ArrayBuffer` with the given [size] in native memory.
     * The bytes are not initialized.
     */
    fun allocate(size: Int): ArrayBuffer {
      require(size >= 0) { "ArrayBuffer size must not be negative!" }
      return allocateNative(size)
    }

    /**
     * Copy the given `ArrayBuffer` into a new **owning** `ArrayBuffer`.
     * Copies of `HardwareBuffer`-backed `ArrayBuffer`s are also backed by a `HardwareBuffer`,
     * others are copied into native memory.
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

      other.checkNotClosed()
      return other.copyNative()
    }

    /**
     * Copy the given `ByteBuffer` into a new **owning** `ArrayBuffer` in native memory.
     * This copies from the start of the buffer up to its current `limit`, and does not mutate the
     * given `ByteBuffer`'s cursor state.
     */
    fun copy(byteBuffer: ByteBuffer): ArrayBuffer {
      val source = byteBuffer.duplicate()
      source.rewind()
      val arrayBuffer = allocate(source.remaining())
      arrayBuffer.withByteBuffer { it.put(source) }
      return arrayBuffer
    }

    /**
     * Copy the given `ByteArray` into a new **owning** `ArrayBuffer` in native memory.
     */
    fun copy(byteArray: ByteArray): ArrayBuffer {
      val arrayBuffer = allocate(byteArray.size)
      arrayBuffer.withByteBuffer { it.put(byteArray) }
      return arrayBuffer
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
