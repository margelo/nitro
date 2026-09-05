import type { BenchmarkWork } from '../../apps/benchmark/src/benchmarks/types'
import path from 'node:path'
import { mkdir, readFile } from 'node:fs/promises'
import { parseArguments, requiredArgument } from './args'
import { runIsolatedCases } from './isolated-cases'
import { validateBenchmarkRun } from './schema'

async function command(
  executable: string,
  argumentsList: string[],
  allowFailure = false
): Promise<void> {
  const child = Bun.spawn([executable, ...argumentsList], {
    stdout: 'inherit',
    stderr: 'inherit',
    timeout: 120_000,
    killSignal: 'SIGKILL',
  })
  const exitCode = await child.exited
  if (exitCode !== 0 && !allowFailure) {
    throw new Error(
      `${executable} ${argumentsList.join(' ')} failed with exit code ${exitCode}.`
    )
  }
}

async function commandOutput(
  executable: string,
  argumentsList: string[]
): Promise<{ exitCode: number; output: string }> {
  const child = Bun.spawn([executable, ...argumentsList], {
    stdout: 'pipe',
    stderr: 'ignore',
    timeout: 15_000,
    killSignal: 'SIGKILL',
    maxBuffer: 2 * 1024 * 1024,
  })
  const [exitCode, output] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
  ])
  return { exitCode, output }
}

const argumentsMap = parseArguments(Bun.argv.slice(2))
const platform = requiredArgument(argumentsMap, 'platform')
if (platform !== 'android' && platform !== 'ios') {
  throw new Error('--platform must be android or ios.')
}
const app = path.resolve(requiredArgument(argumentsMap, 'app'))
const output = path.resolve(requiredArgument(argumentsMap, 'output'))
const deviceId = requiredArgument(argumentsMap, 'device-id')
const casesDirectory = path.join(
  path.dirname(output),
  `${path.basename(output, '.json')}-cases`
)
const receiverArguments = [
  path.join(import.meta.dir, 'receive.ts'),
  '--platform',
  platform,
  '--run-id',
  requiredArgument(argumentsMap, 'run-id'),
  '--reverse',
  requiredArgument(argumentsMap, 'reverse'),
  '--commit-sha',
  requiredArgument(argumentsMap, 'commit-sha'),
  '--suite-hash',
  requiredArgument(argumentsMap, 'suite-hash'),
  '--device',
  requiredArgument(argumentsMap, 'device'),
  '--os-version',
  requiredArgument(argumentsMap, 'os-version'),
  '--architecture',
  requiredArgument(argumentsMap, 'architecture'),
  '--toolchain',
  requiredArgument(argumentsMap, 'toolchain'),
]

async function runCase(
  index: number,
  calibration: boolean,
  work?: BenchmarkWork
) {
  const caseOutput = path.join(
    casesDirectory,
    `${calibration ? 'calibration' : 'case'}-${index}.json`
  )
  const receiver = Bun.spawn(
    [
      'bun',
      ...receiverArguments,
      ...(calibration ? ['--calibration', 'true'] : []),
      ...(work == null
        ? []
        : [
            '--work-id',
            work.id,
            '--iterations',
            String(work.iterations),
            '--chunk-iterations',
            String(work.chunkIterations),
          ]),
      '--output',
      caseOutput,
      '--benchmark-index',
      String(index),
      '--timeout-ms',
      '120000',
    ],
    {
      stdout: 'inherit',
      stderr: 'inherit',
    }
  )
  let monitorCancelled = false

  async function monitorAndroidProcess(): Promise<void> {
    await Bun.sleep(1_000)
    while (!monitorCancelled) {
      const process = await commandOutput('adb', [
        '-s',
        deviceId,
        'shell',
        'pidof',
        'com.margelo.nitrobenchmark',
      ])
      if (process.exitCode !== 0 || process.output.trim().length === 0) {
        throw new Error(
          'Android benchmark app stopped before reporting results.'
        )
      }
      await Bun.sleep(1_000)
    }
  }

  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:8173/config')
        if (response.ok) break
      } catch {
        if (attempt === 49) throw new Error('Benchmark receiver did not start.')
      }
      await Bun.sleep(100)
    }

    if (platform === 'android') {
      const packageName = 'com.margelo.nitrobenchmark'
      await command('adb', [
        '-s',
        deviceId,
        'shell',
        'am',
        'start',
        '-W',
        '-n',
        `${packageName}/.MainActivity`,
      ])
    } else {
      const bundleIdentifier = 'com.margelo.nitrobenchmark'
      await command('xcrun', [
        'simctl',
        'launch',
        '--terminate-running-process',
        deviceId,
        bundleIdentifier,
      ])
    }

    const receiverCompletion = receiver.exited.then((receiverExitCode) => {
      if (receiverExitCode !== 0) {
        throw new Error(
          `Benchmark receiver failed with exit code ${receiverExitCode}.`
        )
      }
    })
    await (platform === 'android'
      ? Promise.race([receiverCompletion, monitorAndroidProcess()])
      : receiverCompletion)
    const result = validateBenchmarkRun(
      JSON.parse(await readFile(caseOutput, 'utf8'))
    )
    const metric = result.metrics[0]!
    console.info(
      `[NitroBenchmark] ${calibration ? 'calibration' : 'measurement'} case ${index + 1}/${result.benchmarkCount}: ${metric.id}, ${metric.iterations} ops/sample`
    )
    return result
  } catch (error) {
    if (platform === 'android') {
      // Capture diagnostics before the emulator action tears down the target.
      // Nothing is collected during a successful timed batch.
      const logs = await commandOutput('adb', [
        '-s',
        deviceId,
        'logcat',
        '-d',
        '-t',
        '1000',
      ])
      const exits = await commandOutput('adb', [
        '-s',
        deviceId,
        'shell',
        'dumpsys',
        'activity',
        'exit-info',
        'com.margelo.nitrobenchmark',
      ])
      const diagnostics = `${logs.output}\n${exits.output}`
      await Bun.write(output.replace(/\.json$/, '.failure.log'), diagnostics)
      console.error(diagnostics)
    }
    throw error
  } finally {
    monitorCancelled = true
    if (platform === 'android') {
      await command(
        'adb',
        [
          '-s',
          deviceId,
          'shell',
          'am',
          'force-stop',
          'com.margelo.nitrobenchmark',
        ],
        true
      )
    } else {
      await command(
        'xcrun',
        ['simctl', 'terminate', deviceId, 'com.margelo.nitrobenchmark'],
        true
      )
    }
    receiver.kill()
    await receiver.exited
  }
}

// Installing once preserves the same binary while fresh processes release the
// runtime-scoped JSI cache between cases. No install/launch work enters timing.
await mkdir(casesDirectory, { recursive: true })
if (platform === 'android') {
  await command(
    'adb',
    ['-s', deviceId, 'uninstall', 'com.margelo.nitrobenchmark'],
    true
  )
  await command('adb', ['-s', deviceId, 'install', '-r', app])
  await command('adb', ['-s', deviceId, 'reverse', 'tcp:8173', 'tcp:8173'])
} else {
  await command(
    'xcrun',
    ['simctl', 'terminate', deviceId, 'com.margelo.nitrobenchmark'],
    true
  )
  await command(
    'xcrun',
    ['simctl', 'uninstall', deviceId, 'com.margelo.nitrobenchmark'],
    true
  )
  await command('xcrun', ['simctl', 'install', deviceId, app])
}
const workFile = argumentsMap.get('work-plan')?.[0]
const plan =
  workFile == null
    ? undefined
    : validateBenchmarkRun(JSON.parse(await readFile(workFile, 'utf8')))
const work = plan?.metrics.map(({ id, iterations, chunkIterations }) => ({
  id,
  iterations,
  chunkIterations,
}))
if (
  plan != null &&
  (plan.configuration.calibration !== true ||
    plan.configuration.suiteHash !==
      requiredArgument(argumentsMap, 'suite-hash'))
) {
  throw new Error('Work plan must be calibration for the measured suite.')
}
if (
  plan != null &&
  plan.configuration.reverse !== (argumentsMap.get('reverse')?.[0] === 'true')
)
  work?.reverse()
const result = await runIsolatedCases(async (index) => {
  if (argumentsMap.has('calibration')) return runCase(index, true)
  let counts = work?.[index]
  if (counts == null) {
    if (work != null) throw new Error('Work plan is missing a benchmark case.')
    const calibration = await runCase(index, true)
    const { id, iterations, chunkIterations } = calibration.metrics[0]!
    counts = { id, iterations, chunkIterations }
  }
  // runCase terminates its process before returning, including calibration.
  return runCase(index, false, counts)
})
await Bun.write(output, `${JSON.stringify(result, null, 2)}\n`)
