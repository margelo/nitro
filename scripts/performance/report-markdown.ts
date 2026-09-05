import {
  REPORTING_THRESHOLD_PERCENT,
  type MetricComparison,
  type PlatformComparison,
} from './comparison'

const OPERATION_NAMES: Readonly<Record<string, string>> = {
  'add-numbers': 'addNumbers()',
  'ascii-short': 'short ASCII string',
  'bounce-1-mib': 'bounce(1 MiB)',
  'bounce-4-kib': 'bounce(4 KiB)',
  'bounce-native-4-kib': 'bounce native-owned buffer (4 KiB)',
  'bounce-native-1-mib': 'bounce native-owned buffer (1 MiB)',
  'deferred-worker-with-trigger':
    'deferred worker Promise (includes trigger call)',
  'copy-1-mib': 'copy(1 MiB)',
  'copy-4-kib': 'copy(4 KiB)',
  'create': 'create()',
  'immediate': 'immediatePromise()',
  'large-1024': 'large array (1,024)',
  'nested-car': 'nested Car struct',
  'number-get-set': 'number property get/set',
  'number-or-string': 'number | string variant',
  'return-existing': 'returnExisting()',
  'simple-func': 'simpleFunc()',
  'small-16': 'small array (16)',
  'synchronous': 'synchronousCallback()',
  'trailing-string': 'optional trailing string',
  'typed-eight-entries': 'typed map (8 entries)',
  'unicode': 'Unicode string',
}

function platformName(platform: PlatformComparison['platform']): string {
  return platform === 'ios' ? 'iOS' : 'Android'
}

function implementationName(
  metricId: string,
  platform: PlatformComparison['platform']
): string {
  if (metricId.startsWith('javascript/')) return 'JavaScript'
  if (metricId.startsWith('turbo-module/')) return 'TurboModule'
  if (metricId.startsWith('nitro-cpp/')) return 'C++'
  if (metricId.startsWith('nitro-platform/')) {
    return platform === 'ios' ? 'Swift' : 'Kotlin'
  }
  return 'Benchmark'
}

function fallbackOperationName(operation: string): string {
  return `${operation.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())}()`
}

function benchmarkName(
  metricId: string,
  platform: PlatformComparison['platform']
): string {
  const operation = metricId.split('/').at(-1)!
  const name = OPERATION_NAMES[operation] ?? fallbackOperationName(operation)
  return `<strong>${escapeHtml(implementationName(metricId, platform))}</strong> <code>${escapeHtml(name)}</code>`
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} ms`
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)} µs`
  return `${value.toFixed(1)} ns`
}

function formatPercent(value: number): string {
  return Math.abs(value)
    .toFixed(2)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')
}

function directionalChange(deltaPercent: number): string {
  if (deltaPercent > 0) return `+${formatPercent(deltaPercent)}% slower`
  if (deltaPercent < 0) return `-${formatPercent(deltaPercent)}% faster`
  return '~0% observed change'
}

function table(
  metrics: readonly MetricComparison[],
  platform: PlatformComparison['platform']
): string {
  return [
    '| Benchmark | Base p50 | Head p50 | Observed change |',
    '| --- | ---: | ---: | --- |',
    ...metrics.map((metric) => {
      const pairMin = Math.min(...metric.pairChangesPercent)
      const pairMax = Math.max(...metric.pairChangesPercent)
      const quality =
        pairMin <= -REPORTING_THRESHOLD_PERCENT &&
        pairMax >= REPORTING_THRESHOLD_PERCENT
          ? '; process pairs disagree'
          : ''
      return `| ${benchmarkName(metric.id, platform)} | ${formatNumber(metric.baseMedianNsPerOp)} | ${formatNumber(metric.headMedianNsPerOp)} | ${directionalChange(metric.deltaPercent)}${quality} |`
    }),
  ].join('\n')
}

export function renderPerformanceReportMarkdown(
  platforms: readonly PlatformComparison[],
  options: {
    repository: string
    baseSha: string
    headSha: string
    workflowRunUrl?: string
    artifactId?: number
    runAttempt?: number
  }
): string {
  const lines = [
    '## Performance Report',
    '',
    '> **Report only:** Measurements do not fail this PR. Process pairs describe this run; they do not establish statistical confidence.',
  ]
  if (options.baseSha === options.headSha) {
    lines.push(
      '',
      'Same-revision baseline run. Differences show measurement variation, not a code change.'
    )
  }
  for (const platform of [...platforms].sort((a, b) =>
    b.platform.localeCompare(a.platform)
  )) {
    lines.push('', `### ${platformName(platform.platform)}`, '')
    if (!platform.suiteComparable) {
      lines.push(
        'Benchmark definitions changed. Results require a new baseline and are not compared.'
      )
      continue
    }
    const changed = platform.comparisons.filter(
      (metric) => Math.abs(metric.deltaPercent) >= REPORTING_THRESHOLD_PERCENT
    )
    lines.push(
      changed.length === 0
        ? `No observed change reached the ${REPORTING_THRESHOLD_PERCENT}% reporting threshold. This does not establish equal performance.`
        : table(changed, platform.platform)
    )
    lines.push(
      '',
      '<details>',
      '<summary>All benchmarks and process variation</summary>',
      '',
      table(platform.comparisons, platform.platform),
      '',
      '| Benchmark | Base process p50 | Head process p50 | Paired changes | Sample MAD / p50 (base, head) |',
      '| --- | --- | --- | --- | --- |'
    )
    for (const metric of platform.comparisons) {
      lines.push(
        `| ${benchmarkName(metric.id, platform.platform)} | ${metric.baseProcessMedians.map(formatNumber).join(', ')} | ${metric.headProcessMedians.map(formatNumber).join(', ')} | ${metric.pairChangesPercent.map(directionalChange).join(', ')} | ${metric.baseMadPercent.toFixed(1)}%, ${metric.headMadPercent.toFixed(1)}% |`
      )
    }
    lines.push(
      '',
      'p50 is the median of timed batch averages in ns/op, not individual-call latency. MAD describes sample spread; ordered raw samples retain within-process drift.',
      '',
      '</details>'
    )
  }
  lines.push(
    '',
    `Benchmarking Code Diff [\`${options.baseSha.slice(0, 8)}\`...\`${options.headSha.slice(0, 8)}\`](https://github.com/${options.repository}/compare/${options.baseSha}..${options.headSha})${options.workflowRunUrl == null ? '' : ` ([view CI run](${options.workflowRunUrl}))`}`,
    ''
  )
  if (options.artifactId != null && options.workflowRunUrl != null) {
    lines.push(
      `Raw measurements: [performance-report-${options.runAttempt} (JSON artifact)](${options.workflowRunUrl}/artifacts/${options.artifactId}). Run ${options.workflowRunUrl.split('/').at(-1)}, attempt ${options.runAttempt}. Download requires GitHub access.`,
      ''
    )
  }
  return lines.join('\n')
}
