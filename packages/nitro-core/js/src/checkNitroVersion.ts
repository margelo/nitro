import type { NitroModulesProxy } from './NitroModulesProxy.js'
import { version as jsVersion } from './version.js'

/**
 * Checks compatibility before reusing a proxy installed by another copy of Nitro.
 */
export function assertNitroVersion(nitroModules: NitroModulesProxy): void {
  if (nitroModules.version !== jsVersion) {
    throw new Error(
      `Nitro was installed twice: once with native version ${nitroModules.version} and once with JS version ${jsVersion}. ` +
        'This usually means different versions of Nitro exist in node_modules (e.g. in monorepos or double-linked setups).'
    )
  }
}

/**
 * Warns when the installed native runtime differs from this JavaScript package.
 * Host integrations should call this in development after installing Nitro.
 */
export function warnIfNitroVersionMismatch(
  nitroModules: NitroModulesProxy
): void {
  if (nitroModules.version !== jsVersion) {
    console.warn(
      `The native Nitro Modules core runtime version is ${nitroModules.version}, but the JS code is using version ${jsVersion}. ` +
        'This could lead to undefined behaviour! Make sure to keep your Nitro versions in sync.'
    )
  }
}
