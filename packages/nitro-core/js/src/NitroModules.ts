import type { NitroModulesProxy } from './NitroModulesProxy.js'
import { version as jsVersion } from './version.js'

const proxy = globalThis.NitroModulesProxy
if (proxy == null) {
  throw new Error(
    'Nitro Modules must be installed before importing nitro-core.'
  )
}

if (proxy.version !== jsVersion) {
  console.warn(
    `The native Nitro Modules version is ${proxy.version}, but the JS version is ${jsVersion}. Keep both versions in sync.`
  )
}

export const NitroModules: NitroModulesProxy = proxy
