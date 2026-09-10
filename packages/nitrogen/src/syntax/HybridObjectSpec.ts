import type { NitroConfig } from '../config/NitroConfig.js'
import type { Language } from '../getPlatformSpecs.js'
import type { Method } from './Method.js'
import type { Property } from './Property.js'

export interface HybridObjectSpec {
  name: string
  language: Language
  properties: Property[]
  methods: Method[]
  baseTypes: HybridObjectSpec[]
  isHybridView: boolean
  /**
   * Whether this Hybrid View opted into rendering React children by declaring a
   * `children` prop of type `HybridViewChildren` in its Nitro spec.
   * Always `false` for Hybrid Objects that aren't Views.
   */
  supportsChildren: boolean
  config: NitroConfig
}
