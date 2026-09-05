import {
  median,
  medianAbsoluteDeviation,
} from '../../apps/benchmark/src/benchmarks/statistics'
import type {
  BenchmarkMetric,
  BenchmarkRunResult,
} from '../../apps/benchmark/src/benchmarks/types'

/** A presentation threshold, not a calibrated regression budget. */
export const REPORTING_THRESHOLD_PERCENT = 5

export interface MetricComparison {
  id: string
  baseMedianNsPerOp: number
  headMedianNsPerOp: number
  deltaPercent: number
  baseProcessMedians: number[]
  headProcessMedians: number[]
  baseMadPercent: number
  headMadPercent: number
  pairChangesPercent: number[]
}

export interface PlatformComparison {
  platform: 'android' | 'ios'
  baseSha: string
  headSha: string
  suiteComparable: boolean
  comparisons: MetricComparison[]
}

export type BencherMetricFormat = Record<string, { latency: { value: number } }>

function indexMetrics(
  runs: readonly BenchmarkRunResult[]
): Map<string, BenchmarkMetric[]> {
  const index = new Map<string, BenchmarkMetric[]>()
  for (const run of runs) {
    for (const metric of run.metrics) {
      index.set(metric.id, [...(index.get(metric.id) ?? []), metric])
    }
  }
  return index
}

export function compareRuns(
  baseRuns: readonly BenchmarkRunResult[],
  headRuns: readonly BenchmarkRunResult[]
): PlatformComparison {
  if (baseRuns.length === 0 || baseRuns.length !== headRuns.length) {
    throw new Error('A matching base run is required for every head run.')
  }
  const { platform, commitSha: baseSha, suiteHash } = baseRuns[0]!.configuration
  const headSha = headRuns[0]!.configuration.commitSha
  for (const [runs, sha] of [
    [baseRuns, baseSha],
    [headRuns, headSha],
  ] as const) {
    if (
      runs.some(
        (run) =>
          run.configuration.platform !== platform ||
          run.configuration.commitSha !== sha
      )
    ) {
      throw new Error('Process runs have different platforms or commit SHAs.')
    }
  }
  const first = baseRuns[0]!
  for (const run of [...baseRuns, ...headRuns]) {
    for (const key of [
      'device',
      'osVersion',
      'architecture',
      'toolchain',
    ] as const) {
      if (run.configuration[key] !== first.configuration[key])
        throw new Error(`Process runs have different ${key} settings.`)
    }
    if (
      JSON.stringify(run.runner) !== JSON.stringify(first.runner) ||
      JSON.stringify(run.environment) !== JSON.stringify(first.environment)
    ) {
      throw new Error('Process runs have different runtime settings.')
    }
  }
  const suiteComparable = [...baseRuns, ...headRuns].every(
    (run) => run.configuration.suiteHash === suiteHash
  )
  const comparison: PlatformComparison = {
    platform,
    baseSha,
    headSha,
    suiteComparable,
    comparisons: [],
  }
  if (!suiteComparable) return comparison

  const baseMetrics = indexMetrics(baseRuns)
  const headMetrics = indexMetrics(headRuns)
  if (
    baseMetrics.size !== headMetrics.size ||
    [...baseMetrics.keys()].some((id) => !headMetrics.has(id))
  ) {
    throw new Error('Base and head expose different benchmark IDs.')
  }
  for (const id of [...baseMetrics.keys()].sort()) {
    const base = baseMetrics.get(id)!
    const head = headMetrics.get(id)!
    if (
      base.length !== baseRuns.length ||
      head.length !== headRuns.length ||
      [...base, ...head].some((metric) => metric.version !== base[0]!.version)
    ) {
      throw new Error(`Benchmark ${id} is missing or has a different version.`)
    }
    const baseSamples = base.flatMap((metric) => metric.samplesNsPerOp)
    const headSamples = head.flatMap((metric) => metric.samplesNsPerOp)
    const baseMedian = median(baseSamples)
    const headMedian = median(headSamples)
    const baseProcessMedians = base.map((metric) =>
      median(metric.samplesNsPerOp)
    )
    const headProcessMedians = head.map((metric) =>
      median(metric.samplesNsPerOp)
    )
    comparison.comparisons.push({
      id,
      baseMedianNsPerOp: baseMedian,
      headMedianNsPerOp: headMedian,
      deltaPercent: (headMedian / baseMedian - 1) * 100,
      baseProcessMedians,
      headProcessMedians,
      baseMadPercent: (medianAbsoluteDeviation(baseSamples) / baseMedian) * 100,
      headMadPercent: (medianAbsoluteDeviation(headSamples) / headMedian) * 100,
      pairChangesPercent: headProcessMedians.map(
        (value, index) => (value / baseProcessMedians[index]! - 1) * 100
      ),
    })
  }
  return comparison
}

export function toBencherMetricFormat(
  runs: readonly BenchmarkRunResult[]
): BencherMetricFormat {
  return Object.fromEntries(
    [...indexMetrics(runs)]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, metrics]) => [
        id,
        {
          latency: {
            value: median(metrics.flatMap((metric) => metric.samplesNsPerOp)),
          },
        },
      ])
  )
}
