package com.margelo.nitro.core

/**
 * Where an error reported to [GlobalErrorHandler] happened.
 */
enum class ErrorSource(
  internal val nativeValue: Int,
) {
  /** A JS callback called asynchronously, without a caller waiting for its result. */
  JS_CALLBACK(0),

  /** A native callback called without a caller waiting for its result. */
  NATIVE_CALLBACK(1),

  /** A JS microtask, such as a Promise continuation, run after a native call into JS. */
  MICROTASK(2),

  /** A `setTimeout` or `setInterval` callback. */
  TIMER(3),

  /** A `requestAnimationFrame` callback. */
  ANIMATION_FRAME(4),

  /** A UI event callback, such as a key press or a completed view controller presentation. */
  UI_CALLBACK(5),
}
