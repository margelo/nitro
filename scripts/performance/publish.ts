import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import type { ReportMetadata } from './report'

const testbeds = {
  android: 'nitro-benchmark-android-release-x86-64-api-36-ubuntu-24-04-kvm',
  ios: 'nitro-benchmark-ios-release-arm64-xcode-26-5-ios-26-5',
} as const

export function bencherArguments(
  metadata: ReportMetadata,
  platform: 'android' | 'ios',
  revision: 'base' | 'head',
  directory: string,
  project: string
): string[] {
  const baselineBranch = `baseline-${metadata.baseSha}`
  const isBase = revision === 'base'
  if (isBase && metadata.pullRequestNumber == null) {
    throw new Error('Only PR reports need a paired baseline upload.')
  }
  const command = [
    'bencher',
    'run',
    '--project',
    project,
    '--branch',
    isBase
      ? baselineBranch
      : metadata.pullRequestNumber == null
        ? 'main'
        : `pr-${metadata.pullRequestNumber}`,
    '--hash',
    isBase ? metadata.baseSha : metadata.headSha,
    '--testbed',
    testbeds[platform],
    '--adapter',
    'json',
    '--file',
    path.join(directory, `bencher-${isBase ? 'base-' : ''}${platform}.json`),
  ]
  if (!isBase && metadata.pullRequestNumber != null) {
    command.push(
      '--start-point',
      baselineBranch,
      '--start-point-hash',
      metadata.baseSha
    )
  }
  return command
}

export function bencherPublications(
  metadata: ReportMetadata,
  directory: string,
  project: string
) {
  const revisions =
    metadata.pullRequestNumber == null
      ? (['head'] as const)
      : (['base', 'head'] as const)
  // Seed every testbed before creating the PR branch. Never reset that branch
  // per platform: doing so would discard reports published for earlier testbeds.
  return revisions.flatMap((revision) =>
    metadata.platforms.map((platform) => ({
      platform,
      revision,
      command: bencherArguments(
        metadata,
        platform,
        revision,
        directory,
        project
      ),
    }))
  )
}

if (import.meta.main) {
  const argumentsMap = parseArguments(Bun.argv.slice(2))
  const directory = requiredArgument(argumentsMap, 'directory')
  const project = process.env.BENCHER_PROJECT
  const apiKey = process.env.BENCHER_API_KEY
  const githubToken = process.env.GITHUB_TOKEN
  if (!project?.trim() || !apiKey?.trim() || !githubToken?.trim()) {
    throw new Error(
      'BENCHER_PROJECT, BENCHER_API_KEY, and GITHUB_TOKEN are required.'
    )
  }
  const metadata: ReportMetadata = JSON.parse(
    await readFile(path.join(directory, 'metadata.json'), 'utf8')
  )
  for (const { platform, revision, command } of bencherPublications(
    metadata,
    directory,
    project
  )) {
    if (revision === 'head') {
      command.push(
        '--github-actions',
        githubToken,
        '--ci-id',
        `nitro-${platform}-release`,
        '--ci-public-links'
      )
      if (metadata.pullRequestNumber != null)
        command.push('--ci-number', String(metadata.pullRequestNumber))
    }
    // The Bencher key is environment-only, never an argument or log message.
    const child = Bun.spawn(command, {
      env: { ...Bun.env, BENCHER_API_KEY: apiKey },
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const exitCode = await child.exited
    if (exitCode !== 0)
      throw new Error(
        `Bencher failed for ${platform} ${revision} with exit code ${exitCode}.`
      )
  }
}
