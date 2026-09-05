import { describe, expect, test } from 'bun:test'
import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'
import { compareRuns, toBencherMetricFormat } from './comparison'
import { validateBenchmarkRun } from './schema'

const BASE_SHA = 'a'.repeat(40)
const HEAD_SHA = 'b'.repeat(40)

function run(
  sha: string,
  samples: number[],
  suiteHash = 'c'.repeat(64)
): BenchmarkRunResult {
  return {
    schemaVersion: 1,
    suiteVersion: 1,
    benchmarkCount: 1,
    configuration: {
      runId: `run-${sha[0]}`,
      reverse: false,
      commitSha: sha,
      suiteHash,
      platform: 'ios',
      device: 'iPhone',
      osVersion: '26.5',
      architecture: 'arm64',
      toolchain: 'Xcode 26.5',
    },
    environment: {
      reactNativeVersion: '0.85.3',
      hermes: true,
      dev: false,
      nitroBuildType: 'release',
    },
    runner: {
      targetBatchDurationMs: 150,
      warmupCount: 5,
      sampleCount: samples.length,
    },
    startedAt: '2026-09-03T00:00:00.000Z',
    durationMs: 1_000,
    metrics: [
      {
        id: 'nitro-cpp/primitive/add-numbers',
        version: 1,
        family: 'primitive',
        implementation: 'nitro-cpp',
        iterations: 10_000,
        chunkIterations: 10_000,
        samplesNsPerOp: samples,
        checksum: 42,
      },
    ],
  }
}

describe('performance comparison', () => {
  test('requires explicit bounded chunk counts and Release Hermes', () => {
    const result = run(BASE_SHA, [100, 100])
    for (const chunk of [0, -1, 1.5, 10_001, undefined]) {
      expect(() =>
        validateBenchmarkRun({
          ...result,
          metrics: [{ ...result.metrics[0], chunkIterations: chunk }],
        })
      ).toThrow()
    }
    result.environment.dev = true
    expect(() => validateBenchmarkRun(result)).toThrow('production Hermes')
  })

  test('retains process disagreement even when pooled medians match', () => {
    const result = compareRuns(
      [run(BASE_SHA, [80, 80]), run(BASE_SHA, [120, 120])],
      [run(HEAD_SHA, [120, 120]), run(HEAD_SHA, [80, 80])]
    )
    expect(result.comparisons[0]?.deltaPercent).toBe(0)
    expect(result.comparisons[0]?.baseProcessMedians).toEqual([80, 120])
    expect(result.comparisons[0]?.pairChangesPercent[0]).toBe(50)
    expect(result.comparisons[0]?.pairChangesPercent[1]).toBeCloseTo(-33.3333)
  })

  test('reports observed changes without inventing confidence bounds', () => {
    const result = compareRuns(
      [run(BASE_SHA, [99, 100, 101])],
      [run(HEAD_SHA, [119, 120, 121])]
    )
    expect(result.comparisons[0]?.deltaPercent).toBeCloseTo(20)
    expect(result.comparisons[0]?.baseMadPercent).toBe(1)
    expect(toBencherMetricFormat([run(HEAD_SHA, [119, 120, 121])])).toEqual({
      'nitro-cpp/primitive/add-numbers': { latency: { value: 120 } },
    })
  })

  test('does not compare changed benchmark definitions', () => {
    expect(
      compareRuns(
        [run(BASE_SHA, [100])],
        [run(HEAD_SHA, [100], 'd'.repeat(64))]
      ).suiteComparable
    ).toBe(false)
  })
  test('rejects unequal work and calibration data even if timings look identical', () => {
    const base = run(BASE_SHA, [100, 100])
    const head = run(HEAD_SHA, [100, 100])
    head.metrics[0]!.iterations = 9_000
    expect(() => compareRuns([base], [head])).toThrow('unequal work')
    head.metrics[0]!.iterations = base.metrics[0]!.iterations
    head.configuration.calibration = true
    expect(() => compareRuns([base], [head])).toThrow('Calibration runs')
    expect(() => validateBenchmarkRun(head)).toThrow(
      'Calibration must not contain'
    )
    head.configuration.calibration = undefined
    head.metrics[0]!.samplesNsPerOp = []
    expect(() => validateBenchmarkRun(head)).toThrow('Sample count')
  })
})
