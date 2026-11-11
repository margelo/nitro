import { expect, test } from 'bun:test'
import { selectReportArtifact, selectRequestArtifact } from './select-report'

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
    name: `performance-publication-${id}`,
    expired: false,
  }))
  const rawArtifact = { id: 99, name: 'performance-report-2', expired: false }
  expect(
    selectReportArtifact('success', 2, [...artifacts, rawArtifact], [])
  ).toBe(2)
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

test('reruns reuse the latest non-expired request from this or an earlier attempt', () => {
  const artifacts = [1, 2, 3].map((id) => ({
    id,
    name: `performance-request-${id}`,
    expired: false,
  }))
  expect(selectRequestArtifact(1, [])).toBeUndefined()
  expect(selectRequestArtifact(1, artifacts)).toBe(1)
  expect(selectRequestArtifact(2, artifacts)).toBe(2)
  expect(selectRequestArtifact(4, artifacts)).toBe(3)
  expect(
    selectRequestArtifact(
      4,
      artifacts.map((artifact) => ({ ...artifact, expired: true }))
    )
  ).toBeUndefined()
  expect(() => selectRequestArtifact(2, [...artifacts, artifacts[1]!])).toThrow(
    'ambiguous'
  )
})
