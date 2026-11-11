import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { commandOutput, saveAndroidFailure } from './diagnostics'

test('diagnostic commands retain stderr, exit status, and timeout evidence', async () => {
  const failure = await commandOutput(process.execPath, [
    '-e',
    'console.error("adb: device emulator-5554 not found"); process.exit(1)',
  ])
  expect(failure.exitCode).toBe(1)
  expect(failure.stdout).toBe('')
  expect(failure.stderr).toContain('device emulator-5554 not found')
  expect(failure.timedOut).toBe(false)

  const hung = await commandOutput(
    process.execPath,
    ['-e', 'console.error("partial diagnostics"); await Bun.sleep(60000)'],
    500
  )
  expect(hung.timedOut).toBe(true)
  expect(hung.signal).toBe('SIGKILL')
  expect(hung.stderr).toContain('partial diagnostics')

  const missing = await commandOutput('/missing/nitro-diagnostic-tool', [])
  expect(missing.exitCode).toBeNull()
  expect(missing.stderr).toContain('/missing/nitro-diagnostic-tool')
})

test('unwritable diagnostics never replace the original benchmark failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-diagnostics-'))
  try {
    const output = path.join(root, 'not-a-directory')
    await Bun.write(output, 'fixture')
    const original = new Error('original launch failure')
    async function fail() {
      try {
        throw original
      } catch (error) {
        await saveAndroidFailure(
          'emulator-5554',
          'app',
          path.join(output, 'case.json'),
          error
        )
        throw error
      }
    }
    await expect(fail()).rejects.toBe(original)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('capture bounds output and pipe lifetime even after the command exits', async () => {
  const verbose = await commandOutput(process.execPath, [
    '-e',
    'process.stdout.write("x".repeat(3 * 1024 * 1024)); await Bun.sleep(60000)',
  ])
  expect(verbose.truncated).toBe(true)
  expect(verbose.stdout.length).toBe(2 * 1024 * 1024)
  expect(verbose.signal).toBe('SIGKILL')

  const inherited = await commandOutput(
    process.execPath,
    [
      '-e',
      `const child = Bun.spawn([process.execPath, '-e', 'await Bun.sleep(60000)'], { stdout: 'inherit', stderr: 'inherit' }); console.log(child.pid); child.unref(); process.exit(0)`,
    ],
    500
  )
  try {
    expect(inherited.exitCode).toBe(0)
    expect(inherited.timedOut).toBe(true)
  } finally {
    const pid = Number.parseInt(inherited.stdout, 10)
    if (pid > 0) process.kill(pid, 'SIGKILL')
  }
})

test('host evidence and crash databases survive unavailable ADB and diagnostic tools', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-crashdata-'))
  try {
    const source = path.join(root, `android-${os.userInfo().username}`)
    const output = path.join(root, 'artifact')
    const dump = path.join('emu-crash-37.2.12.db', 'pending', 'crash.dmp')
    await mkdir(path.dirname(path.join(source, dump)), { recursive: true })
    await mkdir(output)
    await Bun.write(path.join(source, dump), 'emulator minidump')
    const bin = path.join(root, 'bin')
    await mkdir(bin)
    const tool = path.join(bin, 'fixture')
    await Bun.write(
      tool,
      `#!/bin/sh
case "$0" in
  */adb) echo 'adb: device emulator-5554 not found' >&2; exit 1 ;;
esac
echo "fixture $*"
`
    )
    await chmod(tool, 0o755)
    for (const name of [
      'cat',
      'ps',
      'df',
      'sudo',
      'journalctl',
      'adb',
      'uname',
    ]) {
      await symlink(tool, path.join(bin, name))
    }
    const child = Bun.spawn(
      [
        process.execPath,
        path.join(import.meta.dir, 'collect-android-diagnostics.ts'),
        '--output-directory',
        output,
      ],
      {
        env: { ...process.env, PATH: bin, TMPDIR: root },
        stdout: 'pipe',
        stderr: 'pipe',
      }
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect({ exitCode, stdout, stderr }).toEqual({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })
    expect(await readFile(path.join(output, dump), 'utf8')).toBe(
      'emulator minidump'
    )
    expect(
      await readFile(path.join(output, 'emulator-crashes.log'), 'utf8')
    ).toContain('Saved emu-crash-37.2.12.db')
    const adb = await Bun.file(path.join(output, 'adb.json')).json()
    expect(adb.exitCode).toBe(1)
    expect(adb.stderr).toContain('device emulator-5554 not found')
    expect(
      (await Bun.file(path.join(output, 'core-dumps.json')).json()).exitCode
    ).toBeNull()
    expect(
      (await Bun.file(path.join(output, 'memory.json')).json()).stdout
    ).toContain('/proc/meminfo')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
