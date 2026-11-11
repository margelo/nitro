import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

async function withReceiver(
  timeoutMs: number,
  action: (port: number) => Promise<void>
): Promise<{ exitCode: number; hasResult: boolean; durationMs: number }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-receiver-test-'))
  const output = path.join(root, 'result.json')
  // Ask the OS for an available port; tests never occupy the device port 8173.
  const reservation = Bun.serve({ port: 0, fetch: () => new Response() })
  const port = reservation.port!
  await reservation.stop(true)
  const child = Bun.spawn(
    [
      'bun',
      path.join(import.meta.dir, 'receive.ts'),
      '--output',
      output,
      '--port',
      String(port),
      '--timeout-ms',
      String(timeoutMs),
      '--platform',
      'android',
      '--run-id',
      'receiver-test',
      '--reverse',
      'false',
      '--commit-sha',
      'a'.repeat(40),
      '--suite-hash',
      'b'.repeat(64),
      '--device',
      'test emulator',
      '--os-version',
      'test OS',
      '--architecture',
      'x86_64',
      '--toolchain',
      'test toolchain',
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const error = new Response(child.stderr).text()
  const log = new Response(child.stdout).text()
  const startedAt = performance.now()
  try {
    await action(port)
    const exitCode = await child.exited
    await Promise.all([error, log])
    return {
      exitCode,
      hasResult: await Bun.file(output).exists(),
      durationMs: performance.now() - startedAt,
    }
  } finally {
    child.kill()
    await child.exited
    await rm(root, { recursive: true, force: true })
  }
}

async function waitForReceiver(port: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/config`)
      if (response.ok) return
    } catch {
      // The process has not bound its socket yet.
    }
    await Bun.sleep(10)
  }
  throw new Error('Test receiver did not start.')
}

describe('benchmark receiver failures', () => {
  test('fails without producing a result when the app never reports', async () => {
    const result = await withReceiver(250, waitForReceiver)
    expect(result.exitCode).not.toBe(0)
    expect(result.durationMs).toBeLessThan(2_000)
    expect(result.hasResult).toBe(false)
  })

  test('fails immediately on an invalid result instead of accepting it', async () => {
    const result = await withReceiver(5_000, async (port) => {
      await waitForReceiver(port)
      // The receiver may close the connection immediately after rejecting it.
      await fetch(`http://127.0.0.1:${port}/result`, {
        method: 'POST',
        body: JSON.stringify({ schemaVersion: 999 }),
      }).catch(() => {})
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.durationMs).toBeLessThan(2_000)
    expect(result.hasResult).toBe(false)
  })

  test('fails immediately when the app reports a build-mode or checksum error', async () => {
    const result = await withReceiver(5_000, async (port) => {
      await waitForReceiver(port)
      await fetch(`http://127.0.0.1:${port}/error`, {
        method: 'POST',
        body: JSON.stringify({ message: 'Wrong build mode or checksum' }),
      }).catch(() => {})
    })
    expect(result.exitCode).not.toBe(0)
    expect(result.durationMs).toBeLessThan(2_000)
    expect(result.hasResult).toBe(false)
  })
})
