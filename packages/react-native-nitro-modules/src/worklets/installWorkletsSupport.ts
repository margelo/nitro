import type { HybridObject } from 'nitro-core'
import { NitroModules } from 'nitro-core'

export function installWorkletsSupport() {
  try {
    const { registerCustomSerializable } =
      require('react-native-worklets') as typeof import('react-native-worklets')

    const boxedNitroProxy = NitroModules.box(NitroModules)
    registerCustomSerializable({
      name: 'nitro.HybridObject',
      determine(value): value is HybridObject {
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
  } catch {
    // react-native-worklets not installed.
  }
}
