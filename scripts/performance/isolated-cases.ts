import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'
import { validateBenchmarkRun, validateExpectedRun } from './schema'

/** Install once; the caller starts and terminates a fresh app process per case. */
export async function runIsolatedCases(
  runCase: (index: number) => Promise<BenchmarkRunResult>
): Promise<BenchmarkRunResult> {
  const first = validateBenchmarkRun(await runCase(0))
  const count = first.benchmarkCount!
  const runs: BenchmarkRunResult[] = []
  const ids = new Set<string>()
  for (let index = 0; index < count; index++) {
    const run = index === 0 ? first : validateBenchmarkRun(await runCase(index))
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
    runs.push(run)
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
