import { copyFileSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJSON, run, writeJSON } from './lib.mjs'
import { verifyCorePackage, verifyPackageLayout, verifyReactNativePackage } from './package-layout.mjs'
import { releasePackages } from './packages.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))

export function checkConsumer(tarballs) {
  if (tarballs.length !== releasePackages.length) throw new Error('Consumer validation requires all three release tarballs')
  const packed = Object.fromEntries(
    releasePackages.map((name) => {
      const matches = tarballs.filter((file) => path.basename(file).startsWith(`${name}-`))
      if (matches.length !== 1) throw new Error(`Expected one tarball for ${name}`)
      return [name, matches[0]]
    })
  )
  for (const tarball of tarballs) {
    const entries = run('tar', ['-tzf', tarball], { capture: true }).split('\n')
    if (
      entries.some(
        (entry) => /^package\/(?:nitro|apps|docs|hermes)\//.test(entry) || /\/(?:\.git|node_modules|__tests__|\.gradle|\.cxx)\//.test(entry)
      )
    )
      throw new Error(`Development files in ${path.basename(tarball)}`)
  }
  const consumer = mkdtempSync(path.join(tmpdir(), 'nitro-release-consumer-'))
  writeJSON(path.join(consumer, 'package.json'), {
    name: 'nitro-release-consumer',
    version: '1.0.0',
    private: true,
    imports: { '#nitro/*': './nitrogen/generated/shared/javascript/*.cjs' },
  })
  run('npm', ['install', '--no-audit', '--no-fund', packed['nitro-core'], packed.nitrogen], {
    cwd: consumer,
  })
  const version = verifyCorePackage(path.join(consumer, 'node_modules/nitro-core'), { installed: true })
  const nitrogen = verifyPackageLayout(path.join(consumer, 'node_modules/nitrogen'), 'nitrogen', { installed: true })
  if (nitrogen.version !== version || nitrogen.dependencies?.['nitro-core'] !== version)
    throw new Error('Packed Nitrogen must use the matching nitro-core version')
  for (const name of ['nitro-core', 'nitrogen']) {
    const location = path.join(consumer, 'node_modules', name)
    if (lstatSync(location).isSymbolicLink()) throw new Error(`Consumer uses a workspace link for ${name}`)
    for (const entry of ['.git', 'apps', 'docs', 'nitro', 'hermes']) {
      if (existsSync(path.join(location, entry))) throw new Error(`Unexpected packaged entry: ${name}/${entry}`)
    }
  }
  for (const name of ['react-native', 'react-native-nitro-modules']) {
    if (existsSync(path.join(consumer, 'node_modules', name))) throw new Error(`Unexpected dependency: ${name}`)
  }
  const mockRuntime = `globalThis.NitroModulesProxy = { version: ${JSON.stringify(version)}, getHybridClass: () => class {} };`
  run(
    'node',
    [
      '--input-type=module',
      '-e',
      `${mockRuntime} const { NitroModules } = await import('nitro-core'); if (NitroModules !== globalThis.NitroModulesProxy) throw Error('Unexpected runtime')`,
    ],
    { cwd: consumer }
  )
  run(
    'node',
    ['-e', `${mockRuntime} if (require('nitro-core').NitroModules !== globalThis.NitroModulesProxy) throw Error('Unexpected runtime')`],
    { cwd: consumer }
  )
  writeFileSync(
    path.join(consumer, 'Math.nitro.ts'),
    `import { iOS, type HybridObject } from 'nitro-core'
@iOS({ language: 'swift', allowMultipleImplementations: true })
export declare class Math extends HybridObject {
  add(a: number, b: number): number
  greet(name: string): string
}
`
  )
  writeFileSync(path.join(consumer, 'esm.mts'), "export type { HybridObject, NitroModulesProxy } from 'nitro-core'\n")
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
    environment: 'bare',
    cxxNamespace: ['releasecheck'],
    apple: { appleModuleName: 'ReleaseCheck' },
    android: {
      androidNamespace: ['releasecheck'],
      androidCxxLibName: 'ReleaseCheck',
    },
    ignorePaths: ['**/node_modules'],
  })
  const tsc = fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url))
  run('node', ['node_modules/nitrogen/lib/index.js', '--log-level', 'warning'], { cwd: consumer })
  run('node', [tsc, '--project', path.join(consumer, 'tsconfig.json')], {
    cwd: consumer,
  })
  const generated = path.join(consumer, 'nitrogen/generated')
  const swiftSpec = readFileSync(path.join(generated, 'apple/swift/HybridMathSpec.swift'), 'utf8')
  for (const signature of ['func add(a: Double, b: Double) throws -> Double', 'func greet(name: String) throws -> String']) {
    if (!swiftSpec.includes(signature)) throw new Error(`Packed Nitrogen did not generate the Swift signature: ${signature}`)
  }
  const bridgeHeader = readFileSync(path.join(generated, 'apple/c++/include/ReleaseCheck/private/HybridMathSpecSwift.hpp'), 'utf8')
  for (const signature of ['double add(double a, double b);', 'swift::String greet(const swift::String& name);']) {
    if (!bridgeHeader.includes(signature)) throw new Error(`Packed Nitrogen did not generate the Swift C++ bridge signature: ${signature}`)
  }
  if (bridgeHeader.includes('std::string greet(')) throw new Error('Packed Nitrogen generated a native C++ method for the Swift-only spec')
  const bridgeSource = readFileSync(path.join(generated, 'apple/c++/HybridMathSpecSwift.cpp'), 'utf8')
  for (const method of ['add', 'greet']) {
    if (!bridgeSource.includes(`clazz.registerHybridMethod("${method}", &HybridMathSpecSwift::${method});`))
      throw new Error(`Packed Nitrogen did not register the Swift ${method} method`)
  }
  for (const file of [
    'shared/c++/include/ReleaseCheck/HybridMathSpec.hpp',
    'shared/c++/HybridMathSpec.cpp',
    'shared/c++/include/ReleaseCheck/HybridMathSpecCxx.hpp',
    'apple/c++/HybridMathSpecCxx.apple.cpp',
  ]) {
    if (existsSync(path.join(generated, file))) throw new Error(`Packed Nitrogen generated an unused C++ spec or adapter: ${file}`)
  }
  run(
    'node',
    ['-e', `${mockRuntime} if (typeof require('#nitro/Math').Math !== 'function') throw Error('Generated HybridObject class is missing')`],
    { cwd: consumer }
  )
  console.log(`Validated packed core packages in ${consumer}`)
  checkReactNativeConsumer(packed, version)
}

function checkReactNativeConsumer(packed, version) {
  const consumer = mkdtempSync(path.join(tmpdir(), 'nitro-rn-release-consumer-'))
  const app = readJSON(path.join(root, 'tests/react-native/apps/example/package.json'))
  const wrapper = readJSON(path.join(root, 'packages/react-native-nitro-modules/package.json'))
  writeJSON(path.join(consumer, 'package.json'), {
    name: 'nitro-rn-release-consumer',
    private: true,
    imports: { '#nitro/*': './nitrogen/generated/shared/javascript/*.cjs' },
    dependencies: {
      'react': app.dependencies.react,
      'react-native': app.dependencies['react-native'],
      '@types/react': wrapper.devDependencies['@types/react'],
      'typescript': readJSON(path.join(root, 'package.json')).devDependencies.typescript,
      ...Object.fromEntries(Object.entries(packed).map(([name, file]) => [name, `file:${file}`])),
    },
  })
  // Exercise normal consumer lifecycle scripts outside the monorepo.
  run('npm', ['install', '--no-audit', '--no-fund'], { cwd: consumer })
  for (const name of releasePackages) {
    const pkg = verifyPackageLayout(path.join(consumer, 'node_modules', name), name, { installed: true })
    if (pkg.version !== version) throw new Error(`Packed ${name} has a different release version`)
  }
  verifyReactNativePackage(path.join(consumer, 'node_modules/react-native-nitro-modules'), path.join(consumer, 'node_modules/nitro-core'), {
    installed: true,
  })
  mkdirSync(path.join(consumer, 'src'))
  for (const filename of ['TestView.nitro.ts', 'BenchmarkObject.nitro.ts']) {
    copyFileSync(
      path.join(root, 'tests/react-native/packages/react-native-nitro-test', 'src/specs', filename),
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
  const config = readJSON(path.join(root, 'tests/react-native/packages/react-native-nitro-test/nitro.json'))
  writeJSON(path.join(consumer, 'nitro.json'), config)
  run('node', ['node_modules/nitrogen/lib/index.js', '--log-level', 'warning'], { cwd: consumer })
  run('node', ['node_modules/typescript/bin/tsc', '--noEmit'], {
    cwd: consumer,
  })
  for (const file of [
    'apple/c++/views/HybridTestViewComponent.cpp',
    'android/c++/views/HybridTestViewComponent.cpp',
    'shared/c++/include/NitroTest/HybridBenchmarkObjectCppSpec.hpp',
    'apple/swift/HybridBenchmarkObjectSwiftKotlinSpec.swift',
    'apple/swift/HybridTestViewSpec.swift',
  ]) {
    if (!existsSync(path.join(consumer, 'nitrogen/generated', file))) throw new Error(`Packed Nitrogen did not generate ${file}`)
  }
  console.log(`Validated packed RN packages and view generation in ${consumer}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  checkConsumer(process.argv.slice(2).map((file) => path.resolve(file)))
}
