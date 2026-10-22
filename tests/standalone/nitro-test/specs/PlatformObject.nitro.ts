import { Android, Apple } from 'nitro-core'
import type { HybridObject } from 'nitro-core'
import type { SomeExternalObject } from 'nitro-test-external'
import type { Base } from './Base.nitro'
import type { Child } from './Child.nitro'

export * from '#nitro/PlatformObject'

// This object is implemented in Swift and Kotlin
@Apple({
  language: 'swift',
  implementation: { className: 'HybridPlatformObject' },
})
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridPlatformObject' },
})
export declare class PlatformObject extends HybridObject {
  constructor()
  getOSVersion(): string
  createBase(): Base
  createChild(): Child
  createAlternativeBase(): Base
  createInternalObject(): SomeExternalObject
}
