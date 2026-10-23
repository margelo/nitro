// Keep one line per signature, so each number of parameters reads like a table.
@file:Suppress(
  "UNCHECKED_CAST",
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

// `Callback<F>` cannot declare these calls itself, because their parameters depend on `F`.
// Every callback implements the `Callback.Arity<N>` interface for its number of parameters.
// The call operator calls a void callback with `callAndForget`, and any other with `callAsync`.

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <R> Callback<() -> R>.callSync(): R = (this as Callback.Arity0<R>).callSync()

/** Calls this callback and returns a [Promise] of its result. */
fun <R> Callback<() -> R>.callAsync(): Promise<R> = (this as Callback.Arity0<R>).callAsync()

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <R> Callback<() -> R>.callAndForget(): Unit = (this as Callback.Arity0<R>).callAndForget()

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, R> Callback<(P1) -> R>.callSync(p1: P1): R = (this as Callback.Arity1<P1, R>).callSync(p1)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, R> Callback<(P1) -> R>.callAsync(p1: P1): Promise<R> = (this as Callback.Arity1<P1, R>).callAsync(p1)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, R> Callback<(P1) -> R>.callAndForget(p1: P1): Unit = (this as Callback.Arity1<P1, R>).callAndForget(p1)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, R> Callback<(P1, P2) -> R>.callSync(p1: P1, p2: P2): R = (this as Callback.Arity2<P1, P2, R>).callSync(p1, p2)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, R> Callback<(P1, P2) -> R>.callAsync(p1: P1, p2: P2): Promise<R> = (this as Callback.Arity2<P1, P2, R>).callAsync(p1, p2)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, R> Callback<(P1, P2) -> R>.callAndForget(p1: P1, p2: P2): Unit = (this as Callback.Arity2<P1, P2, R>).callAndForget(p1, p2)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, R> Callback<(P1, P2, P3) -> R>.callSync(p1: P1, p2: P2, p3: P3): R = (this as Callback.Arity3<P1, P2, P3, R>).callSync(p1, p2, p3)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, R> Callback<(P1, P2, P3) -> R>.callAsync(p1: P1, p2: P2, p3: P3): Promise<R> = (this as Callback.Arity3<P1, P2, P3, R>).callAsync(p1, p2, p3)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, R> Callback<(P1, P2, P3) -> R>.callAndForget(p1: P1, p2: P2, p3: P3): Unit = (this as Callback.Arity3<P1, P2, P3, R>).callAndForget(p1, p2, p3)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, R> Callback<(P1, P2, P3, P4) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4): R = (this as Callback.Arity4<P1, P2, P3, P4, R>).callSync(p1, p2, p3, p4)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, R> Callback<(P1, P2, P3, P4) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4): Promise<R> = (this as Callback.Arity4<P1, P2, P3, P4, R>).callAsync(p1, p2, p3, p4)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, R> Callback<(P1, P2, P3, P4) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4): Unit = (this as Callback.Arity4<P1, P2, P3, P4, R>).callAndForget(p1, p2, p3, p4)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, R> Callback<(P1, P2, P3, P4, P5) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5): R = (this as Callback.Arity5<P1, P2, P3, P4, P5, R>).callSync(p1, p2, p3, p4, p5)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, R> Callback<(P1, P2, P3, P4, P5) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5): Promise<R> = (this as Callback.Arity5<P1, P2, P3, P4, P5, R>).callAsync(p1, p2, p3, p4, p5)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, R> Callback<(P1, P2, P3, P4, P5) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5): Unit = (this as Callback.Arity5<P1, P2, P3, P4, P5, R>).callAndForget(p1, p2, p3, p4, p5)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, R> Callback<(P1, P2, P3, P4, P5, P6) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6): R = (this as Callback.Arity6<P1, P2, P3, P4, P5, P6, R>).callSync(p1, p2, p3, p4, p5, p6)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, R> Callback<(P1, P2, P3, P4, P5, P6) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6): Promise<R> = (this as Callback.Arity6<P1, P2, P3, P4, P5, P6, R>).callAsync(p1, p2, p3, p4, p5, p6)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, R> Callback<(P1, P2, P3, P4, P5, P6) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6): Unit = (this as Callback.Arity6<P1, P2, P3, P4, P5, P6, R>).callAndForget(p1, p2, p3, p4, p5, p6)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, R> Callback<(P1, P2, P3, P4, P5, P6, P7) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7): R = (this as Callback.Arity7<P1, P2, P3, P4, P5, P6, P7, R>).callSync(p1, p2, p3, p4, p5, p6, p7)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, R> Callback<(P1, P2, P3, P4, P5, P6, P7) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7): Promise<R> = (this as Callback.Arity7<P1, P2, P3, P4, P5, P6, P7, R>).callAsync(p1, p2, p3, p4, p5, p6, p7)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, R> Callback<(P1, P2, P3, P4, P5, P6, P7) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7): Unit = (this as Callback.Arity7<P1, P2, P3, P4, P5, P6, P7, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8): R = (this as Callback.Arity8<P1, P2, P3, P4, P5, P6, P7, P8, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8): Promise<R> = (this as Callback.Arity8<P1, P2, P3, P4, P5, P6, P7, P8, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8): Unit = (this as Callback.Arity8<P1, P2, P3, P4, P5, P6, P7, P8, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9): R = (this as Callback.Arity9<P1, P2, P3, P4, P5, P6, P7, P8, P9, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9): Promise<R> = (this as Callback.Arity9<P1, P2, P3, P4, P5, P6, P7, P8, P9, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9): Unit = (this as Callback.Arity9<P1, P2, P3, P4, P5, P6, P7, P8, P9, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10): R = (this as Callback.Arity10<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10): Promise<R> = (this as Callback.Arity10<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10): Unit = (this as Callback.Arity10<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11): R = (this as Callback.Arity11<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11): Promise<R> = (this as Callback.Arity11<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11): Unit = (this as Callback.Arity11<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12): R = (this as Callback.Arity12<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12): Promise<R> = (this as Callback.Arity12<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12): Unit = (this as Callback.Arity12<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13): R = (this as Callback.Arity13<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13): Promise<R> = (this as Callback.Arity13<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13): Unit = (this as Callback.Arity13<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14): R = (this as Callback.Arity14<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14): Promise<R> = (this as Callback.Arity14<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14): Unit = (this as Callback.Arity14<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15): R = (this as Callback.Arity15<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15): Promise<R> = (this as Callback.Arity15<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15): Unit = (this as Callback.Arity15<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16): R = (this as Callback.Arity16<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16): Promise<R> = (this as Callback.Arity16<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16): Unit = (this as Callback.Arity16<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17): R = (this as Callback.Arity17<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17): Promise<R> = (this as Callback.Arity17<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17): Unit = (this as Callback.Arity17<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18): R = (this as Callback.Arity18<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18): Promise<R> = (this as Callback.Arity18<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18): Unit = (this as Callback.Arity18<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19): R = (this as Callback.Arity19<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19): Promise<R> = (this as Callback.Arity19<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19): Unit = (this as Callback.Arity19<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20): R = (this as Callback.Arity20<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20): Promise<R> = (this as Callback.Arity20<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20): Unit = (this as Callback.Arity20<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21): R = (this as Callback.Arity21<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21): Promise<R> = (this as Callback.Arity21<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21): Unit = (this as Callback.Arity21<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21)

/** Calls this callback and returns its result. A JS callback must be called on its JS thread. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22) -> R>.callSync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21, p22: P22): R = (this as Callback.Arity22<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, R>).callSync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22)

/** Calls this callback and returns a [Promise] of its result. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22) -> R>.callAsync(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21, p22: P22): Promise<R> = (this as Callback.Arity22<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, R>).callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22)

/** Calls this callback without waiting for its result. Errors are reported to Nitro's global error handler. */
fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22) -> R>.callAndForget(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21, p22: P22): Unit = (this as Callback.Arity22<P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, R>).callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun Callback<() -> Unit>.invoke(): Unit = callAndForget()

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <R> Callback<() -> R>.invoke(): Promise<R> = callAsync()

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1> Callback<(P1) -> Unit>.invoke(p1: P1): Unit = callAndForget(p1)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, R> Callback<(P1) -> R>.invoke(p1: P1): Promise<R> = callAsync(p1)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2> Callback<(P1, P2) -> Unit>.invoke(p1: P1, p2: P2): Unit = callAndForget(p1, p2)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, R> Callback<(P1, P2) -> R>.invoke(p1: P1, p2: P2): Promise<R> = callAsync(p1, p2)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3> Callback<(P1, P2, P3) -> Unit>.invoke(p1: P1, p2: P2, p3: P3): Unit = callAndForget(p1, p2, p3)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, R> Callback<(P1, P2, P3) -> R>.invoke(p1: P1, p2: P2, p3: P3): Promise<R> = callAsync(p1, p2, p3)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4> Callback<(P1, P2, P3, P4) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4): Unit = callAndForget(p1, p2, p3, p4)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, R> Callback<(P1, P2, P3, P4) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4): Promise<R> = callAsync(p1, p2, p3, p4)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5> Callback<(P1, P2, P3, P4, P5) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5): Unit = callAndForget(p1, p2, p3, p4, p5)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, R> Callback<(P1, P2, P3, P4, P5) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5): Promise<R> = callAsync(p1, p2, p3, p4, p5)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6> Callback<(P1, P2, P3, P4, P5, P6) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6): Unit = callAndForget(p1, p2, p3, p4, p5, p6)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, R> Callback<(P1, P2, P3, P4, P5, P6) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7> Callback<(P1, P2, P3, P4, P5, P6, P7) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, R> Callback<(P1, P2, P3, P4, P5, P6, P7) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8> Callback<(P1, P2, P3, P4, P5, P6, P7, P8) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21)

/** Calls this void callback with `callAndForget`, like the C++ and Swift call operators. */
@JvmName("invokeAndForget")
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22) -> Unit>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21, p22: P22): Unit = callAndForget(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22)

/** Calls this callback with `callAsync` and returns the [Promise] of its result, like the C++ and Swift call operators. */
operator fun <P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22, R> Callback<(P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, P17, P18, P19, P20, P21, P22) -> R>.invoke(p1: P1, p2: P2, p3: P3, p4: P4, p5: P5, p6: P6, p7: P7, p8: P8, p9: P9, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14, p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21, p22: P22): Promise<R> = callAsync(p1, p2, p3, p4, p5, p6, p7, p8, p9, p10, p11, p12, p13, p14, p15, p16, p17, p18, p19, p20, p21, p22)
