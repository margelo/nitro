import { getNitroModules } from "nitro-core";

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Creates a Promise that can be resolved or rejected from the outside, e.g. to
 * hand a JS Promise to native and settle it later.
 */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

/**
 * Returns the given {@linkcode string} in debug, and `''` in release.
 * C++ type names in error messages are only included in debug builds.
 */
export function debugOnly(string: string): string {
  return getNitroModules().buildType === "debug" ? string : "";
}
