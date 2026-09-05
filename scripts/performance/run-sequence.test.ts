import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { calculateSuiteHash } from './suite-hash'

// Exercise the real controller/receiver with a tiny process standing in for
// simctl's app. Runner tests separately exercise timed work and slowdown bounds.
test.each([
  [false, false],
  [true, false],
  [false, true],
  [true, true],
])(
  'fresh processes share calibrated work; changed suite = %s, saved apps = %s',
  async (changedSuite, savedApps) => {
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
      if (work.id !== id) throw new Error('Work was assigned to the wrong reversed case.')
      await appendFile(process.env.SIMULATOR_LOG, JSON.stringify({ pid: process.pid, configuration, work }) + '\\n')
      const count = configuration.calibration ? 0 : 20
      const response = await fetch('http://127.0.0.1:8173/result', {
        method: 'POST', body: JSON.stringify({
          schemaVersion: 1, suiteVersion: 1, benchmarkCount: 2, configuration,
          environment: { reactNativeVersion: '0.85.3', hermes: true, dev: false, nitroBuildType: 'release' },
          runner: { targetBatchDurationMs: 150, warmupCount: count === 0 ? 0 : 5, sampleCount: count },
          startedAt: new Date().toISOString(), durationMs: 100,
          metrics: [{ ...work, version: 1, family: 'control', implementation: 'javascript', samplesNsPerOp: Array(count).fill(100), checksum: 0 }],
        }),
      })
      if (!response.ok) throw new Error(await response.text())
    `
      )
      const xcrun = path.join(directory, 'xcrun')
      await Bun.write(
        xcrun,
        `#!/bin/sh\nif [ "$2" = launch ]; then exec '${process.execPath}' '${simulator}'; fi\n`
      )
      await chmod(xcrun, 0o755)
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
          platform: 'ios',
          baseSha: 'a'.repeat(40),
          headSha: 'b'.repeat(40),
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
          'ios',
          '--base-app',
          directory,
          '--head-app',
          directory,
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
          'b'.repeat(40),
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
      expect({
        exitCode,
        error: exitCode === 0 ? '' : stdout + stderr,
      }).toEqual({
        exitCode: 0,
        error: '',
      })
      if (savedApps) {
        expect(
          (await Bun.file(path.join(output, 'build.json')).json()).runAttempt
        ).toBe(1)
        expect(
          await Bun.file(path.join(output, 'measurement.json')).json()
        ).toEqual({ buildArtifactId: 456, runAttempt: 2 })
      }
      const processes = (await readFile(log, 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      expect(new Set(processes.map((entry) => entry.pid)).size).toBe(
        changedSuite ? 6 : 10
      )
      expect(
        processes
          .slice(0, 2)
          .every((entry) => entry.configuration.calibration === true)
      ).toBe(true)
      expect(
        processes.slice(2).map((entry) => entry.configuration.runId)
      ).toEqual(
        changedSuite
          ? ['ios-head-1', 'ios-head-1', 'ios-head-2', 'ios-head-2']
          : [
              'ios-base-1',
              'ios-base-1',
              'ios-head-1',
              'ios-head-1',
              'ios-head-2',
              'ios-head-2',
              'ios-base-2',
              'ios-base-2',
            ]
      )
      for (const file of changedSuite
        ? ['head-1', 'head-2']
        : ['base-1', 'head-1', 'head-2', 'base-2']) {
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
