import { calibrateBenchmarkDefinitions } from './runner'
import * as React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import {
  assertReleaseBenchmarkEnvironment,
  createBenchmarkSuite,
  getBenchmarkEnvironment,
  runBenchmarkDefinitions,
  type BenchmarkRunConfiguration,
  type BenchmarkRunResult,
  type BenchmarkRunnerOptions,
} from './index'

const CONTROLLER_URL = 'http://127.0.0.1:8173'
const RUNNER_OPTIONS: Omit<BenchmarkRunnerOptions, 'reverse'> = {
  targetBatchDurationMs: 150,
  warmupCount: 5,
  sampleCount: 20,
}

function isRunConfiguration(
  value: unknown
): value is BenchmarkRunConfiguration {
  if (value == null || typeof value !== 'object') return false
  const candidate = value as Partial<BenchmarkRunConfiguration>
  return (
    (candidate.calibration === undefined || candidate.calibration === true) &&
    (candidate.work === undefined ||
      (candidate.work != null &&
        typeof candidate.work.id === 'string' &&
        Number.isSafeInteger(candidate.work.iterations) &&
        Number.isSafeInteger(candidate.work.chunkIterations))) &&
    typeof candidate.runId === 'string' &&
    typeof candidate.reverse === 'boolean' &&
    typeof candidate.commitSha === 'string' &&
    typeof candidate.suiteHash === 'string' &&
    (candidate.platform === 'android' || candidate.platform === 'ios') &&
    typeof candidate.device === 'string' &&
    typeof candidate.osVersion === 'string' &&
    typeof candidate.architecture === 'string' &&
    typeof candidate.toolchain === 'string' &&
    (candidate.benchmarkIndex === undefined ||
      (Number.isInteger(candidate.benchmarkIndex) &&
        candidate.benchmarkIndex >= 0))
  )
}

async function waitForRuntimeToSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  await new Promise<void>((resolve) => setTimeout(resolve, 1_000))
}

async function readConfiguration(): Promise<BenchmarkRunConfiguration> {
  const response = await fetch(`${CONTROLLER_URL}/config`)
  if (!response.ok) {
    throw new Error(`Controller returned HTTP ${response.status}.`)
  }
  const value: unknown = await response.json()
  if (!isRunConfiguration(value)) {
    throw new Error('Controller returned an invalid benchmark configuration.')
  }
  return value
}

async function postJson(path: string, value: unknown): Promise<void> {
  const response = await fetch(`${CONTROLLER_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  })
  if (!response.ok) {
    throw new Error(`Controller returned HTTP ${response.status}.`)
  }
}

async function run(): Promise<BenchmarkRunResult> {
  const configuration = await readConfiguration()
  const environment = getBenchmarkEnvironment()
  assertReleaseBenchmarkEnvironment(environment)
  await waitForRuntimeToSettle()

  const startedAt = new Date().toISOString()
  const start = performance.now()
  const suite = createBenchmarkSuite()
  const ordered = configuration.reverse ? [...suite].reverse() : suite
  const selected =
    configuration.benchmarkIndex === undefined
      ? suite
      : ordered.slice(
          configuration.benchmarkIndex,
          configuration.benchmarkIndex + 1
        )
  if (selected.length === 0)
    throw new Error('Requested benchmark index is outside the suite.')
  const runner = configuration.calibration
    ? { ...RUNNER_OPTIONS, warmupCount: 0, sampleCount: 0 }
    : RUNNER_OPTIONS
  const metrics = configuration.calibration
    ? (
        await calibrateBenchmarkDefinitions(
          selected,
          runner.targetBatchDurationMs
        )
      ).map((work, index) => ({
        ...work,
        version: selected[index]!.version,
        family: selected[index]!.family,
        implementation: selected[index]!.implementation,
        samplesNsPerOp: [],
        checksum: 0,
      }))
    : await runBenchmarkDefinitions(
        selected,
        { ...runner, reverse: configuration.reverse },
        configuration.work == null ? [] : [configuration.work]
      )

  return {
    schemaVersion: 1,
    suiteVersion: 1,
    configuration,
    environment,
    runner,
    startedAt,
    durationMs: performance.now() - start,
    metrics,
    benchmarkCount: suite.length,
  }
}

export function BenchmarkApp() {
  const [status, setStatus] = React.useState('Preparing Release benchmarks…')

  React.useEffect(() => {
    let active = true
    const execute = async () => {
      try {
        const result = await run()
        await postJson('/result', result)
        if (active) setStatus('Benchmarks complete.')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        try {
          await postJson('/error', { message })
        } catch {
          // The host-side timeout will report a controller connection failure.
        }
        if (active) setStatus(`Benchmark failed: ${message}`)
      }
    }
    execute()
    return () => {
      active = false
    }
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nitro Performance</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0b0b0f',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  status: {
    color: '#b8b8c3',
    fontSize: 16,
    textAlign: 'center',
  },
})
