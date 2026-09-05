import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArguments, requiredArgument } from './args'
import { validateBenchmarkRun } from './schema'
import { calculateSuiteHash } from './suite-hash'

const argumentsMap = parseArguments(Bun.argv.slice(2))
const platform = requiredArgument(argumentsMap, 'platform')
if (platform !== 'android' && platform !== 'ios') {
  throw new Error('--platform must be android or ios.')
}
const baseApp = path.resolve(requiredArgument(argumentsMap, 'base-app'))
const headApp = path.resolve(requiredArgument(argumentsMap, 'head-app'))
const baseRoot = path.resolve(requiredArgument(argumentsMap, 'base-root'))
const headRoot = path.resolve(requiredArgument(argumentsMap, 'head-root'))
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
const [baseSuiteHash, headSuiteHash] = await Promise.all([
  calculateSuiteHash(baseRoot),
  calculateSuiteHash(headRoot),
])

async function runOne(
  revision: 'base' | 'head',
  sequence: number,
  reverse: boolean
): Promise<void> {
  const isBase = revision === 'base'
  const output = path.join(outputDirectory, `${revision}-${sequence}.json`)
  const runId = `${platform}-${revision}-${sequence}`
  const startedAt = performance.now()
  console.info(
    `[NitroBenchmark] ${new Date().toISOString()} ${runId}: starting (${reverse ? 'reverse' : 'forward'} order)`
  )
  const command = [
    'bun',
    path.join(import.meta.dir, 'run-device.ts'),
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

await runOne('base', 1, false)
await runOne('head', 1, false)
await runOne('head', 2, true)
await runOne('base', 2, true)
