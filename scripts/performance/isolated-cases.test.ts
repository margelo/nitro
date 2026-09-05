import { describe, expect, test } from 'bun:test'
import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'
import { runIsolatedCases } from './isolated-cases'

function result(index: number): BenchmarkRunResult {
  return {
    schemaVersion: 1,
    suiteVersion: 1,
    benchmarkCount: 3,
    configuration: {
      benchmarkIndex: index,
      runId: 'ios-base-1',
      reverse: true,
      commitSha: 'a'.repeat(40),
      suiteHash: 'b'.repeat(64),
      platform: 'ios',
      device: 'simulator',
      osVersion: '26.5',
      architecture: 'arm64',
      toolchain: 'Xcode',
    },
    environment: {
      reactNativeVersion: '0.85.3',
      hermes: true,
      dev: false,
      nitroBuildType: 'release',
    },
    runner: { targetBatchDurationMs: 150, warmupCount: 5, sampleCount: 2 },
    startedAt: '2026-09-04T00:00:00.000Z',
    durationMs: 100,
    metrics: [
      {
        id: `nitro-cpp/control/case-${2 - index}`,
        version: 2,
        family: 'control',
        implementation: 'nitro-cpp',
        iterations: 1_500_000,
        chunkIterations: 5_000,
        samplesNsPerOp: [100 + index, 101 + index],
        checksum: 42,
      },
    ],
  }
}

describe('fresh-process benchmark cases', () => {
  test('assembles every case in order without changing samples or revision metadata', async () => {
    const calls: number[] = []
    const combined = await runIsolatedCases(async (index) => {
      calls.push(index)
      return result(index)
    })
    expect(calls).toEqual([0, 1, 2])
    expect(combined.metrics.map((m) => m.id)).toEqual(
      [0, 1, 2].map((i) => result(i).metrics[0]!.id)
    )
    expect(combined.metrics[2]!.samplesNsPerOp).toEqual([102, 103])
    expect(combined.configuration.benchmarkIndex).toBeUndefined()
    expect(combined.configuration.reverse).toBe(true)
    expect(combined.configuration.commitSha).toBe('a'.repeat(40))
    expect(combined.durationMs).toBe(300)
  })

  test('stops immediately on a missing process result', async () => {
    const calls: number[] = []
    await expect(
      runIsolatedCases(async (index) => {
        calls.push(index)
        if (index === 1) throw new Error('app timed out')
        return result(index)
      })
    ).rejects.toThrow('app timed out')
    expect(calls).toEqual([0, 1])
  })

  test('rejects duplicate cases, wrong revisions, changed settings, and wrong indices', async () => {
    const changes: ((r: BenchmarkRunResult) => void)[] = [
      (r) => {
        r.metrics[0]!.id = result(0).metrics[0]!.id
      },
      (r) => {
        r.configuration.commitSha = 'c'.repeat(40)
      },
      (r) => {
        r.configuration.benchmarkIndex = 0
      },
      (r) => {
        r.benchmarkCount = 4
      },
      (r) => {
        r.runner.sampleCount = 3
      },
      (r) => {
        r.environment.reactNativeVersion = 'different'
      },
    ]
    for (const change of changes) {
      await expect(
        runIsolatedCases(async (index) => {
          const r = result(index)
          if (index === 1) change(r)
          return r
        })
      ).rejects.toThrow()
    }
  })

  test('rejects an unbounded suite or a non-isolated first result before launching more', async () => {
    for (const count of [0, 101]) {
      await expect(
        runIsolatedCases(async () => ({ ...result(0), benchmarkCount: count }))
      ).rejects.toThrow()
    }
    await expect(
      runIsolatedCases(async () => ({
        ...result(0),
        metrics: [result(0).metrics[0]!, result(1).metrics[0]!],
      }))
    ).rejects.toThrow('unexpected cases')
  })
})
