package com.margelo.nitro.core

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

/**
 * Receives errors that cannot be delivered to a caller, for example because nobody awaits the call that threw.
 *
 * Errors reported here are currently logged in debug builds.
 */
@Suppress("KotlinJniMissingFunction")
@Keep
@DoNotStrip
object GlobalErrorHandler {
  /**
   * Reports the given [error] that happened in the given [source].
   */
  @JvmStatic
  fun reportError(
    source: ErrorSource,
    error: Throwable,
  ) {
    reportError(source.nativeValue, error)
  }

  @JvmStatic
  @Keep
  @DoNotStrip
  private external fun reportError(
    source: Int,
    error: Throwable,
  )
}
