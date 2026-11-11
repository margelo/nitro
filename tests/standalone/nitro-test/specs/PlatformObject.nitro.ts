import type { HybridObject } from 'nitro-core'

// This object is implemented in Swift and Kotlin
export interface PlatformObject extends HybridObject<{
  ios: 'swift'
  android: 'kotlin'
}> {
  getOSVersion(): string
}
