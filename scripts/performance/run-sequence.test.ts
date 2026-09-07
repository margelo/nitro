import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { calculateSuiteHash } from './suite-hash'

// Exercise the real controller/receiver with a tiny process standing in for
// simctl's app. Runner tests separately exercise timed work and slowdown bounds.
test.each([
  ['ios', 'paired', false],
  ['ios', 'paired', true],
  ['ios', 'changed-suite', true],
  ['ios', 'same-sha', true],
  ['android', 'paired', true],
  ['android', 'same-sha', true],
  ['android', 'changed-suite', true],
  ['ios', 'invalid-result', true],
] as const)(
  '%s per-case comparisons: %s, saved apps = %s',
  async (platform, mode, savedApps) => {
    const changedSuite = mode === 'changed-suite'
    const sameBinary = mode === 'same-sha'
    const headSha = sameBinary ? 'a'.repeat(40) : 'b'.repeat(40)
    const directory = await mkdtemp(path.join(os.tmpdir(), 'nitro-sequence-'))
    try {
      const simulator = path.join(directory, 'simulator.ts')
      await Bun.write(
        simulator,
        `
      import { appendFile } from 'node:fs/promises'
      const configuration = await (await fetch('http://127.0.0.1:8173/config')).json()
      if (process.env.CHANGED_SUITE === 'true' && configuration.commitSha.startsWith('a')) throw new Error('Old base must not receive the new protocol.')
      const index = configuration.reverse ? 1 - configuration.benchmarkIndex : configuration.benchmarkIndex
      const id = ['javascript/control/first', 'javascript/control/second'][index]
      const work = configuration.work ?? { id, iterations: [1000, 500][index], chunkIterations: [250, 100][index] }
      if (work.id !== id) throw new Error('Work was assigned to the wrong case.')
      const appId = process.argv[2]
      const expectedId = process.env.SAME_BINARY === 'true' || configuration.runId.includes('-head-') ? 'com.margelo.nitrobenchmark.head' : 'com.margelo.nitrobenchmark'
      if (appId !== expectedId) throw new Error('Launched the wrong app: ' + appId)
      await appendFile(process.env.SIMULATOR_LOG, JSON.stringify({ pid: process.pid, appId, configuration, work }) + '\\n')
      const count = configuration.calibration ? 0 : 20
      const response = await fetch('http://127.0.0.1:8173/result', {
        method: 'POST', body: JSON.stringify({
          schemaVersion: 1, suiteVersion: 1, benchmarkCount: 2, configuration,
          environment: { reactNativeVersion: '0.85.3', hermes: true, dev: false, nitroBuildType: 'release' },
          runner: { targetBatchDurationMs: 150, warmupCount: count === 0 ? 0 : 5, sampleCount: count },
          startedAt: new Date().toISOString(), durationMs: 100,
          metrics: [{ ...work, version: 1, family: 'control', implementation: 'javascript', samplesNsPerOp: Array(process.env.INVALID_RESULT === 'true' && configuration.runId.includes('-head-') ? 1 : count).fill(100), checksum: 0 }],
        }),
      })
      if (!response.ok) throw new Error(await response.text())
    `
      )
      const commandsLog = path.join(directory, 'commands.jsonl')
      const fakeDevice = path.join(directory, 'device.ts')
      await Bun.write(
        fakeDevice,
        `
        import { appendFile } from 'node:fs/promises'
        const args = process.argv.slice(2)
        await appendFile(process.env.COMMANDS_LOG, JSON.stringify(args) + '\\n')
        if (args.includes('launch') || args.includes('start')) {
          const appId = args.at(-1).split('/')[0]
          const child = Bun.spawn([process.execPath, ${JSON.stringify(simulator)}, appId], { stdout: 'inherit', stderr: 'inherit' })
          process.exit(await child.exited)
        }
        if (args.includes('pidof')) console.log('12345')
      `
      )
      const tool = path.join(directory, platform === 'ios' ? 'xcrun' : 'adb')
      await Bun.write(
        tool,
        `#!/bin/sh\nexec '${process.execPath}' '${fakeDevice}' "$@"\n`
      )
      await chmod(tool, 0o755)
      const output = path.join(directory, 'results')
      const log = path.join(directory, 'processes.jsonl')
      const root = path.resolve(import.meta.dir, '../..')
      const baseRoot = path.join(directory, 'base')
      if (changedSuite) {
        await mkdir(path.join(baseRoot, 'apps/benchmark/src/benchmarks'), {
          recursive: true,
        })
        await Bun.write(
          path.join(baseRoot, 'apps/benchmark/index.js'),
          '// old benchmark'
        )
      }
      const metadataPath = path.join(directory, 'build.json')
      await Bun.write(
        metadataPath,
        JSON.stringify({
          platform,
          baseSha: 'a'.repeat(40),
          headSha,
          baseSuiteHash: await calculateSuiteHash(
            changedSuite ? baseRoot : root
          ),
          headSuiteHash: await calculateSuiteHash(root),
          architecture: 'arm64',
          toolchain: 'fixture',
          configuration: 'Release',
          workflowRunId: 123,
          runAttempt: 1,
        })
      )
      const child = Bun.spawn(
        [
          'bun',
          path.join(import.meta.dir, 'run-sequence.ts'),
          '--platform',
          platform,
          '--base-app',
          path.join(directory, 'base.app'),
          '--head-app',
          path.join(directory, 'head.app'),
          ...(savedApps
            ? ['--build-metadata', metadataPath]
            : [
                '--base-root',
                changedSuite ? baseRoot : root,
                '--head-root',
                root,
              ]),
          '--base-sha',
          'a'.repeat(40),
          '--head-sha',
          headSha,
          '--output-directory',
          output,
          '--device-id',
          'fixture',
          '--device',
          'fixture',
          '--os-version',
          'fixture',
          '--architecture',
          'arm64',
          '--toolchain',
          'fixture',
        ],
        {
          env: {
            ...process.env,
            PATH: `${directory}:${process.env.PATH}`,
            SIMULATOR_LOG: log,
            COMMANDS_LOG: commandsLog,
            SAME_BINARY: String(sameBinary),
            INVALID_RESULT: String(mode === 'invalid-result'),
            GITHUB_RUN_ID: '123',
            GITHUB_RUN_ATTEMPT: '2',
            BUILD_ARTIFACT_ID: '456',
            CHANGED_SUITE: String(changedSuite),
          },
          stdout: 'pipe',
          stderr: 'pipe',
        }
      )
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      const processes = (await readFile(log, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      const commands: string[][] = (await readFile(commandsLog, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      if (mode === 'invalid-result') {
        expect(exitCode).not.toBe(0)
        expect(processes).toHaveLength(3)
        expect(
          processes.every((entry) => entry.configuration.benchmarkIndex === 0)
        ).toBe(true)
        expect(commands.at(-1)).toEqual([
          'simctl',
          'terminate',
          'fixture',
          'com.margelo.nitrobenchmark.head',
        ])
        expect(await Bun.file(path.join(output, 'head-1.json')).exists()).toBe(
          false
        )
        return
      }
      expect({
        exitCode,
        error: exitCode === 0 ? '' : stdout + stderr,
      }).toEqual({ exitCode: 0, error: '' })
      const installs = commands.filter((args) => args.includes('install'))
      expect(installs.map((args) => args.at(-1))).toEqual(
        sameBinary || changedSuite
          ? [path.join(directory, 'head.app')]
          : [path.join(directory, 'head.app'), path.join(directory, 'base.app')]
      )
      const launches = commands.filter(
        (args) => args.includes('launch') || args.includes('start')
      )
      expect(launches.map((args) => args.at(-1))).toEqual(
        processes.map((entry) =>
          platform === 'ios'
            ? entry.appId
            : `${entry.appId}/com.margelo.nitrobenchmark.MainActivity`
        )
      )
      // Every app is stopped before starting the next case, including calibration.
      const lifecycle = commands.filter((args) =>
        ['launch', 'start', 'terminate', 'force-stop'].some((op) =>
          args.includes(op)
        )
      )
      const firstLaunch = lifecycle.findIndex(
        (args) => args.includes('launch') || args.includes('start')
      )
      expect(
        lifecycle
          .slice(firstLaunch)
          .map((args) =>
            args.includes('terminate') || args.includes('force-stop')
              ? 'stop'
              : 'start'
          )
      ).toEqual(processes.flatMap(() => ['start', 'stop']))
      if (savedApps) {
        expect(
          (await Bun.file(path.join(output, 'build.json')).json()).runAttempt
        ).toBe(1)
        expect(
          await Bun.file(path.join(output, 'measurement.json')).json()
        ).toEqual({ buildArtifactId: 456, runAttempt: 2 })
      }
      expect(new Set(processes.map((entry) => entry.pid)).size).toBe(
        changedSuite ? 4 : 6
      )
      expect(
        processes.map((entry) => [
          entry.configuration.benchmarkIndex,
          entry.configuration.runId,
          entry.configuration.calibration === true,
        ])
      ).toEqual(
        [0, 1].flatMap((index) =>
          changedSuite
            ? [
                [index, `${platform}-head-0`, true],
                [index, `${platform}-head-1`, false],
              ]
            : [
                [index, `${platform}-base-0`, true],
                [index, `${platform}-base-1`, false],
                [index, `${platform}-head-1`, false],
              ]
        )
      )
      for (const file of changedSuite ? ['head-1'] : ['base-1', 'head-1']) {
        const run = JSON.parse(
          await readFile(path.join(output, `${file}.json`), 'utf8')
        )
        expect(run.configuration.calibration).toBeUndefined()
        const metrics = run.metrics.sort(
          (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
        )
        expect(
          metrics.map(
            (metric: { iterations: number; chunkIterations: number }) => [
              metric.iterations,
              metric.chunkIterations,
            ]
          )
        ).toEqual([
          [1000, 250],
          [500, 100],
        ])
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
  20_000
)
