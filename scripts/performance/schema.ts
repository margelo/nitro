import type {
  BenchmarkMetric,
  BenchmarkRunConfiguration,
  BenchmarkRunEnvironment,
  BenchmarkRunResult,
} from '../../apps/benchmark/src/benchmarks/types'

const SHA_PATTERN = /^[0-9a-f]{40}$/
const SUITE_HASH_PATTERN = /^[0-9a-f]{64}$/
const METRIC_ID_PATTERN = /^[a-z0-9][a-z0-9/._-]{0,199}$/
const MAX_STRING_LENGTH = 256
const MAX_METRICS = 100
const MAX_SAMPLES = 100
const MAX_NS_PER_OPERATION = 1_000_000_000_000

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function stringValue(value: unknown, name: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_STRING_LENGTH
  ) {
    throw new Error(`${name} must be a non-empty bounded string.`)
  }
  return value
}

function finiteNumber(
  value: unknown,
  name: string,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `${name} must be a finite number between ${minimum} and ${maximum}.`
    )
  }
  return value
}

function positiveInteger(value: unknown, name: string): number {
  const number = finiteNumber(value, name, 1)
  if (!Number.isInteger(number)) throw new Error(`${name} must be an integer.`)
  return number
}

function validateConfiguration(value: unknown): BenchmarkRunConfiguration {
  if (!isObject(value)) throw new Error('configuration must be an object.')
  const commitSha = stringValue(value.commitSha, 'configuration.commitSha')
  if (!SHA_PATTERN.test(commitSha)) {
    throw new Error('configuration.commitSha must be a lowercase 40-byte SHA.')
  }
  const platform = value.platform
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error('configuration.platform must be android or ios.')
  }
  const suiteHash = stringValue(value.suiteHash, 'configuration.suiteHash')
  if (!SUITE_HASH_PATTERN.test(suiteHash)) {
    throw new Error('configuration.suiteHash must be a SHA-256 digest.')
  }
  return {
    ...(value.benchmarkIndex === undefined
      ? {}
      : {
          benchmarkIndex:
            positiveInteger(
              finiteNumber(
                value.benchmarkIndex,
                'configuration.benchmarkIndex',
                0,
                MAX_METRICS - 1
              ) + 1,
              'configuration.benchmarkIndex + 1'
            ) - 1,
        }),
    runId: stringValue(value.runId, 'configuration.runId'),
    reverse:
      typeof value.reverse === 'boolean'
        ? value.reverse
        : (() => {
            throw new Error('configuration.reverse must be a boolean.')
          })(),
    commitSha,
    suiteHash,
    platform,
    device: stringValue(value.device, 'configuration.device'),
    osVersion: stringValue(value.osVersion, 'configuration.osVersion'),
    architecture: stringValue(value.architecture, 'configuration.architecture'),
    toolchain: stringValue(value.toolchain, 'configuration.toolchain'),
  }
}

function validateEnvironment(value: unknown): BenchmarkRunEnvironment {
  if (!isObject(value)) throw new Error('environment must be an object.')
  if (value.hermes !== true || value.dev !== false) {
    throw new Error('Benchmarks must run in production Hermes.')
  }
  if (value.nitroBuildType !== 'release') {
    throw new Error('Benchmarks must run with Nitro release bindings.')
  }
  return {
    reactNativeVersion: stringValue(
      value.reactNativeVersion,
      'environment.reactNativeVersion'
    ),
    hermes: true,
    dev: false,
    nitroBuildType: 'release',
  }
}

function validateMetric(value: unknown, index: number): BenchmarkMetric {
  if (!isObject(value)) throw new Error(`metrics[${index}] must be an object.`)
  const samples = value.samplesNsPerOp
  if (
    !Array.isArray(samples) ||
    samples.length === 0 ||
    samples.length > MAX_SAMPLES
  ) {
    throw new Error(`metrics[${index}].samplesNsPerOp has invalid length.`)
  }
  const samplesNsPerOp = samples.map((sample, sampleIndex) =>
    finiteNumber(
      sample,
      `metrics[${index}].samples[${sampleIndex}]`,
      Number.MIN_VALUE,
      MAX_NS_PER_OPERATION
    )
  )
  const implementation = value.implementation
  if (
    implementation !== 'javascript' &&
    implementation !== 'turbo-module' &&
    implementation !== 'nitro-cpp' &&
    implementation !== 'nitro-platform'
  ) {
    throw new Error(`metrics[${index}] has an invalid implementation.`)
  }
  const family = stringValue(value.family, `metrics[${index}].family`)
  if (
    family !== 'control' &&
    family !== 'primitive' &&
    family !== 'property' &&
    family !== 'string' &&
    family !== 'array' &&
    family !== 'struct' &&
    family !== 'map' &&
    family !== 'optional' &&
    family !== 'variant' &&
    family !== 'hybrid-object' &&
    family !== 'array-buffer' &&
    family !== 'callback' &&
    family !== 'promise'
  ) {
    throw new Error(`metrics[${index}] has an invalid family.`)
  }
  const id = stringValue(value.id, `metrics[${index}].id`)
  if (!METRIC_ID_PATTERN.test(id)) {
    throw new Error(`metrics[${index}] has an invalid ID.`)
  }
  const iterations = positiveInteger(
    value.iterations,
    `metrics[${index}].iterations`
  )
  const chunkIterations = positiveInteger(
    value.chunkIterations,
    `metrics[${index}].chunkIterations`
  )
  if (chunkIterations > iterations) {
    throw new Error(
      `metrics[${index}].chunkIterations exceeds its sample size.`
    )
  }
  return {
    id,
    version: positiveInteger(value.version, `metrics[${index}].version`),
    family: family as BenchmarkMetric['family'],
    implementation,
    iterations,
    chunkIterations,
    samplesNsPerOp,
    checksum: finiteNumber(value.checksum, `metrics[${index}].checksum`),
  }
}

export function validateBenchmarkRun(value: unknown): BenchmarkRunResult {
  if (!isObject(value)) throw new Error('Benchmark result must be an object.')
  if (value.schemaVersion !== 1 || value.suiteVersion !== 1) {
    throw new Error('Unsupported benchmark schema or suite version.')
  }
  if (!isObject(value.runner)) throw new Error('runner must be an object.')
  const metrics = value.metrics
  if (
    !Array.isArray(metrics) ||
    metrics.length === 0 ||
    metrics.length > MAX_METRICS
  ) {
    throw new Error('metrics must be a non-empty bounded array.')
  }
  const validatedMetrics = metrics.map(validateMetric)
  const benchmarkCount = positiveInteger(value.benchmarkCount, 'benchmarkCount')
  if (benchmarkCount > MAX_METRICS || benchmarkCount < metrics.length) {
    throw new Error('benchmarkCount is outside the bounded suite size.')
  }
  if (
    new Set(validatedMetrics.map((metric) => metric.id)).size !== metrics.length
  ) {
    throw new Error('Metric IDs must be unique.')
  }
  const sampleCount = value.runner.sampleCount
  if (
    validatedMetrics.some(
      (metric) => metric.samplesNsPerOp.length !== sampleCount
    )
  ) {
    throw new Error('Sample count does not match runner settings.')
  }
  const startedAt = stringValue(value.startedAt, 'startedAt')
  if (Number.isNaN(Date.parse(startedAt))) {
    throw new Error('startedAt must be an ISO timestamp.')
  }
  return {
    schemaVersion: 1,
    suiteVersion: 1,
    benchmarkCount,
    configuration: validateConfiguration(value.configuration),
    environment: validateEnvironment(value.environment),
    runner: {
      targetBatchDurationMs: finiteNumber(
        value.runner.targetBatchDurationMs,
        'runner.targetBatchDurationMs',
        1,
        10_000
      ),
      warmupCount: positiveInteger(
        value.runner.warmupCount,
        'runner.warmupCount'
      ),
      sampleCount: positiveInteger(
        value.runner.sampleCount,
        'runner.sampleCount'
      ),
    },
    startedAt,
    durationMs: finiteNumber(value.durationMs, 'durationMs'),
    metrics: validatedMetrics,
  }
}

export function validateExpectedRun(
  result: BenchmarkRunResult,
  expected: BenchmarkRunConfiguration
): void {
  const actual = result.configuration
  for (const key of Object.keys(
    expected
  ) as (keyof BenchmarkRunConfiguration)[]) {
    if (actual[key] !== expected[key]) {
      throw new Error(`Result configuration mismatch for ${key}.`)
    }
  }
}

export function isSafeSha(value: string): boolean {
  return SHA_PATTERN.test(value)
}
