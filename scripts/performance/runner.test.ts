import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
  calibrateBenchmarkDefinitions,
  runBenchmarkDefinitions,
} from '../../apps/benchmark/src/benchmarks/runner'
import {
  benchmarkRuntime,
  executeBatch,
} from '../../apps/benchmark/src/benchmarks/batch'
import {
  calibrateIterations,
  roundIterations,
} from '../../apps/benchmark/src/benchmarks/calibration'
import type { BenchmarkDefinition } from '../../apps/benchmark/src/benchmarks/types'

const runtime = { collectGarbage() {}, async yieldToRuntime() {} }
const work = [
  { id: 'javascript/control/fake-clock', iterations: 1, chunkIterations: 1 },
]

afterEach(() => {
  spyOn(performance, 'now').mockRestore()
})

function definition(expectedChecksum: (iterations: number) => number) {
  return {
    id: 'javascript/control/fake-clock',
    version: 1,
    family: 'control',
    implementation: 'javascript',
    kind: 'sync',
    initialIterations: 1,
    maxIterations: 1,
    expectedChecksum,
    run: (iterations) => iterations * 2,
  } satisfies BenchmarkDefinition
}

describe('benchmark runner', () => {
  test('uses a positive-delay native yield, not the immediate timer fast path', async () => {
    const timer = spyOn(globalThis, 'setTimeout')
    try {
      await benchmarkRuntime.yieldToRuntime()
      expect(timer.mock.calls[0]?.[1]).toBe(1)
    } finally {
      timer.mockRestore()
    }
  })

  test('samples batches with a fake clock', async () => {
    let now = 0
    spyOn(performance, 'now').mockImplementation(() => now++)

    const [metric] = await runBenchmarkDefinitions(
      [definition((iterations) => iterations * 2)],
      {
        targetBatchDurationMs: 1,
        warmupCount: 1,
        sampleCount: 2,
        reverse: false,
      },
      work,
      runtime
    )

    expect(metric?.iterations).toBe(1)
    expect(metric?.samplesNsPerOp).toEqual([1_000_000, 1_000_000])
    expect(metric?.checksum).toBe(6)
  })

  test('rejects an invalid checksum outside the timed region', async () => {
    let now = 0
    spyOn(performance, 'now').mockImplementation(() => now++)

    await expect(
      runBenchmarkDefinitions(
        [definition(() => 99)],
        {
          targetBatchDurationMs: 1,
          warmupCount: 1,
          sampleCount: 1,
          reverse: false,
        },
        work,
        runtime
      )
    ).rejects.toThrow('returned checksum 2, expected 99')
  })

  test('rounds counts to two significant digits', () => {
    expect(roundIterations(1_478_392, 100_000_000)).toBe(1_500_000)
    expect(roundIterations(243_987, 100_000_000)).toBe(240_000)
    expect(roundIterations(3_187, 100_000_000)).toBe(3_200)
    expect(roundIterations(0.5, 100)).toBe(1)
    expect(roundIterations(1000, 256)).toBe(256)
  })

  test('calibrates fast and slow methods into 100–200 ms with round counts', async () => {
    for (const msPerOperation of [0.00002, 0.0001, 0.005, 0.1, 10]) {
      const iterations = await calibrateIterations(
        async (n) => n * msPerOperation,
        150
      )
      expect(iterations * msPerOperation).toBeGreaterThanOrEqual(100)
      expect(iterations * msPerOperation).toBeLessThanOrEqual(200)
      expect(iterations).toBe(roundIterations(iterations, 100_000_000))
    }
  })

  test('shrinks an overshooting calibration instead of accepting it', async () => {
    const iterations = await calibrateIterations(
      async (n) => n * 0.01,
      150,
      100_000
    )
    expect(iterations).toBe(15_000)
  })

  test('handles a coarse clock without accepting a zero-duration sample', async () => {
    const iterations = await calibrateIterations(
      async (n) => Math.floor(n / 1000),
      150,
      1
    )
    expect(iterations).toBe(150_000)
  })

  test('fails instead of silently accepting a cap-limited short batch', async () => {
    await expect(
      calibrateIterations(async (n) => n * 0.0006, 150, 1, 256)
    ).rejects.toThrow('Iteration limit')
  })

  test('accumulates bounded chunks and excludes GC, checks, and yields from timing', async () => {
    let now = 0
    let collections = 0
    let nativeCollections = 0
    const calls: number[] = []
    spyOn(performance, 'now').mockImplementation(() => now)
    const result = await executeBatch(
      {
        ...definition((n) => {
          now += 500 // expensive validation must not enter the timer
          return (n * (n + 1)) / 2
        }),
        maxChunkIterations: 1_000,
        collectNativeGarbage() {
          // Native cleanup follows Hermes GC and must also stay untimed.
          expect(collections).toBe(nativeCollections + 1)
          nativeCollections++
          now += 10_000
        },
        run(n) {
          calls.push(n)
          now += n * 0.06
          return (n * (n + 1)) / 2
        },
      },
      2_500,
      {
        collectGarbage() {
          collections++
          now += 10_000
        },
        async yieldToRuntime() {
          now += 1_000
        },
      }
    )
    expect(calls).toEqual([1_000, 1_000, 500])
    expect(collections).toBe(4)
    expect(nativeCollections).toBe(4)
    expect(result.durationMs).toBe(150)
    expect(result.checksum).toBe(2 * 500_500 + 125_250)
  })

  test('chunks async methods without timing cleanup', async () => {
    let now = 0
    spyOn(performance, 'now').mockImplementation(() => now)
    const result = await executeBatch(
      {
        ...definition((n) => n * 2),
        kind: 'async',
        maxChunkIterations: 1_000,
        async run(n) {
          now += n * 0.05
          return n * 2
        },
      },
      3_000,
      runtime
    )
    expect(result).toEqual({ durationMs: 150, checksum: 6_000 })
  })

  test('drains native cleanup after at most four chunks and after the tail', async () => {
    let now = 0
    let pending = 0
    const groups: number[] = []
    spyOn(performance, 'now').mockImplementation(() => now)
    const result = await executeBatch(
      {
        ...definition((n) => n * 2),
        maxChunkIterations: 1_000,
        run(n) {
          pending++
          now += n * 0.015
          return n * 2
        },
      },
      10_000,
      {
        collectGarbage() {
          now += 1_000
        },
        async yieldToRuntime() {
          groups.push(pending)
          pending = 0
          now += 1_000
        },
      }
    )
    expect(groups).toEqual([4, 4, 2])
    expect(result).toEqual({ durationMs: 150, checksum: 20_000 })
  })

  test('calibrates once and executes identical work on slower fresh runtimes', async () => {
    let now = 0
    spyOn(performance, 'now').mockImplementation(() => now)
    const makeDefinition = (speed: number, counts: number[]) => ({
      ...definition((n) => n * 2),
      initialIterations: 100,
      maxIterations: 100_000,
      maxChunkIterations: 250,
      run(n: number) {
        counts.push(n)
        now += n * speed
        return n * 2
      },
    })
    const calibrationCalls: number[] = []
    const plan = await calibrateBenchmarkDefinitions(
      [makeDefinition(0.15, calibrationCalls)],
      150,
      runtime
    )
    expect(plan[0]?.iterations).toBe(1_000)
    for (const speed of [0.15, 0.3, 1.5]) {
      const measuredCalls: number[] = []
      const result = await runBenchmarkDefinitions(
        [makeDefinition(speed, measuredCalls)],
        {
          targetBatchDurationMs: 150,
          warmupCount: 5,
          sampleCount: 20,
          reverse: false,
        },
        plan,
        runtime
      )
      expect(measuredCalls).toEqual(Array(25 * 4).fill(250))
      expect(result[0]?.samplesNsPerOp).toEqual(Array(20).fill(speed * 1e6))
    }
  })

  test('rejects incompatible work counts instead of silently reducing head work', async () => {
    for (const plan of [
      [],
      [{ ...work[0]!, iterations: 2 }],
      [{ ...work[0]!, chunkIterations: 2 }],
    ]) {
      await expect(
        runBenchmarkDefinitions(
          [definition((n) => n * 2)],
          {
            targetBatchDurationMs: 1,
            warmupCount: 1,
            sampleCount: 1,
            reverse: false,
          },
          plan,
          runtime
        )
      ).rejects.toThrow('incompatible work counts')
    }
  })

  test('preserves slow measured samples instead of filtering scheduler stalls', async () => {
    let now = 0
    let calls = 0
    spyOn(performance, 'now').mockImplementation(() => now)
    const [metric] = await runBenchmarkDefinitions(
      [
        {
          ...definition((n) => n * 2),
          run(n) {
            now += ++calls === 2 ? 10 : 1
            return n * 2
          },
        },
      ],
      {
        targetBatchDurationMs: 1,
        warmupCount: 1,
        sampleCount: 2,
        reverse: false,
      },
      work,
      runtime
    )
    expect(metric?.samplesNsPerOp).toEqual([10_000_000, 1_000_000])
  })
})
