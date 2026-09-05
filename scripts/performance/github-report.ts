import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import type { ReportMetadata } from './report'
import { isSafeSha } from './schema'

const COMMENT_MARKER = '<!-- nitro-performance-paired-comparison -->'

interface PullRequestReport extends Pick<
  ReportMetadata,
  'repository' | 'baseSha' | 'headSha'
> {
  pullRequestNumber: number
  markdown: string
}

type GitHubRequest = (
  endpoint: string,
  method?: 'GET' | 'POST' | 'PATCH',
  body?: { body: string }
) => Promise<unknown>

export async function postPerformanceComment(
  report: PullRequestReport,
  request: GitHubRequest,
  botLogin = 'github-actions[bot]'
): Promise<'created' | 'updated' | 'stale'> {
  if (!/^[a-zA-Z0-9-]+\[bot\]$/.test(botLogin)) {
    throw new Error('Performance comment author must be a GitHub bot login.')
  }
  if (
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(report.repository) ||
    !Number.isSafeInteger(report.pullRequestNumber) ||
    report.pullRequestNumber < 1 ||
    !isSafeSha(report.baseSha) ||
    !isSafeSha(report.headSha) ||
    report.markdown.length > 60_000
  ) {
    throw new Error('Invalid validated PR report metadata or size.')
  }

  const root = `/repos/${report.repository}`
  // A PR may have advanced while validation or Bencher publishing was running.
  const pullRequest = (await request(
    `${root}/pulls/${report.pullRequestNumber}`
  )) as { state: string; base: { sha: string }; head: { sha: string } }
  if (
    pullRequest.state !== 'open' ||
    pullRequest.base.sha !== report.baseSha ||
    pullRequest.head.sha !== report.headSha
  ) {
    return 'stale'
  }

  const body = { body: `${COMMENT_MARKER}\n${report.markdown}` }
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
      await request(`${root}/issues/comments/${existing.id}`, 'PATCH', body)
      return 'updated'
    }
    if (comments.length < 100) {
      await request(
        `${root}/issues/${report.pullRequestNumber}/comments`,
        'POST',
        body
      )
      return 'created'
    }
  }
  throw new Error('Comment pagination exceeded its safety limit.')
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
      async (endpoint, method = 'GET', body) => {
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
        return response.json()
      },
      process.env.GITHUB_APP_SLUG
        ? `${process.env.GITHUB_APP_SLUG}[bot]`
        : 'github-actions[bot]'
    )
    console.info(`Paired performance PR comment: ${status}.`)
  }
}
