import type { HybridObject } from '../HybridObject'
import { NitroModules } from '../NitroModules'

export function installWorkletsSupport() {
  let worklets: typeof import('react-native-worklets')
  try {
    worklets =
      require('react-native-worklets') as typeof import('react-native-worklets')
  } catch {
    // react-native-worklets not installed.
    return
  }

  const boxedNitroProxy = NitroModules.box(NitroModules)
  worklets.registerCustomSerializable({
    name: 'nitro.HybridObject',
    determine(value): value is HybridObject<{}> {
      'worklet'
      const nitroProxy = boxedNitroProxy.unbox()
      return nitroProxy.isHybridObject(value)
    },
    pack(value) {
      'worklet'
      const nitroProxy = boxedNitroProxy.unbox()
      return nitroProxy.box(value)
    },
    unpack(value) {
      'worklet'
      return value.unbox()
    },
  })
}
