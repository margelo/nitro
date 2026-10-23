import { Android, Apple } from 'nitro-core'
import type { CppBase } from './CppBase.nitro'
import type { NamedVariant } from './TestObject.nitro'

export * from '#nitro/CppChild'

@Apple({
  language: 'c++',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
@Android({
  language: 'c++',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
export declare class CppChild extends CppBase {
  readonly childValue: number
  bounceVariant(variant: NamedVariant): NamedVariant
}
