export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('Cannot calculate an empty median.')
  const ordered = [...values].sort((left, right) => left - right)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!
}

export function medianAbsoluteDeviation(values: readonly number[]): number {
  const center = median(values)
  return median(values.map((value) => Math.abs(value - center)))
}
