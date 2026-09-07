import type { ReportMetadata } from './report'
import { describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { bencherArguments, bencherPublications } from './publish'

const metadata: ReportMetadata = {
  repository: 'margelo/nitro',
  eventName: 'pull_request',
  pullRequestNumber: 123,
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
  workflowRunId: 123,
  runAttempt: 1,
  platforms: ['android', 'ios'],
}

function option(args: string[], name: string) {
  return args[args.indexOf(name) + 1]
}

describe('Bencher publications', () => {
  test('seeds an exact paired baseline without labelling a stacked base as main', () => {
    const args = bencherArguments(
      metadata,
      'ios',
      'base',
      '/validated',
      'nitro'
    )
    expect(option(args, '--branch')).toBe(`baseline-${metadata.baseSha}`)
    expect(option(args, '--hash')).toBe(metadata.baseSha)
    expect(option(args, '--file')).toBe('/validated/bencher-base-ios.json')
    expect(args).not.toContain('--github-actions')
    expect(args).not.toContain('--key')
  })

  test('posts the PR head with the same-run baseline as its start point', () => {
    const args = bencherArguments(
      metadata,
      'android',
      'head',
      '/validated',
      'nitro'
    )
    expect(option(args, '--branch')).toBe('pr-123')
    expect(option(args, '--hash')).toBe(metadata.headSha)
    expect(option(args, '--start-point')).toBe(`baseline-${metadata.baseSha}`)
    expect(option(args, '--start-point-hash')).toBe(metadata.baseSha)
    expect(option(args, '--file')).toBe('/validated/bencher-android.json')
    expect(args).not.toContain('--start-point-reset')
    expect(args).not.toContain('--key')
  })

  test('uploads both baselines before either head without resetting earlier testbeds', () => {
    const publications = bencherPublications(metadata, '/validated', 'nitro')
    expect(
      publications.map(({ platform, revision }) => [platform, revision])
    ).toEqual([
      ['android', 'base'],
      ['ios', 'base'],
      ['android', 'head'],
      ['ios', 'head'],
    ])
    for (const { command } of publications) {
      expect(command).not.toContain('--start-point-reset')
      expect(command).not.toContain('--github-actions')
      expect(command).not.toContain('--ci-number')
      expect(command).not.toContain('--error-on-alert')
    }
  })

  test('main runs do not require a pre-existing baseline', () => {
    const main = {
      ...metadata,
      eventName: 'push',
      pullRequestNumber: null,
    } as const
    const args = bencherArguments(main, 'ios', 'head', '/validated', 'nitro')
    expect(option(args, '--branch')).toBe('main')
    expect(args).not.toContain('--start-point')
    expect(
      bencherPublications(main, '/validated', 'nitro').map(
        ({ revision }) => revision
      )
    ).toEqual(['head', 'head'])
    expect(() =>
      bencherArguments(main, 'ios', 'base', '/validated', 'nitro')
    ).toThrow()
  })
})

test('uploads pre-rendered Bencher data through fixed arguments, without executing artifact code', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-bencher-'))
  try {
    const directory = path.join(root, 'validated')
    const data = path.join(root, 'artifact')
    const bmf = { 'case-from-head': { latency: { value: 123 } } }
    await Bun.write(
      path.join(directory, 'metadata.json'),
      JSON.stringify(metadata)
    )
    for (const name of ['base-android', 'base-ios', 'android', 'ios']) {
      await Bun.write(
        path.join(data, `bencher-${name}.json`),
        JSON.stringify(bmf)
      )
    }
    await Bun.write(
      path.join(data, 'publish.ts'),
      'throw new Error("Artifact code executed")'
    )
    const executable = path.join(root, 'bin', 'bencher')
    await Bun.write(
      executable,
      `#!${process.execPath}
import { appendFile } from 'node:fs/promises'
const args = Bun.argv.slice(2)
const file = args[args.indexOf('--file') + 1]
await appendFile(process.env.CAPTURE, JSON.stringify({ args, data: await Bun.file(file).json() }) + '\\n')
`
    )
    await chmod(executable, 0o755)
    const capture = path.join(root, 'uploads.jsonl')
    const child = Bun.spawn(
      [
        'bun',
        path.join(import.meta.dir, 'publish.ts'),
        '--directory',
        directory,
        '--data-directory',
        data,
      ],
      {
        env: {
          ...process.env,
          PATH: `${path.join(root, 'bin')}:${process.env.PATH}`,
          BENCHER_PROJECT: 'nitro',
          BENCHER_API_KEY: 'test-only',
          CAPTURE: capture,
        },
        stdout: 'pipe',
        stderr: 'pipe',
      }
    )
    const stderr = new Response(child.stderr).text()
    expect(await child.exited).toBe(0)
    expect(await stderr).toBe('')
    const uploads = (await Bun.file(capture).text())
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
    expect(uploads).toHaveLength(4)
    for (const upload of uploads) {
      expect(upload.data).toEqual(bmf)
      expect(upload.args).not.toContain('test-only')
      expect(option(upload.args, '--project')).toBe('nitro')
      expect(option(upload.args, '--file')).toStartWith(directory)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
