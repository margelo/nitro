import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'

const REPOSITORY = 'margelo/nitro'
const FORK_REPOSITORY = 'contributor/nitro'
const BASE_SHA = 'a'.repeat(40)
const HEAD_SHA = 'b'.repeat(40)
const SUITE_HASH = 'c'.repeat(64)

function run(
  platform: 'android' | 'ios',
  revision: 'base' | 'head',
  sequence: number
): BenchmarkRunResult {
  const center = revision === 'base' ? 100 : 120
  const samples = Array.from(
    { length: 20 },
    (_, index) => center - 1 + (index % 3)
  )
  return {
    schemaVersion: 1,
    suiteVersion: 1,
    benchmarkCount: 1,
    configuration: {
      runId: `${platform}-${revision}-${sequence}`,
      reverse: sequence === 2,
      commitSha: revision === 'base' ? BASE_SHA : HEAD_SHA,
      suiteHash: SUITE_HASH,
      platform,
      device: 'fixed simulator',
      osVersion: 'fixed OS',
      architecture: platform === 'ios' ? 'arm64' : 'x86_64',
      toolchain: 'fixed toolchain',
    },
    environment: {
      reactNativeVersion: '0.85.3',
      hermes: true,
      dev: false,
      nitroBuildType: 'release',
    },
    runner: {
      targetBatchDurationMs: 150,
      warmupCount: 5,
      sampleCount: 20,
    },
    startedAt: '2026-09-04T00:00:00.000Z',
    durationMs: 4_000,
    metrics: [
      {
        id: 'nitro-cpp/primitive/add-numbers',
        version: 1,
        family: 'primitive',
        implementation: 'nitro-cpp',
        iterations: 10_000,
        chunkIterations: 10_000,
        samplesNsPerOp: samples,
        checksum: 42,
      },
    ],
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await Bun.write(file, `${JSON.stringify(value, null, 2)}\n`)
}

async function createFixture(root: string): Promise<{
  artifact: string
  output: string
  trustedEvent: string
  trustedPullRequest: string
}> {
  const artifact = path.join(root, 'artifact')
  const output = path.join(root, 'output')
  for (const platform of ['android', 'ios'] as const) {
    const directory = path.join(artifact, 'raw', platform)
    await mkdir(directory, { recursive: true })
    for (const revision of ['base', 'head'] as const) {
      for (const sequence of [1, 2]) {
        await writeJson(
          path.join(directory, `${revision}-${sequence}.json`),
          run(platform, revision, sequence)
        )
      }
    }
  }

  await writeJson(path.join(artifact, 'performance-report.json'), {
    schemaVersion: 2,
    eventName: 'pull_request',
    repository: REPOSITORY,
    pullRequestNumber: 123,
    baseSha: BASE_SHA,
    headSha: HEAD_SHA,
    baseSuiteHash: SUITE_HASH,
    headSuiteHash: SUITE_HASH,
    workflowRunId: 123456789,
    runAttempt: 1,
  })

  const trustedEvent = path.join(root, 'workflow-run.json')
  await writeJson(trustedEvent, {
    repository: { full_name: REPOSITORY },
    workflow_run: {
      id: 123456789,
      run_attempt: 1,
      html_url: 'https://github.com/margelo/nitro/actions/runs/123456789',
      event: 'pull_request',
      head_sha: HEAD_SHA,
      head_repository: { full_name: FORK_REPOSITORY },
    },
  })
  const trustedPullRequest = path.join(root, 'pull-request.json')
  await writeJson(trustedPullRequest, {
    number: 123,
    state: 'open',
    base: { sha: BASE_SHA, repo: { full_name: REPOSITORY } },
    head: { sha: HEAD_SHA, repo: { full_name: FORK_REPOSITORY } },
  })
  return { artifact, output, trustedEvent, trustedPullRequest }
}

async function validate(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const process = Bun.spawn(
    [
      'bun',
      path.join(import.meta.dir, 'validate-report.ts'),
      '--artifact-directory',
      fixture.artifact,
      '--output-directory',
      fixture.output,
      '--expected-repository',
      REPOSITORY,
      '--trusted-workflow-event',
      fixture.trustedEvent,
      '--artifact-id',
      '987',
      '--trusted-pull-request',
      fixture.trustedPullRequest,
    ],
    { stderr: 'pipe', stdout: 'pipe' }
  )
  const error = new Response(process.stderr).text()
  const output = new Response(process.stdout).text()
  const [exitCode, errorMessage, outputMessage] = await Promise.all([
    process.exited,
    error,
    output,
  ])
  return { exitCode, error: `${errorMessage}${outputMessage}` }
}

describe('trusted performance report validation', () => {
  test('rebuilds Markdown and BMF from bounded raw samples', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-performance-'))
    try {
      const fixture = await createFixture(root)
      expect((await validate(fixture)).exitCode).toBe(0)
      const markdown = await readFile(
        path.join(fixture.output, 'performance-summary.md'),
        'utf8'
      )
      expect(markdown).toContain('## Performance Report')
      expect(markdown).toContain('### iOS')
      expect(markdown).toContain('### Android')
      expect(markdown).toContain(
        '<strong>C++</strong> <code>addNumbers()</code>'
      )
      expect(markdown).toContain(
        '<summary>All benchmarks and process variation</summary>'
      )
      expect(markdown).toContain(
        `Benchmarking Code Diff [\`${BASE_SHA.slice(0, 8)}\`...\`${HEAD_SHA.slice(0, 8)}\`](https://github.com/margelo/nitro/compare/${BASE_SHA}..${HEAD_SHA}) ([view CI run](https://github.com/margelo/nitro/actions/runs/123456789))`
      )
      const bmf = JSON.parse(
        await readFile(path.join(fixture.output, 'bencher-ios.json'), 'utf8')
      )
      expect(bmf['nitro-cpp/primitive/add-numbers'].latency.value).toBe(120)
      const baseBmf = JSON.parse(
        await readFile(
          path.join(fixture.output, 'bencher-base-ios.json'),
          'utf8'
        )
      )
      expect(baseBmf['nitro-cpp/primitive/add-numbers'].latency.value).toBe(100)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('skips a PR that advanced after measurement', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-performance-'))
    try {
      const fixture = await createFixture(root)
      const pullRequest = JSON.parse(
        await readFile(fixture.trustedPullRequest, 'utf8')
      )
      pullRequest.head.sha = 'd'.repeat(40)
      await writeJson(fixture.trustedPullRequest, pullRequest)
      const result = await validate(fixture)
      expect(result.exitCode).toBe(0)
      expect(result.error).toContain('Skipping stale')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects a forged workflow run URL', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-performance-'))
    try {
      const fixture = await createFixture(root)
      const event = JSON.parse(await readFile(fixture.trustedEvent, 'utf8'))
      event.workflow_run.html_url = 'https://example.com/forged'
      await writeJson(fixture.trustedEvent, event)
      const result = await validate(fixture)
      expect(result.exitCode).not.toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  test.each([
    'attempt',
    'repository',
    'raw-sha',
    'raw-order',
    'raw-count',
    'raw-id',
    'raw-mode',
  ])('rejects mismatched or malformed raw provenance: %s', async (kind) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-performance-'))
    try {
      const fixture = await createFixture(root)
      const manifest = path.join(fixture.artifact, 'performance-report.json')
      const raw = path.join(fixture.artifact, 'raw/ios/head-1.json')
      const file = kind === 'attempt' || kind === 'repository' ? manifest : raw
      const value = JSON.parse(await readFile(file, 'utf8'))
      if (kind === 'attempt') value.runAttempt = 2
      if (kind === 'repository') value.repository = 'other/repo'
      if (kind === 'raw-sha') value.configuration.commitSha = BASE_SHA
      if (kind === 'raw-order') value.configuration.reverse = true
      if (kind === 'raw-count') value.metrics[0].samplesNsPerOp.pop()
      if (kind === 'raw-id') value.metrics[0].id = '<script>alert(1)</script>'
      if (kind === 'raw-mode') value.environment.dev = true
      await writeJson(file, value)
      expect((await validate(fixture)).exitCode).not.toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  test('changed suites accept a head-only baseline; comparable suites require base', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-performance-'))
    try {
      const fixture = await createFixture(root)
      for (const platform of ['android', 'ios'])
        for (const sequence of [1, 2]) {
          await rm(
            path.join(
              fixture.artifact,
              'raw',
              platform,
              `base-${sequence}.json`
            )
          )
        }
      expect((await validate(fixture)).exitCode).not.toBe(0)
      const file = path.join(fixture.artifact, 'performance-report.json')
      const manifest = JSON.parse(await readFile(file, 'utf8'))
      manifest.baseSuiteHash = 'd'.repeat(64)
      await writeJson(file, manifest)
      expect((await validate(fixture)).exitCode).toBe(0)
      expect(
        await readFile(
          path.join(fixture.output, 'performance-summary.md'),
          'utf8'
        )
      ).toContain('require a new baseline')
      expect(
        await Bun.file(
          path.join(fixture.output, 'bencher-base-ios.json')
        ).exists()
      ).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
