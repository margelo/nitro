import type { HybridObject, Sync } from 'react-native-nitro-modules'

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

interface BenchmarkMethods {
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
  callbackSync(callback: Sync<() => number>): number
  promiseReturnsInstantly(): Promise<number>
  // Completion is triggered after the pending Promise has been converted to JS.
  createPendingPromise(): Promise<number>
  resolvePendingPromiseOnWorker(): void
}

export interface BenchmarkObjectCpp
  extends HybridObject<{ ios: 'c++'; android: 'c++' }>, BenchmarkMethods {
  readonly thisObject: BenchmarkObjectCpp
  newBenchmarkObject(): BenchmarkObjectCpp
}

export interface BenchmarkObjectSwiftKotlin
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }>, BenchmarkMethods {
  readonly thisObject: BenchmarkObjectSwiftKotlin
  newBenchmarkObject(): BenchmarkObjectSwiftKotlin
}
