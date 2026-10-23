import assert from 'node:assert/strict'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// This is the installed package contract consumed by the RN staging command.
export const corePackageFiles = [
  'package.json',
  'LICENSE',
  'js/src/index.ts',
  'js/src/HybridObject.ts',
  'js/src/version.ts',
  'js/lib/commonjs/index.js',
  'js/lib/module/index.js',
  'js/lib/typescript/commonjs/index.d.ts',
  'js/lib/typescript/module/index.d.ts',
  'native/cpp/include/NitroModules/HybridObject.hpp',
  'native/cpp/include/NitroModules/NitroDefines.hpp',
  'native/apple/core/HybridObject.swift',
  'native/android/src/main/cpp/src/NitroOnLoad.cpp',
  'native/android/src/main/java/com/margelo/nitro/core/HybridObject.kt',
]

export const reactNativePackageFiles = [
  'package.json',
  'NitroModules.podspec',
  'react-native.config.js',
  'Package.swift',
  'cpp/core/include/module.modulemap',
  'apple/core/include/module.modulemap',
  'apple/core/swift-bridge/include/module.modulemap',
  'include/module.modulemap',
  'cpp/core/include/NitroModules/InstallNitro.hpp',
  'cpp/core/include/NitroModules/NitroDefines.hpp',
  'apple/views/HybridView.swift',
  'android/src/main/cpp/src/JNIOnLoad.cpp',
  'android/core/main/cpp/src/NitroOnLoad.cpp',
  'android/build.gradle',
  'android/CMakeLists.txt',
  'android/consumer-rules.pro',
  'src/index.ts',
  'lib/commonjs/index.js',
  'lib/module/index.js',
  'lib/typescript/index.d.ts',
  'LICENSE',
]

export function verifyPackageLayout(directory, name, { installed = false } = {}) {
  for (const entry of ['apps', 'docs', 'nitro'])
    assert(!readdirSync(directory).includes(entry), `Development files in package: ${name}/${entry}`)
  const walk = (location) => {
    const stat = lstatSync(location)
    assert(!stat.isSymbolicLink(), `Package contains a symlink: ${location}`)
    if (!stat.isDirectory()) return
    for (const name of readdirSync(location)) {
      // npm may install a package's dependencies here when they cannot be hoisted.
      // Tarball inspection separately rejects dependencies bundled in our packages.
      if (installed && location === directory && name === 'node_modules') continue
      assert(
        !['.git', 'node_modules', '.gradle', '.cxx', 'hermes', '__tests__'].includes(name),
        `Development files in package: ${location}/${name}`
      )
      walk(path.join(location, name))
    }
  }
  walk(directory)
  const pkg = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
  assert.equal(pkg.name, name)
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const [dependency, version] of Object.entries(pkg[field] ?? {})) {
      assert(
        typeof version === 'string' && !/^(?:workspace:|file:|link:|portal:|\.{0,2}[/\\])/.test(version),
        `Local dependency in ${name}: ${field}.${dependency}=${version}`
      )
    }
  }
  return pkg
}

export function verifyCorePackage(directory, options) {
  const pkg = verifyPackageLayout(directory, 'nitro-core', options)
  for (const relative of corePackageFiles)
    assert(lstatSync(path.join(directory, relative)).isFile(), `Missing core package file: ${relative}`)
  const native = readFileSync(path.join(directory, 'native/cpp/include/NitroModules/NitroDefines.hpp'), 'utf8')
  const js = readFileSync(path.join(directory, 'js/src/version.ts'), 'utf8')
  assert.equal(native.match(/^#define NITRO_VERSION "([^"]+)"$/m)?.[1], pkg.version, 'Native version must match the npm package')
  assert.equal(js.match(/^export const version = '([^']+)'$/m)?.[1], pkg.version, 'JS version must match the npm package')
  return pkg.version
}

export function verifyReactNativePackage(directory, coreDirectory, options) {
  const pkg = verifyPackageLayout(directory, 'react-native-nitro-modules', options)
  const version = verifyCorePackage(coreDirectory, options)
  assert.equal(pkg.version, version, 'RN package must use the shared release version')
  assert.equal(pkg.dependencies?.['nitro-core'], version, 'RN package must pin the matching core')
  for (const relative of reactNativePackageFiles)
    assert(lstatSync(path.join(directory, relative)).isFile(), `Missing RN package file: ${relative}`)
  for (const [source, target] of [
    ['native/cpp/include/NitroModules/NitroDefines.hpp', 'cpp/core/include/NitroModules/NitroDefines.hpp'],
    ['native/cpp/include/NitroModules/HybridObject.hpp', 'cpp/core/include/NitroModules/HybridObject.hpp'],
    ['native/apple/core/HybridObject.swift', 'apple/core/core/HybridObject.swift'],
    ['native/android/src/main/cpp/src/NitroOnLoad.cpp', 'android/core/main/cpp/src/NitroOnLoad.cpp'],
    ['LICENSE', 'LICENSE'],
  ]) {
    assert(
      readFileSync(path.join(coreDirectory, source)).equals(readFileSync(path.join(directory, target))),
      `RN package contains stale core source: ${target}`
    )
  }
  return version
}
