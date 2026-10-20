declare global {
  /**
   * The global proxy object that can create other autolinked HybridObjects.
   */
  var NitroModulesProxy:
    | import('./NitroModulesProxy.js').NitroModulesProxy
    | undefined
}

// ensures this file is treated as a module
export {}
