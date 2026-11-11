import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import type { ReportMetadata } from './report'

export interface PerformanceComment extends Pick<
  ReportMetadata,
  'repository' | 'workflowRunId'
> {
  pullRequestNumber: number
  markdown: string
}

interface PullRequestReport extends PerformanceComment {
  baseSha: string
  headSha: string
}

export type GitHubRequest = (
  endpoint: string,
  method?: 'GET' | 'POST' | 'PATCH',
  body?: Record<string, unknown>
) => Promise<unknown>

interface Comment {
  id: number
  node_id: string
  body: string
  user: { login: string; type: string }
}

function validateComment(report: PerformanceComment, botLogin: string): void {
  if (!/^[a-zA-Z0-9-]+\[bot\]$/.test(botLogin)) {
    throw new Error('Performance comment author must be a GitHub bot login.')
  }
  if (
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(report.repository) ||
    !Number.isSafeInteger(report.pullRequestNumber) ||
    report.pullRequestNumber < 1 ||
    !Number.isSafeInteger(report.workflowRunId) ||
    report.workflowRunId < 1 ||
    report.markdown.trim().length === 0 ||
    report.markdown.length > 60_000
  ) {
    throw new Error('Invalid validated PR report metadata or size.')
  }
}

export async function postPerformanceComment(
  report: PullRequestReport,
  request: GitHubRequest,
  botLogin = 'github-actions[bot]'
): Promise<'created' | 'updated' | 'stale'> {
  validateComment(report, botLogin)
  if (
    !/^[0-9a-f]{40}$/.test(report.baseSha) ||
    !/^[0-9a-f]{40}$/.test(report.headSha)
  ) {
    throw new Error('Invalid validated PR report revisions.')
  }
  // A PR may have advanced while publication was being prepared.
  const pullRequest = (await request(
    `/repos/${report.repository}/pulls/${report.pullRequestNumber}`
  )) as { state: string; base: { sha: string }; head: { sha: string } }
  if (
    pullRequest.state !== 'open' ||
    pullRequest.base.sha !== report.baseSha ||
    pullRequest.head.sha !== report.headSha
  ) {
    return 'stale'
  }
  return upsertPerformanceComment(report, request, botLogin, true)
}

// Failure notifications share the run's comment, but leave older reports visible.
export async function upsertPerformanceComment(
  report: PerformanceComment,
  request: GitHubRequest,
  botLogin = 'github-actions[bot]',
  minimizePrevious = false
): Promise<'created' | 'updated'> {
  validateComment(report, botLogin)
  const root = `/repos/${report.repository}`
  const marker = `<!-- nitro-performance-paired-comparison:${report.workflowRunId} -->`
  const body = { body: `${marker}\n${report.markdown}` }
  const previous: Comment[] = []
  async function markPreviousOutdated() {
    if (!minimizePrevious) return
    for (const comment of previous) {
      await request('/graphql', 'POST', {
        query: `mutation($id: ID!) {
          minimizeComment(input: { subjectId: $id, classifier: OUTDATED }) {
            minimizedComment { isMinimized }
          }
        }`,
        variables: { id: comment.node_id },
      })
    }
  }
  for (let page = 1; page <= 10; page++) {
    const comments = (await request(
      `${root}/issues/${report.pullRequestNumber}/comments?per_page=100&page=${page}`
    )) as Comment[]
    const ownReports = comments.filter(
      (comment) =>
        comment.user.login === botLogin &&
        comment.user.type === 'Bot' &&
        /^<!-- nitro-performance-paired-comparison(?::[1-9][0-9]*)? -->/.test(
          comment.body
        )
    )
    const existing = ownReports.find((comment) =>
      comment.body.startsWith(marker)
    )
    // REST lists comments oldest first. Never hide a newer report when rerunning
    // an older workflow, and never unhide an already-outdated run on a retry.
    previous.push(
      ...ownReports.filter(
        (comment) => existing == null || comment.id < existing.id
      )
    )
    if (existing != null) {
      await request(`${root}/issues/comments/${existing.id}`, 'PATCH', body)
      await markPreviousOutdated()
      return 'updated'
    }
    if (comments.length < 100) {
      await request(
        `${root}/issues/${report.pullRequestNumber}/comments`,
        'POST',
        body
      )
      await markPreviousOutdated()
      return 'created'
    }
  }
  throw new Error('Comment pagination exceeded its safety limit.')
}

export function createGitHubRequest(token: string): GitHubRequest {
  return async (endpoint, method = 'GET', body) => {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      method,
      signal: AbortSignal.timeout(30_000),
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2026-03-10',
        'Content-Type': 'application/json',
      },
      body: body == null ? undefined : JSON.stringify(body),
    })
    if (!response.ok) {
      throw new Error(`GitHub report request failed: ${response.status}.`)
    }
    const result = (await response.json()) as { errors?: unknown[] }
    if (result.errors?.length)
      throw new Error('GitHub GraphQL report request failed.')
    return result
  }
}

if (import.meta.main) {
  const argumentsMap = parseArguments(Bun.argv.slice(2))
  const directory = requiredArgument(argumentsMap, 'directory')
  const metadata = JSON.parse(
    await readFile(path.join(directory, 'metadata.json'), 'utf8')
  ) as ReportMetadata
  if (metadata.pullRequestNumber != null) {
    const token = process.env.GITHUB_TOKEN
    if (token == null) throw new Error('GITHUB_TOKEN is required.')
    const markdown = await readFile(
      path.join(directory, 'performance-summary.md'),
      'utf8'
    )
    const status = await postPerformanceComment(
      { ...metadata, pullRequestNumber: metadata.pullRequestNumber, markdown },
      createGitHubRequest(token),
      process.env.GITHUB_APP_SLUG
        ? `${process.env.GITHUB_APP_SLUG}[bot]`
        : 'github-actions[bot]'
    )
    console.info(`Paired performance PR comment: ${status}.`)
  }
}
