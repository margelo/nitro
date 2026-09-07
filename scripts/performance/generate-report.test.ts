import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'

const REPOSITORY = 'margelo/nitro'
const BASE_SHA = 'a'.repeat(40)
const HEAD_SHA = 'b'.repeat(40)
const SUITE_HASH = 'c'.repeat(64)

function run(
  platform: 'android' | 'ios',
  revision: 'base' | 'head'
): BenchmarkRunResult {
  const center = revision === 'base' ? 100 : 120
  const samples = Array.from(
    { length: 20 },
    (_, index) => center - 1 + (index % 3)
  )
  return {
    schemaVersion: 2,
    suiteVersion: 1,
    benchmarkCount: 1,
    configuration: {
      runId: `${platform}-${revision}-1`,
      reverse: false,
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
}> {
  const artifact = path.join(root, 'artifact')
  const output = path.join(root, 'output')
  for (const platform of ['android', 'ios'] as const) {
    const directory = path.join(artifact, 'raw', platform)
    await mkdir(directory, { recursive: true })
    await writeJson(path.join(directory, 'measurement.json'), {
      buildArtifactId: platform === 'android' ? 1 : 3,
      runAttempt: 1,
    })
    await writeJson(path.join(directory, 'build.json'), {
      platform,
      baseSha: BASE_SHA,
      headSha: HEAD_SHA,
      baseSuiteHash: SUITE_HASH,
      headSuiteHash: SUITE_HASH,
      architecture: platform === 'ios' ? 'arm64' : 'x86_64',
      toolchain: 'fixed toolchain',
      configuration: 'Release',
      workflowRunId: 123456789,
      runAttempt: 1,
    })
    for (const revision of ['base', 'head'] as const) {
      await writeJson(
        path.join(directory, `${revision}-1.json`),
        run(platform, revision)
      )
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
    artifacts: {
      android: {
        buildId: 1,
        buildAttempt: 1,
        measurementId: 2,
        measurementAttempt: 1,
      },
      ios: {
        buildId: 3,
        buildAttempt: 1,
        measurementId: 4,
        measurementAttempt: 1,
      },
    },
  })

  return { artifact, output }
}

async function generate(fixture: Awaited<ReturnType<typeof createFixture>>) {
  const child = Bun.spawn(
    [
      'bun',
      path.join(import.meta.dir, 'generate-report.ts'),
      '--artifact-directory',
      fixture.artifact,
      '--output-directory',
      fixture.output,
      '--artifact-id',
      '987',
    ],
    {
      stderr: 'pipe',
      stdout: 'pipe',
      env: {
        ...process.env,
        GITHUB_STEP_SUMMARY: path.join(fixture.output, 'job-summary.md'),
      },
    }
  )
  const error = new Response(child.stderr).text()
  const output = new Response(child.stdout).text()
  const [exitCode, errorMessage, outputMessage] = await Promise.all([
    child.exited,
    error,
    output,
  ])
  return { exitCode, error: `${errorMessage}${outputMessage}` }
}

describe('HEAD report generation', () => {
  test('generates Markdown and BMF from raw samples', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-performance-'))
    try {
      const fixture = await createFixture(root)
      expect((await generate(fixture)).exitCode).toBe(0)
      const markdown = await readFile(
        path.join(fixture.output, 'performance-summary.md'),
        'utf8'
      )
      expect(
        await Bun.file(path.join(fixture.output, 'job-summary.md')).text()
      ).toBe(markdown)
      expect(markdown).toContain('/artifacts/987')
      expect(markdown).toContain('## Performance Report')
      expect(markdown).toContain('### iOS')
      expect(markdown).toContain('### Android')
      expect(markdown).toContain(
        '<strong>C++</strong> <code>addNumbers()</code>'
      )
      expect(markdown).toContain('<summary>All Benchmarks</summary>')
      expect(markdown).toContain(
        `Benchmarking Code Diff [\`${BASE_SHA.slice(0, 8)}\`...\`${HEAD_SHA.slice(0, 8)}\`](https://github.com/margelo/nitro/compare/${BASE_SHA}..${HEAD_SHA}) ([view raw output](https://github.com/margelo/nitro/actions/runs/123456789))`
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

  test.each(['raw-sha', 'raw-order', 'raw-count', 'raw-id', 'raw-mode'])(
    'rejects mismatched or malformed raw provenance: %s',
    async (kind) => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-performance-'))
      try {
        const fixture = await createFixture(root)
        const raw = path.join(fixture.artifact, 'raw/ios/head-1.json')
        const file = raw
        const value = JSON.parse(await readFile(file, 'utf8'))
        if (kind === 'raw-sha') value.configuration.commitSha = BASE_SHA
        if (kind === 'raw-order') value.configuration.reverse = true
        if (kind === 'raw-count') value.metrics[0].samplesNsPerOp.pop()
        if (kind === 'raw-id') value.metrics[0].id = '<script>alert(1)</script>'
        if (kind === 'raw-mode') value.environment.dev = true
        await writeJson(file, value)
        expect((await generate(fixture)).exitCode).not.toBe(0)
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  )
  test('changed suites compare shared IDs and report new and removed cases', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-performance-'))
    try {
      const fixture = await createFixture(root)
      const file = path.join(fixture.artifact, 'performance-report.json')
      const manifest = await Bun.file(file).json()
      manifest.headSuiteHash = 'd'.repeat(64)
      await writeJson(file, manifest)
      for (const platform of ['android', 'ios']) {
        const directory = path.join(fixture.artifact, 'raw', platform)
        const buildFile = path.join(directory, 'build.json')
        const build = await Bun.file(buildFile).json()
        build.headSuiteHash = manifest.headSuiteHash
        await writeJson(buildFile, build)
        const baseFile = path.join(directory, 'base-1.json')
        const base = await Bun.file(baseFile).json()
        base.metrics.push({
          ...base.metrics[0],
          id: 'nitro-cpp/primitive/removed-case',
        })
        base.benchmarkCount = 2
        await writeJson(baseFile, base)
        const headFile = path.join(directory, 'head-1.json')
        const head = await Bun.file(headFile).json()
        head.configuration.suiteHash = manifest.headSuiteHash
        head.runner = { warmupCount: 10, sampleCount: 10 }
        head.metrics[0].samplesNsPerOp = Array(10).fill(120)
        head.metrics[0].iterations *= 2
        head.metrics[0].version++
        head.metrics.unshift({
          ...head.metrics[0],
          id: 'nitro-cpp/primitive/new-case',
        })
        head.benchmarkCount = 2
        await writeJson(headFile, head)
      }
      expect(await generate(fixture)).toEqual({ exitCode: 0, error: '' })
      const markdown = await Bun.file(
        path.join(fixture.output, 'performance-summary.md')
      ).text()
      expect(markdown).toContain('🔴 +20% slower')
      expect(markdown).toContain('⭐️ New (120.0 ns)')
      expect(markdown).toContain('❌ Removed')
      expect(markdown).not.toContain('require a new baseline')
      expect(
        await Bun.file(
          path.join(fixture.output, 'bencher-base-ios.json')
        ).exists()
      ).toBe(true)

      // Suite changes cannot excuse a missing or duplicated process artifact.
      const baseFile = path.join(fixture.artifact, 'raw/ios/base-1.json')
      const base = await Bun.file(baseFile).json()
      await rm(baseFile)
      expect((await generate(fixture)).error).toContain(
        'Expected one ios base run'
      )
      await writeJson(baseFile, base)
      await writeJson(
        path.join(fixture.artifact, 'raw/ios/head-2.json'),
        await Bun.file(
          path.join(fixture.artifact, 'raw/ios/head-1.json')
        ).json()
      )
      expect((await generate(fixture)).error).toContain(
        'Expected one ios head run'
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

test('rerunning Android retains the exact earlier iOS measurements and app builds', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-attempts-'))
  try {
    const fixture = await createFixture(root)
    const manifestFile = path.join(fixture.artifact, 'performance-report.json')
    const manifest = await Bun.file(manifestFile).json()
    manifest.runAttempt = 2
    manifest.artifacts.android.measurementId = 5
    manifest.artifacts.android.measurementAttempt = 2
    await writeJson(
      path.join(fixture.artifact, 'raw/android/measurement.json'),
      { buildArtifactId: 1, runAttempt: 2 }
    )
    await writeJson(manifestFile, manifest)
    expect(await generate(fixture)).toEqual({ exitCode: 0, error: '' })
    const markdown = await Bun.file(
      path.join(fixture.output, 'performance-summary.md')
    ).text()
    expect(markdown).toContain('Android: [measurements, attempt 2]')
    expect(markdown).toContain('iOS: [measurements, attempt 1]')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
