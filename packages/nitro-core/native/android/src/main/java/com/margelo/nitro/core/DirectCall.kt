package com.margelo.nitro.core

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Helpers for the Kotlin bridges Nitrogen generates for direct JSI host functions.
 * See `DirectCall.hpp`.
 */
@Keep
@DoNotStrip
object DirectCall {
  // A string result that did not fit the scratch memory, or was not ASCII. Each Runtime's thread keeps its own.
  private val pendingString = ThreadLocal<String?>()

  /**
   * Each Runtime's scratch `byte[]` and `ByteBuffer`, by the slot [registerScratch] returned.
   * Bridges receive the slot as an `Int`, which JNI passes faster than an object reference.
   * Registration replaces the arrays instead of mutating them, so readers never need a lock.
   */
  @JvmField
  @Volatile
  var scratchBytes: Array<ByteArray?> = arrayOfNulls(0)

  @JvmField
  @Volatile
  var scratchBuffers: Array<ByteBuffer?> = arrayOfNulls(0)

  /** Stores a Runtime's scratch memory and returns its slot. */
  @JvmStatic
  @Keep
  @DoNotStrip
  @Synchronized
  fun registerScratch(
    bytes: ByteArray,
    buffer: ByteBuffer,
  ): Int {
    var slot = scratchBytes.indexOfFirst { it == null }
    if (slot < 0) slot = scratchBytes.size
    val newBytes = scratchBytes.copyOf(maxOf(scratchBytes.size, slot + 1))
    val newBuffers = scratchBuffers.copyOf(newBytes.size)
    newBytes[slot] = bytes
    newBuffers[slot] = buffer
    // Publish the buffers first, so a reader that sees a slot's bytes also sees its buffer.
    scratchBuffers = newBuffers
    scratchBytes = newBytes
    return slot
  }

  /** Frees a slot when its Runtime is destroyed. */
  @JvmStatic
  @Keep
  @DoNotStrip
  @Synchronized
  fun unregisterScratch(slot: Int) {
    val newBytes = scratchBytes.copyOf()
    val newBuffers = scratchBuffers.copyOf()
    newBytes[slot] = null
    newBuffers[slot] = null
    scratchBytes = newBytes
    scratchBuffers = newBuffers
  }

  /**
   * Creates a Runtime's scratch buffer. On ART, a direct buffer is backed by a non-movable `byte[]`,
   * so C++ and Kotlin can share its memory. C++ checks that before relying on it.
   */
  @JvmStatic
  @Keep
  @DoNotStrip
  fun createScratch(size: Int): ByteBuffer = ByteBuffer.allocateDirect(size).order(ByteOrder.nativeOrder())

  /** Returns and clears the string [writeASCII] could not write. */
  @JvmStatic
  @Keep
  @DoNotStrip
  fun takePendingString(): String? {
    val value = pendingString.get()
    pendingString.set(null)
    return value
  }

  /**
   * Creates a string from [length] ASCII bytes of [bytes] at [offset].
   * The `hibyte` constructor lets ART create a compressed string without a charset lookup.
   */
  @JvmStatic
  @Suppress("DEPRECATION", "PLATFORM_CLASS_MAPPED_TO_KOTLIN")
  fun stringFromASCII(
    bytes: ByteArray,
    offset: Int,
    length: Int,
  ): String = java.lang.String(bytes, 0, offset, length) as String

  /**
   * Writes [value] to [bytes] at [base] as ASCII and returns its length,
   * or keeps it for [takePendingString] and returns -1 if it is not ASCII or does not fit.
   */
  @JvmStatic
  fun writeASCII(
    value: String,
    bytes: ByteArray,
    base: Int,
  ): Int {
    val length = value.length
    // One check up front lets ART drop the bounds checks inside the loop.
    if (base < 0 || length > bytes.size - base) {
      pendingString.set(value)
      return -1
    }
    var i = 0
    while (i < length) {
      val code = value[i].code
      if (code >= 0x80) {
        pendingString.set(value)
        return -1
      }
      bytes[base + i] = code.toByte()
      i++
    }
    return length
  }
}
