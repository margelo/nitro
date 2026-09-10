import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import { installApp, runDeviceCase } from './run-device'
import { combineIsolatedCases } from './isolated-cases'
import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'
import { calculateSuiteHash } from './suite-hash'
import type { BuildMetadata } from './build-metadata'

// Keep all four pairs adjacent for each case, with each revision first twice.
const pairOrders = [
  ['base', 'head'],
  ['head', 'base'],
  ['head', 'base'],
  ['base', 'head'],
] as const

const argumentsMap = parseArguments(Bun.argv.slice(2))
const platformArgument = requiredArgument(argumentsMap, 'platform')
if (platformArgument !== 'android' && platformArgument !== 'ios') {
  throw new Error('--platform must be android or ios.')
}
const platform = platformArgument
const freshIosSimulator =
  argumentsMap.get('fresh-ios-simulator')?.[0] ?? 'false'
if (
  !['true', 'false'].includes(freshIosSimulator) ||
  (freshIosSimulator === 'true' && platform !== 'ios')
) {
  throw new Error(
    '--fresh-ios-simulator must be true or false, and requires iOS when true.'
  )
}
const installOptions = { freshIosSimulator: freshIosSimulator === 'true' }
const baseApp = path.resolve(requiredArgument(argumentsMap, 'base-app'))
const headApp = path.resolve(requiredArgument(argumentsMap, 'head-app'))
const baseSha = requiredArgument(argumentsMap, 'base-sha')
const headSha = requiredArgument(argumentsMap, 'head-sha')
const outputDirectory = path.resolve(
  requiredArgument(argumentsMap, 'output-directory')
)
const deviceId = requiredArgument(argumentsMap, 'device-id')
const device = requiredArgument(argumentsMap, 'device')
const osVersion = requiredArgument(argumentsMap, 'os-version')
const architecture = requiredArgument(argumentsMap, 'architecture')
const toolchain = requiredArgument(argumentsMap, 'toolchain')

await mkdir(outputDirectory, { recursive: true })
// CI binds the downloaded apps to their original build, even on job reruns.
// Local callers can still point at their two source checkouts.
const metadataPath = argumentsMap.get('build-metadata')?.[0]
const build: BuildMetadata | undefined =
  metadataPath == null
    ? undefined
    : JSON.parse(await readFile(metadataPath, 'utf8'))
if (
  build != null &&
  (build.baseSha !== baseSha ||
    build.headSha !== headSha ||
    build.platform !== platform ||
    build.architecture !== architecture ||
    build.toolchain !== toolchain ||
    build.configuration !== 'Release' ||
    build.workflowRunId !== Number(process.env.GITHUB_RUN_ID))
) {
  throw new Error(
    'Downloaded app metadata does not match the requested revisions or testbed.'
  )
}
const [baseSuiteHash, headSuiteHash] =
  build == null
    ? await Promise.all([
        calculateSuiteHash(
          path.resolve(requiredArgument(argumentsMap, 'base-root'))
        ),
        calculateSuiteHash(
          path.resolve(requiredArgument(argumentsMap, 'head-root'))
        ),
      ])
    : [build.baseSuiteHash, build.headSuiteHash]
if (build != null) {
  await Bun.write(
    path.join(outputDirectory, 'build.json'),
    `${JSON.stringify(build, null, 2)}\n`
  )
  await Bun.write(
    path.join(outputDirectory, 'measurement.json'),
    `${JSON.stringify({ buildArtifactId: Number(process.env.BUILD_ARTIFACT_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT), pairCount: pairOrders.length }, null, 2)}\n`
  )
}

await Bun.write(
  path.join(outputDirectory, 'suite.json'),
  `${JSON.stringify({ baseSuiteHash, headSuiteHash }, null, 2)}\n`
)

const sameBinary = baseSha === headSha
const headId = 'com.margelo.nitrobenchmark.head'
const baseId = sameBinary ? headId : 'com.margelo.nitrobenchmark'
await installApp(platform, deviceId, headApp, headId, installOptions)
if (!sameBinary) {
  await installApp(platform, deviceId, baseApp, baseId, installOptions)
}

async function runCase(
  revision: 'base' | 'head',
  index: number,
  pair: number
): Promise<BenchmarkRunResult> {
  const isBase = revision === 'base'
  const name = `${revision}-${pair}`
  return runDeviceCase(
    deviceId,
    isBase ? baseId : headId,
    {
      platform,
      runId: `${platform}-${name}`,
      reverse: false,
      benchmarkIndex: index,
      commitSha: isBase ? baseSha : headSha,
      suiteHash: isBase ? baseSuiteHash : headSuiteHash,
      device,
      osVersion,
      architecture,
      toolchain,
    },
    path.join(outputDirectory, `${name}-cases`, `case-${index}.json`)
  )
}

const pairs = pairOrders.map(() => ({
  base: [] as BenchmarkRunResult[],
  head: [] as BenchmarkRunResult[],
}))
// Each revision reports its own suite size. Alternate fresh processes while
// both have cases left; the report matches their results by ID, not position.
const counts = { base: 1, head: 1 }
for (let index = 0; index < Math.max(counts.base, counts.head); index++) {
  for (const [pairIndex, order] of pairOrders.entries()) {
    for (const revision of order) {
      if (index >= counts[revision]) continue
      const result = await runCase(revision, index, pairIndex + 1)
      pairs[pairIndex]![revision].push(result)
      if (index === 0) counts[revision] = result.benchmarkCount!
    }
  }
}
for (const [pairIndex, pair] of pairs.entries()) {
  for (const revision of ['base', 'head'] as const) {
    const result = combineIsolatedCases(pair[revision])
    await Bun.write(
      path.join(outputDirectory, `${revision}-${pairIndex + 1}.json`),
      `${JSON.stringify(result, null, 2)}\n`
    )
  }
}
