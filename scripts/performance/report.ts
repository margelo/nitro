import path from 'node:path'
import { parseArguments, requiredArgument } from './args'

export const PLATFORMS = ['android', 'ios'] as const
export type Platform = (typeof PLATFORMS)[number]
export type PlatformFailure =
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'invalid-results'
export type PlatformFailures = Partial<Record<Platform, PlatformFailure>>

/** Raw measurements and provenance, retained separately from the rendered publication. */
export interface PerformanceReport {
  schemaVersion: 2
  eventName:
    | 'issue_comment'
    | 'pull_request'
    | 'push'
    | 'schedule'
    | 'workflow_dispatch'
  repository: string
  pullRequestNumber: number | null
  baseSha: string
  headSha: string
  baseSuiteHash: string | null
  headSuiteHash: string | null
  workflowRunId: number
  runAttempt: number
  artifacts: Partial<Record<Platform, PlatformArtifacts>>
  platformFailures?: PlatformFailures
}

export interface PlatformArtifacts {
  buildId: number
  buildAttempt: number
  measurementId: number
  measurementAttempt: number
}

/** Stable publication envelope. It does not depend on the raw benchmark schema. */
export interface ReportMetadata extends Pick<
  PerformanceReport,
  | 'eventName'
  | 'repository'
  | 'pullRequestNumber'
  | 'baseSha'
  | 'headSha'
  | 'workflowRunId'
  | 'runAttempt'
> {
  platforms: Platform[]
  // Optional for publications produced before partial reporting was supported.
  platformFailures?: PlatformFailures
}

if (import.meta.main) {
  const args = parseArguments(Bun.argv.slice(2))
  const eventName = requiredArgument(args, 'event-name')
  if (
    eventName !== 'issue_comment' &&
    eventName !== 'pull_request' &&
    eventName !== 'push' &&
    eventName !== 'schedule' &&
    eventName !== 'workflow_dispatch'
  ) {
    throw new Error(`Unsupported event: ${eventName}`)
  }
  const raw = requiredArgument(args, 'raw-directory')
  const report: PerformanceReport = {
    artifacts: {},
    platformFailures: {},
    baseSuiteHash: null,
    headSuiteHash: null,
    schemaVersion: 2,
    eventName,
    repository: requiredArgument(args, 'repository'),
    pullRequestNumber: Number(requiredArgument(args, 'pull-request')) || null,
    baseSha: requiredArgument(args, 'base-sha'),
    headSha: requiredArgument(args, 'head-sha'),
    workflowRunId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
  }
  for (const platform of PLATFORMS) {
    // Older default-branch workflows only collect after both jobs succeeded.
    const result = process.env[`${platform.toUpperCase()}_RESULT`] ?? 'success'
    if (result !== 'success') {
      if (
        !['failure', 'cancelled', 'skipped', 'invalid-results'].includes(
          result ?? ''
        )
      ) {
        throw new Error(`Invalid ${platform} job result: ${result}`)
      }
      report.platformFailures![platform] = result as PlatformFailure
      continue
    }
    try {
      const build = await Bun.file(
        path.join(raw, platform, 'build.json')
      ).json()
      const measurement = await Bun.file(
        path.join(raw, platform, 'measurement.json')
      ).json()
      const suite = await Bun.file(
        path.join(raw, platform, 'suite.json')
      ).json()
      const ids: PlatformArtifacts = {
        buildId: measurement.buildArtifactId,
        buildAttempt: build.runAttempt,
        measurementId: Number(
          process.env[`${platform.toUpperCase()}_ARTIFACT_ID`]
        ),
        measurementAttempt: measurement.runAttempt,
      }
      if (
        Object.values(ids).some((id) => !Number.isSafeInteger(id) || id < 1) ||
        build.platform !== platform ||
        build.baseSha !== report.baseSha ||
        build.headSha !== report.headSha ||
        build.workflowRunId !== report.workflowRunId ||
        ids.buildAttempt > ids.measurementAttempt ||
        ids.measurementAttempt > report.runAttempt ||
        !/^[0-9a-f]{64}$/.test(suite.baseSuiteHash) ||
        !/^[0-9a-f]{64}$/.test(suite.headSuiteHash) ||
        build.baseSuiteHash !== suite.baseSuiteHash ||
        build.headSuiteHash !== suite.headSuiteHash ||
        (report.baseSuiteHash !== null &&
          report.baseSuiteHash !== suite.baseSuiteHash) ||
        (report.headSuiteHash !== null &&
          report.headSuiteHash !== suite.headSuiteHash)
      ) {
        throw new Error(
          `${platform} artifact provenance does not match this report.`
        )
      }
      report.baseSuiteHash = suite.baseSuiteHash
      report.headSuiteHash = suite.headSuiteHash
      report.artifacts[platform] = ids
    } catch (error) {
      console.error(`Cannot collect ${platform} results:`, error)
      report.platformFailures![platform] = 'invalid-results'
    }
  }
  await Bun.write(
    requiredArgument(args, 'output'),
    `${JSON.stringify(report, null, 2)}\n`
  )
}
