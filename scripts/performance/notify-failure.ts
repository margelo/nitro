import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import {
  createGitHubRequest,
  upsertPerformanceComment,
  type PerformanceComment,
} from './github-report'

interface WorkflowEvent {
  repository: { full_name: string }
  workflow_run: {
    id: number
    run_attempt: number
    event: string
    display_title: string
    conclusion: string
    head_repository: { full_name: string }
  }
}

export function failureComment(
  event: WorkflowEvent,
  repository: string,
  publisherRunId: number,
  markdown?: string
): PerformanceComment {
  const run = event.workflow_run
  const number = /^Nitro Performance for PR #([1-9][0-9]*)$/.exec(
    run.display_title
  )?.[1]
  if (
    event.repository.full_name !== repository ||
    run.head_repository.full_name !== repository ||
    run.event !== 'issue_comment' ||
    number == null ||
    !Number.isSafeInteger(Number(number)) ||
    !Number.isSafeInteger(run.id) ||
    run.id < 1 ||
    !Number.isSafeInteger(run.run_attempt) ||
    run.run_attempt < 1 ||
    !Number.isSafeInteger(publisherRunId) ||
    publisherRunId < 1
  ) {
    throw new Error(
      'Failure notification does not identify a trusted performance request.'
    )
  }
  const runUrl = `https://github.com/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}`
  const publisherUrl = `https://github.com/${repository}/actions/runs/${publisherRunId}`
  const message =
    run.conclusion === 'success'
      ? '❌ **Performance report publishing failed.**'
      : '❌ **Performance tests failed.**'
  return {
    repository,
    pullRequestNumber: Number(number),
    workflowRunId: run.id,
    markdown: [
      message,
      '',
      `[View performance run, attempt ${run.run_attempt}](${runUrl}) · [View publishing logs](${publisherUrl})`,
      '',
      run.conclusion === 'success'
        ? 'Re-run the failed publishing job from the publishing logs. A successful retry updates this comment.'
        : 'Re-run the failed jobs from the performance run. A successful retry updates this comment.',
      ...(markdown == null ? [] : ['', markdown]),
    ].join('\n'),
  }
}

if (import.meta.main) {
  const token = process.env.GITHUB_TOKEN
  if (token == null) throw new Error('GITHUB_TOKEN is required.')
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH!, 'utf8')
  ) as WorkflowEvent
  const args = parseArguments(Bun.argv.slice(2))
  const markdown =
    process.env.REPORT_VALIDATED === 'true'
      ? await readFile(
          path.join(
            requiredArgument(args, 'directory'),
            'performance-summary.md'
          ),
          'utf8'
        )
      : undefined
  const comment = failureComment(
    event,
    process.env.GITHUB_REPOSITORY!,
    Number(process.env.GITHUB_RUN_ID),
    markdown
  )
  await upsertPerformanceComment(
    comment,
    createGitHubRequest(token),
    process.env.GITHUB_APP_SLUG
      ? `${process.env.GITHUB_APP_SLUG}[bot]`
      : 'github-actions[bot]'
  )
}
