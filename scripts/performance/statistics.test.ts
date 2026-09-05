import { expect, test } from 'bun:test'
import {
  median,
  medianAbsoluteDeviation,
} from '../../apps/benchmark/src/benchmarks/statistics'

test('median and MAD preserve their input and resist an isolated outlier', () => {
  const values = [100, 2, 3, 4, 1]
  expect(median(values)).toBe(3)
  expect(medianAbsoluteDeviation(values)).toBe(1)
  expect(values).toEqual([100, 2, 3, 4, 1])
  expect(median([1, 2, 3, 4])).toBe(2.5)
  expect(() => median([])).toThrow()
})
