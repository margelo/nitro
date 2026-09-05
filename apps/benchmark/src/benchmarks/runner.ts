import { median } from './statistics'
import { calibrateIterations } from './calibration'
import { benchmarkRuntime, executeBatch, type BenchmarkRuntime } from './batch'
import type {
  BenchmarkDefinition,
  BenchmarkMetric,
  BenchmarkRunnerOptions,
  BenchmarkWork,
} from './types'

export async function calibrateBenchmarkDefinitions(
  definitions: readonly BenchmarkDefinition[],
  targetBatchDurationMs: number,
  runtime: BenchmarkRuntime = benchmarkRuntime
): Promise<BenchmarkWork[]> {
  const work: BenchmarkWork[] = []
  for (const definition of definitions) {
    const iterations = await calibrateIterations(
      async (count) =>
        (await executeBatch(definition, count, runtime)).durationMs,
      targetBatchDurationMs,
      definition.initialIterations,
      definition.maxIterations
    )
    work.push({
      id: definition.id,
      iterations,
      chunkIterations: Math.min(
        iterations,
        definition.maxChunkIterations ?? iterations
      ),
    })
  }
  return work
}

export async function runBenchmarkDefinitions(
  definitions: readonly BenchmarkDefinition[],
  options: BenchmarkRunnerOptions,
  work: readonly BenchmarkWork[],
  runtime: BenchmarkRuntime = benchmarkRuntime
): Promise<BenchmarkMetric[]> {
  const ordered = options.reverse
    ? [...definitions].reverse()
    : [...definitions]
  const metrics: BenchmarkMetric[] = []
  for (const definition of ordered) {
    const plan = work.find((entry) => entry.id === definition.id)
    if (
      plan == null ||
      !Number.isSafeInteger(plan.iterations) ||
      plan.iterations < 1 ||
      plan.iterations > (definition.maxIterations ?? 100_000_000) ||
      !Number.isSafeInteger(plan.chunkIterations) ||
      plan.chunkIterations < 1 ||
      plan.chunkIterations > plan.iterations ||
      plan.chunkIterations > (definition.maxChunkIterations ?? plan.iterations)
    ) {
      throw new Error(
        `Missing or incompatible work counts for ${definition.id}.`
      )
    }
    let checksum = 0
    for (let index = 0; index < options.warmupCount; index++) {
      checksum += (
        await executeBatch(
          definition,
          plan.iterations,
          runtime,
          plan.chunkIterations
        )
      ).checksum
    }
    // The same plan is used for both binaries. Preserve every ordered sample,
    // even if head is much slower than the calibration target.
    const samplesNsPerOp: number[] = []
    for (let index = 0; index < options.sampleCount; index++) {
      const sample = await executeBatch(
        definition,
        plan.iterations,
        runtime,
        plan.chunkIterations
      )
      checksum += sample.checksum
      samplesNsPerOp.push((sample.durationMs * 1_000_000) / plan.iterations)
    }
    const metric: BenchmarkMetric = {
      ...plan,
      version: definition.version,
      family: definition.family,
      implementation: definition.implementation,
      samplesNsPerOp,
      checksum,
    }
    metrics.push(metric)
    console.info(
      `[NitroBenchmark] ${metric.id}: ${median(samplesNsPerOp).toFixed(2)} ns/op; ${plan.iterations} ops/sample, chunks of ${plan.chunkIterations}`
    )
  }
  return metrics
}
