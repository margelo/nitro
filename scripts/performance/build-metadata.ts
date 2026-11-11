import { parseArguments, requiredArgument } from './args'
import { calculateSuiteHash } from './suite-hash'

/** Stored beside the exact apps, and copied unchanged into raw results. */
export interface BuildMetadata {
  platform: 'android' | 'ios'
  baseSha: string
  headSha: string
  baseSuiteHash: string
  headSuiteHash: string
  architecture: string
  toolchain: string
  configuration: 'Release'
  workflowRunId: number
  runAttempt: number
}

if (import.meta.main) {
  const args = parseArguments(Bun.argv.slice(2))
  const platform = requiredArgument(args, 'platform')
  if (platform !== 'android' && platform !== 'ios')
    throw new Error('Invalid platform.')
  const baseRoot = requiredArgument(args, 'base-root')
  const headRoot = requiredArgument(args, 'head-root')
  async function revision(root: string): Promise<string> {
    const child = Bun.spawn(['git', '-C', root, 'rev-parse', 'HEAD'], {
      stdout: 'pipe',
    })
    const sha = (await new Response(child.stdout).text()).trim()
    if ((await child.exited) !== 0)
      throw new Error('Cannot resolve built revision.')
    return sha
  }
  const metadata: BuildMetadata = {
    platform,
    baseSha: await revision(baseRoot),
    headSha: await revision(headRoot),
    baseSuiteHash: await calculateSuiteHash(baseRoot),
    headSuiteHash: await calculateSuiteHash(headRoot),
    architecture: requiredArgument(args, 'architecture'),
    toolchain: requiredArgument(args, 'toolchain'),
    configuration: 'Release',
    workflowRunId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
  }
  await Bun.write(
    requiredArgument(args, 'output'),
    `${JSON.stringify(metadata, null, 2)}\n`
  )
}
