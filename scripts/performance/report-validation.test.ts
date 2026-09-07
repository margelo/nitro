import { expect, test } from 'bun:test'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-publication-'))
  const metadata = {
    repository: 'margelo/nitro',
    eventName: 'pull_request',
    pullRequestNumber: 123,
    baseSha: 'a'.repeat(40),
    headSha: 'b'.repeat(40),
    workflowRunId: 123456,
    runAttempt: 2,
    platforms: ['android', 'ios'],
  }
  const event = {
    repository: { full_name: metadata.repository },
    workflow_run: {
      id: metadata.workflowRunId,
      run_attempt: metadata.runAttempt,
      event: metadata.eventName,
      head_sha: metadata.headSha,
      head_branch: 'feature',
      head_repository: { full_name: 'contributor/nitro' },
    },
  }
  const pr = {
    number: metadata.pullRequestNumber,
    state: 'open',
    base: { sha: metadata.baseSha, repo: { full_name: metadata.repository } },
    head: { sha: metadata.headSha, repo: { full_name: 'contributor/nitro' } },
  }
  const artifact = path.join(root, 'artifact')
  const output = path.join(root, 'output')
  const markdown =
    '## Report from HEAD\n\n<table><tr><td>🟢 faster</td></tr></table>\n\n`$(touch should-not-exist)`\n'
  await Bun.write(path.join(artifact, 'performance-summary.md'), markdown)
  async function validate() {
    for (const [file, data] of [
      [path.join(artifact, 'metadata.json'), metadata],
      [path.join(root, 'event.json'), event],
      [path.join(root, 'pr.json'), pr],
    ] as const) {
      await Bun.write(file, JSON.stringify(data))
    }
    const child = Bun.spawn(
      [
        'bun',
        path.join(import.meta.dir, 'validate-report.ts'),
        '--artifact-directory',
        artifact,
        '--output-directory',
        output,
        '--expected-repository',
        'margelo/nitro',
        '--trusted-workflow-event',
        path.join(root, 'event.json'),
        '--trusted-pull-request',
        path.join(root, 'pr.json'),
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env, GITHUB_OUTPUT: path.join(root, 'outputs') },
      }
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    return { exitCode, text: stdout + stderr }
  }
  return {
    root,
    artifact,
    output,
    metadata,
    event,
    pr,
    markdown,
    validate,
    [Symbol.asyncDispose]: () => rm(root, { recursive: true, force: true }),
  }
}

test('forwards HEAD Markdown unchanged without reading the raw schema or recomputing results', async () => {
  await using f = await fixture()
  // Future raw schemas and arbitrary artifact source code are never loaded by the publisher.
  await Bun.write(
    path.join(f.artifact, 'performance-report.json'),
    '{"schemaVersion":999}'
  )
  await Bun.write(path.join(f.artifact, 'raw/ios/head-1.json'), 'not JSON')
  await Bun.write(
    path.join(f.artifact, 'report.ts'),
    'throw new Error("PR code executed")'
  )
  expect((await f.validate()).exitCode).toBe(0)
  expect(
    await Bun.file(path.join(f.output, 'performance-summary.md')).text()
  ).toBe(f.markdown)
  expect(await Bun.file(path.join(f.output, 'metadata.json')).json()).toEqual(
    f.metadata
  )
})

test.each([
  'repository',
  'event',
  'run',
  'attempt',
  'head',
  'pr',
  'fork',
  'base-repository',
  'platform',
  'duplicate-platform',
])('rejects a publication with mismatched %s', async (kind) => {
  await using f = await fixture()
  if (kind === 'repository') f.metadata.repository = 'other/repo'
  if (kind === 'event') f.metadata.eventName = 'push'
  if (kind === 'run') f.metadata.workflowRunId++
  if (kind === 'attempt') f.metadata.runAttempt++
  if (kind === 'head') f.metadata.headSha = 'c'.repeat(40)
  if (kind === 'pr') f.metadata.pullRequestNumber++
  if (kind === 'fork') f.pr.head.repo.full_name = 'another/nitro'
  if (kind === 'base-repository') f.pr.base.repo.full_name = 'other/repo'
  if (kind === 'platform') f.metadata.platforms = ['../../injected']
  if (kind === 'duplicate-platform') f.metadata.platforms = ['ios', 'ios']
  expect((await f.validate()).exitCode).not.toBe(0)
})

test.each(['head', 'base', 'closed'])(
  'skips stale PR results: %s',
  async (change) => {
    await using f = await fixture()
    if (change === 'head') f.pr.head.sha = 'c'.repeat(40)
    if (change === 'base') f.pr.base.sha = 'c'.repeat(40)
    if (change === 'closed') f.pr.state = 'closed'
    const result = await f.validate()
    expect(result.exitCode).toBe(0)
    expect(result.text).toContain('Skipping stale')
    expect(await Bun.file(path.join(f.root, 'outputs')).text()).toContain(
      'stale=true'
    )
    expect(
      await Bun.file(path.join(f.output, 'performance-summary.md')).exists()
    ).toBe(false)
  }
)

test.each(['', 'x'.repeat(60_001)])(
  'rejects empty or oversized comments',
  async (markdown) => {
    await using f = await fixture()
    await Bun.write(path.join(f.artifact, 'performance-summary.md'), markdown)
    expect((await f.validate()).exitCode).not.toBe(0)
  }
)

test.each(['push', 'schedule', 'workflow_dispatch'])(
  'allows %s history only from main in this repository',
  async (eventName) => {
    await using f = await fixture()
    f.metadata.eventName = f.event.workflow_run.event = eventName
    Object.assign(f.metadata, { pullRequestNumber: null })
    f.event.workflow_run.head_branch = 'main'
    f.event.workflow_run.head_repository.full_name = 'margelo/nitro'
    expect((await f.validate()).exitCode).toBe(0)
    f.event.workflow_run.head_branch = 'feature'
    expect((await f.validate()).exitCode).not.toBe(0)
    f.event.workflow_run.head_branch = 'main'
    f.event.workflow_run.head_repository.full_name = 'contributor/nitro'
    expect((await f.validate()).exitCode).not.toBe(0)
  }
)

test('rejects a symlink instead of posting a file outside the publication', async () => {
  await using f = await fixture()
  const report = path.join(f.artifact, 'performance-summary.md')
  await rm(report)
  const outside = path.join(f.root, 'outside.md')
  await Bun.write(outside, 'Must not be posted')
  await symlink(outside, report)
  expect((await f.validate()).exitCode).not.toBe(0)
})
