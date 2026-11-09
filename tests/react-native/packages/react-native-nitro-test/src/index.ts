import { NitroModules } from 'react-native-nitro-modules'
import type {
  BenchmarkObjectCpp,
  BenchmarkObjectSwiftKotlin,
} from './specs/BenchmarkObject.nitro'

export * from './specs/BenchmarkObject.nitro'
export * from './specs/TestView.nitro'
export * from './specs/PaddedTestView.nitro'

export const HybridBenchmarkObjectCpp =
  NitroModules.createHybridObject<BenchmarkObjectCpp>('BenchmarkObjectCpp')
export const HybridBenchmarkObjectSwiftKotlin =
  NitroModules.createHybridObject<BenchmarkObjectSwiftKotlin>(
    'BenchmarkObjectSwiftKotlin'
  )

export { TestView, type TestViewRef } from './views/TestView'
export { PaddedTestView } from './views/PaddedTestView'
export {
  RecyclableTestView,
  type RecyclableTestViewRef,
} from './views/RecyclableTestView'
