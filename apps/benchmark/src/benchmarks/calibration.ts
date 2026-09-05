const MAX_CALIBRATION_STEPS = 24

/** Two significant digits: e.g. 1,500,000, 240,000 or 3,200 operations. */
export function roundIterations(value: number, maximum: number): number {
  const bounded = Math.max(1, Math.min(maximum, value))
  const step = 10 ** Math.max(0, Math.floor(Math.log10(bounded)) - 1)
  return Math.max(1, Math.min(maximum, Math.round(bounded / step) * step))
}

export async function calibrateIterations(
  measure: (iterations: number) => Promise<number>,
  targetMs: number,
  initialIterations = 1_000,
  maximum = 100_000_000
): Promise<number> {
  let iterations = roundIterations(initialIterations, maximum)
  let confirmations = 0
  for (let step = 0; step < MAX_CALIBRATION_STEPS; step++) {
    const durationMs = await measure(iterations)
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error('Calibration requires a finite, non-negative duration.')
    }
    // Choose a practical batch duration; this does not establish steady state.
    if (durationMs >= targetMs * 0.8 && durationMs <= targetMs * 1.2) {
      if (++confirmations === 2) return iterations
      continue
    }
    confirmations = 0
    if (iterations === maximum && durationMs < targetMs * 0.8) {
      throw new Error('Iteration limit prevents a sufficiently long batch.')
    }
    if (iterations === 1 && durationMs > targetMs * 1.2) {
      throw new Error('One operation exceeds the target batch duration.')
    }
    // Unlike the old calibration, also shrink an overshooting batch.
    const scale = durationMs === 0 ? 10 : targetMs / durationMs
    iterations = roundIterations(
      iterations * Math.max(0.1, Math.min(10, scale)),
      maximum
    )
  }
  throw new Error(
    'Calibration could not reach the target duration within its step limit.'
  )
}
