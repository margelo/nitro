import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)
const read = (file: string) => readFile(new URL(file, root), 'utf8')

test('the benchmark app has no Harness or example UI dependencies', async () => {
  const manifest = JSON.parse(await read('apps/benchmark/package.json'))
  expect(Object.keys(manifest.dependencies).sort()).toEqual([
    'react',
    'react-native',
    'react-native-nitro-modules',
    'react-native-nitro-test',
    'react-native-nitro-test-external',
  ])
  expect(JSON.stringify(manifest)).not.toMatch(/harness|navigation|safe-area/)
  expect(await read('apps/benchmark/index.js')).toContain('BenchmarkApp')
  expect(await read('apps/example/index.js')).not.toContain('BenchmarkApp')
  expect(await read('apps/example/src/App.tsx')).not.toContain(
    'BenchmarksScreen'
  )
})

test('performance CI builds the standalone Release app without custom variants', async () => {
  const workflow = (
    await Promise.all(
      [
        '.github/workflows/performance.yml',
        'scripts/performance/build-android.sh',
        'scripts/performance/build-ios.sh',
      ].map(read)
    )
  ).join('\n')
  expect(workflow).toContain('cd apps/benchmark/android')
  expect(workflow).toContain(':app:assembleRelease')
  expect(workflow).toContain('-configuration Release')
  expect(workflow).not.toContain('assembleBenchmark')
  expect(workflow).not.toContain('apps/example')
  const gradle = await read('apps/benchmark/android/app/build.gradle')
  expect(gradle).toContain('enableProguardInReleaseBuilds = true')
  expect(gradle).toContain('debuggable false')
  const scheme = await read(
    'apps/benchmark/ios/NitroBenchmark.xcodeproj/xcshareddata/xcschemes/NitroBenchmark.xcscheme'
  )
  expect(scheme).toContain('buildConfiguration = "Release"')
  expect(scheme).not.toMatch(/LLDB|buildConfiguration = "Debug"/)
})

test('the loopback receiver allowance is scoped to the benchmark app', async () => {
  const policy = await read(
    'apps/benchmark/android/app/src/main/res/xml/network_security_config.xml'
  )
  expect(policy).toContain('<base-config cleartextTrafficPermitted="false"')
  expect(policy.match(/<domain /g)?.length).toBe(2)
  expect(policy).toContain(
    '<domain includeSubdomains="false">127.0.0.1</domain>'
  )
  expect(policy).toContain(
    '<domain includeSubdomains="false">localhost</domain>'
  )
  expect(
    await read('apps/example/android/app/src/main/AndroidManifest.xml')
  ).not.toContain('network_security_config')
})
