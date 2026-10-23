import { Android, Apple, type HybridObject } from 'nitro-core'

export * from '#nitro/Example'

@Android({
  language: 'kotlin',
  implementation: { className: 'HybridExample' },
})
@Apple({
  language: 'swift',
  implementation: { className: 'HybridExample' },
})
export declare class Example extends HybridObject {
  constructor()

  add(a: number, b: number): number
}
