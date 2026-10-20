import { iOS } from 'react-native-nitro-modules'
import type { HybridObject } from 'react-native-nitro-modules'

export type Powertrain = 'electric' | 'gas' | 'hybrid'

export interface Person {
  name: string
  age: number
}

export interface Car {
  year: number
  make: string
  model: string
  power: number
  powertrain: Powertrain
  driver?: Person
  passengers: Person[]
  isFast?: boolean
  favouriteTrack?: string
  performanceScores: number[]
  someVariant?: number | string
}

@iOS({
  language: 'c++',
  implementation: {
    className: 'HybridBenchmarkObjectCpp',
    include: '"HybridBenchmarkObjectCpp.hpp"',
  },
})
export declare class BenchmarkObjectCpp extends HybridObject {
  constructor()

  numberValue: number
  simpleFunc(): void
  addNumbers(a: number, b: number): number
  addStrings(a: string, b: string): string
  bounceNumbers(array: number[]): number[]
  bounceCar(car: Car): Car
  bounceSimpleMap(map: Record<string, number>): Record<string, number>
  tryOptionalParams(num: number, boo: boolean, str?: string): string
  passVariant(
    either: number | string | number[] | string[] | boolean
  ): number | string
  bounceArrayBuffer(buffer: ArrayBuffer): ArrayBuffer
  copyBuffer(buffer: ArrayBuffer): ArrayBuffer
  callbackSync(callback: () => number): number
  promiseReturnsInstantly(): Promise<number>
  // Completion is triggered after the pending Promise has been converted to JS.
  createPendingPromise(): Promise<number>
  resolvePendingPromiseOnWorker(): void

  readonly thisObject: BenchmarkObjectCpp
  newBenchmarkObject(): BenchmarkObjectCpp
}

@iOS({
  language: 'swift',
  implementation: { className: 'HybridBenchmarkObjectSwift' },
})
export declare class BenchmarkObjectSwiftKotlin extends HybridObject {
  constructor()

  numberValue: number
  simpleFunc(): void
  addNumbers(a: number, b: number): number
  addStrings(a: string, b: string): string
  bounceNumbers(array: number[]): number[]
  bounceCar(car: Car): Car
  bounceSimpleMap(map: Record<string, number>): Record<string, number>
  tryOptionalParams(num: number, boo: boolean, str?: string): string
  passVariant(
    either: number | string | number[] | string[] | boolean
  ): number | string
  bounceArrayBuffer(buffer: ArrayBuffer): ArrayBuffer
  copyBuffer(buffer: ArrayBuffer): ArrayBuffer
  callbackSync(callback: () => number): number
  promiseReturnsInstantly(): Promise<number>
  // Completion is triggered after the pending Promise has been converted to JS.
  createPendingPromise(): Promise<number>
  resolvePendingPromiseOnWorker(): void

  readonly thisObject: BenchmarkObjectSwiftKotlin
  newBenchmarkObject(): BenchmarkObjectSwiftKotlin
}

export * from '#nitro/BenchmarkObjectCpp'

export * from '#nitro/BenchmarkObjectSwiftKotlin'
