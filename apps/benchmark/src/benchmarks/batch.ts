import type { BenchmarkDefinition } from './types'

export interface BenchmarkRuntime {
  collectGarbage(): void
  yieldToRuntime(): Promise<void>
}

export const benchmarkRuntime: BenchmarkRuntime = {
  collectGarbage() {
    // Hermes exposes this in Release too; never silently omit memory cleanup.
    const gc = (globalThis as { gc?: () => void }).gc
    if (gc == null) throw new Error('Benchmark runtime requires Hermes gc().')
    gc()
  },
  // RCTTiming immediately re-enqueues zero-delay timers. A positive delay goes
  // through its next-frame path, allowing the native run loop/pools to drain.
  yieldToRuntime: () => new Promise((resolve) => setTimeout(resolve, 1)),
}

export async function executeBatch(
  definition: BenchmarkDefinition,
  iterations: number,
  runtime: BenchmarkRuntime,
  chunkIterations = Math.min(
    iterations,
    definition.maxChunkIterations ?? iterations
  )
): Promise<{ durationMs: number; checksum: number }> {
  if (!Number.isSafeInteger(chunkIterations) || chunkIterations < 1) {
    throw new Error(`Benchmark ${definition.id} has an invalid chunk size.`)
  }
  let durationMs = 0
  let checksum = 0
  let chunksSinceYield = 0
  runtime.collectGarbage()
  definition.collectNativeGarbage?.()
  for (
    let remaining = iterations;
    remaining > 0;
    remaining -= chunkIterations
  ) {
    const count = Math.min(remaining, chunkIterations)
    const start = performance.now()
    const result =
      definition.kind === 'async'
        ? await definition.run(count)
        : definition.run(count)
    const elapsed = performance.now() - start

    // Timing stops before checksum validation and explicit garbage collection.
    if (!Number.isFinite(result) || !Number.isFinite(elapsed) || elapsed < 0) {
      throw new Error(`Benchmark ${definition.id} produced an invalid sample.`)
    }
    const expected = definition.expectedChecksum(count)
    if (result !== expected) {
      throw new Error(
        `Benchmark ${definition.id} returned checksum ${result}, expected ${expected}.`
      )
    }
    durationMs += elapsed
    checksum += result
    runtime.collectGarbage()
    definition.collectNativeGarbage?.()
    // Drain native autorelease pools/cleaners after at most four bounded chunks.
    // A native timer yield can cost a frame; do not pay it for every tiny chunk.
    chunksSinceYield++
    if (chunksSinceYield === 4 || remaining <= chunkIterations) {
      await runtime.yieldToRuntime()
      chunksSinceYield = 0
    }
  }
  return { durationMs, checksum }
}
