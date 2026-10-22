package com.margelo.nitro.core

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

/**
 * Reports Kotlin errors that cannot be delivered to a caller to Nitro's C++ `GlobalErrorHandler`.
 */
@Suppress("KotlinJniMissingFunction")
@Keep
@DoNotStrip
internal object GlobalErrorHandler {
  /**
   * Reports an [error] thrown by a native callback that was called without waiting for its result.
   */
  @JvmStatic
  @Keep
  @DoNotStrip
  external fun reportNativeCallbackError(error: Throwable)
}
