import type { ReportMetadata } from './report'
import { describe, expect, test } from 'bun:test'
import { bencherArguments, bencherPublications } from './publish'

const metadata: ReportMetadata = {
  repository: 'margelo/nitro',
  eventName: 'pull_request',
  pullRequestNumber: 123,
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
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
