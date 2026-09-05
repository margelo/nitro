import { readFile } from 'node:fs/promises'
import { parseArguments, requiredArgument } from './args'

/** The artifact contains raw runs plus provenance. Only trusted code derives a report. */
export interface PerformanceReport {
  schemaVersion: 2
  eventName: 'pull_request' | 'push' | 'schedule' | 'workflow_dispatch'
  repository: string
  pullRequestNumber: number | null
  baseSha: string
  headSha: string
  baseSuiteHash: string
  headSuiteHash: string
  workflowRunId: number
  runAttempt: number
}

export interface ReportMetadata extends Omit<
  PerformanceReport,
  'schemaVersion' | 'workflowRunId' | 'runAttempt'
> {
  platforms: ('android' | 'ios')[]
}

if (import.meta.main) {
  const args = parseArguments(Bun.argv.slice(2))
  const eventName = requiredArgument(args, 'event-name')
  if (
    eventName !== 'pull_request' &&
    eventName !== 'push' &&
    eventName !== 'schedule' &&
    eventName !== 'workflow_dispatch'
  ) {
    throw new Error(`Unsupported event: ${eventName}`)
  }
  const { baseSuiteHash, headSuiteHash } = JSON.parse(
    await readFile(requiredArgument(args, 'suite'), 'utf8')
  ) as Pick<PerformanceReport, 'baseSuiteHash' | 'headSuiteHash'>
  const report: PerformanceReport = {
    baseSuiteHash,
    headSuiteHash,
    schemaVersion: 2,
    eventName,
    repository: requiredArgument(args, 'repository'),
    pullRequestNumber: Number(requiredArgument(args, 'pull-request')) || null,
    baseSha: requiredArgument(args, 'base-sha'),
    headSha: requiredArgument(args, 'head-sha'),
    workflowRunId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
  }
  await Bun.write(
    requiredArgument(args, 'output'),
    `${JSON.stringify(report, null, 2)}\n`
  )
}
