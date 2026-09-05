import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

test('Android performance CI requires KVM and cannot fall back to software emulation', async () => {
  const source = await readFile(
    new URL('../../.github/workflows/performance.yml', import.meta.url),
    'utf8'
  )
  const workflow = Bun.YAML.parse(source) as {
    jobs: {
      android: {
        steps: {
          name?: string
          run?: string
          with?: Record<string, unknown>
        }[]
      }
    }
  }
  const steps = workflow.jobs.android.steps
  const kvmIndex = steps.findIndex(
    (step) => step.name === 'Enable KVM for benchmark measurements'
  )
  const buildIndex = steps.findIndex(
    (step) => step.name === 'Build head benchmark APK'
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
  ).toBeLessThan(
    steps.findIndex((s) => s.name === 'Publish to Bencher and GitHub')
  )
})
