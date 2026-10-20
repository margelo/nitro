import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'
import { ModuleNotFoundError } from '../ModuleNotFoundError'

// Codegen registers the TurboModule; React Native's JSI hook installs Nitro.
interface Spec extends TurboModule {}

// Reuse the existing proxy when the same JS runtime evaluates Nitro again,
// such as when react-native-harness loads a dedicated test bundle.
if (globalThis.NitroModulesProxy == null) {
  // Resolving the TurboModule synchronously installs its JSI bindings.
  try {
    TurboModuleRegistry.getEnforcing<Spec>('NitroModules')
  } catch (e) {
    throw new ModuleNotFoundError(e)
  }

  if (globalThis.NitroModulesProxy == null) {
    const cause = new Error(
      'The NitroModules TurboModule loaded, but its JSI bindings did not install `global.NitroModulesProxy`.'
    )
    throw new ModuleNotFoundError(cause)
  }
}
