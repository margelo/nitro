import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import { installApp, runDeviceCase } from './run-device'
import { combineIsolatedCases } from './isolated-cases'
import type {
  BenchmarkRunResult,
  BenchmarkWork,
} from '../../apps/benchmark/src/benchmarks/types'
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

const comparable = baseSuiteHash === headSuiteHash
const sameBinary = baseSha === headSha
const headId = 'com.margelo.nitrobenchmark.head'
const baseId = sameBinary ? headId : 'com.margelo.nitrobenchmark'
await installApp(platform, deviceId, headApp, headId)
if (comparable && !sameBinary) {
  await installApp(platform, deviceId, baseApp, baseId)
}

async function runCase(
  revision: 'base' | 'head',
  index: number,
  work?: BenchmarkWork
): Promise<BenchmarkRunResult> {
  const isBase = revision === 'base'
  const calibration = work == null
  const name = calibration ? `calibration-${revision}` : `${revision}-1`
  return runDeviceCase(
    deviceId,
    isBase ? baseId : headId,
    {
      platform,
      runId: `${platform}-${revision}-${calibration ? 0 : 1}`,
      reverse: false,
      benchmarkIndex: index,
      ...(calibration ? { calibration: true as const } : { work }),
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

if (!comparable) {
  console.info(
    '[NitroBenchmark] Benchmark definitions changed; measuring a new head baseline only.'
  )
}
const calibrationRevision = comparable ? 'base' : 'head'
const calibrations: BenchmarkRunResult[] = []
const baseRuns: BenchmarkRunResult[] = []
const headRuns: BenchmarkRunResult[] = []
// Discover the suite size from the first calibration. Every calibration process
// exits before measuring base then head with the exact same operation counts.
let count = 1
for (let index = 0; index < count; index++) {
  const calibration = await runCase(calibrationRevision, index)
  if (index === 0) count = calibration.benchmarkCount!
  const { id, iterations, chunkIterations } = calibration.metrics[0]!
  const work = { id, iterations, chunkIterations }
  calibrations.push(calibration)
  if (comparable) baseRuns.push(await runCase('base', index, work))
  headRuns.push(await runCase('head', index, work))
}
for (const [name, runs] of [
  [`calibration-${calibrationRevision}`, calibrations],
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
