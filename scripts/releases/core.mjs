import { appendFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertCI,
  assertClean,
  assertValidatedCommit,
  compareVersions,
  downloadRelease,
  finishRelease,
  getRelease,
  git,
  isNightly,
  nightlyVersion,
  npmTagFor,
  packPackage,
  parseVersion,
  publishPackages,
  readJSON,
  registryPackage,
  run,
  saveDraft,
  validateManifest,
  versionFromTag,
} from './lib.mjs'
import { checkConsumer } from './check-consumer.mjs'
import { releasePackages, versionedFiles } from './packages.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
process.chdir(root)
const repository = 'margelo/nitro'
const automaticNightly = process.env.RELEASE_MODE === 'nightly'
const releaseEventTag = process.env.RELEASE_EVENT_TAG || undefined
let sourceCommit = git(['rev-parse', 'HEAD'])
const version = automaticNightly
  ? nightlyVersion(
      readJSON('package.json').version,
      process.env.GITHUB_RUN_NUMBER,
      sourceCommit
    )
  : releaseEventTag
    ? versionFromTag(releaseEventTag)
    : process.env.RELEASE_VERSION
parseVersion(version)
const nightly = isNightly(version)
const npmTag = npmTagFor(
  version,
  automaticNightly ? 'nightly' : process.env.RELEASE_NPM_TAG
)
if (nightly !== (npmTag === 'nightly'))
  throw new Error('Nightly versions must use the nightly npm tag')
const tag = `v${version}`
const dryRun = process.env.RELEASE_DRY_RUN === 'true'
function reportCompletedRelease() {
  if (!dryRun && process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`)
}
const branch =
  process.env.RELEASE_BRANCH ||
  process.env.GITHUB_REF_NAME ||
  git(['branch', '--show-current'])
if (branch !== 'main') throw new Error('Release from main')
if (!dryRun) assertCI(repository)
assertClean()
git(['fetch', 'origin', branch, '--tags'])
const directory = mkdtempSync(path.join(tmpdir(), 'nitro-release-'))
const exists = !!git(['tag', '--list', tag])
if (releaseEventTag && !exists)
  throw new Error('The GitHub release tag is missing')
let manifest
let allowPublishedCheckpoint = false

if (exists) {
  const commit = git(['rev-parse', `${tag}^{commit}`])
  const annotation = git([
    'for-each-ref',
    '--format=%(contents)',
    `refs/tags/${tag}`,
  ])
  const release = getRelease(repository, tag)
  allowPublishedCheckpoint = releaseEventTag === tag && release?.draft === false
  if (annotation.split('\n').includes(`Nitro-Release: ${tag}`)) {
    if (!annotation.split('\n').includes(`Npm-Tag: ${npmTag}`))
      throw new Error(`Tag ${tag} was created with a different npm tag`)
    sourceCommit = annotation
      .split('\n')
      .find((line) => line.startsWith('Source-Commit: '))
      ?.slice('Source-Commit: '.length)
  } else {
    if (
      nightly ||
      !release ||
      release.draft ||
      (releaseEventTag !== tag &&
        !release.assets.some((asset) => asset.name === 'nitro-release.json'))
    )
      throw new Error(
        `Tag ${tag} must come from this workflow or a published GitHub release`
      )
    // A GitHub release already has an immutable tag. Its source must have been
    // versioned before publishing the release; never move that tag to a bump commit.
    sourceCommit = commit
    allowPublishedCheckpoint = true
  }
  if (!/^[a-f0-9]{40}$/.test(sourceCommit))
    throw new Error('Release tag does not record its source commit')
  if (nightly && git(['rev-parse', `${tag}^`]) !== sourceCommit)
    throw new Error('Nightly commit must be based on its recorded source')
  git([
    'merge-base',
    '--is-ancestor',
    nightly ? sourceCommit : commit,
    `origin/${branch}`,
  ])
  git(['checkout', '--detach', commit])
  run('node', ['scripts/set-version.mjs', '--check'])
  if (readJSON('package.json').version !== version)
    throw new Error('Tagged version does not match input')
  if (release?.assets.some((asset) => asset.name === 'nitro-release.json')) {
    manifest = downloadRelease(repository, tag, 'nitro-release.json', directory)
    if (
      manifest.commit !== commit ||
      manifest.npmTag !== npmTag ||
      manifest.sourceCommit !== sourceCommit
    )
      throw new Error(
        'Saved release differs from its Git tag or requested npm tag'
      )
  }
} else {
  if (nightly && !automaticNightly)
    throw new Error(
      'New nightlies are created by pushes to main; rerun their original workflow to retry'
    )
  if (
    automaticNightly &&
    !dryRun &&
    (branch !== 'main' || sourceCommit !== process.env.GITHUB_SHA)
  )
    throw new Error('Nightlies must build the exact main push commit')
  if (nightly)
    git(['merge-base', '--is-ancestor', sourceCommit, `origin/${branch}`])
  if (!nightly && sourceCommit !== git(['rev-parse', `origin/${branch}`]))
    throw new Error('Release checkout must match the remote branch tip')
  if (
    !nightly &&
    compareVersions(version, readJSON('package.json').version) <= 0
  )
    throw new Error(
      'A new release must increase the version. To recover a release, use its existing version.'
    )
  // A failed run may have pushed its tag without reaching the draft checkpoint.
  const releaseTags = git([
    'for-each-ref',
    '--format=%(refname:short) %(contents:subject)',
    'refs/tags',
  ])
    .split('\n')
    .filter((line) => /^v\S+ Nitro-Release: v\S+(?: |$)/.test(line))
    .map((line) => line.split(' ')[0])
  for (const releaseTag of nightly
    ? []
    : releaseTags.filter((name) => !isNightly(name.slice(1)))) {
    const release = getRelease(repository, releaseTag)
    if (!release || release.draft)
      throw new Error(`Resume ${releaseTag} before starting another release`)
  }
  for (const name of releasePackages) {
    if (await registryPackage(name, version))
      throw new Error(`${name}@${version} already exists on npm`)
  }
}

if (!dryRun)
  assertValidatedCommit(
    git(['rev-parse', 'HEAD']),
    process.env.RELEASE_VALIDATED_COMMIT
  )
if (!exists) run('node', ['scripts/set-version.mjs', version])

if (!manifest) {
  run('bun', [
    'install',
    '--ignore-scripts',
    ...(exists ? ['--frozen-lockfile'] : []),
  ])
  run('bun', ['run', 'test:release'])
  run('bun', ['run', 'build'])
  // Link workspace CLIs now that their build outputs exist.
  run('bun', ['install', '--ignore-scripts', '--frozen-lockfile'])
  run('bun', ['run', 'typecheck'])
  const packages = releasePackages.map((name) =>
    packPackage(path.join(root, 'packages', name), directory)
  )
  checkConsumer(packages.map((pkg) => path.join(directory, pkg.filename)))
  if (dryRun) {
    console.log(
      `Validated ${tag} (${npmTag}); no commit, tag, push or publication. Tarballs: ${directory}`
    )
    process.exit(0)
  }
  if (!exists) {
    git(['config', 'user.name', 'Marc Rousavy'])
    git(['config', 'user.email', 'me@mrousavy.com'])
    git(['add', ...versionedFiles])
    git(['diff', '--exit-code'])
    if (git(['ls-files', '--others', '--exclude-standard']))
      throw new Error('Release generated unexpected untracked files')
    git(['commit', '-m', `chore: release ${version}`])
    git([
      'tag',
      '--annotate',
      tag,
      '--message',
      `Nitro-Release: ${tag}\n\nNpm-Tag: ${npmTag}\nSource-Commit: ${sourceCommit}`,
    ])
    git([
      'push',
      '--atomic',
      'origin',
      ...(!nightly ? [`HEAD:refs/heads/${branch}`] : []),
      `refs/tags/${tag}`,
    ])
  } else {
    assertClean()
  }
  manifest = validateManifest(
    {
      schema: 1,
      repository,
      version,
      tag,
      commit: git(['rev-parse', 'HEAD']),
      npmTag,
      sourceCommit,
      packages,
    },
    { repository, tag, packages: releasePackages }
  )
  saveDraft(manifest, directory, 'nitro-release.json', {
    allowPublished: allowPublishedCheckpoint,
  })
}
if (dryRun) {
  console.log(`Saved artifacts for ${tag} verified. No publication.`)
  process.exit(0)
}
await publishPackages(manifest, directory)
finishRelease(manifest)
reportCompletedRelease()
console.log(`Released ${releasePackages.join(', ')} at ${version}`)
