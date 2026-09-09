import { expect, test } from 'bun:test'
import {
  validatePerformanceRequest,
  updatePerformanceStatus,
} from './workflow-status'
import type { GitHubRequest } from './github-report'

function fixture() {
  const metadata = {
    repository: 'margelo/nitro',
    pullRequestNumber: 123,
    workflowRunId: 456,
    requestAttempt: 1,
    headSha: 'a'.repeat(40),
  }
  const event = {
    action: 'completed' as 'in_progress' | 'completed',
    repository: { full_name: 'margelo/nitro' },
    workflow_run: {
      id: 456,
      run_attempt: 2,
      event: 'issue_comment',
      display_title: 'Nitro Performance for PR #123',
      conclusion: 'success',
      head_repository: { full_name: 'margelo/nitro' },
    },
  }
  const writes: { endpoint: string; body: unknown }[] = []
  const status = {
    context: 'Nitro Performance',
    state: 'pending',
    target_url: 'https://github.com/margelo/nitro/actions/runs/456',
    creator: { login: 'github-actions[bot]', type: 'Bot' },
  }
  const statuses = [status]
  const latest = { run_attempt: 2, status: 'completed' }
  const request: GitHubRequest = async (endpoint, method = 'GET', body) => {
    if (method === 'POST') {
      writes.push({ endpoint, body })
      return {}
    }
    if (endpoint.includes('/statuses?')) return statuses
    return latest
  }
  return { metadata, event, writes, status, statuses, latest, request }
}

test('requires an existing Actions status to trust the commit supplied by an artifact', async () => {
  const f = fixture()
  await validatePerformanceRequest(
    f.metadata,
    f.event,
    'margelo/nitro',
    f.request
  )
  f.status.creator.login = 'attacker'
  await expect(
    validatePerformanceRequest(f.metadata, f.event, 'margelo/nitro', f.request)
  ).rejects.toThrow('matching trusted commit status')
  expect(f.writes).toHaveLength(0)
})

test.each([
  'pr',
  'run',
  'repository',
  'attempt',
  'head',
  'status-context',
  'status-url',
  'status-state',
])('rejects forged request metadata or status: %s', async (kind) => {
  const f = fixture()
  if (kind === 'pr') f.metadata.pullRequestNumber++
  if (kind === 'run') f.metadata.workflowRunId++
  if (kind === 'repository') f.metadata.repository = 'other/repo'
  if (kind === 'attempt') f.metadata.requestAttempt = 3
  if (kind === 'head') f.metadata.headSha = 'not a commit'
  if (kind === 'status-context') f.status.context = 'Nitro Performance / 999'
  if (kind === 'status-url') f.status.target_url = 'https://example.com'
  if (kind === 'status-state') f.status.state = 'success'
  await expect(
    validatePerformanceRequest(f.metadata, f.event, 'margelo/nitro', f.request)
  ).rejects.toThrow()
  expect(f.writes).toHaveLength(0)
})

test.each([
  ['in_progress', 'success', 'success', 'pending'],
  ['completed', 'success', 'success', 'success'],
  ['completed', 'failure', 'failure', 'failure'],
  ['completed', 'success', 'failure', 'failure'],
  ['completed', 'cancelled', 'success', 'error'],
] as const)(
  'publishes %s / %s / %s as %s on the tested commit',
  async (action, conclusion, publicationStatus, expected) => {
    const f = fixture()
    f.event.action = action
    f.event.workflow_run.conclusion = conclusion
    f.latest.status = action === 'in_progress' ? 'in_progress' : 'completed'
    await updatePerformanceStatus(
      f.metadata,
      f.event,
      { status: publicationStatus, runId: 789 },
      f.request
    )
    expect(f.writes).toEqual([
      {
        endpoint: `/repos/margelo/nitro/statuses/${f.metadata.headSha}`,
        body: expect.objectContaining({
          state: expected,
          context: 'Nitro Performance',
          target_url: `https://github.com/margelo/nitro/actions/runs/${conclusion === 'success' && publicationStatus === 'failure' ? 789 : 456}`,
        }),
      },
    ])
  }
)

test('ignores late webhooks from earlier attempts and already-finished starts', async () => {
  const f = fixture()
  f.latest.run_attempt = 3
  await updatePerformanceStatus(
    f.metadata,
    f.event,
    { status: 'success', runId: 789 },
    f.request
  )
  f.latest.run_attempt = 2
  f.event.action = 'in_progress'
  await updatePerformanceStatus(
    f.metadata,
    f.event,
    { status: 'success', runId: 789 },
    f.request
  )
  expect(f.writes).toHaveLength(0)
})

test('a newer request owns the shared status even after its publishing fails', async () => {
  const f = fixture()
  f.statuses.unshift(
    {
      ...f.status,
      state: 'failure',
      target_url: 'https://github.com/margelo/nitro/actions/runs/999',
    },
    {
      ...f.status,
      target_url: 'https://github.com/margelo/nitro/actions/runs/457',
    }
  )
  // The older request is still authentic and can publish its own comment.
  await validatePerformanceRequest(
    f.metadata,
    f.event,
    'margelo/nitro',
    f.request
  )
  await updatePerformanceStatus(
    f.metadata,
    f.event,
    { status: 'success', runId: 789 },
    f.request
  )
  expect(f.writes).toHaveLength(0)
  f.metadata.workflowRunId = 457
  f.event.workflow_run.id = 457
  await updatePerformanceStatus(
    f.metadata,
    f.event,
    { status: 'success', runId: 999 },
    f.request
  )
  expect(f.writes).toHaveLength(1)
  expect(f.writes[0]?.body).toMatchObject({
    context: 'Nitro Performance',
    state: 'success',
  })
})

test('finishes the original numbered status for a run started before the change', async () => {
  const f = fixture()
  f.status.context = 'Nitro Performance / 456'
  await validatePerformanceRequest(
    f.metadata,
    f.event,
    'margelo/nitro',
    f.request
  )
  await updatePerformanceStatus(
    f.metadata,
    f.event,
    { status: 'success', runId: 789 },
    f.request
  )
  expect(f.writes[0]?.body).toMatchObject({
    context: 'Nitro Performance / 456',
  })
})
