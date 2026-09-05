import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import { validateBenchmarkRun } from './schema'
import { calculateSuiteHash } from './suite-hash'
import type { BuildMetadata } from './build-metadata'

const argumentsMap = parseArguments(Bun.argv.slice(2))
const platform = requiredArgument(argumentsMap, 'platform')
if (platform !== 'android' && platform !== 'ios') {
  throw new Error('--platform must be android or ios.')
}
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

async function runOne(
  revision: 'base' | 'head',
  sequence: number,
  reverse: boolean,
  calibration = false
): Promise<void> {
  const isBase = revision === 'base'
  const output = path.join(
    outputDirectory,
    calibration
      ? `calibration-${revision}.json`
      : `${revision}-${sequence}.json`
  )
  const runId = `${platform}-${revision}-${sequence}`
  const startedAt = performance.now()
  console.info(
    `[NitroBenchmark] ${new Date().toISOString()} ${runId}: starting (${reverse ? 'reverse' : 'forward'} order)`
  )
  const command = [
    'bun',
    path.join(import.meta.dir, 'run-device.ts'),
    ...(calibration
      ? ['--calibration', 'true']
      : [
          '--work-plan',
          path.join(
            outputDirectory,
            `calibration-${isBase || baseSuiteHash === headSuiteHash ? 'base' : 'head'}.json`
          ),
        ]),
    '--platform',
    platform,
    '--app',
    isBase ? baseApp : headApp,
    '--output',
    output,
    '--run-id',
    runId,
    '--reverse',
    String(reverse),
    '--commit-sha',
    isBase ? baseSha : headSha,
    '--suite-hash',
    isBase ? baseSuiteHash : headSuiteHash,
    '--device-id',
    deviceId,
    '--device',
    device,
    '--os-version',
    osVersion,
    '--architecture',
    architecture,
    '--toolchain',
    toolchain,
  ]
  const child = Bun.spawn(command, { stdout: 'inherit', stderr: 'inherit' })
  const exitCode = await child.exited
  if (exitCode !== 0) throw new Error(`${revision} run ${sequence} failed.`)
  const result = validateBenchmarkRun(
    JSON.parse(await readFile(output, 'utf8'))
  )
  console.info(
    `[NitroBenchmark] ${new Date().toISOString()} ${runId}: complete; ${result.metrics.length} metrics, suite ${(result.durationMs / 1_000).toFixed(1)}s, wall ${((performance.now() - startedAt) / 1_000).toFixed(1)}s`
  )
}

// Derive one plan from base, then discard every calibration process. Changed
// suites need separate plans and will be reported without a comparison.
if (baseSuiteHash === headSuiteHash) {
  await runOne('base', 0, false, true)
  await runOne('base', 1, false)
  await runOne('head', 1, false)
  await runOne('head', 2, true)
  await runOne('base', 2, true)
} else {
  console.info(
    '[NitroBenchmark] Benchmark definitions changed; measuring a new head baseline only.'
  )
  await runOne('head', 0, false, true)
  await runOne('head', 1, false)
  await runOne('head', 2, true)
}
