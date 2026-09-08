import { expect, test } from 'bun:test'
import { readFile, mkdtemp, chmod, rm } from 'node:fs/promises'
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
  expect(emulator?.script).toContain('/ KVM')
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
  expect(publisher.jobs.publish.if).toBe(
    "github.event.workflow_run.event == 'issue_comment'"
  )
  expect(entry.on).toEqual({ issue_comment: { types: ['created'] } })
  expect(entry.concurrency).toBeUndefined()
  expect(publisher.concurrency).toEqual({
    'group': 'performance-report-${{ github.event.workflow_run.id }}',
    'cancel-in-progress': false,
  })
  const source = JSON.stringify(publisher)
  expect(source).not.toMatch(
    /pull_request.head.sha|bun install|NITRO_BENCHER_ENABLED/
  )
  expect(source).toContain('secrets.BENCHER_KEY')
  expect(source).not.toMatch(
    /generate-report|report-markdown|comparison\.ts|trusted-artifacts|raw\//
  )
  const aggregate = entry.jobs['nitro-performance']
  expect(
    aggregate.steps.find((s: any) => s.name === 'Checkout report tooling').with
      .ref
  ).toBe('${{ needs.prepare.outputs.head_sha }}')
  expect(JSON.stringify(aggregate)).not.toContain('secrets.')
  const renderIndex = aggregate.steps.findIndex(
    (s: any) => s.name === 'Render performance report from HEAD'
  )
  const rawUploadIndex = aggregate.steps.findIndex(
    (s: any) => s.name === 'Upload aggregate report'
  )
  expect(renderIndex).toBeGreaterThan(rawUploadIndex)
  expect(aggregate.steps[renderIndex].run).toContain('generate-report.ts')
  expect(aggregate.steps[renderIndex].run).toContain(
    '${{ steps.raw-report.outputs.artifact-id }}'
  )
  expect(aggregate.steps[renderIndex + 1].with.name).toBe(
    'performance-publication-${{ github.run_attempt }}'
  )
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

test.each(['margelo/nitro', 'contributor/nitro'])(
  'resolves manual PR revisions from %s without filtering changed paths',
  async (headRepository) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-request-'))
    try {
      const workflow = Bun.YAML.parse(
        await readFile(
          new URL('../../.github/workflows/performance.yml', import.meta.url),
          'utf8'
        )
      ) as any
      const script = workflow.jobs.prepare.steps.find(
        (step: any) => step.id === 'metadata'
      ).run
      const pr = {
        number: 123,
        state: 'open',
        base: { sha: 'a'.repeat(40), repo: { full_name: 'margelo/nitro' } },
        head: { sha: 'b'.repeat(40), repo: { full_name: headRepository } },
      }
      // Only the pull lookup is available: no changed-file lookup or git diff.
      const gh = path.join(root, 'gh')
      await Bun.write(
        gh,
        '#!/bin/bash\n[[ "$*" == "api repos/margelo/nitro/pulls/123" ]] || exit 1\ncat "$PR_FIXTURE"\n'
      )
      await chmod(gh, 0o755)
      async function resolve() {
        await Bun.write(path.join(root, 'pr.json'), JSON.stringify(pr))
        await rm(path.join(root, 'outputs'), { force: true })
        const child = Bun.spawn(['bash', '-euo', 'pipefail', '-c', script], {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${root}:${process.env.PATH}`,
            PR_FIXTURE: path.join(root, 'pr.json'),
            PR_NUMBER: '123',
            GITHUB_REPOSITORY: 'margelo/nitro',
            GITHUB_OUTPUT: path.join(root, 'outputs'),
          },
          stdout: 'pipe',
          stderr: 'pipe',
        })
        return child.exited
      }
      expect(await resolve()).toBe(0)
      expect(await Bun.file(path.join(root, 'outputs')).text()).toBe(
        `base_sha=${pr.base.sha}\nhead_sha=${pr.head.sha}\nhead_repository=${headRepository}\npr_number=123\n`
      )
      pr.state = 'closed'
      expect(await resolve()).not.toBe(0)
      expect(await Bun.file(path.join(root, 'outputs')).exists()).toBe(false)
      pr.state = 'open'
      pr.head.sha = 'invalid\nhead_sha=injected'
      expect(await resolve()).not.toBe(0)
      expect(await Bun.file(path.join(root, 'outputs')).exists()).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  }
)
