import type { PerformanceReport, ReportMetadata } from './report'
import type { BuildMetadata } from './build-metadata'
import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'
import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import { compareRuns, toBencherMetricFormat } from './comparison'
import { renderPerformanceReportMarkdown } from './report-markdown'
import { validateBenchmarkRun } from './schema'

const METRIC_ID_PATTERN = /^[a-z0-9][a-z0-9/._-]{0,199}$/
const argumentsMap = parseArguments(Bun.argv.slice(2))
const artifactDirectory = requiredArgument(argumentsMap, 'artifact-directory')
const outputDirectory = requiredArgument(argumentsMap, 'output-directory')
const report: PerformanceReport = JSON.parse(
  await readFile(
    path.join(artifactDirectory, 'performance-report.json'),
    'utf8'
  )
)
const workflowRunUrl = `https://github.com/${report.repository}/actions/runs/${report.workflowRunId}`
const builds = new Map<string, BuildMetadata>()
for (const platform of ['android', 'ios'] as const) {
  const ids = report.artifacts[platform]
  const build: BuildMetadata = await Bun.file(
    path.join(artifactDirectory, 'raw', platform, 'build.json')
  ).json()
  if (
    build.platform !== platform ||
    build.baseSha !== report.baseSha ||
    build.headSha !== report.headSha ||
    build.baseSuiteHash !== report.baseSuiteHash ||
    build.headSuiteHash !== report.headSuiteHash ||
    build.workflowRunId !== report.workflowRunId ||
    build.runAttempt !== ids.buildAttempt ||
    build.configuration !== 'Release' ||
    ids.buildAttempt > ids.measurementAttempt ||
    ids.measurementAttempt > report.runAttempt
  ) {
    throw new Error(
      `${platform} app build metadata does not match this report.`
    )
  }
  const measurement = await Bun.file(
    path.join(artifactDirectory, 'raw', platform, 'measurement.json')
  ).json()
  if (
    measurement.buildArtifactId !== ids.buildId ||
    measurement.runAttempt !== ids.measurementAttempt
  ) {
    throw new Error(
      `${platform} measurement provenance does not match this report.`
    )
  }
  builds.set(platform, build)
}

async function loadRawRun(
  platform: 'android' | 'ios',
  revision: 'base' | 'head',
  expectedSha: string
): Promise<BenchmarkRunResult> {
  const directory = path.join(artifactDirectory, 'raw', platform)
  const filePattern = new RegExp(`^${revision}-[0-9]+\\.json$`)
  const files = (await readdir(directory)).filter((file) =>
    filePattern.test(file)
  )
  if (files.length !== 1 || files[0] !== `${revision}-1.json`) {
    throw new Error(`Expected one ${platform} ${revision} run.`)
  }
  const run = validateBenchmarkRun(
    JSON.parse(await readFile(path.join(directory, files[0]!), 'utf8'))
  )
  if (
    run.configuration.runId !== `${platform}-${revision}-1` ||
    run.configuration.reverse !== false ||
    run.configuration.platform !== platform ||
    run.configuration.architecture !== builds.get(platform)!.architecture ||
    run.configuration.toolchain !== builds.get(platform)!.toolchain ||
    run.configuration.benchmarkIndex !== undefined ||
    run.metrics.length !== run.benchmarkCount ||
    run.configuration.commitSha !== expectedSha ||
    run.configuration.suiteHash !==
      (revision === 'base' ? report.baseSuiteHash : report.headSuiteHash) ||
    run.metrics.some((metric) => !METRIC_ID_PATTERN.test(metric.id))
  ) {
    throw new Error(`${platform} ${revision} run metadata is invalid.`)
  }
  return run
}

const comparisons = await Promise.all(
  (['android', 'ios'] as const).map(async (platform) => {
    const headRuns = [await loadRawRun(platform, 'head', report.headSha)]
    const baseRuns = [await loadRawRun(platform, 'base', report.baseSha)]
    const comparison = compareRuns(baseRuns, headRuns)
    return { comparison, baseRuns, headRuns }
  })
)

await mkdir(outputDirectory, { recursive: true })
const markdown = renderPerformanceReportMarkdown(
  comparisons.map(({ comparison }) => comparison),
  {
    repository: report.repository,
    baseSha: report.baseSha,
    headSha: report.headSha,
    workflowRunUrl,
    artifactId: Number(requiredArgument(argumentsMap, 'artifact-id')),
    runAttempt: report.runAttempt,
    artifacts: report.artifacts,
  }
)
await Bun.write(path.join(outputDirectory, 'performance-summary.md'), markdown)

await Bun.write(
  path.join(outputDirectory, 'metadata.json'),
  `${JSON.stringify(
    {
      repository: report.repository,
      eventName: report.eventName,
      pullRequestNumber: report.pullRequestNumber,
      baseSha: report.baseSha,
      headSha: report.headSha,
      workflowRunId: report.workflowRunId,
      runAttempt: report.runAttempt,
      platforms: comparisons.map(({ comparison }) => comparison.platform),
    } satisfies ReportMetadata,
    null,
    2
  )}\n`
)

for (const { comparison, baseRuns, headRuns } of comparisons) {
  for (const [suffix, runs] of [
    [`base-${comparison.platform}`, baseRuns],
    [comparison.platform, headRuns],
  ] as const) {
    if (runs.length === 0) continue
    await Bun.write(
      path.join(outputDirectory, `bencher-${suffix}.json`),
      `${JSON.stringify(toBencherMetricFormat(runs), null, 2)}\n`
    )
  }
}

if (process.env.GITHUB_STEP_SUMMARY != null) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown)
}
