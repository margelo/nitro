import { expect, test } from 'bun:test'
import { selectReportArtifact } from './select-report'

test('docs-only and cancelled measurements skip cleanly', () => {
  expect(
    selectReportArtifact(
      'success',
      1,
      [],
      [{ name: 'nitro-performance', conclusion: 'skipped' }]
    )
  ).toBeUndefined()
  expect(selectReportArtifact('cancelled', 1, [], [])).toBeUndefined()
})
test('a relevant build failure or missing results remains a failure', () => {
  expect(() => selectReportArtifact('failure', 1, [], [])).toThrow(
    'workflow failure'
  )
  expect(() => selectReportArtifact('success', 1, [], [])).toThrow(
    'exactly one'
  )
})
test('selects the immutable artifact for the triggering attempt only', () => {
  const artifacts = [1, 2].map((id) => ({
    id,
    name: `performance-report-${id}`,
    expired: false,
  }))
  expect(selectReportArtifact('success', 2, artifacts, [])).toBe(2)
  expect(() => selectReportArtifact('success', 3, artifacts, [])).toThrow()
  expect(() =>
    selectReportArtifact('success', 2, [...artifacts, artifacts[1]!], [])
  ).toThrow()
  expect(() =>
    selectReportArtifact(
      'success',
      2,
      [{ ...artifacts[1]!, expired: true }],
      []
    )
  ).toThrow()
})
