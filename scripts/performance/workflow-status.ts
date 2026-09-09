import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import { createGitHubRequest, type GitHubRequest } from './github-report'

interface PerformanceRequest {
  repository: string
  pullRequestNumber: number
  workflowRunId: number
  requestAttempt: number
  headSha: string
}
interface WorkflowEvent {
  action: 'in_progress' | 'completed'
  repository: { full_name: string }
  workflow_run: {
    id: number
    run_attempt: number
    event: string
    display_title: string
    conclusion: string | null
    head_repository: { full_name: string }
  }
}

export async function validatePerformanceRequest(
  metadata: PerformanceRequest,
  event: WorkflowEvent,
  repository: string,
  request: GitHubRequest
): Promise<{ context: string; latestRequestUrl?: string }> {
  const run = event.workflow_run
  if (
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository) ||
    metadata.repository !== repository ||
    event.repository.full_name !== repository ||
    run.head_repository.full_name !== repository ||
    run.event !== 'issue_comment' ||
    metadata.workflowRunId !== run.id ||
    !Number.isSafeInteger(run.id) ||
    run.id < 1 ||
    !Number.isSafeInteger(metadata.pullRequestNumber) ||
    metadata.pullRequestNumber < 1 ||
    run.display_title !==
      `Nitro Performance for PR #${metadata.pullRequestNumber}` ||
    !Number.isSafeInteger(metadata.requestAttempt) ||
    metadata.requestAttempt < 1 ||
    metadata.requestAttempt > run.run_attempt ||
    !/^[0-9a-f]{40}$/.test(metadata.headSha)
  ) {
    throw new Error('Invalid performance request provenance.')
  }
  // Artifacts are untrusted. The initial status, written by the isolated request
  // job, proves this workflow was authorized to test this exact commit.
  let latestRequestUrl: string | undefined
  for (let page = 1; page <= 10; page++) {
    const statuses = (await request(
      `/repos/${repository}/commits/${metadata.headSha}/statuses?per_page=100&page=${page}`
    )) as {
      context: string
      state: string
      target_url: string
      creator: { login: string; type: string }
    }[]
    // GitHub returns newest first. Only pending statuses identify requests:
    // a publishing failure can change the final status URL to the publisher.
    for (const status of statuses) {
      if (
        status.creator.login !== 'github-actions[bot]' ||
        status.creator.type !== 'Bot' ||
        status.state !== 'pending'
      )
        continue
      if (status.context === 'Nitro Performance')
        latestRequestUrl ??= status.target_url
      if (
        (status.context === 'Nitro Performance' ||
          status.context === `Nitro Performance / ${run.id}`) &&
        status.target_url ===
          `https://github.com/${repository}/actions/runs/${run.id}`
      )
        return { context: status.context, latestRequestUrl }
    }
    if (statuses.length < 100) break
  }
  throw new Error('Performance request has no matching trusted commit status.')
}

export async function updatePerformanceStatus(
  metadata: PerformanceRequest,
  event: WorkflowEvent,
  publication: { status: string; runId: number },
  request: GitHubRequest
): Promise<void> {
  const { context, latestRequestUrl } = await validatePerformanceRequest(
    metadata,
    event,
    metadata.repository,
    request
  )
  const run = event.workflow_run
  // Request and publication jobs share a concurrency group, so a new request
  // cannot replace this owner between the lookup and the status write.
  if (
    context === 'Nitro Performance' &&
    latestRequestUrl !==
      `https://github.com/${metadata.repository}/actions/runs/${run.id}`
  )
    return
  const root = `/repos/${metadata.repository}`
  const latest = (await request(`${root}/actions/runs/${run.id}`)) as {
    run_attempt: number
    status: string
  }
  // A delayed webhook must not overwrite the status of a newer attempt, or set
  // a completed run back to pending.
  if (
    latest.run_attempt !== run.run_attempt ||
    (event.action === 'in_progress' && latest.status === 'completed')
  )
    return
  const state =
    event.action === 'in_progress'
      ? 'pending'
      : run.conclusion === 'cancelled'
        ? 'error'
        : run.conclusion === 'success' && publication.status === 'success'
          ? 'success'
          : 'failure'
  const description =
    state === 'pending'
      ? 'Performance tests are running'
      : state === 'success'
        ? 'Performance tests and report publishing succeeded'
        : state === 'error'
          ? 'Performance run was cancelled'
          : 'Performance tests or report publishing failed'
  await request(`${root}/statuses/${metadata.headSha}`, 'POST', {
    state,
    context,
    target_url: `https://github.com/${metadata.repository}/actions/runs/${run.conclusion === 'success' && publication.status === 'failure' ? publication.runId : run.id}`,
    description,
  })
}

if (import.meta.main) {
  const token = process.env.GITHUB_TOKEN
  if (token == null) throw new Error('GITHUB_TOKEN is required.')
  const args = parseArguments(Bun.argv.slice(2))
  const metadata = JSON.parse(
    await readFile(
      path.join(requiredArgument(args, 'directory'), 'request.json'),
      'utf8'
    )
  ) as PerformanceRequest
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH!, 'utf8')
  ) as WorkflowEvent
  const request = createGitHubRequest(token)
  if (requiredArgument(args, 'mode') === 'update') {
    await updatePerformanceStatus(
      metadata,
      event,
      {
        status: process.env.PUBLICATION_STATUS!,
        runId: Number(process.env.GITHUB_RUN_ID),
      },
      request
    )
  } else {
    await validatePerformanceRequest(
      metadata,
      event,
      process.env.GITHUB_REPOSITORY!,
      request
    )
  }
}
