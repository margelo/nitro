import { expect, test } from 'bun:test'
import {
  REPORTING_THRESHOLD_PERCENT,
  type MetricComparison,
  type PlatformComparison,
} from './comparison'
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
function report(metrics: MetricComparison[]): PlatformComparison {
  return { platform: 'ios', ...options, comparisons: metrics }
}

test('restores the original table, emphasis, colors, disclosure, and footer', () => {
  const text = renderPerformanceReportMarkdown(
    [
      report([
        metric('nitro-cpp/primitive/add-numbers', 20),
        metric('nitro-platform/promise/immediate', -12.5),
        metric('javascript/primitive/add-numbers', 2),
      ]),
    ],
    options
  )
  expect(text).toMatchInlineSnapshot(`
    "## Performance Report

    > ⚠️ **Advisory:** Results do not fail this PR.

    ### iOS

    <table>
      <thead>
        <tr>
          <th align="left">Benchmark</th>
          <th align="right">Before</th>
          <th align="right">After</th>
          <th align="left">Difference</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>C++</strong> <code>addNumbers()</code></td>
          <td align="right"><strong>100.0 ns</strong></td>
          <td align="right">120.0 ns</td>
          <td>🔴 +20% slower</td>
        </tr>
        <tr>
          <td><strong>Swift</strong> <code>immediatePromise()</code></td>
          <td align="right">100.0 ns</td>
          <td align="right"><strong>87.5 ns</strong></td>
          <td>🟢 -12.5% faster</td>
        </tr>
      </tbody>
    </table>

    <details>
      <summary>All Benchmarks</summary>
      <table>
        <thead>
          <tr>
            <th align="left">Benchmark</th>
            <th align="right">Before</th>
            <th align="right">After</th>
            <th align="left">Difference</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>JavaScript</strong> <code>addNumbers()</code></td>
            <td align="right"><strong>100.0 ns</strong></td>
            <td align="right">102.0 ns</td>
            <td>🔴 +2% slower</td>
          </tr>
        </tbody>
      </table>
    </details>

    Benchmarking Code Diff [\`aaaaaaaa\`...\`bbbbbbbb\`](https://github.com/margelo/nitro/compare/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) ([view raw output](https://github.com/margelo/nitro/actions/runs/123))

    Raw measurements: [performance-report-2 (JSON artifact)](https://github.com/margelo/nitro/actions/runs/123/artifacts/987). Run 123, attempt 2. Download requires GitHub access.
    "
  `)
})

test('large Promise changes remain visible without duplicate diagnostic tables', () => {
  const text = renderPerformanceReportMarkdown(
    [
      report([
        metric('nitro-cpp/promise/immediate', 20, [-5, 45]),
        metric('nitro-cpp/primitive/add-numbers', 2),
      ]),
    ],
    options
  )
  const [main, collapsed] = text.split('<details>')
  expect(main).toContain('immediatePromise()')
  expect(main).toContain('🔴 +20% slower')
  expect(main).not.toContain('addNumbers()')
  expect(collapsed).toContain('addNumbers()')
  expect(collapsed).not.toContain('immediatePromise()')
  expect(text.match(/<table>/g)).toHaveLength(2)
  expect(text).not.toMatch(/process pairs|Sample MAD|Base process|95%|noisy/)
})

test.each([
  REPORTING_THRESHOLD_PERCENT,
  -REPORTING_THRESHOLD_PERCENT,
  REPORTING_THRESHOLD_PERCENT - 0.01,
  -REPORTING_THRESHOLD_PERCENT + 0.01,
])('preserves the reporting threshold for a %s%% change', (delta) => {
  const text = renderPerformanceReportMarkdown(
    [report([metric('nitro-cpp/primitive/add-numbers', delta)])],
    options
  )
  const [main, collapsed] = text.split('<details>')
  const visible = Math.abs(delta) >= REPORTING_THRESHOLD_PERCENT
  expect(main!.includes('addNumbers()')).toBe(visible)
  expect(collapsed!.includes('addNumbers()')).toBe(!visible)
  expect(text.match(/<code>addNumbers\(\)<\/code>/g)).toHaveLength(1)
  expect(text).not.toMatch(/unchanged|equal performance|decisive|calibrat/)
  if (visible) {
    expect(collapsed).toContain('All benchmarks are shown above.')
  } else {
    expect(main).toContain(
      `No observed change reached the ${REPORTING_THRESHOLD_PERCENT}% reporting threshold.`
    )
  }
})

test('equal measurements show zero observed change without bolding either time', () => {
  const text = renderPerformanceReportMarkdown(
    [report([metric('nitro-cpp/primitive/add-numbers', 0, [-30, 30])])],
    options
  )
  expect(text).toContain('⚪ ~0% observed change')
  expect(text.match(/<td align="right">100.0 ns<\/td>/g)).toHaveLength(2)
  expect(text).not.toMatch(/unchanged|equal performance/)
})

test('keeps iOS before Android and preserves names, escaping, and time units', () => {
  const comparison = report([
    {
      ...metric('nitro-platform/buffer/copy-1-mib', -6.25),
      baseMedianNsPerOp: 1_600_000,
      headMedianNsPerOp: 1_500_000,
    },
    {
      ...metric('turbo-module/primitive/add-numbers', 10),
      baseMedianNsPerOp: 1_000,
      headMedianNsPerOp: 1_100,
    },
    metric('nitro-platform/custom/a-<b>&"\'', 20),
  ])
  const platforms: PlatformComparison[] = [
    { ...comparison, platform: 'android' },
    comparison,
  ]
  const text = renderPerformanceReportMarkdown(platforms, options)
  expect(text.indexOf('### iOS')).toBeLessThan(text.indexOf('### Android'))
  expect(platforms[0]!.platform).toBe('android')
  expect(text).toContain('<strong>Swift</strong> <code>copy(1 MiB)</code>')
  expect(text).toContain('<strong>Kotlin</strong> <code>copy(1 MiB)</code>')
  expect(text).toContain(
    '<strong>TurboModule</strong> <code>addNumbers()</code>'
  )
  expect(text).toContain('1.60 ms')
  expect(text).toContain('<strong>1.50 ms</strong>')
  expect(text).toContain('<strong>1.00 µs</strong>')
  expect(text).toContain('1.10 µs')
  expect(text).toContain('🟢 -6.25% faster')
  expect(text).toContain('<code>a-&lt;b&gt;&amp;&quot;&#39;()</code>')
})

test('new and removed cases stay visible with no invented percentage change', () => {
  const text = renderPerformanceReportMarkdown(
    [
      report([
        {
          ...metric('javascript/control/new-case', 0),
          baseMedianNsPerOp: null,
          deltaPercent: null,
        },
        {
          ...metric('javascript/control/removed-case', 0),
          headMedianNsPerOp: null,
          deltaPercent: null,
        },
      ]),
    ],
    options
  )
  const [main] = text.split('<details>')
  expect(main).toContain('<code>newCase()</code>')
  expect(main).toContain('<td align="right">—</td>')
  expect(main).toContain('<td align="right">⭐️ New (100.0 ns)</td>')
  expect(main).toContain('<code>removedCase()</code>')
  expect(main).toContain('<td align="right">100.0 ns</td>')
  expect(main).toContain('<td align="right">❌ Removed</td>')
  expect(main).not.toMatch(/slower|faster|baseline|definitions changed/)
})

test('same-revision runs remain explicit', () => {
  expect(
    renderPerformanceReportMarkdown([], {
      ...options,
      headSha: options.baseSha,
    })
  ).toContain('Same-revision baseline run')
})

test('keeps exact run, raw JSON, and platform artifact provenance', () => {
  const text = renderPerformanceReportMarkdown([], {
    ...options,
    artifacts: {
      android: {
        measurementId: 654,
        measurementAttempt: 2,
        buildId: 321,
        buildAttempt: 1,
      },
      ios: {
        measurementId: 765,
        measurementAttempt: 2,
        buildId: 432,
        buildAttempt: 1,
      },
    },
  })
  expect(text).toContain(`([view raw output](${options.workflowRunUrl}))`)
  expect(text).toContain(
    `Raw measurements: [performance-report-2 (JSON artifact)](${options.workflowRunUrl}/artifacts/987). Run 123, attempt 2. Download requires GitHub access.`
  )
  expect(text).toContain(
    `Android: [measurements, attempt 2](${options.workflowRunUrl}/artifacts/654), [apps, attempt 1](${options.workflowRunUrl}/artifacts/321).`
  )
  expect(text).toContain(
    `iOS: [measurements, attempt 2](${options.workflowRunUrl}/artifacts/765), [apps, attempt 1](${options.workflowRunUrl}/artifacts/432).`
  )
})
