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
import { resolveCICommit } from './ci-ref.mjs'
import { git, nightlyVersion, run } from './lib.mjs'

function fixture(t, sourceVersion = '0.37.1', releaseVersion = '0.37.2') {
  const cwd = mkdtempSync(path.join(tmpdir(), 'nitro-release-ci-ref-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  git(['init', '--quiet'], { cwd })
  git(['config', 'user.name', 'Marc Rousavy'], { cwd })
  git(['config', 'user.email', 'me@mrousavy.com'], { cwd })
  writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ version: sourceVersion }) + '\n'
  )
  git(['add', 'package.json'], { cwd })
  git(['commit', '--quiet', '--no-gpg-sign', '--message', 'Source'], { cwd })
  const sourceCommit = git(['rev-parse', 'HEAD'], { cwd })
  writeFileSync(
    path.join(cwd, 'package.json'),
    JSON.stringify({ version: releaseVersion }) + '\n'
  )
  git(['add', 'package.json'], { cwd })
  git(['commit', '--quiet', '--no-gpg-sign', '--message', 'Release'], { cwd })
  const releaseCommit = git(['rev-parse', 'HEAD'], { cwd })
  git(['checkout', '--quiet', '--detach', sourceCommit], { cwd })
  return { cwd, sourceCommit, releaseCommit }
}

test('new manual and nightly releases validate the checked-out event commit', (t) => {
  const { cwd, sourceCommit } = fixture(t)
  for (const env of [
    { RELEASE_VERSION: '0.37.2' },
    { RELEASE_MODE: 'nightly', GITHUB_RUN_NUMBER: '42' },
  ]) {
    assert.equal(resolveCICommit({ cwd, env }), sourceCommit)
  }
})

test('manual and release-event recovery validate the peeled release tag', (t) => {
  const { cwd, sourceCommit, releaseCommit } = fixture(t)
  git(['tag', '--annotate', 'v0.37.2', releaseCommit, '--message', 'Release'], {
    cwd,
  })
  for (const env of [
    { RELEASE_VERSION: '0.37.2' },
    { RELEASE_EVENT_TAG: 'v0.37.2', RELEASE_VERSION: 'invalid' },
  ]) {
    assert.equal(resolveCICommit({ cwd, env }), releaseCommit)
    assert.equal(git(['rev-parse', 'HEAD'], { cwd }), sourceCommit)
  }
})

test('nightly retries validate their existing tag instead of the event commit', (t) => {
  const { cwd, sourceCommit, releaseCommit } = fixture(t)
  const version = nightlyVersion('0.37.1', '42', sourceCommit)
  git(['tag', `v${version}`, releaseCommit], { cwd })
  for (const env of [
    { RELEASE_MODE: 'nightly', GITHUB_RUN_NUMBER: '42' },
    { RELEASE_VERSION: version },
    { RELEASE_EVENT_TAG: `v${version}` },
  ]) {
    assert.equal(resolveCICommit({ cwd, env }), releaseCommit)
  }
})

test('fresh v1 nightlies validate the source and ignore the main nightly tag', (t) => {
  const { cwd, sourceCommit, releaseCommit } = fixture(
    t,
    '1.0.0-alpha.0',
    '1.0.0-alpha.1'
  )
  const mainVersion = nightlyVersion('1.0.0-alpha.0', '42', sourceCommit)
  git(['tag', `v${mainVersion}`, releaseCommit], { cwd })
  for (const branchEnv of [
    { RELEASE_BRANCH: 'v1', GITHUB_REF_NAME: 'main' },
    { GITHUB_REF_NAME: 'v1' },
  ]) {
    assert.equal(
      resolveCICommit({
        cwd,
        env: { ...branchEnv, RELEASE_MODE: 'nightly', GITHUB_RUN_NUMBER: '42' },
      }),
      sourceCommit
    )
  }
})

test('v1 nightly retries validate the existing alpha-nightly release commit', (t) => {
  const { cwd, sourceCommit, releaseCommit } = fixture(
    t,
    '1.0.0-alpha.0',
    '1.0.0-alpha.1'
  )
  const version = nightlyVersion(
    '1.0.0-alpha.0',
    '42',
    sourceCommit,
    'alpha-nightly'
  )
  git(
    ['tag', '--annotate', `v${version}`, releaseCommit, '--message', 'Release'],
    {
      cwd,
    }
  )
  for (const env of [
    { RELEASE_MODE: 'nightly', GITHUB_RUN_NUMBER: '42' },
    { RELEASE_VERSION: version },
    { RELEASE_EVENT_TAG: `v${version}` },
  ]) {
    assert.equal(
      resolveCICommit({ cwd, env: { ...env, RELEASE_BRANCH: 'v1' } }),
      releaseCommit
    )
    assert.equal(git(['rev-parse', 'HEAD'], { cwd }), sourceCommit)
  }
})

test('v1 nightly CI rejects a base outside the alpha release line', (t) => {
  const { cwd } = fixture(t)
  assert.throws(
    () =>
      resolveCICommit({
        cwd,
        env: {
          RELEASE_BRANCH: 'v1',
          RELEASE_MODE: 'nightly',
          GITHUB_RUN_NUMBER: '42',
        },
      }),
    /V1 nightlies require a 1.x alpha base version/
  )
})

test('invalid versions and missing release-event tags fail before selecting CI', (t) => {
  const { cwd } = fixture(t)
  for (const env of [
    {},
    { RELEASE_VERSION: 'latest' },
    { RELEASE_EVENT_TAG: '0.37.2' },
    { RELEASE_MODE: 'nightly', GITHUB_RUN_NUMBER: '0' },
  ]) {
    assert.throws(() => resolveCICommit({ cwd, env }))
  }
  assert.throws(
    () => resolveCICommit({ cwd, env: { RELEASE_EVENT_TAG: 'v0.37.2' } }),
    /The GitHub release tag is missing/
  )
})

test('the resolver writes the immutable commit to the workflow output file', (t) => {
  const { cwd, releaseCommit } = fixture(t)
  git(['tag', 'v0.37.2', releaseCommit], { cwd })
  const source = fileURLToPath(new URL('../../', import.meta.url))
  for (const filename of ['ci-ref.mjs', 'lib.mjs', 'packages.mjs']) {
    const relative = path.join('scripts/releases', filename)
    mkdirSync(path.dirname(path.join(cwd, relative)), { recursive: true })
    copyFileSync(path.join(source, relative), path.join(cwd, relative))
  }
  const output = path.join(cwd, 'workflow-output')
  run(process.execPath, ['scripts/releases/ci-ref.mjs'], {
    cwd,
    capture: true,
    env: {
      RELEASE_MODE: 'manual',
      RELEASE_VERSION: '0.37.2',
      RELEASE_EVENT_TAG: '',
      GITHUB_OUTPUT: output,
    },
  })
  assert.equal(readFileSync(output, 'utf8'), `commit=${releaseCommit}\n`)
})
