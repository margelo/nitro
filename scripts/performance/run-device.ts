import type { BenchmarkRunConfiguration } from '../../apps/benchmark/src/benchmarks/types'
import path from 'node:path'
import { mkdir, readFile } from 'node:fs/promises'
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

/** Each call launches a fresh process and terminates it before returning. */
export async function runDeviceCase(
  deviceId: string,
  appId: string,
  configuration: BenchmarkRunConfiguration & { benchmarkIndex: number },
  output: string
) {
  const { platform, benchmarkIndex: index, calibration, work } = configuration
  await mkdir(path.dirname(output), { recursive: true })
  const receiverArguments = [
    path.join(import.meta.dir, 'receive.ts'),
    '--platform',
    platform,
    '--run-id',
    configuration.runId,
    '--reverse',
    String(configuration.reverse),
    '--commit-sha',
    configuration.commitSha,
    '--suite-hash',
    configuration.suiteHash,
    '--device',
    configuration.device,
    '--os-version',
    configuration.osVersion,
    '--architecture',
    configuration.architecture,
    '--toolchain',
    configuration.toolchain,
  ]
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
      output,
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
        appId,
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
    let ready = false
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch('http://127.0.0.1:8173/config')
        if (response.ok) {
          ready = true
          break
        }
      } catch {
        // The receiver is still starting.
      }
      await Bun.sleep(100)
    }

    if (!ready) throw new Error('Benchmark receiver did not start.')

    if (platform === 'android') {
      await command('adb', [
        '-s',
        deviceId,
        'shell',
        'am',
        'start',
        '-W',
        '-n',
        `${appId}/com.margelo.nitrobenchmark.MainActivity`,
      ])
    } else {
      await command('xcrun', [
        'simctl',
        'launch',
        '--terminate-running-process',
        deviceId,
        appId,
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
      JSON.parse(await readFile(output, 'utf8'))
    )
    const metric = result.metrics[0]!
    console.info(
      `[NitroBenchmark] ${new Date().toISOString()} ${configuration.runId} ${calibration ? 'calibration' : 'measurement'} case ${index + 1}/${result.benchmarkCount}: ${metric.id}, ${metric.iterations} ops/sample`
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
        appId,
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
        ['-s', deviceId, 'shell', 'am', 'force-stop', appId],
        true
      )
    } else {
      await command('xcrun', ['simctl', 'terminate', deviceId, appId], true)
    }
    receiver.kill()
    await receiver.exited
  }
}

/** Install once; app identities let revisions coexist on the same device. */
export async function installApp(
  platform: 'android' | 'ios',
  deviceId: string,
  app: string,
  appId: string
): Promise<void> {
  if (platform === 'android') {
    await command('adb', ['-s', deviceId, 'uninstall', appId], true)
    await command('adb', ['-s', deviceId, 'install', '-r', app])
    await command('adb', ['-s', deviceId, 'reverse', 'tcp:8173', 'tcp:8173'])
  } else {
    await command('xcrun', ['simctl', 'terminate', deviceId, appId], true)
    await command('xcrun', ['simctl', 'uninstall', deviceId, appId], true)
    await command('xcrun', ['simctl', 'install', deviceId, app])
  }
}
