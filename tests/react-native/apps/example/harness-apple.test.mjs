import { afterAll, beforeEach, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const tools = { ...(await import('@react-native-harness/tools')) }
const spawn = mock()
mock.module('@react-native-harness/tools', () => ({ ...tools, spawn }))

// Exercise the installed code used by the Harness CLI, including the Bun patch.
const packageUrl = import.meta.resolve('@react-native-harness/platform-apple/package.json')
const { getAppInfo, isAppInstalled } = await import(new URL('dist/xcrun/simctl.js', packageUrl).href)
const { getAppleSimulatorPlatformInstance } = await import(new URL('dist/instance.js', packageUrl).href)

const UDID = 'test-simulator'
const BUNDLE_ID = 'com.margelo.nitro.example'
const APP_INFO = {
  Bundle: '/Applications/NitroExample.app',
  CFBundleIdentifier: BUNDLE_ID,
  CFBundleExecutable: 'NitroExample',
  CFBundleName: 'NitroExample',
  Path: '/Applications/NitroExample.app',
}
const MISSING_APP = [
  'An error was encountered processing the command (domain=NSPOSIXErrorDomain, code=3):',
  `No application record found for ${BUNDLE_ID}`,
  'Underlying error (domain=NSPOSIXErrorDomain, code=3):',
  '\tApplication not found',
].join('\n')

function subprocessError(exitCode, stderr = '') {
  return Object.assign(new tools.SubprocessError('simulator command failed'), { exitCode, stderr })
}

function mockAppInfo(info) {
  spawn.mockResolvedValueOnce({ stdout: 'app-info-plist' }).mockResolvedValueOnce({ stdout: JSON.stringify(info) })
}

beforeEach(() => {
  spawn.mockReset()
  spawn.mockImplementation(async () => {
    throw new Error('Unexpected subprocess call')
  })
})

afterAll(() => {
  mock.module('@react-native-harness/tools', () => tools)
})

for (const [name, stderr] of [
  ['Xcode 27 output with an indented diagnostic', MISSING_APP],
  ['an unindented diagnostic', 'Application not found\n'],
  ['CRLF output with spaces', 'Underlying error:\r\n  Application not found\r\n'],
]) {
  test(`Harness treats ${name} as a missing app`, async () => {
    spawn.mockRejectedValue(subprocessError(3, stderr))
    expect(await getAppInfo(UDID, BUNDLE_ID)).toBeNull()
    expect(await isAppInstalled(UDID, BUNDLE_ID)).toBe(false)
    expect(spawn.mock.calls).toEqual([
      ['xcrun', ['simctl', 'appinfo', UDID, BUNDLE_ID], { signal: undefined, killSignal: 'SIGKILL' }],
      ['xcrun', ['simctl', 'appinfo', UDID, BUNDLE_ID], { signal: undefined, killSignal: 'SIGKILL' }],
    ])
  })
}

for (const [name, exitCode, stderr] of [
  ['a different exit-code-3 error', 3, 'No such process'],
  ['an exit-code-3 error without a diagnostic', 3, ''],
  ['a diagnostic embedded in another message', 3, 'Unexpected Application not found during lookup'],
  ['a diagnostic with a different exit code', 22, MISSING_APP],
  ['an invalid device', 148, 'Invalid device'],
  ['a shut-down device', 149, 'Unable to lookup applications in current state: Shutdown'],
]) {
  test(`Harness propagates ${name}`, async () => {
    const error = subprocessError(exitCode, stderr)
    spawn.mockRejectedValue(error)
    await expect(getAppInfo(UDID, BUNDLE_ID)).rejects.toBe(error)
    await expect(isAppInstalled(UDID, BUNDLE_ID)).rejects.toBe(error)
    expect(spawn).toHaveBeenCalledTimes(2)
  })
}

test('Harness propagates non-subprocess errors even when their fields describe a missing app', async () => {
  const error = Object.assign(new Error('lookup failed'), { exitCode: 3, stderr: MISSING_APP })
  spawn.mockRejectedValueOnce(error)
  await expect(getAppInfo(UDID, BUNDLE_ID)).rejects.toBe(error)
  expect(spawn).toHaveBeenCalledTimes(1)
})

test('Harness propagates plist conversion errors even when they describe a missing app', async () => {
  const error = subprocessError(3, MISSING_APP)
  spawn.mockResolvedValueOnce({ stdout: 'invalid-plist' }).mockRejectedValueOnce(error)
  await expect(getAppInfo(UDID, BUNDLE_ID)).rejects.toBe(error)
  expect(spawn.mock.calls[1]).toEqual([
    'plutil',
    ['-convert', 'json', '-o', '-', '-'],
    { stdin: { string: 'invalid-plist' }, signal: undefined, killSignal: 'SIGKILL' },
  ])
})

test('Harness propagates malformed JSON from plist conversion', async () => {
  spawn.mockResolvedValueOnce({ stdout: 'app-info-plist' }).mockResolvedValueOnce({ stdout: 'invalid-json' })
  await expect(getAppInfo(UDID, BUNDLE_ID)).rejects.toBeInstanceOf(SyntaxError)
  expect(spawn).toHaveBeenCalledTimes(2)
})

test('Harness preserves installed app information and reports the app as installed', async () => {
  mockAppInfo(APP_INFO)
  expect(await getAppInfo(UDID, BUNDLE_ID)).toEqual(APP_INFO)
  expect(spawn.mock.calls).toEqual([
    ['xcrun', ['simctl', 'appinfo', UDID, BUNDLE_ID], { signal: undefined, killSignal: 'SIGKILL' }],
    ['plutil', ['-convert', 'json', '-o', '-', '-'], { stdin: { string: 'app-info-plist' }, signal: undefined, killSignal: 'SIGKILL' }],
  ])
  mockAppInfo(APP_INFO)
  expect(await isAppInstalled(UDID, BUNDLE_ID)).toBe(true)
})

test('Harness preserves the successful one-entry response for missing apps on older Xcode versions', async () => {
  mockAppInfo({ CFBundleIdentifier: BUNDLE_ID })
  expect(await getAppInfo(UDID, BUNDLE_ID)).toBeNull()
  mockAppInfo({ CFBundleIdentifier: BUNDLE_ID })
  expect(await isAppInstalled(UDID, BUNDLE_ID)).toBe(false)
  expect(spawn).toHaveBeenCalledTimes(4)
})

test('Harness installs HARNESS_APP_PATH after the initial missing-app lookup', async () => {
  const appPath = mkdtempSync(path.join(tmpdir(), 'nitro-harness-app-'))
  const previousAppPath = process.env.HARNESS_APP_PATH
  process.env.HARNESS_APP_PATH = appPath
  spawn.mockImplementation(async (command, args) => {
    expect(command).toBe('xcrun')
    if (args[1] === 'list') {
      return {
        stdout: JSON.stringify({
          devices: {
            'com.apple.CoreSimulator.SimRuntime.iOS-27-0': [{ name: 'HarnessTest', udid: UDID, state: 'Booted' }],
          },
        }),
      }
    }
    if (args[1] === 'appinfo') throw subprocessError(3, MISSING_APP)
    if (args[1] === 'install' || args[1] === 'terminate') return { stdout: '' }
    if (args[1] === 'spawn' && args[3] === 'defaults') {
      if (args[4] === 'read') throw subprocessError(1, 'The domain/default pair does not exist')
      if (args[4] === 'write') return { stdout: '' }
    }
    throw new Error(`Unexpected simulator command: ${args.join(' ')}`)
  })

  try {
    const platform = await getAppleSimulatorPlatformInstance(
      {
        name: 'ios',
        device: { type: 'simulator', name: 'HarnessTest', systemVersion: '27.0' },
        bundleId: BUNDLE_ID,
      },
      { permissions: false, metroPort: 8081 },
      { signal: new AbortController().signal }
    )
    const commands = spawn.mock.calls.map(([, args]) => args)
    expect(commands.filter((args) => args[1] === 'install')).toEqual([['simctl', 'install', UDID, appPath]])
    expect(commands.findIndex((args) => args[1] === 'appinfo')).toBeLessThan(commands.findIndex((args) => args[1] === 'install'))
    await platform.dispose()
  } finally {
    if (previousAppPath === undefined) delete process.env.HARNESS_APP_PATH
    else process.env.HARNESS_APP_PATH = previousAppPath
    rmSync(appPath, { recursive: true, force: true })
  }
})
