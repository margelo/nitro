import { expect, test } from 'bun:test'
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

test('Android performance CI requires KVM and cannot fall back to software emulation', async () => {
  const source = await readFile(
    new URL('../../.github/workflows/performance.yml', import.meta.url),
    'utf8'
  )
  const workflow = Bun.YAML.parse(source) as {
    jobs: {
      'measure-android': {
        steps: {
          name?: string
          run?: string
          with?: Record<string, unknown>
        }[]
      }
    }
  }
  const steps = workflow.jobs['measure-android'].steps
  const kvmIndex = steps.findIndex(
    (step) => step.name === 'Enable KVM for benchmark measurements'
  )
  const buildIndex = steps.findIndex(
    (step) => step.name === 'Run paired Android benchmarks'
  )
  expect(kvmIndex).toBeGreaterThanOrEqual(0)
  expect(kvmIndex).toBeLessThan(buildIndex)
  expect(steps[kvmIndex]?.run).toContain('test -c /dev/kvm')
  expect(steps[kvmIndex]?.run).toContain('test -r /dev/kvm && test -w /dev/kvm')
  const kvmScript = steps[kvmIndex]!.run!
  expect(kvmScript.indexOf('udevadm settle --timeout=30')).toBeGreaterThan(
    kvmScript.indexOf('udevadm trigger')
  )
  expect(kvmScript.indexOf('udevadm settle --timeout=30')).toBeLessThan(
    kvmScript.indexOf('test -r /dev/kvm')
  )

  const emulator = steps.find(
    (step) => step.name === 'Run paired Android benchmarks'
  )?.with
  expect(emulator?.['disable-linux-hw-accel']).toBe(false)
  expect(emulator?.['pre-emulator-launch-script']).toContain('-accel-check')
  expect(emulator?.['emulator-options']).toContain('-accel on')
  expect(emulator?.['emulator-options']).toContain('-no-snapshot')
  expect(emulator?.['script']).toContain('/ KVM')
})

test('one trusted publisher handles internal and fork reports without executing PR code', async () => {
  const entry = Bun.YAML.parse(
    await readFile(
      new URL('../../.github/workflows/performance.yml', import.meta.url),
      'utf8'
    )
  ) as any
  const publisher = Bun.YAML.parse(
    await readFile(
      new URL(
        '../../.github/workflows/performance-report.yml',
        import.meta.url
      ),
      'utf8'
    )
  ) as any
  expect(entry.permissions).toEqual({ contents: 'read' })
  expect(entry.jobs['publish-pr']).toBeUndefined()
  expect(publisher.jobs.publish.if).toBeUndefined()
  const source = JSON.stringify(publisher)
  expect(source).not.toMatch(
    /pull_request.head.sha|bun install|NITRO_BENCHER_ENABLED/
  )
  expect(source).toContain('secrets.BENCHER_KEY')
  const steps = publisher.jobs.publish.steps as any[]
  expect(
    steps.find((s) => s.name === 'Download performance report').with[
      'artifact-ids'
    ]
  ).toBe('${{ steps.select.outputs.artifact_id }}')
  expect(
    steps.findIndex((s) => s.name === 'Verify pinned Bencher binary')
  ).toBeLessThan(steps.findIndex((s) => s.name === 'Publish Bencher history'))
})

test.each([false, true])(
  'package docs skip measurements unless native code also changed: %s',
  async (nativeChange) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-relevance-'))
    try {
      async function git(...args: string[]) {
        const child = Bun.spawn(['git', ...args], {
          cwd: root,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        const output = await new Response(child.stdout).text()
        if ((await child.exited) !== 0)
          throw new Error(await new Response(child.stderr).text())
        return output.trim()
      }
      await git('init', '-q')
      await git(
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.com',
        'commit',
        '--allow-empty',
        '-qm',
        'base'
      )
      const base = await git('rev-parse', 'HEAD')
      const directory = path.join(root, 'packages/react-native-nitro-modules')
      await mkdir(directory, { recursive: true })
      await Bun.write(path.join(directory, 'README.md'), 'documentation')
      await Bun.write(path.join(directory, 'guide.mdx'), 'documentation')
      if (nativeChange)
        await Bun.write(path.join(directory, 'Runtime.cpp'), '// native change')
      await git('add', '.')
      await git(
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.com',
        'commit',
        '-qm',
        'head'
      )
      const workflow = Bun.YAML.parse(
        await readFile(
          new URL('../../.github/workflows/performance.yml', import.meta.url),
          'utf8'
        )
      ) as any
      const script = workflow.jobs.prepare.steps.find(
        (step: any) => step.id === 'metadata'
      ).run
      const child = Bun.spawn(['bash', '-euo', 'pipefail', '-c', script], {
        cwd: root,
        env: {
          ...process.env,
          EVENT_NAME: 'pull_request',
          PR_BASE_SHA: base,
          PR_HEAD_SHA: await git('rev-parse', 'HEAD'),
          PR_NUMBER: '1',
          GITHUB_OUTPUT: path.join(root, 'outputs'),
          GITHUB_STEP_SUMMARY: path.join(root, 'summary'),
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      expect(await child.exited).toBe(0)
      expect(await Bun.file(path.join(root, 'outputs')).text()).toContain(
        `relevant=${nativeChange}`
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
)
