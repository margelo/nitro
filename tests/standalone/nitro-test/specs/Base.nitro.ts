import { Android, Apple } from 'nitro-core'
import type { HybridObject } from 'nitro-core'

export * from '#nitro/Base'

export enum SizeUnit {
  Points = 1,
  Pixels = 2,
}

export interface Size {
  width: number
  height: number
  unit: SizeUnit
}

@Apple({
  language: 'swift',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
@Android({
  language: 'kotlin',
  allowMultipleImplementations: true,
  allowInheritance: true,
})
export declare class Base extends HybridObject {
  readonly baseValue: number
  bounceSize(size: Size): Size
  bounceSizeUnit(unit: SizeUnit): SizeUnit
  mapSize(size: Size, callback: (size: Size) => Size): Promise<Size>
}
