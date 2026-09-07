import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'
import { validateBenchmarkRun, validateExpectedRun } from './schema'

/** Combine a complete suite without discarding any per-process raw samples. */
export function combineIsolatedCases(
  runs: readonly BenchmarkRunResult[]
): BenchmarkRunResult {
  const first = validateBenchmarkRun(runs[0])
  const count = first.benchmarkCount!
  if (runs.length !== count)
    throw new Error('Incomplete isolated benchmark suite.')
  const ids = new Set<string>()
  for (let index = 0; index < count; index++) {
    const run = validateBenchmarkRun(runs[index])
    const { work: _firstWork, ...sharedConfiguration } = first.configuration
    validateExpectedRun(run, { ...sharedConfiguration, benchmarkIndex: index })
    if (
      run.benchmarkCount !== count ||
      run.metrics.length !== 1 ||
      ids.has(run.metrics[0]!.id)
    ) {
      throw new Error(
        'Isolated benchmark results contain missing, duplicate, or unexpected cases.'
      )
    }
    if (
      JSON.stringify(run.environment) !== JSON.stringify(first.environment) ||
      JSON.stringify(run.runner) !== JSON.stringify(first.runner)
    ) {
      throw new Error(
        'Isolated benchmark processes have incompatible runtime settings.'
      )
    }
    ids.add(run.metrics[0]!.id)
  }
  const configuration = { ...first.configuration }
  delete configuration.benchmarkIndex
  delete configuration.work
  return {
    ...first,
    configuration,
    durationMs: runs.reduce((sum, run) => sum + run.durationMs, 0),
    metrics: runs.flatMap((run) => run.metrics),
  }
}
