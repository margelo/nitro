import 'react-native-nitro-modules'
import {
  BenchmarkObjectCpp,
  BenchmarkObjectSwiftKotlin,
} from './specs/BenchmarkObject.nitro'

export * from './specs/BenchmarkObject.nitro'
export * from './specs/TestView.nitro'
export * from './specs/RecyclableTestView.nitro'

export const HybridBenchmarkObjectCpp = new BenchmarkObjectCpp()
export const HybridBenchmarkObjectSwiftKotlin = new BenchmarkObjectSwiftKotlin()

export { TestView, type TestViewRef } from './views/TestView'
export {
  RecyclableTestView,
  type RecyclableTestViewRef,
} from './views/RecyclableTestView'
