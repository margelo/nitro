declare global {
  /**
   * The native `JSICache` for Nitro.
   * This is created on the fly natively when needed.
   * @readonly
   */
  var __nitroJsiCache: {} | undefined
  /**
   * The native `Dispatcher` for Nitro.
   *
   * A `Dispatcher` is only available in a `jsi::Runtime` when
   * it was installed using `Dispatcher::installRuntimeGlobalDispatcher(...)`.
   *
   * If you use a `jsi::Runtime` that does not have a `Dispatcher` ({@linkcode __nitroDispatcher} `==` `null`),
   * any asynchronous operations (`Callbacks` or `Promises`) will throw an error.
   * You would need to either:
   * - A) Install a `Dispatcher` that can safely thread-hop ("dispatch") to this `jsi::Runtime` on the native side
   * - B) Only use synchronous methods and no callbacks on this `jsi::Runtime`.
   * @readonly
   */
  var __nitroDispatcher: {} | undefined
  /**
   * The global proxy object that can create other autolinked HybridObjects.
   */
  var NitroModulesProxy: {} | undefined
}

// ensures this file is treated as a module
export {}
