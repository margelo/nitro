import type { ReportMetadata } from './report'
import { appendFile, mkdir, readFile, lstat } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'

async function readBoundedFile(
  file: string,
  maxBytes: number
): Promise<string> {
  const information = await lstat(file)
  if (
    !information.isFile() ||
    information.size === 0 ||
    information.size > maxBytes
  ) {
    throw new Error(`${file} has an invalid size.`)
  }
  return readFile(file, 'utf8')
}

const args = parseArguments(Bun.argv.slice(2))
const directory = requiredArgument(args, 'artifact-directory')
const output = requiredArgument(args, 'output-directory')
const repository = requiredArgument(args, 'expected-repository')
// These inputs come from GitHub, not from the downloaded artifact.
const event = JSON.parse(
  await readFile(requiredArgument(args, 'trusted-workflow-event'), 'utf8')
)
const run = event.workflow_run
const metadata: ReportMetadata = JSON.parse(
  await readBoundedFile(path.join(directory, 'metadata.json'), 64 * 1024)
)
if (
  metadata.repository !== repository ||
  event.repository.full_name !== repository ||
  metadata.eventName !== run.event ||
  metadata.workflowRunId !== run.id ||
  metadata.runAttempt !== run.run_attempt ||
  metadata.headSha !== run.head_sha ||
  typeof metadata.baseSha !== 'string' ||
  !/^[0-9a-f]{40}$/.test(metadata.baseSha) ||
  !Array.isArray(metadata.platforms) ||
  metadata.platforms.length === 0 ||
  metadata.platforms.length > 2 ||
  new Set(metadata.platforms).size !== metadata.platforms.length ||
  metadata.platforms.some(
    (platform) => platform !== 'android' && platform !== 'ios'
  )
) {
  throw new Error(
    'Publication metadata does not match the triggering workflow.'
  )
}

if (run.event === 'pull_request') {
  const pr = JSON.parse(
    await readFile(requiredArgument(args, 'trusted-pull-request'), 'utf8')
  )
  if (
    metadata.pullRequestNumber === null ||
    !Number.isSafeInteger(metadata.pullRequestNumber) ||
    metadata.pullRequestNumber < 1 ||
    metadata.pullRequestNumber !== pr.number ||
    pr.base.repo.full_name !== repository ||
    pr.head.repo.full_name !== run.head_repository.full_name
  ) {
    throw new Error(
      'Publication metadata does not match the trusted pull request.'
    )
  }
  if (
    pr.state !== 'open' ||
    metadata.baseSha !== pr.base.sha ||
    metadata.headSha !== pr.head.sha
  ) {
    console.info(
      'Skipping stale performance results: the pull request advanced or closed.'
    )
    if (process.env.GITHUB_OUTPUT != null)
      await appendFile(process.env.GITHUB_OUTPUT, 'stale=true\n')
    process.exit(0)
  }
} else if (
  !['push', 'schedule', 'workflow_dispatch'].includes(run.event) ||
  run.head_branch !== 'main' ||
  run.head_repository.full_name !== repository ||
  metadata.pullRequestNumber !== null
) {
  throw new Error('Only main runs may publish main performance history.')
}

const markdown = await readBoundedFile(
  path.join(directory, 'performance-summary.md'),
  240_000
)
if (markdown.length > 60_000 || markdown.trim().length === 0) {
  throw new Error('Performance comment is empty or exceeds GitHub limits.')
}
await mkdir(output, { recursive: true })
await Bun.write(path.join(output, 'metadata.json'), JSON.stringify(metadata))
// Markdown is data. Do not interpolate it into shell commands or execute any artifact files.
await Bun.write(path.join(output, 'performance-summary.md'), markdown)
