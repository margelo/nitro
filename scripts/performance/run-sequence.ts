import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import { installApp, runDeviceCase } from './run-device'
import { combineIsolatedCases } from './isolated-cases'
import type { BenchmarkRunResult } from '../../apps/benchmark/src/benchmarks/types'
import { calculateSuiteHash } from './suite-hash'
import type { BuildMetadata } from './build-metadata'

const argumentsMap = parseArguments(Bun.argv.slice(2))
const platformArgument = requiredArgument(argumentsMap, 'platform')
if (platformArgument !== 'android' && platformArgument !== 'ios') {
  throw new Error('--platform must be android or ios.')
}
const platform = platformArgument
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
    `${JSON.stringify({ buildArtifactId: Number(process.env.BUILD_ARTIFACT_ID), runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT) }, null, 2)}\n`
  )
}

await Bun.write(
  path.join(outputDirectory, 'suite.json'),
  `${JSON.stringify({ baseSuiteHash, headSuiteHash }, null, 2)}\n`
)

const sameBinary = baseSha === headSha
const headId = 'com.margelo.nitrobenchmark.head'
const baseId = sameBinary ? headId : 'com.margelo.nitrobenchmark'
await installApp(platform, deviceId, headApp, headId)
if (!sameBinary) {
  await installApp(platform, deviceId, baseApp, baseId)
}

async function runCase(
  revision: 'base' | 'head',
  index: number
): Promise<BenchmarkRunResult> {
  const isBase = revision === 'base'
  const name = `${revision}-1`
  return runDeviceCase(
    deviceId,
    isBase ? baseId : headId,
    {
      platform,
      runId: `${platform}-${revision}-1`,
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

const baseRuns: BenchmarkRunResult[] = []
const headRuns: BenchmarkRunResult[] = []
// Each revision reports its own suite size. Alternate fresh processes while
// both have cases left; the report matches their results by ID, not position.
let baseCount = 1
let headCount = 1
for (let index = 0; index < Math.max(baseCount, headCount); index++) {
  if (index < baseCount) {
    const base = await runCase('base', index)
    baseRuns.push(base)
    if (index === 0) baseCount = base.benchmarkCount!
  }
  if (index < headCount) {
    const head = await runCase('head', index)
    headRuns.push(head)
    if (index === 0) headCount = head.benchmarkCount!
  }
}
for (const [name, runs] of [
  ['base-1', baseRuns],
  ['head-1', headRuns],
] as const) {
  if (runs.length === 0) continue
  const result = combineIsolatedCases(runs)
  await Bun.write(
    path.join(outputDirectory, `${name}.json`),
    `${JSON.stringify(result, null, 2)}\n`
  )
}
