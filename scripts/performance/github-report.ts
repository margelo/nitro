import { appendFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import type { ValidatedReportMetadata } from './report'

const COMMENT_MARKER = '<!-- nitro-performance-paired-comparison -->'
const ORDER_MARKER =
  /^<!-- nitro-performance-source: ([1-9][0-9]*)\.([1-9][0-9]*) -->$/

interface PullRequestReport extends Pick<
  ValidatedReportMetadata,
  | 'repository'
  | 'baseSha'
  | 'headSha'
  | 'workflowRunId'
  | 'workflowRunNumber'
  | 'runAttempt'
> {
  pullRequestNumber: number
  markdown: string
}

type GitHubRequest = (
  endpoint: string,
  method?: 'GET' | 'POST' | 'PATCH',
  body?: { body: string }
) => Promise<unknown>

type CommentResult = {
  status: 'created' | 'updated' | 'superseded' | 'closed'
  current: boolean
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

interface PullRequest {
  state: string
  base: { sha: string }
  head: { sha: string; ref: string; repo: { full_name: string } }
}

async function existingOrder(
  body: string,
  repository: string,
  pullRequest: PullRequest,
  request: GitHubRequest
): Promise<{ runNumber: number; attempt: number } | undefined> {
  const marker = ORDER_MARKER.exec(body.split('\n')[1] ?? '')
  // Older reports already identify their run/attempt in the raw-artifact footer.
  // Neither form is trusted: during rollout HEAD Markdown could forge a marker.
  const source =
    marker ?? /\bRun ([1-9][0-9]*), attempt ([1-9][0-9]*)\./.exec(body)
  if (source == null) return undefined
  const runId = Number(source[1])
  const attempt = Number(source[2])
  if (!positiveInteger(runId) || !positiveInteger(attempt)) return undefined
  const run = (await request(
    `/repos/${repository}/actions/runs/${runId}/attempts/${attempt}`
  )) as {
    id: number
    name: string
    run_number: number
    run_attempt: number
    status: string
    conclusion: string
    head_branch: string
    head_repository: { full_name: string }
  } | null
  if (
    run == null ||
    run.id !== runId ||
    run.run_attempt !== attempt ||
    run.name !== 'Nitro Performance' ||
    run.status !== 'completed' ||
    run.conclusion !== 'success' ||
    run.head_branch !== pullRequest.head.ref ||
    run.head_repository.full_name !== pullRequest.head.repo.full_name ||
    !positiveInteger(run.run_number)
  )
    return undefined
  return { runNumber: run.run_number, attempt }
}

// The workflow serializes publishers for the same source repository/branch.
// Keep the ordering check and comment write inside that concurrency group:
// GitHub's comment API has no conditional PATCH to make this atomic itself.
export async function postPerformanceComment(
  report: PullRequestReport,
  request: GitHubRequest,
  botLogin = 'github-actions[bot]'
): Promise<CommentResult> {
  if (!/^[a-zA-Z0-9-]+\[bot\]$/.test(botLogin)) {
    throw new Error('Performance comment author must be a GitHub bot login.')
  }
  if (
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(report.repository) ||
    !positiveInteger(report.pullRequestNumber) ||
    !positiveInteger(report.workflowRunId) ||
    !positiveInteger(report.workflowRunNumber) ||
    !positiveInteger(report.runAttempt) ||
    !/^[0-9a-f]{40}$/.test(report.baseSha) ||
    !/^[0-9a-f]{40}$/.test(report.headSha) ||
    report.markdown.trim().length === 0 ||
    report.markdown.length > 60_000
  ) {
    throw new Error('Invalid validated PR report metadata or size.')
  }

  const root = `/repos/${report.repository}`
  const pullRequest = (await request(
    `${root}/pulls/${report.pullRequestNumber}`
  )) as PullRequest
  if (pullRequest.state !== 'open') return { status: 'closed', current: false }
  const current =
    pullRequest.base.sha === report.baseSha &&
    pullRequest.head.sha === report.headSha

  const runUrl = `https://github.com/${report.repository}/actions/runs/${report.workflowRunId}/attempts/${report.runAttempt}`
  const commitUrl = `https://github.com/${report.repository}/commit/`
  const body = {
    body: [
      COMMENT_MARKER,
      `<!-- nitro-performance-source: ${report.workflowRunId}.${report.runAttempt} -->`,
      `Measured [\`${report.headSha.slice(0, 8)}\`](${commitUrl}${report.headSha}) against [\`${report.baseSha.slice(0, 8)}\`](${commitUrl}${report.baseSha}). [Run ${report.workflowRunNumber}, attempt ${report.runAttempt}](${runUrl}).`,
      ...(current
        ? []
        : [
            '',
            'The PR has advanced since these measurements. Newer completed results will replace this report.',
          ]),
      '',
      report.markdown,
    ].join('\n'),
  }
  for (let page = 1; page <= 10; page++) {
    const comments = (await request(
      `${root}/issues/${report.pullRequestNumber}/comments?per_page=100&page=${page}`
    )) as {
      id: number
      body: string
      user: { login: string; type: string }
    }[]
    const existing = comments.find(
      (comment) =>
        comment.user.login === botLogin &&
        comment.user.type === 'Bot' &&
        comment.body.startsWith(COMMENT_MARKER)
    )
    if (existing != null) {
      const order = await existingOrder(
        existing.body,
        report.repository,
        pullRequest,
        request
      )
      if (
        order != null &&
        (order.runNumber > report.workflowRunNumber ||
          (order.runNumber === report.workflowRunNumber &&
            order.attempt > report.runAttempt))
      ) {
        return { status: 'superseded', current }
      }
      await request(`${root}/issues/comments/${existing.id}`, 'PATCH', body)
      return { status: 'updated', current }
    }
    if (comments.length < 100) {
      await request(
        `${root}/issues/${report.pullRequestNumber}/comments`,
        'POST',
        body
      )
      return { status: 'created', current }
    }
  }
  throw new Error('Comment pagination exceeded its safety limit.')
}

if (import.meta.main) {
  const argumentsMap = parseArguments(Bun.argv.slice(2))
  const directory = requiredArgument(argumentsMap, 'directory')
  const metadata = JSON.parse(
    await readFile(path.join(directory, 'metadata.json'), 'utf8')
  ) as ValidatedReportMetadata
  if (metadata.pullRequestNumber != null) {
    const token = process.env.GITHUB_TOKEN
    if (token == null) throw new Error('GITHUB_TOKEN is required.')
    const markdown = await readFile(
      path.join(directory, 'performance-summary.md'),
      'utf8'
    )
    const result = await postPerformanceComment(
      { ...metadata, pullRequestNumber: metadata.pullRequestNumber, markdown },
      async (endpoint, method = 'GET', body) => {
        // The bot token only needs PR access. The workflow token reads Actions
        // provenance for the existing comment, including previous publisher versions.
        const requestToken = endpoint.includes('/actions/runs/')
          ? process.env.GH_TOKEN
          : token
        if (requestToken == null)
          throw new Error('Missing GitHub request token.')
        const response = await fetch(`https://api.github.com${endpoint}`, {
          method,
          signal: AbortSignal.timeout(30_000),
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${requestToken}`,
            'X-GitHub-Api-Version': '2026-03-10',
            'Content-Type': 'application/json',
          },
          body: body == null ? undefined : JSON.stringify(body),
        })
        if (endpoint.includes('/actions/runs/') && response.status === 404)
          return null
        if (!response.ok) {
          throw new Error(`GitHub report request failed: ${response.status}.`)
        }
        return response.json()
      },
      process.env.GITHUB_APP_SLUG
        ? `${process.env.GITHUB_APP_SLUG}[bot]`
        : 'github-actions[bot]'
    )
    if (process.env.GITHUB_OUTPUT != null) {
      const publishHistory = result.current && result.status !== 'superseded'
      await appendFile(
        process.env.GITHUB_OUTPUT,
        `publish_history=${publishHistory}\n`
      )
    }
    console.info(`Paired performance PR comment: ${result.status}.`)
  }
}
