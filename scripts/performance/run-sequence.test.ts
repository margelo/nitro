import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { calculateSuiteHash } from './suite-hash'
import { compareRuns } from './comparison'

// Exercise the real controller/receiver with a tiny process standing in for
// simctl's app. Runner tests separately exercise fixed work across different execution speeds.
test.each([
  ['ios', 'paired', false],
  ['ios', 'paired', true],
  ['ios', 'changed-suite', true],
  ['ios', 'added-case', true],
  ['ios', 'removed-case', true],
  ['ios', 'same-sha', true],
  ['android', 'paired', true],
  ['android', 'same-sha', true],
  ['android', 'changed-suite', true],
  ['android', 'added-case', true],
  ['android', 'removed-case', true],
  ['ios', 'invalid-result', true],
] as const)(
  '%s per-case comparisons: %s, saved apps = %s',
  async (platform, mode, savedApps) => {
    const changedSuite = [
      'changed-suite',
      'added-case',
      'removed-case',
    ].includes(mode)
    const baseIds = ['javascript/control/first', 'javascript/control/second']
    const headIds =
      mode === 'added-case'
        ? [baseIds[1]!, 'javascript/control/new', baseIds[0]!]
        : mode === 'removed-case'
          ? [baseIds[1]!]
          : baseIds
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
      const ids = JSON.parse(process.env[configuration.runId.includes('-head-') ? 'HEAD_IDS' : 'BASE_IDS'])
      const index = configuration.reverse ? ids.length - 1 - configuration.benchmarkIndex : configuration.benchmarkIndex
      const id = ids[index]
      if (id == null) throw new Error("Requested case outside this app's suite")
      const work = { id, iterations: id.endsWith('/first') ? 1000 : 500, chunkIterations: id.endsWith('/first') ? 250 : 100 }
      const appId = process.argv[2]
      const expectedId = process.env.SAME_BINARY === 'true' || configuration.runId.includes('-head-') ? 'com.margelo.nitrobenchmark.head' : 'com.margelo.nitrobenchmark'
      if (appId !== expectedId) throw new Error('Launched the wrong app: ' + appId)
      await appendFile(process.env.SIMULATOR_LOG, JSON.stringify({ pid: process.pid, appId, configuration, work }) + '\\n')
      const count = 20
      const response = await fetch('http://127.0.0.1:8173/result', {
        method: 'POST', body: JSON.stringify({
          schemaVersion: 2, suiteVersion: 1, benchmarkCount: ids.length, configuration,
          environment: { reactNativeVersion: '0.85.3', hermes: true, dev: false, nitroBuildType: 'release' },
          runner: { warmupCount: 5, sampleCount: count },
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
            BASE_IDS: JSON.stringify(baseIds),
            HEAD_IDS: JSON.stringify(headIds),
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
        expect(processes).toHaveLength(2)
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
        sameBinary
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
      // Every app is stopped before starting the next case.
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
        baseIds.length + headIds.length
      )
      expect(
        processes.map((entry) => [
          entry.configuration.benchmarkIndex,
          entry.configuration.runId,
        ])
      ).toEqual(
        mode === 'added-case'
          ? [
              [0, `${platform}-base-1`],
              [0, `${platform}-head-1`],
              [1, `${platform}-base-1`],
              [1, `${platform}-head-1`],
              [2, `${platform}-head-1`],
            ]
          : mode === 'removed-case'
            ? [
                [0, `${platform}-base-1`],
                [0, `${platform}-head-1`],
                [1, `${platform}-base-1`],
              ]
            : [
                [0, `${platform}-base-1`],
                [0, `${platform}-head-1`],
                [1, `${platform}-base-1`],
                [1, `${platform}-head-1`],
              ]
      )
      expect(
        (await readdir(output)).some((name) => name.startsWith('calibration'))
      ).toBe(false)
      const base = await Bun.file(path.join(output, 'base-1.json')).json()
      const head = await Bun.file(path.join(output, 'head-1.json')).json()
      expect(base.metrics.map((metric: { id: string }) => metric.id)).toEqual(
        baseIds
      )
      expect(head.metrics.map((metric: { id: string }) => metric.id)).toEqual(
        headIds
      )
      const comparisons = compareRuns([base], [head]).comparisons
      expect(
        comparisons.find((metric) => metric.id === baseIds[1])?.deltaPercent
      ).toBe(0)
      if (mode === 'added-case') {
        expect(
          comparisons.find((metric) => metric.id === 'javascript/control/new')
            ?.baseMedianNsPerOp
        ).toBeNull()
        // The first case moved to index 2, but still compares against base index 0.
        expect(
          comparisons.find((metric) => metric.id === baseIds[0])?.deltaPercent
        ).toBe(0)
      }
      if (mode === 'removed-case') {
        expect(
          comparisons.find((metric) => metric.id === baseIds[0])
            ?.headMedianNsPerOp
        ).toBeNull()
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  },
  20_000
)
