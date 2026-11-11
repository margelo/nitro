import { Platform } from 'react-native'
import { NitroModules } from 'react-native-nitro-modules'
import type { BenchmarkRunEnvironment } from './types'

declare const __DEV__: boolean

function reactNativeVersion(): string {
  const version = Platform.constants.reactNativeVersion
  return `${version.major}.${version.minor}.${version.patch}`
}

export function getBenchmarkEnvironment(): BenchmarkRunEnvironment {
  return {
    reactNativeVersion: reactNativeVersion(),
    hermes: HermesInternal != null,
    dev: __DEV__,
    nitroBuildType: NitroModules.buildType,
  }
}

export function assertReleaseBenchmarkEnvironment(
  environment: BenchmarkRunEnvironment
): void {
  if (environment.dev) {
    throw new Error('Performance benchmarks require __DEV__ === false.')
  }
  if (!environment.hermes) {
    throw new Error('Performance benchmarks require the Hermes runtime.')
  }
  if (environment.nitroBuildType !== 'release') {
    throw new Error(
      `Performance benchmarks require a release Nitro build, got ${environment.nitroBuildType}.`
    )
  }
}
