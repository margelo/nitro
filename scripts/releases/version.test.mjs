import assert from 'node:assert/strict'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { run } from './lib.mjs'
import { versionedManifests } from './packages.mjs'

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'nitro-release-version-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const source = fileURLToPath(new URL('../../', import.meta.url))
  for (const relative of [
    'scripts/set-version.mjs',
    'scripts/releases/lib.mjs',
    'scripts/releases/packages.mjs',
  ]) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    copyFileSync(path.join(source, relative), path.join(root, relative))
  }
  for (const relative of versionedManifests) {
    const filename = path.join(root, relative)
    mkdirSync(path.dirname(filename), { recursive: true })
    writeFileSync(
      filename,
      JSON.stringify({
        name:
          relative === 'package.json'
            ? 'nitro'
            : path.basename(path.dirname(relative)),
        version: '0.37.1',
        dependencies: {
          'nitro-core': '0.37.1',
          'react-native-nitro-modules': '0.37.1',
          'react-native-nitro-test': 'workspace:*',
        },
        devDependencies: { nitrogen: '0.37.1' },
        peerDependencies: { 'react-native-nitro-modules': '*' },
      })
    )
  }
  for (const [relative, content] of [
    [
      'packages/nitro-core/native/cpp/utils/NitroDefines.hpp',
      '#define NITRO_VERSION "0.37.1"\n',
    ],
    [
      'packages/nitro-core/js/src/version.ts',
      "export const version = '0.37.1'\n",
    ],
  ]) {
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true })
    writeFileSync(path.join(root, relative), content)
  }
  return root
}

test('one version command updates public packages, private RN apps and exact tooling/runtime pins', (t) => {
  const root = fixture(t)
  const version = '0.38.0-nightly.123.gabcdef012345'
  run(process.execPath, ['scripts/set-version.mjs', version], {
    cwd: root,
    capture: true,
  })
  run(process.execPath, ['scripts/set-version.mjs', '--check'], {
    cwd: root,
    capture: true,
  })
  for (const relative of versionedManifests) {
    const manifest = JSON.parse(readFileSync(path.join(root, relative), 'utf8'))
    assert.equal(manifest.version, version)
    assert.equal(manifest.dependencies['nitro-core'], version)
    assert.equal(manifest.dependencies['react-native-nitro-modules'], version)
    assert.equal(manifest.devDependencies.nitrogen, version)
    assert.equal(
      manifest.dependencies['react-native-nitro-test'],
      'workspace:*'
    )
    assert.equal(manifest.peerDependencies['react-native-nitro-modules'], '*')
  }
})

test('version checks reject drift in the RN package or private fixture tooling pins', (t) => {
  const root = fixture(t)
  for (const relative of [
    'packages/react-native-nitro-modules/package.json',
    'tests/react-native/apps/example/package.json',
  ]) {
    const filename = path.join(root, relative)
    const manifest = JSON.parse(readFileSync(filename, 'utf8'))
    manifest.devDependencies.nitrogen = '^0.37.1'
    writeFileSync(filename, JSON.stringify(manifest))
    assert.throws(
      () =>
        run(process.execPath, ['scripts/set-version.mjs', '--check'], {
          cwd: root,
          capture: true,
        }),
      /must pin/
    )
    manifest.devDependencies.nitrogen = '0.37.1'
    writeFileSync(filename, JSON.stringify(manifest))
  }
})
