// Keep one line per signature, so each number of parameters reads like a table.
@file:Suppress(
  "ktlint:standard:argument-list-wrapping",
  "ktlint:standard:chain-method-continuation",
  "ktlint:standard:class-signature",
  "ktlint:standard:function-literal",
  "ktlint:standard:function-signature",
  "ktlint:standard:max-line-length",
  "ktlint:standard:parameter-list-wrapping",
  "ktlint:standard:wrapping",
)

package com.margelo.nitro.core

import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip

/**
 * A callback to either a JS function or a Kotlin function, for example `Callback<(value: Double) -> Unit>`.
 *
 * Unlike a Kotlin lambda, a [Callback] lets its caller choose how to call it:
 * - `callSync(...)` calls it and returns its result. A JS callback must be called on its JS thread.
 * - `callAsync(...)` returns a [Promise] of its result. A JS callback is scheduled on its JS thread.
 * - `callAndForget(...)` does not wait for a result. Errors are reported to Nitro's global error handler.
 *
 * Like in C++ and Swift, the call operator `callback(...)` uses `callAndForget` for a void callback,
 * and `callAsync` for a callback that returns a value.
 *
 * A Kotlin function created with [Callback.native] runs immediately on the calling thread.
 * Callbacks can be shared across threads. Callers must still synchronize access to mutable arguments and results.
 */
@Keep
@DoNotStrip
sealed interface Callback<out F : Function<*>> {
  // Each number of parameters, up to 22, has an interface with the three calls.
  // Generated classes override all three calls for JS and C++ callbacks.
  // A Kotlin function only implements `callSync`, so the other calls run it immediately.
  // Only `callSync` of a Kotlin implementation is kept once it is passed to C++ or JS.

  /** A [Callback] with 0 parameters. */
  fun interface Arity0<R> : Callback<() -> R> {
    fun callSync(): R

    fun callAsync(): Promise<R> = callNativeAsync { callSync() }

    fun callAndForget(): Unit = callNativeAndForget { callSync() }
  }

  /** A [Callback] with 1 parameter. */
  fun interface Arity1<P1, R> : Callback<(P1) -> R> {
    fun callSync(p1: P1): R

    fun callAsync(p1: P1): Promise<R> = callNativeAsync { callSync(p1) }

    fun callAndForget(p1: P1): Unit = callNativeAndForget { callSync(p1) }
  }

  /** A [Callback] with 2 parameters. */
  fun interface Arity2<P1, P2, R> : Callback<(P1, P2) -> R> {
    fun callSync(p1: P1, p2: P2): R

    fun callAsync(p1: P1, p2: P2): Promise<R> = callNativeAsync { callSync(p1, p2) }

    fun callAndForget(p1: P1, p2: P2): Unit = callNativeAndForget { callSync(p1, p2) }
  }

  /** A [Callback] with 3 parameters. */
  fun interface Arity3<P1, P2, P3, R> : Callback<(P1, P2, P3) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3): R

    fun callAsync(p1: P1, p2: P2, p3: P3): Promise<R> = callNativeAsync { callSync(p1, p2, p3) }

    fun callAndForget(p1: P1, p2: P2, p3: P3): Unit = callNativeAndForget { callSync(p1, p2, p3) }
  }

  /** A [Callback] with 4 parameters. */
  fun interface Arity4<P1, P2, P3, P4, R> : Callback<(P1, P2, P3, P4) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4): Unit = callNativeAndForget { callSync(p1, p2, p3, p4) }
  }

  /** A [Callback] with 5 parameters. */
  fun interface Arity5<P1, P2, P3, P4, P5, R> : Callback<(P1, P2, P3, P4, P5) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5) }
  }

  /** A [Callback] with 6 parameters. */
  fun interface Arity6<P1, P2, P3, P4, P5, P6, R> : Callback<(P1, P2, P3, P4, P5, P6) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6) }
  }

  /** A [Callback] with 7 parameters. */
  fun interface Arity7<P1, P2, P3, P4, P5, P6, P7, R> : Callback<(P1, P2, P3, P4, P5, P6, P7) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7) }
  }

  /** A [Callback] with 8 parameters. */
  fun interface Arity8<P1, P2, P3, P4, P5, P6, P7, P8, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8) }
  }

  /** A [Callback] with 9 parameters. */
  fun interface Arity9<P1, P2, P3, P4, P5, P6, P7, P8, P9, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9) }
  }

  /** A [Callback] with 10 parameters. */
  fun interface Arity10<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10) }
  }

  /** A [Callback] with 11 parameters. */
  fun interface Arity11<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11) }
  }

  /** A [Callback] with 12 parameters. */
  fun interface Arity12<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12) }
  }

  /** A [Callback] with 13 parameters. */
  fun interface Arity13<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13) }
  }

  /** A [Callback] with 14 parameters. */
  fun interface Arity14<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14) }
  }

  /** A [Callback] with 15 parameters. */
  fun interface Arity15<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15) }
  }

  /** A [Callback] with 16 parameters. */
  fun interface Arity16<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16) }
  }

  /** A [Callback] with 17 parameters. */
  fun interface Arity17<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17) }
  }

  /** A [Callback] with 18 parameters. */
  fun interface Arity18<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18) }
  }

  /** A [Callback] with 19 parameters. */
  fun interface Arity19<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19) }
  }

  /** A [Callback] with 20 parameters. */
  fun interface Arity20<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20) }
  }

  /** A [Callback] with 21 parameters. */
  fun interface Arity21<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21) }
  }

  /** A [Callback] with 22 parameters. */
  fun interface Arity22<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, R> : Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22) -> R> {
    fun callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21, p22: P22): R

    fun callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21, p22: P22): Promise<R> = callNativeAsync { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22) }

    fun callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21, p22: P22): Unit = callNativeAndForget { callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22) }
  }

  companion object {
    /**
     * Creates a callback that calls the given Kotlin [function].
     * `callSync`, `callAsync` and `callAndForget` all run it immediately on the calling thread.
     */
    @Suppress("UNCHECKED_CAST")
    fun <F : Function<*>> native(function: F): Callback<F> {
      val callback: Callback<*> =
        when (function) {
          is Function0<*> -> Arity0(function as () -> Any?)
          is Function1<*, *> -> Arity1(function as (Any?) -> Any?)
          is Function2<*, *, *> -> Arity2(function as (Any?, Any?) -> Any?)
          is Function3<*, *, *, *> -> Arity3(function as (Any?, Any?, Any?) -> Any?)
          is Function4<*, *, *, *, *> -> Arity4(function as (Any?, Any?, Any?, Any?) -> Any?)
          is Function5<*, *, *, *, *, *> -> Arity5(function as (Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function6<*, *, *, *, *, *, *> -> Arity6(function as (Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function7<*, *, *, *, *, *, *, *> -> Arity7(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function8<*, *, *, *, *, *, *, *, *> -> Arity8(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function9<*, *, *, *, *, *, *, *, *, *> -> Arity9(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function10<*, *, *, *, *, *, *, *, *, *, *> -> Arity10(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function11<*, *, *, *, *, *, *, *, *, *, *, *> -> Arity11(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function12<*, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity12(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function13<*, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity13(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function14<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity14(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function15<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity15(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function16<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity16(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function17<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity17(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function18<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity18(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function19<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity19(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function20<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity20(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function21<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity21(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          is Function22<*, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *, *> -> Arity22(function as (Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?, Any?) -> Any?)
          else -> throw IllegalArgumentException("A Callback can have at most 22 parameters.")
        }
      return callback as Callback<F>
    }
  }
}

internal inline fun <R> callNativeAsync(call: () -> R): Promise<R> =
  try {
    Promise.resolved(call())
  } catch (error: Throwable) {
    Promise.rejected(error)
  }

internal inline fun callNativeAndForget(call: () -> Unit) {
  try {
    call()
  } catch (error: Throwable) {
    GlobalErrorHandler.reportNativeCallbackError(error)
  }
}
