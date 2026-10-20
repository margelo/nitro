import './turbomodule/NativeNitroModules'
import { installWorkletsSupport } from './worklets/installWorkletsSupport'

export * from 'nitro-core'

export type { HybridView } from './views/HybridView'
export * from './views/getHostComponent'

installWorkletsSupport()
