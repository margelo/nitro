import { NitroModules as NativeNitroModules } from './turbomodule/NativeNitroModules'
import { installWorkletsSupport } from './worklets/installWorkletsSupport'

export * from 'nitro-core'
export const NitroModules = NativeNitroModules
export { isRuntimeAlive } from './turbomodule/NativeNitroModules'

export * from './views/HybridView'
export * from './views/getHostComponent'
export * from './views/callback'

installWorkletsSupport()
