import { expect, test } from 'bun:test'
import type { MetricComparison, PlatformComparison } from './comparison'
import { renderPerformanceReportMarkdown } from './report-markdown'

const options = {
  repository: 'margelo/nitro',
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
  workflowRunUrl: 'https://github.com/margelo/nitro/actions/runs/123',
  artifactId: 987,
  runAttempt: 2,
}
function metric(
  id: string,
  delta: number,
  pairs = [delta, delta]
): MetricComparison {
  return {
    id,
    baseMedianNsPerOp: 100,
    headMedianNsPerOp: 100 + delta,
    deltaPercent: delta,
    baseProcessMedians: [90, 110],
    headProcessMedians: [90 + delta, 110 + delta],
    baseMadPercent: 10,
    headMadPercent: 12,
    pairChangesPercent: pairs,
  }
}
function report(
  metrics: MetricComparison[],
  suiteComparable = true
): PlatformComparison {
  return { platform: 'ios', ...options, suiteComparable, comparisons: metrics }
}
test('large Promise changes and disagreeing process pairs remain visible', () => {
  const text = renderPerformanceReportMarkdown(
    [
      report([
        metric('nitro-cpp/promise/immediate', 20, [-5, 45]),
        metric('nitro-cpp/primitive/add-numbers', 2),
      ]),
    ],
    options
  )
  const main = text.split('<details>')[0]!
  expect(main).toContain('immediatePromise()')
  expect(main).toContain('+20% slower; process pairs disagree')
  expect(main).not.toContain('addNumbers()')
  expect(text).toContain('90.0 ns, 110.0 ns')
  expect(text).toContain('10.0%, 12.0%')
  expect(text).toContain('performance-report-2 (JSON artifact)')
  expect(text).toContain('/actions/runs/123/artifacts/987')
  expect(text).not.toMatch(/95%|unchanged!|calibrated.*budget/)
})
test('small observed changes do not claim equality', () => {
  const text = renderPerformanceReportMarkdown(
    [report([metric('nitro-cpp/primitive/add-numbers', 0, [-30, 30])])],
    options
  )
  expect(text).toContain('This does not establish equal performance.')
  expect(text).toContain('process pairs disagree')
})
test('same revision and changed suites are explicit', () => {
  expect(
    renderPerformanceReportMarkdown([report([], false)], options)
  ).toContain('require a new baseline')
  expect(
    renderPerformanceReportMarkdown([], {
      ...options,
      headSha: options.baseSha,
    })
  ).toContain('Same-revision baseline run')
})
