import type { NitroModulesProxy } from './NitroModulesProxy.js'
import './globals.js'

/**
 * The installed native Nitro entry point.
 *
 * A host integration must call {@linkcode getNitroModules} after installing
 * Nitro into the JavaScript runtime. The binding then refers to that same
 * native object, including its NativeState and prototype.
 */
export let NitroModules: NitroModulesProxy

/**
 * Returns the native proxy, if this JavaScript runtime has installed Nitro.
 * This does not install Nitro or initialize the {@linkcode NitroModules} binding.
 */
export function getInstalledNitro(): NitroModulesProxy | undefined {
  return globalThis.NitroModulesProxy as NitroModulesProxy | undefined
}

/**
 * Returns the installed native proxy and initializes {@linkcode NitroModules}.
 * The host integration is responsible for installing Nitro first.
 */
export function getNitroModules(): NitroModulesProxy {
  const nitroModules = getInstalledNitro()
  if (nitroModules == null) {
    throw new Error(
      'Nitro is not installed in this JavaScript runtime. Initialize the host integration before using NitroModules.'
    )
  }
  NitroModules = nitroModules
  return nitroModules
}

/**
 * Returns whether the runtime still has Nitro's JSI cache and dispatcher.
 */
export function isRuntimeAlive(): boolean {
  const cache = globalThis.__nitroJsiCache
  const dispatcher = globalThis.__nitroDispatcher
  return cache != null && dispatcher != null
}
