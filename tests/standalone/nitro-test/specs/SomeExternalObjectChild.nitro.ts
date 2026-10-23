import { Android, Apple } from 'nitro-core'
import type { SomeExternalObject } from 'nitro-test-external'

export * from '#nitro/SomeExternalObjectChild'

// A Swift/Kotlin HybridObject that inherits from another module's Swift/Kotlin
// HybridObject. Its bridge must not redeclare the base module's helpers.
@Apple({
  language: 'swift',
  implementation: { className: 'HybridSomeExternalObjectChild' },
})
@Android({
  language: 'kotlin',
  implementation: { className: 'HybridSomeExternalObjectChild' },
})
export declare class SomeExternalObjectChild extends SomeExternalObject {
  constructor()
  readonly childValue: number
}
