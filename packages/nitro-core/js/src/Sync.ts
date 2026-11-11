/**
 * Marks the given function as _synchronous_, allowing it to be called synchronously on the same
 * Thread.
 *
 * This allows for fast native -> JS calls and avoids any asynchronous dispatching, but requires careful
 * threading considerations.
 */
export type Sync<T> = T extends Function ? T & { __syncTag?: never } : never
