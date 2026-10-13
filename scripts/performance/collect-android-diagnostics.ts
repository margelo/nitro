import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { commandOutput } from './diagnostics'
import { parseArguments, requiredArgument } from './args'

async function saveEmulatorCrashReports(
  sourceDirectory: string,
  outputDirectory: string
): Promise<void> {
  const log: string[] = [`Emulator crash directory: ${sourceDirectory}`]
  try {
    const entries = (await readdir(sourceDirectory)).filter((entry) =>
      entry.startsWith('emu-crash-')
    )
    if (entries.length === 0) log.push('No emulator crash databases found.')
    for (const entry of entries) {
      try {
        await cp(
          path.join(sourceDirectory, entry),
          path.join(outputDirectory, entry),
          { recursive: true }
        )
        log.push(`Saved ${entry}`)
      } catch (error) {
        log.push(`Could not save ${entry}: ${error}`)
      }
    }
  } catch (error) {
    log.push(`Could not read emulator crash directory: ${error}`)
  }
  await writeFile(
    path.join(outputDirectory, 'emulator-crashes.log'),
    log.join('\n')
  )
}

async function collectHostDiagnostics(outputDirectory: string): Promise<void> {
  await mkdir(outputDirectory, { recursive: true })
  const snapshots: [string, [string, ...string[]]][] = [
    [
      'memory',
      [
        'cat',
        '/proc/meminfo',
        '/proc/pressure/memory',
        '/proc/pressure/cpu',
        '/proc/pressure/io',
      ],
    ],
    ['processes', ['ps', '-eo', 'pid,ppid,stat,rss,vsz,comm']],
    ['disk', ['df', '-h']],
    ['kernel', ['sudo', '-n', 'dmesg', '--ctime']],
    [
      'kernel-journal',
      ['journalctl', '--no-pager', '-k', '-b', '--since', '90 minutes ago'],
    ],
    ['core-dumps', ['coredumpctl', '--no-pager', 'list']],
    ['adb', ['adb', 'devices', '-l']],
    ['kernel-version', ['uname', '-a']],
  ]
  const sdk = process.env.ANDROID_HOME
  if (sdk != null) {
    snapshots.push([
      'android-sdk',
      [
        'cat',
        ...[
          'emulator/source.properties',
          'system-images/android-36/default/x86_64/source.properties',
        ].map((file) => path.join(sdk, file)),
      ],
    ])
  }
  // cgroup counters retain OOM evidence after the killed process is gone.
  try {
    const groups = await readFile('/proc/self/cgroup', 'utf8')
    await writeFile(path.join(outputDirectory, 'cgroup.txt'), groups)
    const group = groups.split('\n').find((line) => line.startsWith('0::'))
    const directories = new Set(['/sys/fs/cgroup'])
    if (group != null)
      directories.add(path.join('/sys/fs/cgroup', group.slice(3)))
    snapshots.push([
      'cgroup-memory',
      [
        'cat',
        ...[...directories].flatMap((directory) =>
          ['memory.events', 'memory.current', 'memory.peak', 'memory.max'].map(
            (file) => path.join(directory, file)
          )
        ),
      ],
    ])
  } catch (error) {
    await writeFile(path.join(outputDirectory, 'cgroup.txt'), String(error))
  }
  await Promise.all([
    ...snapshots.map(async ([name, [executable, ...args]]) => {
      const result = await commandOutput(executable, args)
      await writeFile(
        path.join(outputDirectory, `${name}.json`),
        JSON.stringify(result, null, 2)
      )
    }),
    // Crashpad databases live outside the device and survive emulator teardown.
    saveEmulatorCrashReports(
      path.join(os.tmpdir(), `android-${os.userInfo().username}`),
      outputDirectory
    ),
  ])
}

if (import.meta.main) {
  const args = parseArguments(process.argv.slice(2))
  await collectHostDiagnostics(requiredArgument(args, 'output-directory'))
}
