import { median } from './statistics'
import { getBenchmarkIterations } from './iterations'
import { benchmarkRuntime, executeBatch, type BenchmarkRuntime } from './batch'
import type {
  BenchmarkDefinition,
  BenchmarkMetric,
  BenchmarkRunnerOptions,
} from './types'

export async function runBenchmarkDefinitions(
  definitions: readonly BenchmarkDefinition[],
  options: BenchmarkRunnerOptions,
  platform: 'android' | 'ios',
  runtime: BenchmarkRuntime = benchmarkRuntime
): Promise<BenchmarkMetric[]> {
  const ordered = options.reverse
    ? [...definitions].reverse()
    : [...definitions]
  const metrics: BenchmarkMetric[] = []
  for (const definition of ordered) {
    const iterations = getBenchmarkIterations(definition.id, platform)
    const chunkIterations = Math.min(
      iterations,
      definition.maxChunkIterations ?? iterations
    )
    let checksum = 0
    for (let index = 0; index < options.warmupCount; index++) {
      checksum += (
        await executeBatch(definition, iterations, runtime, chunkIterations)
      ).checksum
    }
    // Both binaries use the checked-in counts. Preserve every ordered sample,
    // including slow samples; never shorten the workload from measured timings.
    const samplesNsPerOp: number[] = []
    for (let index = 0; index < options.sampleCount; index++) {
      const sample = await executeBatch(
        definition,
        iterations,
        runtime,
        chunkIterations
      )
      checksum += sample.checksum
      samplesNsPerOp.push((sample.durationMs * 1_000_000) / iterations)
    }
    const metric: BenchmarkMetric = {
      id: definition.id,
      iterations,
      chunkIterations,
      version: definition.version,
      family: definition.family,
      implementation: definition.implementation,
      samplesNsPerOp,
      checksum,
    }
    metrics.push(metric)
    console.info(
      `[NitroBenchmark] ${metric.id}: ${median(samplesNsPerOp).toFixed(2)} ns/op; ${iterations} ops/sample, chunks of ${chunkIterations}`
    )
  }
  return metrics
}
