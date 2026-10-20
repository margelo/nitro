import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJSON, run, writeJSON } from './lib.mjs'
import {
  verifyCorePackage,
  verifyPackageLayout,
  verifyReactNativePackage,
} from './package-layout.mjs'
import { releasePackages } from './packages.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))

export function checkConsumer(tarballs) {
  if (tarballs.length !== releasePackages.length)
    throw new Error('Consumer validation requires all three release tarballs')
  const packed = Object.fromEntries(
    releasePackages.map((name) => {
      const matches = tarballs.filter((file) =>
        path.basename(file).startsWith(`${name}-`)
      )
      if (matches.length !== 1)
        throw new Error(`Expected one tarball for ${name}`)
      return [name, matches[0]]
    })
  )
  for (const tarball of tarballs) {
    const entries = run('tar', ['-tzf', tarball], { capture: true }).split('\n')
    if (
      entries.some(
        (entry) =>
          /^package\/(?:nitro|apps|docs|hermes)\//.test(entry) ||
          /\/(?:\.git|node_modules|__tests__|\.gradle|\.cxx)\//.test(entry)
      )
    )
      throw new Error(`Development files in ${path.basename(tarball)}`)
  }
  const consumer = mkdtempSync(path.join(tmpdir(), 'nitro-release-consumer-'))
  writeJSON(path.join(consumer, 'package.json'), {
    name: 'nitro-release-consumer',
    version: '1.0.0',
    private: true,
  })
  run(
    'npm',
    [
      'install',
      '--no-audit',
      '--no-fund',
      packed['nitro-core'],
      packed.nitrogen,
    ],
    {
      cwd: consumer,
    }
  )
  const version = verifyCorePackage(
    path.join(consumer, 'node_modules/nitro-core'),
    { installed: true }
  )
  const nitrogen = verifyPackageLayout(
    path.join(consumer, 'node_modules/nitrogen'),
    'nitrogen',
    { installed: true }
  )
  if (
    nitrogen.version !== version ||
    nitrogen.dependencies?.['nitro-core'] !== version
  )
    throw new Error('Packed Nitrogen must use the matching nitro-core version')
  for (const name of ['nitro-core', 'nitrogen']) {
    const location = path.join(consumer, 'node_modules', name)
    if (lstatSync(location).isSymbolicLink())
      throw new Error(`Consumer uses a workspace link for ${name}`)
    for (const entry of ['.git', 'apps', 'docs', 'nitro', 'hermes']) {
      if (existsSync(path.join(location, entry)))
        throw new Error(`Unexpected packaged entry: ${name}/${entry}`)
    }
  }
  for (const name of ['react-native', 'react-native-nitro-modules']) {
    if (existsSync(path.join(consumer, 'node_modules', name)))
      throw new Error(`Unexpected dependency: ${name}`)
  }
  run(
    'node',
    [
      '--input-type=module',
      '-e',
      "import { getInstalledNitro } from 'nitro-core'; if (getInstalledNitro() !== undefined) throw Error('Unexpected runtime')",
    ],
    { cwd: consumer }
  )
  run(
    'node',
    [
      '-e',
      "if (require('nitro-core').getInstalledNitro() !== undefined) throw Error('Unexpected runtime')",
    ],
    { cwd: consumer }
  )
  writeFileSync(
    path.join(consumer, 'Math.nitro.ts'),
    "import type { HybridObject } from 'nitro-core'\nexport interface Math extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> { add(a: number, b: number): number }\n"
  )
  writeFileSync(
    path.join(consumer, 'esm.mts'),
    "export type { HybridObject, NitroModulesProxy } from 'nitro-core'\n"
  )
  writeJSON(path.join(consumer, 'tsconfig.json'), {
    compilerOptions: {
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      target: 'ESNext',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
    },
    include: ['*.ts', '*.mts'],
  })
  writeJSON(path.join(consumer, 'nitro.json'), {
    cxxNamespace: ['releasecheck'],
    ios: { iosModuleName: 'ReleaseCheck' },
    android: {
      androidNamespace: ['releasecheck'],
      androidCxxLibName: 'ReleaseCheck',
    },
    autolinking: {},
    ignorePaths: ['**/node_modules'],
  })
  const tsc = fileURLToPath(
    new URL('../../node_modules/typescript/bin/tsc', import.meta.url)
  )
  run('node', [tsc, '--project', path.join(consumer, 'tsconfig.json')], {
    cwd: consumer,
  })
  run(
    'node',
    ['node_modules/nitrogen/lib/index.js', '--log-level', 'warning'],
    { cwd: consumer }
  )
  const header = path.join(
    consumer,
    'nitrogen/generated/shared/c++/HybridMathSpec.hpp'
  )
  if (!existsSync(header) || !readFileSync(header, 'utf8').includes('add('))
    throw new Error('Packed Nitrogen did not generate the consumer spec')
  console.log(`Validated packed core packages in ${consumer}`)
  checkReactNativeConsumer(packed, version)
}

function checkReactNativeConsumer(packed, version) {
  const consumer = mkdtempSync(
    path.join(tmpdir(), 'nitro-rn-release-consumer-')
  )
  const app = readJSON(
    path.join(root, 'tests/react-native/apps/example/package.json')
  )
  const wrapper = readJSON(
    path.join(root, 'packages/react-native-nitro-modules/package.json')
  )
  writeJSON(path.join(consumer, 'package.json'), {
    name: 'nitro-rn-release-consumer',
    private: true,
    dependencies: {
      'react': app.dependencies.react,
      'react-native': app.dependencies['react-native'],
      '@types/react': wrapper.devDependencies['@types/react'],
      'typescript': readJSON(path.join(root, 'package.json')).devDependencies
        .typescript,
      ...Object.fromEntries(
        Object.entries(packed).map(([name, file]) => [name, `file:${file}`])
      ),
    },
  })
  // Exercise normal consumer lifecycle scripts outside the monorepo.
  run('npm', ['install', '--no-audit', '--no-fund'], { cwd: consumer })
  for (const name of releasePackages) {
    const pkg = verifyPackageLayout(
      path.join(consumer, 'node_modules', name),
      name,
      { installed: true }
    )
    if (pkg.version !== version)
      throw new Error(`Packed ${name} has a different release version`)
  }
  verifyReactNativePackage(
    path.join(consumer, 'node_modules/react-native-nitro-modules'),
    path.join(consumer, 'node_modules/nitro-core'),
    { installed: true }
  )
  mkdirSync(path.join(consumer, 'src'))
  for (const filename of ['TestView.nitro.ts', 'BenchmarkObject.nitro.ts']) {
    copyFileSync(
      path.join(
        root,
        'tests/react-native/packages/react-native-nitro-test',
        'src/specs',
        filename
      ),
      path.join(consumer, 'src', filename)
    )
  }
  writeJSON(path.join(consumer, 'tsconfig.json'), {
    compilerOptions: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: 'ESNext',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      jsx: 'react-jsx',
    },
    include: ['src'],
  })
  const config = readJSON(
    path.join(
      root,
      'tests/react-native/packages/react-native-nitro-test/nitro.json'
    )
  )
  config.autolinking = {
    TestView: config.autolinking.TestView,
    BenchmarkObjectCpp: config.autolinking.BenchmarkObjectCpp,
    BenchmarkObjectSwiftKotlin: config.autolinking.BenchmarkObjectSwiftKotlin,
  }
  writeJSON(path.join(consumer, 'nitro.json'), config)
  run('node', ['node_modules/typescript/bin/tsc', '--noEmit'], {
    cwd: consumer,
  })
  run(
    'node',
    ['node_modules/nitrogen/lib/index.js', '--log-level', 'warning'],
    { cwd: consumer }
  )
  for (const file of [
    'shared/c++/views/HybridTestViewComponent.cpp',
    'shared/c++/HybridBenchmarkObjectCppSpec.hpp',
    'ios/swift/HybridBenchmarkObjectSwiftKotlinSpec.swift',
    'android/kotlin/com/margelo/nitro/test/HybridBenchmarkObjectSwiftKotlinSpec.kt',
    'ios/swift/HybridTestViewSpec.swift',
    'android/kotlin/com/margelo/nitro/test/HybridTestViewSpec.kt',
  ]) {
    if (!existsSync(path.join(consumer, 'nitrogen/generated', file)))
      throw new Error(`Packed Nitrogen did not generate ${file}`)
  }
  console.log(`Validated packed RN packages and view generation in ${consumer}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkConsumer(process.argv.slice(2).map((file) => path.resolve(file)))
}
