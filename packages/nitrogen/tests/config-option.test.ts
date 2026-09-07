import { expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

test('loads the configuration passed through --config', async () => {
  const workingDirectory = await mkdtemp(
    path.join(tmpdir(), 'nitrogen-config-option-')
  )
  const configPath = path.join(workingDirectory, 'custom-config.json')
  const cliPath = path.resolve(import.meta.dir, '../src/index.ts')

  try {
    await writeFile(
      configPath,
      JSON.stringify({
        cxxNamespace: ['custom'],
        ios: { iosModuleName: 'CustomModule' },
        android: {
          androidNamespace: ['custom'],
          androidCxxLibName: 'CustomModule',
        },
        autolinking: {},
      })
    )

    const child = Bun.spawn(
      [process.execPath, cliPath, workingDirectory, '--config', configPath],
      {
        cwd: workingDirectory,
        stdout: 'pipe',
        stderr: 'pipe',
      }
    )
    const [stdout, stderr] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    const output = stdout + stderr

    expect(output).toContain('custom-config.json')
    expect(output).toContain("Nitrogen didn't find any spec files")
    expect(output).not.toContain('The path ./nitro.json does not exist')
  } finally {
    await rm(workingDirectory, { recursive: true, force: true })
  }
})
