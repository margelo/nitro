export type BenchmarkImplementation =
  | 'javascript'
  | 'turbo-module'
  | 'nitro-cpp'
  | 'nitro-platform'

export type BenchmarkFamily =
  | 'control'
  | 'primitive'
  | 'property'
  | 'string'
  | 'array'
  | 'struct'
  | 'map'
  | 'optional'
  | 'variant'
  | 'hybrid-object'
  | 'array-buffer'
  | 'callback'
  | 'promise'

interface BenchmarkDefinitionBase {
  id: string
  version: number
  family: BenchmarkFamily
  implementation: BenchmarkImplementation
  initialIterations?: number
  maxIterations?: number
  /** Bound live allocations, not the total operations in a measured sample. */
  maxChunkIterations?: number
  /** Additional native-heap cleanup after Hermes GC, outside measured time. */
  collectNativeGarbage?(): void
  expectedChecksum(iterations: number): number
}

export interface SyncBenchmarkDefinition extends BenchmarkDefinitionBase {
  kind: 'sync'
  run(iterations: number): number
}

export interface AsyncBenchmarkDefinition extends BenchmarkDefinitionBase {
  kind: 'async'
  run(iterations: number): Promise<number>
}

export type BenchmarkDefinition =
  | SyncBenchmarkDefinition
  | AsyncBenchmarkDefinition

export interface BenchmarkRunnerOptions {
  targetBatchDurationMs: number
  warmupCount: number
  sampleCount: number
  reverse: boolean
}

export interface BenchmarkWork {
  id: string
  iterations: number
  /** Maximum operations between untimed garbage collections. */
  chunkIterations: number
}

export interface BenchmarkMetric extends BenchmarkWork {
  version: number
  family: BenchmarkFamily
  implementation: BenchmarkImplementation
  samplesNsPerOp: number[]
  checksum: number
}

export interface BenchmarkRunConfiguration {
  /** Calibration is discarded; measurement always uses a fresh process. */
  calibration?: true
  work?: BenchmarkWork
  /** Select one case in suite order for a fresh-process measurement. */
  benchmarkIndex?: number
  runId: string
  reverse: boolean
  commitSha: string
  suiteHash: string
  platform: 'android' | 'ios'
  device: string
  osVersion: string
  architecture: string
  toolchain: string
}

export interface BenchmarkRunEnvironment {
  reactNativeVersion: string
  hermes: boolean
  dev: boolean
  nitroBuildType: 'debug' | 'release'
}

export interface BenchmarkRunResult {
  schemaVersion: 1
  suiteVersion: 1
  configuration: BenchmarkRunConfiguration
  environment: BenchmarkRunEnvironment
  runner: Omit<BenchmarkRunnerOptions, 'reverse'>
  startedAt: string
  durationMs: number
  metrics: BenchmarkMetric[]
  /** Full suite size, including when this process measured just one case. */
  benchmarkCount?: number
}
