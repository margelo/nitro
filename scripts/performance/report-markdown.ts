import {
  REPORTING_THRESHOLD_PERCENT,
  type MetricComparison,
  type PlatformComparison,
} from './comparison'
import type { PerformanceReport } from './report'

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

function difference(metric: MetricComparison): string {
  if (metric.deltaPercent > 0)
    return `🔴 ${directionalChange(metric.deltaPercent)}`
  if (metric.deltaPercent < 0)
    return `🟢 ${directionalChange(metric.deltaPercent)}`
  return `⚪ ${directionalChange(metric.deltaPercent)}`
}

function measurement(
  metric: MetricComparison,
  revision: 'base' | 'head'
): string {
  const before = metric.baseMedianNsPerOp
  const after = metric.headMedianNsPerOp
  const value = revision === 'base' ? before : after
  const isFaster = revision === 'base' ? before < after : after < before
  const formatted = formatNumber(value)
  return isFaster ? `<strong>${formatted}</strong>` : formatted
}

function renderMetricTable(
  metrics: readonly MetricComparison[],
  platform: PlatformComparison['platform'],
  indentation = 0
): string {
  const indent = ' '.repeat(indentation)
  const level1 = ' '.repeat(indentation + 2)
  const level2 = ' '.repeat(indentation + 4)
  const level3 = ' '.repeat(indentation + 6)
  const lines = [
    `${indent}<table>`,
    `${level1}<thead>`,
    `${level2}<tr>`,
    `${level3}<th align="left">Benchmark</th>`,
    `${level3}<th align="right">Before</th>`,
    `${level3}<th align="right">After</th>`,
    `${level3}<th align="left">Difference</th>`,
    `${level2}</tr>`,
    `${level1}</thead>`,
    `${level1}<tbody>`,
  ]
  for (const metric of metrics) {
    lines.push(
      `${level2}<tr>`,
      `${level3}<td>${benchmarkName(metric.id, platform)}</td>`,
      `${level3}<td align="right">${measurement(metric, 'base')}</td>`,
      `${level3}<td align="right">${measurement(metric, 'head')}</td>`,
      `${level3}<td>${difference(metric)}</td>`,
      `${level2}</tr>`
    )
  }
  lines.push(`${level1}</tbody>`, `${indent}</table>`)
  return lines.join('\n')
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
    artifacts?: PerformanceReport['artifacts']
  }
): string {
  const lines = [
    '## Performance Report',
    '',
    '> ⚠️ **Advisory:** Results do not fail this PR.',
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
        '> Benchmark definitions changed in this PR. Results require a new baseline and are not compared.'
      )
      continue
    }
    const changed = platform.comparisons.filter(
      (metric) => Math.abs(metric.deltaPercent) >= REPORTING_THRESHOLD_PERCENT
    )
    const other = platform.comparisons.filter(
      (metric) => Math.abs(metric.deltaPercent) < REPORTING_THRESHOLD_PERCENT
    )
    lines.push(
      changed.length === 0
        ? `No observed change reached the ${REPORTING_THRESHOLD_PERCENT}% reporting threshold.`
        : renderMetricTable(changed, platform.platform),
      '',
      '<details>',
      '  <summary>All Benchmarks</summary>',
      other.length === 0
        ? `  <p>Every benchmark reached the ${REPORTING_THRESHOLD_PERCENT}% reporting threshold.</p>`
        : renderMetricTable(other, platform.platform, 2),
      '</details>'
    )
  }
  lines.push(
    '',
    `Benchmarking Code Diff [\`${options.baseSha.slice(0, 8)}\`...\`${options.headSha.slice(0, 8)}\`](https://github.com/${options.repository}/compare/${options.baseSha}..${options.headSha})${options.workflowRunUrl == null ? '' : ` ([view raw output](${options.workflowRunUrl}))`}`,
    ''
  )
  if (options.artifactId != null && options.workflowRunUrl != null) {
    lines.push(
      `Raw measurements: [performance-report-${options.runAttempt} (JSON artifact)](${options.workflowRunUrl}/artifacts/${options.artifactId}). Run ${options.workflowRunUrl.split('/').at(-1)}, attempt ${options.runAttempt}. Download requires GitHub access.`,
      ''
    )
  }
  const platformArtifacts = options.artifacts
  if (platformArtifacts != null && options.workflowRunUrl != null) {
    lines.push(
      ...(['android', 'ios'] as const).map((platform) => {
        const artifacts = platformArtifacts[platform]
        return `${platformName(platform)}: [measurements, attempt ${artifacts.measurementAttempt}](${options.workflowRunUrl}/artifacts/${artifacts.measurementId}), [apps, attempt ${artifacts.buildAttempt}](${options.workflowRunUrl}/artifacts/${artifacts.buildId}).`
      }),
      ''
    )
  }
  return lines.join('\n')
}
