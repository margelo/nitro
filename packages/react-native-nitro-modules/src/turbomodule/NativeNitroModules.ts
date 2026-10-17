import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'
import { ModuleNotFoundError } from '../ModuleNotFoundError'
import {
  assertNitroVersion,
  getInstalledNitro,
  getNitroModules,
  isRuntimeAlive,
  warnIfNitroVersionMismatch,
} from 'nitro-core'

// Codegen registers the TurboModule; React Native's JSI hook installs Nitro.
interface Spec extends TurboModule {}

let nitroModules = getInstalledNitro()

// Reuse the existing proxy when the same JS runtime evaluates Nitro again,
// such as when react-native-harness loads a dedicated test bundle.
if (nitroModules != null) {
  assertNitroVersion(nitroModules)
} else {
  // Resolving the TurboModule synchronously installs its JSI bindings.
  try {
    TurboModuleRegistry.getEnforcing<Spec>('NitroModules')
  } catch (e) {
    throw new ModuleNotFoundError(e)
  }

  nitroModules = getInstalledNitro()
  if (nitroModules == null) {
    const cause = new Error(
      'The NitroModules TurboModule loaded, but its JSI bindings did not install `global.NitroModulesProxy`.'
    )
    throw new ModuleNotFoundError(cause)
  }
}

export const NitroModules = getNitroModules()

// Double-check native version
if (__DEV__) {
  warnIfNitroVersionMismatch(NitroModules)
}

export { isRuntimeAlive }
