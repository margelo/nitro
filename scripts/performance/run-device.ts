import type { BenchmarkRunConfiguration } from '../../apps/benchmark/src/benchmarks/types'
import path from 'node:path'
import { mkdir, readFile } from 'node:fs/promises'
import { validateBenchmarkRun } from './schema'
import { commandOutput, saveAndroidFailure } from './diagnostics'

async function command(
  executable: string,
  argumentsList: string[],
  allowFailure = false
): Promise<void> {
  const result = await commandOutput(executable, argumentsList, 120_000)
  if (result.stdout) console.info(result.stdout)
  if (result.stderr) console.error(result.stderr)
  if (
    (result.exitCode !== 0 || result.timedOut || result.truncated) &&
    !allowFailure
  ) {
    throw new Error(
      `${executable} ${argumentsList.join(' ')} failed with exit code ${result.exitCode}.\n${JSON.stringify(result, null, 2)}`
    )
  }
}

/** Each call launches a fresh process and terminates it before returning. */
export async function runDeviceCase(
  deviceId: string,
  appId: string,
  configuration: BenchmarkRunConfiguration & { benchmarkIndex: number },
  output: string
) {
  const { platform, benchmarkIndex: index } = configuration
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
      if (monitorCancelled) return
      if (
        process.exitCode !== 0 ||
        process.timedOut ||
        process.truncated ||
        process.stdout.trim().length === 0
      ) {
        throw new Error(
          `Android benchmark app could not be found before reporting results.\n${JSON.stringify(process, null, 2)}`
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
      `[NitroBenchmark] ${new Date().toISOString()} ${configuration.runId} measurement case ${index + 1}/${result.benchmarkCount}: ${metric.id}, ${metric.iterations} ops/sample`
    )
    return result
  } catch (error) {
    monitorCancelled = true
    if (platform === 'android') {
      // Capture diagnostics before the emulator action tears down the target.
      // Nothing is collected during a successful timed batch.
      await saveAndroidFailure(deviceId, appId, output, error)
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
