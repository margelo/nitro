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
    schemaVersion: 2,
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
    expect(() => validateBenchmarkRun({ ...result, schemaVersion: 1 })).toThrow(
      'Unsupported benchmark schema'
    )
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

  test('compares normalized timings even when the benchmark or runner changes', () => {
    const base = run(BASE_SHA, [100, 100])
    const head = run(HEAD_SHA, [100, 100, 100], 'd'.repeat(64))
    head.runner.warmupCount = 10
    head.metrics[0]!.iterations = 20_000
    head.metrics[0]!.chunkIterations = 5_000
    head.metrics[0]!.version++
    expect(compareRuns([base], [head]).comparisons[0]?.deltaPercent).toBe(0)
    head.metrics[0]!.samplesNsPerOp = [200, 200, 200]
    expect(compareRuns([base], [head]).comparisons[0]?.deltaPercent).toBe(100)
  })

  test('matches reordered cases by ID and retains new and removed timings', () => {
    const base = run(BASE_SHA, [100, 100])
    const head = run(HEAD_SHA, [120, 120], 'd'.repeat(64))
    base.metrics.push({ ...base.metrics[0]!, id: 'removed' })
    head.metrics.unshift({ ...head.metrics[0]!, id: 'new' })
    base.benchmarkCount = head.benchmarkCount = 2
    const metrics = compareRuns([base], [head]).comparisons
    expect(
      metrics.map(({ id, baseMedianNsPerOp, headMedianNsPerOp }) => [
        id,
        baseMedianNsPerOp,
        headMedianNsPerOp,
      ])
    ).toEqual([
      ['new', null, 120],
      ['nitro-cpp/primitive/add-numbers', 100, 120],
      ['removed', 100, null],
    ])
    expect(metrics[0]?.deltaPercent).toBeNull()
    expect(metrics[1]?.deltaPercent).toBeCloseTo(20)
    expect(metrics[2]?.deltaPercent).toBeNull()
    expect(metrics[0]?.pairChangesPercent).toEqual([])
    expect(metrics[2]?.pairChangesPercent).toEqual([])
  })

  test('still rejects missing samples', () => {
    const head = run(HEAD_SHA, [100, 100])
    head.metrics[0]!.samplesNsPerOp = []
    expect(() => validateBenchmarkRun(head)).toThrow('Sample count')
  })
})
