import { Android, Apple } from 'nitro-core'
import type { Child } from './Child.nitro'

export * from '#nitro/Grandchild'

@Apple({ language: 'swift', implementation: { className: 'HybridGrandchild' } })
@Android({ language: 'kotlin', implementation: { className: 'HybridGrandchild' } })
export declare class Grandchild extends Child {
  constructor()
  readonly grandchildValue: number
}
