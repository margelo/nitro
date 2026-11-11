import type { Base } from './Base.nitro'
import type { NamedVariant } from './TestObject.nitro'

// This is a `HybridObject` that actually inherits from a different `HybridObject`.
// This will set up an inheritance chain on the native side.
// The native `Child` Swift/Kotlin class will inherit from the `Base` Swift/Kotlin class.
export interface Child extends Base {
  readonly childValue: number
  // tests if the same variant can be used in a different HybridObject
  bounceVariant(variant: NamedVariant): NamedVariant
}
