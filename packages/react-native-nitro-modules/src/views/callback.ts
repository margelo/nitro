import type { NitroViewWrappedCallback } from './getHostComponent'

// TODO: Remove `callback(...)` wrapping once React Native supports passing down
// functions as raw jsi::Values instead of intercepting them for event handling.
/**
 * Wrap the given {@linkcode func} in a Nitro callback.
 * - For older versions of react-native, this wraps the callback in a `{ f: T }` object.
 * - For newer versions of react-native, this just returns the function as-is.
 */
export function callback<T>(
  func: T
): T extends (...args: any[]) => any ? NitroViewWrappedCallback<T> : T
export function callback(func: unknown) {
  if (typeof func === 'function') {
    return { f: func }
  }
  return func
}
