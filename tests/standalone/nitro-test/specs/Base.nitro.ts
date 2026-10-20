import type { HybridObject } from 'nitro-core'

// This is a simple `HybridObject` with just one value.
export interface Base extends HybridObject<{
  ios: 'swift'
  android: 'kotlin'
}> {
  readonly baseValue: number
}
