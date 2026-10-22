import { Android, iOS } from 'nitro-core'
import type { CppBase } from './CppBase.nitro'
import type { NamedVariant } from './TestObject.nitro'

export * from '#nitro/CppChild'

@iOS({
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
