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
    if (length > bytes.size - base) {
      pendingString.set(value)
      return -1
    }
    for (i in 0 until length) {
      val code = value[i].code
      if (code >= 0x80) {
        pendingString.set(value)
        return -1
      }
      bytes[base + i] = code.toByte()
    }
    return length
  }
}
