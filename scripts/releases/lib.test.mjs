import assert from 'node:assert/strict'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { gzipSync } from 'node:zlib'
import { releasePackages } from './packages.mjs'
import { corePackageFiles, verifyCorePackage } from './package-layout.mjs'
import {
  assertValidatedCommit,
  compareVersions,
  downloadRelease,
  fileIntegrity,
  finishRelease,
  getRelease,
  git,
  isNightly,
  nightlyVersion,
  npmTagFor,
  parseVersion,
  publishPackages,
  registryPackage,
  run,
  saveDraft,
  validateManifest,
  versionFromTag,
} from './lib.mjs'

test('publication requires CI for the resolved release commit', () => {
  const releaseCommit = 'a'.repeat(40)
  const newerMainCommit = 'b'.repeat(40)
  assert.doesNotThrow(() => assertValidatedCommit(releaseCommit, releaseCommit))
  for (const validated of [
    undefined,
    '',
    releaseCommit.slice(0, 12),
    newerMainCommit,
  ]) {
    assert.throws(
      () => assertValidatedCommit(releaseCommit, validated),
      /Required CI has not validated release commit/
    )
  }
})

test('unstaged release changes fail with their file paths', (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nitro-release-git-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  git(['init', '--quiet'], { cwd: directory })
  for (const file of ['version.txt', 'unexpected-project.pbxproj']) {
    writeFileSync(path.join(directory, file), 'before\n')
  }
  git(['add', '.'], { cwd: directory })
  for (const file of ['version.txt', 'unexpected-project.pbxproj']) {
    writeFileSync(path.join(directory, file), 'after\n')
  }
  git(['add', 'version.txt'], { cwd: directory })

  assert.throws(
    () => git(['diff', '--exit-code'], { cwd: directory }),
    (error) => {
      assert.match(error.message, /git diff --exit-code failed \(1\)/)
      assert.match(error.message, /unexpected-project\.pbxproj/)
      assert.doesNotMatch(error.message, /version\.txt/)
      return true
    }
  )
  git(['add', 'unexpected-project.pbxproj'], { cwd: directory })
  assert.equal(git(['diff', '--exit-code'], { cwd: directory }), '')
})

function installedCoreFixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nitro-packed-core-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  for (const relative of corePackageFiles) {
    const file = path.join(directory, relative)
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, 'fixture\n')
  }
  writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'nitro-core', version: '0.37.2-beta.1' })
  )
  writeFileSync(
    path.join(directory, 'native/cpp/utils/NitroDefines.hpp'),
    '#define NITRO_VERSION "0.37.2-beta.1"\n'
  )
  writeFileSync(
    path.join(directory, 'js/src/version.ts'),
    "export const version = '0.37.2-beta.1'\n"
  )
  return directory
}

test('packed core contains native sources and matching JS/native versions', (t) => {
  assert.equal(verifyCorePackage(installedCoreFixture(t)), '0.37.2-beta.1')
})

test('packed core rejects missing native sources', (t) => {
  const directory = installedCoreFixture(t)
  rmSync(path.join(directory, 'native/apple/core/HybridObject.swift'))
  assert.throws(() => verifyCorePackage(directory), /ENOENT/)
})

test('packed core rejects a JS/native version mismatch', (t) => {
  const directory = installedCoreFixture(t)
  writeFileSync(
    path.join(directory, 'native/cpp/utils/NitroDefines.hpp'),
    '#define NITRO_VERSION "0.37.1"\n'
  )
  assert.throws(() => verifyCorePackage(directory), /Native version/)
})

test('packed core rejects linked implementation sources and build caches', (t) => {
  const directory = installedCoreFixture(t)
  symlinkSync(
    path.join(directory, 'js/src/index.ts'),
    path.join(directory, 'js/src/linked.ts')
  )
  assert.throws(() => verifyCorePackage(directory), /symlink/)
  rmSync(path.join(directory, 'js/src/linked.ts'))
  mkdirSync(path.join(directory, 'native/android/.gradle'))
  assert.throws(() => verifyCorePackage(directory), /Development files/)
})

function releaseFixture(t, { version = '0.37.2', npmTag = 'latest' } = {}) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'nitro-release-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const manifest = {
    schema: 1,
    repository: 'margelo/nitro',
    tag: `v${version}`,
    version,
    npmTag,
    commit: 'a'.repeat(40),
    sourceCommit: 'b'.repeat(40),
    packages: releasePackages.map((name) => {
      const filename = `${name}-${version}.tgz`
      // The release helpers hash these bytes; package inspection is tested by CI.
      writeFileSync(
        path.join(directory, filename),
        gzipSync(JSON.stringify({ name, version }))
      )
      return {
        name,
        version,
        filename,
        integrity: fileIntegrity(path.join(directory, filename)),
      }
    }),
  }
  return { directory, manifest }
}

function registryFixture(manifest) {
  const versions = new Map()
  const tags = new Map()
  const publishes = []
  const publicationTags = []
  const key = (name, version) => `${name}@${version}`
  const record = (pkg) => ({
    version: pkg.version,
    dist: { integrity: pkg.integrity },
  })
  const lookup = async (name, version) =>
    versions.get(key(name, version)) ?? tags.get(key(name, version)) ?? null
  const execute = (command, args) => {
    assert.equal(command, 'npm')
    assert.equal(args[0], 'publish')
    const pkg = manifest.packages.find(
      (entry) => entry.filename === path.basename(args[1])
    )
    assert.ok(pkg, 'only a recorded tarball may be published')
    const npmTag = args[3]
    assert.ok(
      npmTag === manifest.npmTag ||
        (isNightly(manifest.version) &&
          npmTag === `nightly-${manifest.commit.slice(0, 12)}`),
      'publish must use the selected channel or the older nightly fallback'
    )
    assert.deepEqual(args.slice(2), [
      '--tag',
      npmTag,
      '--access',
      'public',
      '--provenance',
      '--ignore-scripts',
    ])
    publishes.push(pkg.name)
    publicationTags.push({ name: pkg.name, npmTag })
    versions.set(key(pkg.name, pkg.version), record(pkg))
    tags.set(key(pkg.name, npmTag), record(pkg))
  }
  return {
    versions,
    tags,
    publishes,
    publicationTags,
    lookup,
    execute,
    key,
    record,
  }
}

test('nightly versions are deterministic for a source commit and workflow run', () => {
  const source = 'abcdef012345' + 'a'.repeat(28)
  const version = nightlyVersion('0.37.1', 42, source)
  assert.equal(version, '0.37.2-nightly.42.gabcdef012345')
  assert.equal(nightlyVersion('0.37.1', '42', source), version)
  assert.equal(
    nightlyVersion('0.38.0-beta.1', 42, source),
    '0.38.0-nightly.42.gabcdef012345'
  )
  assert.equal(
    nightlyVersion('1.0.0-rc.2', 42, source),
    '1.0.0-nightly.42.gabcdef012345'
  )
  assert.equal(
    nightlyVersion('0.37.1', 42, '001234567890' + 'a'.repeat(28)),
    '0.37.2-nightly.42.g001234567890'
  )
  assert.equal(
    compareVersions(nightlyVersion('0.37.1', 43, source), version),
    1
  )
  assert.equal(compareVersions(version, '0.37.2'), -1)
  assert.ok(isNightly(version))
  assert.equal(isNightly('0.37.2'), false)
  assert.equal(isNightly('0.37.2-beta.nightly'), false)
  assert.equal(isNightly('0.37.2-nightly-other.42'), false)
})

test('nightly versions require a positive run number and full source SHA', () => {
  const source = 'b'.repeat(40)
  for (const runNumber of [
    0,
    -1,
    1.2,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    '',
    '01',
    '1.2',
    '1e2',
    undefined,
    null,
    true,
  ]) {
    assert.throws(
      () => nightlyVersion('0.37.1', runNumber, source),
      /positive integer/
    )
  }
  for (const commit of [
    '',
    'main',
    'b'.repeat(12),
    'g'.repeat(40),
    `../${source}`,
    undefined,
  ]) {
    assert.throws(
      () => nightlyVersion('0.37.1', 1, commit),
      /source commit SHA/
    )
  }
  assert.throws(
    () => nightlyVersion('0.37', 1, source),
    /Invalid release version/
  )
  assert.throws(
    () => nightlyVersion(`0.0.${Number.MAX_SAFE_INTEGER}`, 1, source),
    /Invalid release version/
  )
})

test('nightly manifests bind the nightly channel and full source commit', (t) => {
  const version = nightlyVersion('0.37.1', 42, 'b'.repeat(40))
  const { manifest } = releaseFixture(t, { version, npmTag: 'nightly' })
  const options = {
    repository: manifest.repository,
    tag: manifest.tag,
    packages: releasePackages,
  }
  assert.equal(validateManifest(manifest, options), manifest)
  for (const override of [
    { sourceCommit: undefined },
    { sourceCommit: 'main' },
    { npmTag: 'beta' },
    { npmTag: 'latest' },
  ]) {
    assert.throws(() => validateManifest({ ...manifest, ...override }, options))
  }
  const stable = releaseFixture(t).manifest
  assert.throws(
    () =>
      validateManifest(
        { ...stable, npmTag: 'nightly' },
        { ...options, tag: stable.tag }
      ),
    /reserved for nightly versions/
  )
})

test('new nightlies update nightly without changing stable latest', async (t) => {
  const version = nightlyVersion('0.37.1', 42, 'b'.repeat(40))
  const { manifest, directory } = releaseFixture(t, {
    version,
    npmTag: 'nightly',
  })
  const registry = registryFixture(manifest)
  for (const pkg of manifest.packages) {
    registry.tags.set(registry.key(pkg.name, 'latest'), { version: '0.37.1' })
    registry.tags.set(registry.key(pkg.name, 'nightly'), {
      version: nightlyVersion('0.37.1', 41, 'c'.repeat(40)),
    })
  }
  await publishPackages(manifest, directory, registry)
  for (const pkg of manifest.packages) {
    assert.equal((await registry.lookup(pkg.name, 'latest')).version, '0.37.1')
    assert.equal((await registry.lookup(pkg.name, 'nightly')).version, version)
  }
  assert.deepEqual(
    registry.publicationTags,
    manifest.packages.map(({ name }) => ({ name, npmTag: 'nightly' }))
  )
})

test('an older nightly publishes under a commit tag without moving nightly backwards', async (t) => {
  const version = nightlyVersion('0.37.1', 41, 'b'.repeat(40))
  const { manifest, directory } = releaseFixture(t, {
    version,
    npmTag: 'nightly',
  })
  const registry = registryFixture(manifest)
  const newer = nightlyVersion('0.37.1', 42, 'c'.repeat(40))
  for (const pkg of manifest.packages) {
    registry.tags.set(registry.key(pkg.name, 'latest'), { version: '0.37.1' })
    registry.tags.set(registry.key(pkg.name, 'nightly'), { version: newer })
  }
  await publishPackages(manifest, directory, registry)
  const fallbackTag = `nightly-${manifest.commit.slice(0, 12)}`
  assert.deepEqual(
    registry.publicationTags,
    manifest.packages.map(({ name }) => ({ name, npmTag: fallbackTag }))
  )
  for (const pkg of manifest.packages) {
    assert.equal((await registry.lookup(pkg.name, 'latest')).version, '0.37.1')
    assert.equal((await registry.lookup(pkg.name, 'nightly')).version, newer)
    assert.equal(
      (await registry.lookup(pkg.name, fallbackTag)).version,
      version
    )
  }
  await publishPackages(manifest, directory, registry)
  assert.equal(
    registry.publishes.length,
    3,
    'retry must not republish or retag the older nightly'
  )
})

test('fresh publications and checkpoint retries preserve GitHub provenance identity', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  const keys = [
    'GITHUB_SHA',
    'GITHUB_REF',
    'GITHUB_WORKFLOW_SHA',
    'GITHUB_WORKFLOW_REF',
  ]
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  )
  try {
    // A fresh run starts at the source commit; recovery may run newer release
    // tooling. Neither workflow's signed identity is the saved release tag.
    for (const source of [manifest.sourceCommit, 'c'.repeat(40)]) {
      const identity = {
        GITHUB_SHA: source,
        GITHUB_REF: 'refs/heads/main',
        GITHUB_WORKFLOW_SHA: source,
        GITHUB_WORKFLOW_REF:
          'margelo/nitro/.github/workflows/release.yml@refs/heads/main',
      }
      Object.assign(process.env, identity)
      const registry = registryFixture(manifest)
      await publishPackages(manifest, directory, {
        lookup: registry.lookup,
        execute: (command, args, options) => {
          const inherited = JSON.parse(
            run(
              process.execPath,
              [
                '-e',
                `console.log(JSON.stringify(Object.fromEntries(${JSON.stringify(keys)}.map(key => [key, process.env[key]]))))`,
              ],
              { ...options, capture: true }
            )
          )
          assert.deepEqual(inherited, identity)
          registry.execute(command, args)
        },
      })
      assert.deepEqual(registry.publishes, releasePackages)
    }
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('versions require exact SemVer without build metadata or unsafe input', () => {
  for (const version of ['0.37.2', '1.0.0-beta.1', '1.0.0-0', '1.0.0-beta-2']) {
    assert.doesNotThrow(() => parseVersion(version))
  }
  for (const version of [
    undefined,
    null,
    1,
    '',
    'v1.0.0',
    'patch',
    '^1.0.0',
    '1.0',
    '01.0.0',
    '1.01.0',
    '1.0.00',
    '1.0.0-beta.01',
    '1.0.0+build.1',
    '1.0.0-',
    '1.0.0-beta..1',
    '9007199254740992.0.0',
    `1.0.0-${'beta'.repeat(70)}`,
    '../1.0.0',
    '1.0.0\n',
    '1.0.0;echo nope',
    '$(echo 1.0.0)',
  ]) {
    assert.throws(() => parseVersion(version), undefined, String(version))
  }
})

test('GitHub release tags select an exact version without accepting branch or path input', () => {
  assert.equal(versionFromTag('v0.38.0'), '0.38.0')
  assert.equal(versionFromTag('v0.38.0-beta.1'), '0.38.0-beta.1')
  for (const tag of [
    undefined,
    'main',
    '0.38.0',
    'v^0.38.0',
    'v0.38.0+build',
    'v0.38.0\n',
    '../v0.38.0',
  ])
    assert.throws(() => versionFromTag(tag))
})

test('release packages include the RN adapter after its dependencies', () => {
  assert.deepEqual(releasePackages, [
    'nitro-core',
    'nitrogen',
    'react-native-nitro-modules',
  ])
})

test('version order follows SemVer prerelease precedence, including large identifiers', () => {
  const ordered = [
    '1.0.0-alpha',
    '1.0.0-alpha.1',
    '1.0.0-alpha.beta',
    '1.0.0-beta',
    '1.0.0-beta.2',
    '1.0.0-beta.11',
    '1.0.0-rc.1',
    '1.0.0',
    '1.0.1',
    '1.1.0',
    '2.0.0',
  ]
  for (let i = 0; i < ordered.length; i++) {
    assert.equal(compareVersions(ordered[i], ordered[i]), 0)
    if (i > 0) {
      assert.equal(compareVersions(ordered[i - 1], ordered[i]), -1)
      assert.equal(compareVersions(ordered[i], ordered[i - 1]), 1)
    }
  }
  assert.equal(
    compareVersions('1.0.0-9007199254740992', '1.0.0-9007199254740993'),
    -1
  )
  assert.equal(compareVersions('1.0.0-9', '1.0.0-a'), -1)
})

test('npm tag defaults preserve stable and prerelease channels', () => {
  assert.equal(npmTagFor('0.37.2'), 'latest')
  assert.equal(npmTagFor('0.38.0-beta.1'), 'beta')
  assert.equal(npmTagFor('0.38.0-rc.1'), 'rc')
  assert.equal(npmTagFor('0.38.0-1'), 'next')
  assert.equal(npmTagFor('0.38.0-beta.1', 'next'), 'next')
  assert.equal(npmTagFor('0.38.0', 'next'), 'next')
  assert.throws(
    () => npmTagFor('0.38.0-beta.1', 'latest'),
    /prereleases cannot use latest/
  )
  for (const tag of [
    '../latest',
    '--provenance',
    'latest\n',
    'beta;echo',
    'BETA',
    '1.2.3',
    'v1',
    'x',
  ]) {
    assert.throws(() => npmTagFor('0.38.0', tag), undefined, tag)
  }
})

test('manifest validation binds artifacts to the expected repository, tag and package order', (t) => {
  const { manifest } = releaseFixture(t)
  const options = {
    repository: 'margelo/nitro',
    tag: manifest.tag,
    packages: releasePackages,
  }
  assert.equal(validateManifest(manifest, options), manifest)
  const changes = [
    (copy) => {
      copy.schema = 2
    },
    (copy) => {
      copy.repository = 'someone/nitro'
    },
    (copy) => {
      copy.tag = 'v0.37.3'
    },
    (copy) => {
      copy.commit = 'main'
    },
    (copy) => {
      copy.version = '0.37.3'
    },
    (copy) => {
      copy.npmTag = ''
    },
    (copy) => {
      copy.packages.reverse()
    },
    (copy) => {
      copy.packages.pop()
    },
    (copy) => {
      copy.packages[0].version = '0.37.3'
    },
    (copy) => {
      copy.packages[0].filename = '../nitro-core-0.37.2.tgz'
    },
    (copy) => {
      copy.packages[0].integrity = 'sha512-corrupt'
    },
  ]
  for (const change of changes) {
    const copy = structuredClone(manifest)
    change(copy)
    assert.throws(() => validateManifest(copy, options))
  }
})

test('registry lookup reads versions and tags through npm with tarball integrity', async () => {
  const pkg = {
    version: '0.38.0-beta.1',
    dist: { integrity: 'sha512-recorded' },
  }
  for (const version of [pkg.version, 'beta']) {
    const published = await registryPackage(
      '@scope/core',
      version,
      (command, args, options) => {
        assert.equal(command, 'npm')
        assert.deepEqual(args, [
          'view',
          `@scope/core@${version}`,
          '--json',
          '--prefer-online',
        ])
        assert.equal(options.encoding, 'utf8')
        return { status: 0, stdout: JSON.stringify(pkg), stderr: '' }
      }
    )
    assert.deepEqual(published, pkg)
  }
})

test('registry lookup recognizes npm E404 and a missing latest tag', async () => {
  assert.equal(
    await registryPackage('nitro-core', '0.37.2', () => ({
      status: 1,
      stdout: JSON.stringify({ error: { code: 'E404' } }),
      stderr: 'npm error code E404',
    })),
    null
  )
  assert.equal(
    await registryPackage('nitro-core', 'latest', () => ({
      status: 0,
      stdout: '',
      stderr: '',
    })),
    null
  )
})

test('registry auth, rate limit, server and exhausted network failures propagate', async () => {
  for (const code of [
    'E401',
    'E403',
    'E429',
    'E500',
    'E503',
    'EPIPE',
    'ECONNRESET',
  ]) {
    await assert.rejects(
      registryPackage('nitro-core', '0.37.2', () => ({
        status: 1,
        stdout: JSON.stringify({ error: { code } }),
        stderr: `npm error code ${code}`,
      })),
      new RegExp(`npm view nitro-core@0.37.2 failed \\(1\\)\\n.*${code}`)
    )
  }
  const error = new Error('spawn npm ENOENT')
  await assert.rejects(
    registryPackage('nitro-core', '0.37.2', () => ({ error })),
    error
  )
})

test('registry lookup rejects malformed metadata and unexpected empty output', async () => {
  for (const status of [0, 1]) {
    for (const stdout of ['', 'not JSON']) {
      await assert.rejects(
        registryPackage('nitro-core', '0.37.2', () => ({
          status,
          stdout,
          stderr: 'npm error E404 in unstructured output',
        })),
        /npm view nitro-core@0.37.2: invalid JSON/
      )
    }
  }
  for (const metadata of [
    null,
    {},
    [],
    '0.37.2',
    { error: { code: 'E404' } },
  ]) {
    await assert.rejects(
      registryPackage('nitro-core', '0.37.2', () => ({
        status: 0,
        stdout: JSON.stringify(metadata),
      })),
      /missing package version/
    )
  }
  await assert.rejects(
    registryPackage('nitro-core', 'latest', () => ({
      status: 1,
      stdout: '',
      stderr: 'npm error EPIPE',
    })),
    /invalid JSON\n.*EPIPE/
  )
})

test('partial publication resumes with the same artifacts and only publishes the missing package', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  const registry = registryFixture(manifest)
  const attempts = []
  let failNitrogen = true
  const execute = (command, args) => {
    const filename = path.basename(args[1])
    attempts.push(filename)
    if (filename.startsWith('nitrogen-') && failNitrogen) {
      failNitrogen = false
      throw new Error('npm temporarily unavailable')
    }
    registry.execute(command, args)
  }
  await assert.rejects(
    publishPackages(manifest, directory, { lookup: registry.lookup, execute }),
    /temporarily unavailable/
  )
  assert.deepEqual(registry.publishes, ['nitro-core'])
  await publishPackages(manifest, directory, {
    lookup: registry.lookup,
    execute,
  })
  assert.deepEqual(registry.publishes, releasePackages)
  assert.deepEqual(attempts, [
    'nitro-core-0.37.2.tgz',
    'nitrogen-0.37.2.tgz',
    'nitrogen-0.37.2.tgz',
    'react-native-nitro-modules-0.37.2.tgz',
  ])
  await publishPackages(manifest, directory, {
    lookup: registry.lookup,
    execute,
  })
  assert.equal(attempts.length, 4, 'a fully published release is a no-op')
})

test('a conflict in the second package prevents publishing either package', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  const registry = registryFixture(manifest)
  const nitrogen = manifest.packages[1]
  registry.versions.set(registry.key(nitrogen.name, nitrogen.version), {
    version: nitrogen.version,
    dist: { integrity: 'sha512-other' },
  })
  await assert.rejects(
    publishPackages(manifest, directory, registry),
    /different tarball/
  )
  assert.deepEqual(registry.publishes, [])
})

test('a conflicting RN tarball prevents publishing core or Nitrogen', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  const registry = registryFixture(manifest)
  registry.versions.set(
    registry.key('react-native-nitro-modules', manifest.version),
    {
      dist: { integrity: 'sha512-other' },
    }
  )
  await assert.rejects(
    publishPackages(manifest, directory, registry),
    /different tarball/
  )
  assert.deepEqual(registry.publishes, [])
})

test('a failed RN publish resumes only the adapter from the saved three-package release', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  const registry = registryFixture(manifest)
  await assert.rejects(
    publishPackages(manifest, directory, {
      lookup: registry.lookup,
      execute: (command, args) => {
        if (path.basename(args[1]).startsWith('react-native-nitro-modules-'))
          throw new Error('RN publish interrupted')
        registry.execute(command, args)
      },
    }),
    /RN publish interrupted/
  )
  assert.deepEqual(registry.publishes, ['nitro-core', 'nitrogen'])
  await publishPackages(manifest, directory, registry)
  assert.deepEqual(registry.publishes, releasePackages)
})

test('corrupt saved tarballs fail before registry access or publication', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  writeFileSync(path.join(directory, manifest.packages[1].filename), 'corrupt')
  await assert.rejects(
    publishPackages(manifest, directory, {
      lookup: () => assert.fail('must verify files before reading npm'),
      execute: () => assert.fail('must not publish corrupt files'),
    }),
    /Tarball integrity mismatch/
  )
})

test('preflight registry failures prevent publication', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  const registry = registryFixture(manifest)
  await assert.rejects(
    publishPackages(manifest, directory, {
      lookup: async (name) => {
        if (name === 'nitrogen') throw new Error('npm registry HTTP 503')
        return null
      },
      execute: registry.execute,
    }),
    /HTTP 503/
  )
  assert.deepEqual(registry.publishes, [])
})

test('an unpublished older release cannot move latest backwards', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  const registry = registryFixture(manifest)
  registry.tags.set(registry.key('nitrogen', 'latest'), { version: '0.38.0' })
  await assert.rejects(
    publishPackages(manifest, directory, registry),
    /tag backwards from 0.38.0/
  )
  assert.deepEqual(registry.publishes, [])
})

test('an already published older release resumes without changing the newer latest tag', async (t) => {
  const { manifest, directory } = releaseFixture(t)
  const registry = registryFixture(manifest)
  for (const pkg of manifest.packages) {
    registry.versions.set(
      registry.key(pkg.name, pkg.version),
      registry.record(pkg)
    )
    registry.tags.set(registry.key(pkg.name, 'latest'), { version: '0.38.0' })
  }
  await publishPackages(manifest, directory, registry)
  assert.deepEqual(registry.publishes, [])
  assert.equal(
    (await registry.lookup('nitro-core', 'latest')).version,
    '0.38.0'
  )
})

test('prereleases publish only to their selected channel', async (t) => {
  const { manifest, directory } = releaseFixture(t, {
    version: '0.38.0-beta.1',
    npmTag: 'beta',
  })
  const registry = registryFixture(manifest)
  registry.tags.set(registry.key('nitro-core', 'latest'), { version: '1.0.0' })
  await publishPackages(manifest, directory, registry)
  assert.equal((await registry.lookup('nitro-core', 'latest')).version, '1.0.0')
  assert.equal(
    (await registry.lookup('nitro-core', 'beta')).version,
    manifest.version
  )
})

test('successful publishes finalize fresh and resumed releases without registry visibility', async (t) => {
  for (const resume of [false, true]) {
    const { manifest, directory } = releaseFixture(t)
    const registry = registryFixture(manifest)
    const github = githubFixture(manifest)
    const release = saveDraft(manifest, directory, 'nitro-release.json', github)
    if (resume) {
      const core = manifest.packages[0]
      registry.versions.set(
        registry.key(core.name, core.version),
        registry.record(core)
      )
    }
    await publishPackages(manifest, directory, {
      lookup: (name, version) => {
        assert.equal(
          registry.publishes.length,
          0,
          'successful uploads must not depend on further registry reads'
        )
        return registry.lookup(name, version)
      },
      execute: (command, args) => {
        registry.execute(command, args)
        const name = registry.publishes.at(-1)
        // npm accepted the upload, but its read API still returns E404.
        registry.versions.delete(registry.key(name, manifest.version))
        registry.tags.delete(registry.key(name, manifest.npmTag))
      },
    })
    finishRelease(manifest, { release, request: github.request })
    const expected = resume ? releasePackages.slice(1) : releasePackages
    assert.deepEqual(registry.publishes, expected)
    assert.equal(github.releases[0].draft, false)
    for (const name of expected)
      assert.equal(await registry.lookup(name, manifest.version), null)
    for (const pkg of manifest.packages)
      assert.equal(
        fileIntegrity(path.join(directory, pkg.filename)),
        pkg.integrity
      )
  }
})

function githubFixture(manifest) {
  const releases = []
  const bytes = new Map()
  const calls = []
  let nextID = 1
  const repo = `repos/${manifest.repository}`
  const addRelease = (overrides = {}) => {
    const release = {
      id: nextID++,
      tag_name: manifest.tag,
      draft: true,
      assets: [],
      ...overrides,
    }
    releases.push(release)
    return release
  }
  const request = (endpoint, options = {}) => {
    calls.push({ endpoint, ...options })
    if (endpoint.startsWith(`${repo}/releases?`)) {
      const page = Number(
        new URLSearchParams(endpoint.split('?')[1]).get('page')
      )
      return structuredClone(releases.slice((page - 1) * 100, page * 100))
    }
    if (endpoint === `${repo}/git/ref/tags/${manifest.tag}`) return {}
    if (endpoint === `${repo}/releases` && options.method === 'POST') {
      return structuredClone(addRelease({ draft: options.body.draft }))
    }
    if (endpoint === `${repo}/releases/latest`) return null
    if (options.method === 'DELETE') {
      const id = Number(endpoint.split('/').at(-1))
      assert.ok(bytes.delete(id), 'only an existing asset can be deleted')
      for (const release of releases)
        release.assets = release.assets.filter((asset) => asset.id !== id)
      return null
    }
    if (options.method === 'PATCH') {
      const release = releases.find(
        (entry) => endpoint === `${repo}/releases/${entry.id}`
      )
      assert.ok(release, 'finalization must address the selected release ID')
      Object.assign(release, options.body)
      return structuredClone(release)
    }
    assert.fail(`Unexpected GitHub request: ${endpoint}`)
  }
  const upload = (repository, selected, filename) => {
    assert.equal(repository, manifest.repository)
    const release = releases.find((entry) => entry.id === selected.id)
    assert.ok(release)
    const name = path.basename(filename)
    assert.ok(
      !release.assets.some((asset) => asset.name === name),
      'duplicate asset upload'
    )
    const asset = { id: nextID++, name }
    calls.push({ upload: name, releaseID: release.id })
    release.assets.push(asset)
    bytes.set(asset.id, readFileSync(filename))
    return structuredClone(asset)
  }
  const download = (repository, asset, destination) => {
    assert.equal(repository, manifest.repository)
    calls.push({ download: asset.id })
    assert.ok(bytes.has(asset.id))
    writeFileSync(destination, bytes.get(asset.id))
  }
  const lookup = (repository, tag) => getRelease(repository, tag, { request })
  return {
    releases,
    bytes,
    calls,
    addRelease,
    request,
    upload,
    download,
    lookup,
  }
}

test('draft lookup scans all pages and selects the exact tag checkpoint past an empty duplicate', (t) => {
  const { manifest } = releaseFixture(t)
  const github = githubFixture(manifest)
  github.addRelease()
  for (let i = 0; i < 99; i++)
    github.addRelease({ tag_name: `${manifest.tag}-${i}` })
  const original = github.addRelease({
    assets: [{ id: 500, name: 'nitro-release.json' }],
  })
  assert.deepEqual(github.lookup(manifest.repository, manifest.tag), original)
  assert.deepEqual(
    github.calls.map((call) => call.endpoint),
    [
      'repos/margelo/nitro/releases?per_page=100&page=1',
      'repos/margelo/nitro/releases?per_page=100&page=2',
    ]
  )
})

test('draft lookup detects conflicting checkpoints even after the first matching page', (t) => {
  const { manifest } = releaseFixture(t)
  const github = githubFixture(manifest)
  github.addRelease({ assets: [{ id: 500, name: 'nitro-release.json' }] })
  for (let i = 0; i < 99; i++)
    github.addRelease({ tag_name: `${manifest.tag}-${i}` })
  github.addRelease({ assets: [{ id: 501, name: 'nitro-release.json' }] })
  assert.throws(
    () => github.lookup(manifest.repository, manifest.tag),
    /Ambiguous releases/
  )
})

test('lookup distinguishes missing, incomplete, published and ambiguous releases', (t) => {
  const { manifest } = releaseFixture(t)
  const github = githubFixture(manifest)
  assert.equal(github.lookup(manifest.repository, manifest.tag), null)
  const release = github.addRelease()
  assert.deepEqual(github.lookup(manifest.repository, manifest.tag), release)
  release.draft = false
  assert.deepEqual(github.lookup(manifest.repository, manifest.tag), release)
  github.addRelease()
  assert.throws(
    () => github.lookup(manifest.repository, manifest.tag),
    /Ambiguous releases/
  )
})

test('lookup errors cannot be mistaken for an absent draft', () => {
  for (const status of [401, 403, 404, 503]) {
    assert.throws(
      () =>
        getRelease('margelo/nitro', 'v0.37.2', {
          request: () => {
            throw new Error(`GitHub HTTP ${status}`)
          },
        }),
      new RegExp(`HTTP ${status}`)
    )
  }
})

test('finishing a draft promotes only stable releases newer than GitHub Latest', (t) => {
  const { manifest, directory } = releaseFixture(t)
  for (const [current, expectedLatest] of [
    [null, true],
    [{ tag_name: 'v0.37.1' }, true],
    [{ tag_name: 'v0.37.2' }, true],
    [{ tag_name: 'v0.38.0' }, false],
  ]) {
    const github = githubFixture(manifest)
    const release = saveDraft(manifest, directory, 'nitro-release.json', github)
    finishRelease(manifest, {
      release,
      request: (endpoint, options) => {
        if (endpoint.endsWith('/latest')) {
          assert.deepEqual(options, { allowNotFound: true })
          return current
        }
        return github.request(endpoint, options)
      },
    })
    assert.deepEqual(github.calls.at(-1), {
      endpoint: `repos/${manifest.repository}/releases/${release.id}`,
      method: 'PATCH',
      body: { draft: false, make_latest: String(expectedLatest) },
    })
  }
})

test('prereleases and non-latest channels never become GitHub Latest', (t) => {
  for (const options of [
    { version: '0.38.0-beta.1', npmTag: 'beta' },
    { version: '0.38.0', npmTag: 'next' },
  ]) {
    const { manifest, directory } = releaseFixture(t, options)
    const github = githubFixture(manifest)
    const release = saveDraft(manifest, directory, 'nitro-release.json', github)
    finishRelease(manifest, { release, request: github.request })
    assert.equal(github.calls.at(-1).body.make_latest, 'false')
    assert.ok(!github.calls.some((call) => call.endpoint?.endsWith('/latest')))
  }
})

test('completed releases are unchanged and missing checkpoints cannot be completed', (t) => {
  const { manifest } = releaseFixture(t)
  const release = {
    id: 1,
    tag_name: manifest.tag,
    draft: false,
    assets: [{ id: 2, name: 'nitro-release.json' }],
  }
  const request = () => assert.fail('must not query or change GitHub')
  finishRelease(manifest, { release, request })
  assert.throws(
    () => finishRelease(manifest, { release: null, request }),
    /checkpoint is missing/
  )
  assert.throws(
    () =>
      finishRelease(manifest, {
        release: { ...release, draft: true, assets: [] },
        request,
      }),
    /Missing or ambiguous release asset/
  )
  assert.throws(
    () =>
      finishRelease(manifest, {
        release: { ...release, tag_name: 'v0.37.3' },
        request,
      }),
    /Release ID does not match/
  )
})

test('a GitHub Latest lookup failure leaves the release as a draft', (t) => {
  const { manifest, directory } = releaseFixture(t)
  const github = githubFixture(manifest)
  const release = saveDraft(manifest, directory, 'nitro-release.json', github)
  assert.throws(
    () =>
      finishRelease(manifest, {
        release,
        request: () => {
          throw new Error('GitHub HTTP 503')
        },
      }),
    /GitHub HTTP 503/
  )
  assert.equal(github.releases[0].draft, true)
})

test('a draft checkpoint verifies its tag and uploads every tarball before the manifest', (t) => {
  const { manifest, directory } = releaseFixture(t, {
    version: '0.38.0-beta.1',
    npmTag: 'beta',
  })
  const github = githubFixture(manifest)
  const release = saveDraft(manifest, directory, 'nitro-release.json', github)
  assert.equal(
    github.calls[1].endpoint,
    `repos/${manifest.repository}/git/ref/tags/${manifest.tag}`
  )
  assert.deepEqual(github.calls[2], {
    endpoint: `repos/${manifest.repository}/releases`,
    method: 'POST',
    body: {
      tag_name: manifest.tag,
      name: manifest.tag,
      draft: true,
      prerelease: true,
      generate_release_notes: true,
      make_latest: 'false',
    },
  })
  assert.deepEqual(
    github.calls.filter((call) => call.upload),
    [...manifest.packages.map((pkg) => pkg.filename), 'nitro-release.json'].map(
      (upload) => ({ upload, releaseID: release.id })
    )
  )
  assert.deepEqual(
    JSON.parse(
      readFileSync(path.join(directory, 'nitro-release.json'), 'utf8')
    ),
    manifest
  )
})

test('a missing remote tag prevents creating a draft', (t) => {
  const { manifest, directory } = releaseFixture(t)
  assert.throws(
    () =>
      saveDraft(manifest, directory, 'nitro-release.json', {
        lookup: () => null,
        request: (endpoint, options) => {
          assert.ok(endpoint.includes('/git/ref/tags/'))
          assert.equal(options, undefined)
          throw new Error('GitHub HTTP 404')
        },
        upload: () => assert.fail('must not upload without a tag'),
      }),
    /HTTP 404/
  )
})

test('drafts with a checkpoint and completed releases refuse artifact replacement', (t) => {
  const { manifest, directory } = releaseFixture(t)
  for (const release of [
    { draft: false, assets: [] },
    { draft: true, assets: [{ name: 'nitro-release.json' }] },
  ]) {
    assert.throws(
      () =>
        saveDraft(manifest, directory, 'nitro-release.json', {
          lookup: () => release,
          request: () => assert.fail('saved artifacts must not be overwritten'),
          upload: () => assert.fail('saved artifacts must not be overwritten'),
        }),
      /Cannot replace|checkpoint already exists/
    )
  }
})

test('an interrupted tarball upload resumes the same draft and writes the manifest last', (t) => {
  const { manifest, directory } = releaseFixture(t)
  const github = githubFixture(manifest)
  let failSecondUpload = true
  const upload = (...args) => {
    if (
      path.basename(args[2]) === manifest.packages[1].filename &&
      failSecondUpload
    ) {
      failSecondUpload = false
      throw new Error('upload connection reset')
    }
    return github.upload(...args)
  }
  assert.throws(
    () =>
      saveDraft(manifest, directory, 'nitro-release.json', {
        ...github,
        upload,
      }),
    /connection reset/
  )
  assert.deepEqual(
    github.releases[0].assets.map((asset) => asset.name),
    [manifest.packages[0].filename]
  )
  const releaseID = github.releases[0].id
  saveDraft(manifest, directory, 'nitro-release.json', { ...github, upload })
  assert.equal(github.releases.length, 1)
  assert.equal(github.releases[0].id, releaseID)
  assert.deepEqual(
    github.releases[0].assets.map((asset) => asset.name),
    [...manifest.packages.map((pkg) => pkg.filename), 'nitro-release.json']
  )
})

test('a published release can save its first checkpoint without replacing public assets', (t) => {
  const { manifest, directory } = releaseFixture(t)
  const github = githubFixture(manifest)
  const release = github.addRelease({ draft: false })
  const first = manifest.packages[0]
  github.upload(
    manifest.repository,
    release,
    path.join(directory, first.filename)
  )
  github.calls.length = 0
  saveDraft(manifest, directory, 'nitro-release.json', {
    ...github,
    allowPublished: true,
  })
  assert.deepEqual(
    github.calls.filter((call) => call.upload).map((call) => call.upload),
    [
      ...manifest.packages.slice(1).map((pkg) => pkg.filename),
      'nitro-release.json',
    ]
  )
  assert.ok(!github.calls.some((call) => call.method === 'DELETE'))
})

test('a published-release retry stops on corrupt public tarballs before uploading', (t) => {
  const { manifest, directory } = releaseFixture(t)
  const github = githubFixture(manifest)
  const release = github.addRelease({ draft: false })
  const asset = github.upload(
    manifest.repository,
    release,
    path.join(directory, manifest.packages[0].filename)
  )
  github.bytes.set(asset.id, Buffer.from('different bytes'))
  github.calls.length = 0
  assert.throws(
    () =>
      saveDraft(manifest, directory, 'nitro-release.json', {
        ...github,
        allowPublished: true,
      }),
    /Tarball integrity mismatch/
  )
  assert.ok(!github.calls.some((call) => call.upload || call.method))
})

test('a published-release checkpoint cannot be replaced even by its release-event retry', (t) => {
  const { manifest, directory } = releaseFixture(t)
  assert.throws(
    () =>
      saveDraft(manifest, directory, 'nitro-release.json', {
        lookup: () => ({
          draft: false,
          assets: [{ name: 'nitro-release.json' }],
        }),
        allowPublished: true,
        request: () => assert.fail('immutable checkpoint must be reused'),
        upload: () => assert.fail('immutable checkpoint must be reused'),
      }),
    /checkpoint already exists/
  )
})

test('a duplicate empty draft cannot redirect checkpoint downloads or finalization after partial publication', async (t) => {
  const { manifest, directory } = releaseFixture(t, {
    version: '0.37.2-nightly.32.gbbbbbbbbbbbb',
    npmTag: 'nightly',
  })
  const github = githubFixture(manifest)
  const original = saveDraft(manifest, directory, 'nitro-release.json', github)
  const duplicate = github.addRelease()
  github.releases.reverse() // GitHub lists the newer empty draft first.
  const registry = registryFixture(manifest)
  registry.versions.set(
    registry.key(manifest.packages[0].name, manifest.version),
    registry.record(manifest.packages[0])
  )
  const savedBytes = new Map(github.bytes)
  github.calls.length = 0
  const release = github.lookup(manifest.repository, manifest.tag)
  const recovered = path.join(directory, 'recovered')
  const checkpoint = downloadRelease(
    manifest.repository,
    release,
    'nitro-release.json',
    recovered,
    github
  )
  assert.deepEqual(checkpoint, manifest)
  await publishPackages(checkpoint, recovered, registry)
  finishRelease(checkpoint, { release, request: github.request })
  assert.deepEqual(registry.publishes, releasePackages.slice(1))
  assert.deepEqual(
    github.calls.filter((call) => call.download).map((call) => call.download),
    [
      original.assets.at(-1).id,
      ...original.assets.slice(0, -1).map((asset) => asset.id),
    ]
  )
  assert.deepEqual(github.bytes, savedBytes)
  assert.equal(
    github.releases.find((entry) => entry.id === original.id).draft,
    false
  )
  assert.equal(duplicate.draft, true)
  assert.deepEqual(duplicate.assets, [])
  assert.ok(
    !github.calls.some((call) => call.upload || call.method === 'DELETE')
  )
})

test('a lost manifest upload response resumes the completed checkpoint without replacing it', (t) => {
  const { manifest, directory } = releaseFixture(t)
  const github = githubFixture(manifest)
  assert.throws(
    () =>
      saveDraft(manifest, directory, 'nitro-release.json', {
        ...github,
        upload: (...args) => {
          const asset = github.upload(...args)
          if (asset.name === 'nitro-release.json')
            throw new Error('upload response lost')
          return asset
        },
      }),
    /upload response lost/
  )
  github.calls.length = 0
  const release = github.lookup(manifest.repository, manifest.tag)
  assert.throws(
    () => saveDraft(manifest, directory, 'nitro-release.json', github),
    /checkpoint already exists/
  )
  assert.deepEqual(
    downloadRelease(
      manifest.repository,
      release,
      'nitro-release.json',
      path.join(directory, 'recovered'),
      github
    ),
    manifest
  )
  assert.ok(!github.calls.some((call) => call.upload || call.method))
})

test('checkpoint recovery refuses missing, ambiguous and corrupt tarballs', (t) => {
  for (const defect of ['missing', 'duplicate', 'corrupt']) {
    const { manifest, directory } = releaseFixture(t)
    const github = githubFixture(manifest)
    const release = saveDraft(manifest, directory, 'nitro-release.json', github)
    if (defect === 'missing') release.assets.shift()
    if (defect === 'duplicate')
      release.assets.push({ ...release.assets[0], id: 999 })
    if (defect === 'corrupt')
      github.bytes.set(release.assets[0].id, Buffer.from('different bytes'))
    assert.throws(
      () =>
        downloadRelease(
          manifest.repository,
          release,
          'nitro-release.json',
          path.join(directory, 'recovered'),
          github
        ),
      /Missing or ambiguous release asset|Tarball integrity mismatch/
    )
  }
})
