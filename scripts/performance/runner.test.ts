import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { runBenchmarkDefinitions } from '../../apps/benchmark/src/benchmarks/runner'
import { executeBatch } from '../../apps/benchmark/src/benchmarks/batch'
import { getBenchmarkIterations } from '../../apps/benchmark/src/benchmarks/iterations'
import type { BenchmarkDefinition } from '../../apps/benchmark/src/benchmarks/types'

const runtime = { collectGarbage() {}, async yieldToRuntime() {} }
const id = 'javascript/control/add-numbers'
const iterations = getBenchmarkIterations(id, 'ios')

afterEach(() => {
  spyOn(performance, 'now').mockRestore()
})

function definition(expectedChecksum: (iterations: number) => number) {
  return {
    id,
    version: 1,
    family: 'control',
    implementation: 'javascript',
    kind: 'sync',
    expectedChecksum,
    run: (iterations) => iterations * 2,
  } satisfies BenchmarkDefinition
}

describe('benchmark runner', () => {
  test('primitive-only cases perform their full work without cleanup pauses', async () => {
    let now = 0
    const calls: number[] = []
    spyOn(performance, 'now').mockImplementation(() => now)
    const [metric] = await runBenchmarkDefinitions(
      [
        {
          ...definition((n) => n * 2),
          cleanup: 'none',
          run(n) {
            calls.push(n)
            now += n * 0.00002
            return n * 2
          },
        },
      ],
      { warmupCount: 5, sampleCount: 20, reverse: false },
      'ios',
      {
        collectGarbage() {
          throw new Error('Unexpected GC')
        },
        async yieldToRuntime() {
          throw new Error('Unexpected native yield')
        },
      }
    )
    expect(calls).toEqual(Array(25).fill(iterations))
    expect(metric?.samplesNsPerOp).toHaveLength(20)
    expect(metric?.checksum).toBe(25 * iterations * 2)
  })

  test('GC-only cases retain bounded collections without native frame waits', async () => {
    let now = 0
    let collections = 0
    const chunks: number[] = []
    spyOn(performance, 'now').mockImplementation(() => now)
    const result = await executeBatch(
      {
        ...definition((n) => n * 2),
        cleanup: 'gc',
        maxChunkIterations: 50,
        run(n) {
          chunks.push(n)
          now += n
          return n * 2
        },
      },
      120,
      {
        collectGarbage() {
          collections++
          now += 1000
        },
        async yieldToRuntime() {
          throw new Error('Unexpected native yield')
        },
      }
    )
    expect(chunks).toEqual([50, 50, 20])
    expect(collections).toBe(4)
    expect(result).toEqual({ durationMs: 120, checksum: 240 })
  })

  test('samples batches with a fake clock', async () => {
    let now = 0
    spyOn(performance, 'now').mockImplementation(() => now++)

    const [metric] = await runBenchmarkDefinitions(
      [definition((iterations) => iterations * 2)],
      {
        warmupCount: 1,
        sampleCount: 2,
        reverse: false,
      },
      'ios',
      runtime
    )

    expect(metric?.iterations).toBe(iterations)
    expect(metric?.samplesNsPerOp).toEqual([
      1_000_000 / iterations,
      1_000_000 / iterations,
    ])
    expect(metric?.checksum).toBe(6 * iterations)
  })

  test('rejects an invalid checksum outside the timed region', async () => {
    let now = 0
    spyOn(performance, 'now').mockImplementation(() => now++)

    await expect(
      runBenchmarkDefinitions(
        [definition(() => 99)],
        {
          warmupCount: 1,
          sampleCount: 1,
          reverse: false,
        },
        'ios',
        runtime
      )
    ).rejects.toThrow(`returned checksum ${2 * iterations}, expected 99`)
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

  test('executes identical fixed work on slower fresh runtimes', async () => {
    let now = 0
    spyOn(performance, 'now').mockImplementation(() => now)
    for (const platform of ['android', 'ios'] as const) {
      const count = getBenchmarkIterations(id, platform)
      for (const speed of [0.00002, 0.00004, 0.0002]) {
        const measuredCalls: number[] = []
        const result = await runBenchmarkDefinitions(
          [
            {
              ...definition((n) => n * 2),
              maxChunkIterations: count / 4,
              run(n) {
                measuredCalls.push(n)
                now += n * speed
                return n * 2
              },
            },
          ],
          { warmupCount: 5, sampleCount: 20, reverse: false },
          platform,
          runtime
        )
        expect(measuredCalls).toEqual(Array(25 * 4).fill(count / 4))
        expect(result[0]?.samplesNsPerOp).toHaveLength(20)
        for (const sample of result[0]!.samplesNsPerOp)
          expect(sample).toBeCloseTo(speed * 1e6, 8)
      }
    }
  })

  test('requires an explicit count for a new case', async () => {
    await expect(
      runBenchmarkDefinitions(
        [{ ...definition((n) => n * 2), id: 'new/case' }],
        { warmupCount: 5, sampleCount: 20, reverse: false },
        'ios',
        runtime
      )
    ).rejects.toThrow('Missing fixed iteration count for new/case on ios')
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
        warmupCount: 1,
        sampleCount: 2,
        reverse: false,
      },
      'ios',
      runtime
    )
    expect(metric?.samplesNsPerOp).toEqual([
      10_000_000 / iterations,
      1_000_000 / iterations,
    ])
  })
})
