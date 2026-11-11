import { type TurboModule, TurboModuleRegistry } from 'react-native'

export interface Spec extends TurboModule {
  addNumbers(a: number, b: number): number
  /** Benchmark-only, synchronous cleanup; never called inside a timed region. */
  collectGarbage(): boolean
}

export default TurboModuleRegistry.getEnforcing<Spec>('ExampleTurboModule')
