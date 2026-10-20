/**
 * Marks a callback parameter that native code only borrows for the duration of the call.
 *
 * Native code receives an `InlineCallback` instead of an owning `Callback`, so calling it
 * synchronously skips the `Callback`'s allocations. Call `escape()` on it to keep it for later.
 *
 * Nitrogen only accepts `Inline` as the type of a required method, static method or
 * constructor parameter.
 * @example
 * ```ts
 * forEach(callback: Inline<(item: Item) => void>): void
 * ```
 */
export type Inline<T extends (...args: never[]) => unknown> = T & {
  __inlineTag?: never
}
