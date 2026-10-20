import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  corePackageFiles,
  reactNativePackageFiles,
  verifyPackageLayout,
  verifyReactNativePackage,
} from './package-layout.mjs'

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'nitro-package-layout-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const core = path.join(root, 'nitro-core')
  const wrapper = path.join(root, 'react-native-nitro-modules')
  for (const [directory, files] of [
    [core, corePackageFiles],
    [
      wrapper,
      [
        ...reactNativePackageFiles,
        'cpp/core/include/NitroModules/HybridObject.hpp',
        'apple/core/core/HybridObject.swift',
      ],
    ],
  ]) {
    for (const relative of files) {
      const file = path.join(directory, relative)
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(file, 'shared native source\n')
    }
    writeFileSync(
      path.join(directory, 'package.json'),
      JSON.stringify({
        name: path.basename(directory),
        version: '0.38.0-beta.1',
        ...(directory === wrapper
          ? { dependencies: { 'nitro-core': '0.38.0-beta.1' } }
          : {}),
      })
    )
  }
  for (const file of [
    path.join(core, 'native/cpp/include/NitroModules/NitroDefines.hpp'),
    path.join(wrapper, 'cpp/core/include/NitroModules/NitroDefines.hpp'),
  ])
    writeFileSync(file, '#define NITRO_VERSION "0.38.0-beta.1"\n')
  writeFileSync(
    path.join(core, 'js/src/version.ts'),
    "export const version = '0.38.0-beta.1'\n"
  )
  return { core, wrapper }
}

test('packed RN adapter contains matching JS/native package versions and core sources', (t) => {
  const { core, wrapper } = fixture(t)
  assert.equal(verifyReactNativePackage(wrapper, core), '0.38.0-beta.1')
})

test('consumer checks reject stale staged RN implementation even when versions match', (t) => {
  const { core, wrapper } = fixture(t)
  writeFileSync(
    path.join(wrapper, 'apple/core/core/HybridObject.swift'),
    'stale source'
  )
  assert.throws(
    () => verifyReactNativePackage(wrapper, core),
    /stale core source/
  )
})

test('consumer checks require exact RN core dependency and all native entrypoints', (t) => {
  const { core, wrapper } = fixture(t)
  const filename = path.join(wrapper, 'package.json')
  const manifest = JSON.parse(readFileSync(filename, 'utf8'))
  manifest.dependencies['nitro-core'] = '^0.38.0-beta.1'
  writeFileSync(filename, JSON.stringify(manifest))
  assert.throws(
    () => verifyReactNativePackage(wrapper, core),
    /pin the matching core/
  )
  manifest.dependencies['nitro-core'] = '0.38.0-beta.1'
  writeFileSync(filename, JSON.stringify(manifest))
  rmSync(path.join(wrapper, 'NitroModules.podspec'))
  assert.throws(() => verifyReactNativePackage(wrapper, core), /ENOENT/)
})

test('every dependency field rejects workspace and filesystem references in published packages', (t) => {
  const { wrapper } = fixture(t)
  for (const field of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const version of [
      'workspace:*',
      'file:../core',
      'link:../core',
      '../core',
      '/tmp/core',
    ]) {
      writeFileSync(
        path.join(wrapper, 'package.json'),
        JSON.stringify({
          name: 'react-native-nitro-modules',
          [field]: { 'nitro-core': version },
        })
      )
      assert.throws(
        () => verifyPackageLayout(wrapper, 'react-native-nitro-modules'),
        /Local dependency/
      )
    }
  }
})

test('published packages cannot contain linked files or repository directories', (t) => {
  const { wrapper } = fixture(t)
  symlinkSync(
    path.join(wrapper, 'src/index.ts'),
    path.join(wrapper, 'src/linked.ts')
  )
  assert.throws(
    () => verifyPackageLayout(wrapper, 'react-native-nitro-modules'),
    /symlink/
  )
  rmSync(path.join(wrapper, 'src/linked.ts'))
  mkdirSync(path.join(wrapper, 'apps'))
  assert.throws(
    () => verifyPackageLayout(wrapper, 'react-native-nitro-modules'),
    /Development files/
  )
})

test('installed package inspection permits dependencies npm could not hoist', (t) => {
  const { wrapper } = fixture(t)
  mkdirSync(path.join(wrapper, 'node_modules'))
  symlinkSync(
    path.join(wrapper, 'src/index.ts'),
    path.join(wrapper, 'node_modules/installed-bin')
  )
  assert.throws(
    () => verifyPackageLayout(wrapper, 'react-native-nitro-modules'),
    /Development files/
  )
  assert.doesNotThrow(() =>
    verifyPackageLayout(wrapper, 'react-native-nitro-modules', {
      installed: true,
    })
  )
})
