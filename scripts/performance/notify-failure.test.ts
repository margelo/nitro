import { expect, test } from 'bun:test'
import { failureComment } from './notify-failure'

function fixture() {
  return {
    repository: { full_name: 'margelo/nitro' },
    workflow_run: {
      id: 456,
      run_attempt: 2,
      event: 'issue_comment',
      display_title: 'Nitro Performance for PR #123',
      conclusion: 'failure',
      head_repository: { full_name: 'margelo/nitro' },
    },
  }
}

test('reports build, measurement and tooling failures without needing any artifacts', () => {
  const comment = failureComment(fixture(), 'margelo/nitro', 789)
  expect(comment.pullRequestNumber).toBe(123)
  expect(comment.workflowRunId).toBe(456)
  expect(comment.markdown).toContain('Performance tests failed')
  expect(comment.markdown).toContain(
    'https://github.com/margelo/nitro/actions/runs/456/attempts/2'
  )
  expect(comment.markdown).toContain(
    'https://github.com/margelo/nitro/actions/runs/789'
  )
})

test('reports publishing failures and retains an available performance table', () => {
  const event = fixture()
  event.workflow_run.conclusion = 'success'
  const markdown = '## Performance Report\n\n<table>measured results</table>'
  const comment = failureComment(event, 'margelo/nitro', 789, markdown)
  expect(comment.markdown).toContain('Performance report publishing failed')
  expect(comment.markdown).toContain(markdown)
})

test.each([
  'title',
  'repository',
  'fork',
  'event',
  'run',
  'attempt',
  'publisher',
])('rejects untrusted failure notification metadata: %s', (kind) => {
  const event = fixture()
  if (kind === 'title') event.workflow_run.display_title = 'Unrelated workflow'
  if (kind === 'repository') event.repository.full_name = 'other/repo'
  if (kind === 'fork')
    event.workflow_run.head_repository.full_name = 'contributor/nitro'
  if (kind === 'event') event.workflow_run.event = 'push'
  if (kind === 'run') event.workflow_run.id = 0
  if (kind === 'attempt') event.workflow_run.run_attempt = 0
  expect(() =>
    failureComment(event, 'margelo/nitro', kind === 'publisher' ? 0 : 789)
  ).toThrow('trusted performance request')
})
