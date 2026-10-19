import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { releasePackages } from './packages.mjs'

export function run(command, args, { cwd, capture = false, input, env } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    input,
    env: env ? { ...process.env, ...env } : process.env,
    stdio:
      capture || input !== undefined ? ['pipe', 'pipe', 'pipe'] : 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
    throw new Error(
      `${command} ${args.join(' ')} failed (${result.status})\n${output}`
    )
  }
  return result.stdout?.trim() ?? ''
}

export const git = (args, options = {}) =>
  run('git', args, { capture: true, ...options })
export const readJSON = (file) => JSON.parse(readFileSync(file, 'utf8'))
export const writeJSON = (file, value) =>
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)

export function assertValidatedCommit(commit, validatedCommit) {
  if (
    !/^[a-f0-9]{40}$/.test(validatedCommit ?? '') ||
    validatedCommit !== commit
  )
    throw new Error(`Required CI has not validated release commit ${commit}`)
}

// npm normalizes build metadata. Reject it so tags, manifests and registry versions agree.
export function parseVersion(version) {
  if (typeof version !== 'string' || version.length > 256)
    throw new Error('A version of at most 256 characters is required')
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(
      version
    )
  if (!match) throw new Error(`Invalid release version: ${version}`)
  const numbers = match.slice(1, 4).map(Number)
  const prerelease = match[4]?.split('.') ?? []
  if (
    numbers.some((n) => !Number.isSafeInteger(n)) ||
    prerelease.some((s) => /^0\d+$/.test(s))
  ) {
    throw new Error(`Invalid release version: ${version}`)
  }
  return {
    major: numbers[0],
    minor: numbers[1],
    patch: numbers[2],
    prerelease,
  }
}

export function nightlyVersion(baseVersion, runNumber, sourceCommit) {
  const base = parseVersion(baseVersion)
  if (
    !['string', 'number'].includes(typeof runNumber) ||
    !/^[1-9]\d*$/.test(String(runNumber)) ||
    !Number.isSafeInteger(Number(runNumber))
  ) {
    throw new Error('A nightly requires a positive integer workflow run number')
  }
  if (
    typeof sourceCommit !== 'string' ||
    !/^[a-f0-9]{40}$/.test(sourceCommit)
  ) {
    throw new Error('A nightly requires the full source commit SHA')
  }
  const patch = base.patch + (base.prerelease.length ? 0 : 1)
  const version = `${base.major}.${base.minor}.${patch}-nightly.${runNumber}.g${sourceCommit.slice(0, 12)}`
  parseVersion(version)
  return version
}

export function isNightly(version) {
  return parseVersion(version).prerelease[0] === 'nightly'
}

export function versionFromTag(tag) {
  if (typeof tag !== 'string' || !tag.startsWith('v'))
    throw new Error('A GitHub release tag must be vVERSION')
  const version = tag.slice(1)
  parseVersion(version)
  return version
}

export function compareVersions(a, b) {
  const left = parseVersion(a)
  const right = parseVersion(b)
  for (const field of ['major', 'minor', 'patch']) {
    if (left[field] !== right[field]) return left[field] > right[field] ? 1 : -1
  }
  if (!left.prerelease.length || !right.prerelease.length) {
    return Number(!left.prerelease.length) - Number(!right.prerelease.length)
  }
  for (
    let i = 0;
    i < Math.max(left.prerelease.length, right.prerelease.length);
    i++
  ) {
    const l = left.prerelease[i]
    const r = right.prerelease[i]
    if (l === r) continue
    if (l === undefined) return -1
    if (r === undefined) return 1
    const ln = /^\d+$/.test(l)
    const rn = /^\d+$/.test(r)
    if (ln && rn) return BigInt(l) > BigInt(r) ? 1 : -1
    if (ln !== rn) return ln ? -1 : 1
    return l > r ? 1 : -1
  }
  return 0
}

export function npmTagFor(version, requested = '') {
  const { prerelease } = parseVersion(version)
  const tag =
    requested ||
    (prerelease.length
      ? /^[a-z]/.test(prerelease[0])
        ? prerelease[0]
        : 'next'
      : 'latest')
  if (
    !/^[a-z][a-z0-9-]*$/.test(tag) ||
    tag === 'x' ||
    /^v\d/.test(tag) ||
    (prerelease.length && tag === 'latest')
  ) {
    throw new Error(
      `Invalid npm tag ${tag} for ${version}; prereleases cannot use latest`
    )
  }
  return tag
}

export function validateManifest(manifest, { repository, tag, packages }) {
  if (
    manifest.schema !== 1 ||
    manifest.repository !== repository ||
    manifest.tag !== tag ||
    tag !== `v${manifest.version}` ||
    !/^[a-f0-9]{40}$/.test(manifest.commit) ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceCommit)
  ) {
    throw new Error(
      'Release manifest does not match the repository, tag or commit'
    )
  }
  npmTagFor(manifest.version, manifest.npmTag)
  if (typeof manifest.npmTag !== 'string' || !manifest.npmTag)
    throw new Error('Missing npm tag')
  if (isNightly(manifest.version)) {
    if (
      manifest.npmTag !== 'nightly' ||
      !/^[a-f0-9]{40}$/.test(manifest.sourceCommit)
    ) {
      throw new Error(
        'A nightly manifest requires the nightly npm tag and source commit SHA'
      )
    }
  } else if (manifest.npmTag === 'nightly') {
    throw new Error('The nightly npm tag is reserved for nightly versions')
  }
  if (
    !Array.isArray(manifest.packages) ||
    manifest.packages.length !== packages.length
  ) {
    throw new Error('Release manifest has an unexpected package list')
  }
  for (const [index, name] of packages.entries()) {
    const pkg = manifest.packages[index]
    if (
      pkg.name !== name ||
      pkg.version !== manifest.version ||
      pkg.filename !== `${name}-${manifest.version}.tgz` ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/.test(pkg.integrity)
    ) {
      throw new Error(`Invalid release package: ${name}`)
    }
  }
  return manifest
}

export function github(
  endpoint,
  { method = 'GET', body, allowNotFound = false } = {}
) {
  const args = ['api', endpoint, '--method', method]
  if (body !== undefined) args.push('--input', '-')
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    input: body === undefined ? undefined : JSON.stringify(body),
  })
  if (result.error) throw result.error
  if (allowNotFound && result.status !== 0 && /HTTP 404/.test(result.stderr))
    return null
  if (result.status !== 0)
    throw new Error(`GitHub ${method} ${endpoint}: ${result.stderr}`)
  return result.stdout.trim() ? JSON.parse(result.stdout) : null
}

export const getRelease = (repo, tag) =>
  github(`repos/${repo}/releases/tags/${tag}`, { allowNotFound: true })

export function fileIntegrity(filename) {
  return `sha512-${createHash('sha512').update(readFileSync(filename)).digest('base64')}`
}

export function verifyFiles(manifest, directory) {
  for (const pkg of manifest.packages) {
    if (fileIntegrity(path.join(directory, pkg.filename)) !== pkg.integrity) {
      throw new Error(`Tarball integrity mismatch: ${pkg.filename}`)
    }
  }
}

export function downloadRelease(repo, tag, manifestName, directory) {
  mkdirSync(directory, { recursive: true })
  run('gh', [
    'release',
    'download',
    tag,
    '--repo',
    repo,
    '--pattern',
    manifestName,
    '--dir',
    directory,
  ])
  const manifest = readJSON(path.join(directory, manifestName))
  validateManifest(manifest, {
    repository: repo,
    tag,
    packages: releasePackages,
  })
  for (const pkg of manifest.packages) {
    run('gh', [
      'release',
      'download',
      tag,
      '--repo',
      repo,
      '--pattern',
      pkg.filename,
      '--dir',
      directory,
    ])
  }
  verifyFiles(manifest, directory)
  return manifest
}

export function packPackage(packageDir, destination) {
  mkdirSync(destination, { recursive: true })
  const output = run(
    'npm',
    ['pack', '--json', '--pack-destination', destination],
    { cwd: packageDir, capture: true }
  )
  const [pkg] = JSON.parse(output)
  const packed = {
    name: pkg.name,
    version: pkg.version,
    filename: pkg.filename,
    integrity: pkg.integrity,
  }
  verifyFiles({ packages: [packed] }, destination)
  return packed
}

export async function registryPackage(name, version, execute = spawnSync) {
  const spec = `${name}@${version}`
  // npm handles registry configuration and retries transient read failures.
  const result = execute('npm', ['view', spec, '--json'], {
    encoding: 'utf8',
  })
  if (result.error) throw result.error
  // npm returns empty output when an existing package has no latest tag.
  if (result.status === 0 && version === 'latest' && !result.stdout.trim())
    return null
  let metadata
  try {
    metadata = JSON.parse(result.stdout)
  } catch (cause) {
    throw new Error(`npm view ${spec}: invalid JSON\n${result.stderr ?? ''}`, {
      cause,
    })
  }
  if (result.status !== 0) {
    if (metadata?.error?.code === 'E404') return null
    throw new Error(
      `npm view ${spec} failed (${result.status})\n${result.stderr || result.stdout}`
    )
  }
  if (typeof metadata?.version !== 'string')
    throw new Error(`npm view ${spec}: missing package version`)
  return metadata
}

export async function assertPublishedPackages(
  manifest,
  { lookup = registryPackage } = {}
) {
  for (const pkg of manifest.packages) {
    const published = await lookup(pkg.name, pkg.version)
    if (published?.dist?.integrity !== pkg.integrity)
      throw new Error(
        `npm does not contain the recorded ${pkg.name}@${pkg.version} tarball`
      )
  }
}

export async function publishPackages(
  manifest,
  directory,
  { lookup = registryPackage, execute = run } = {}
) {
  verifyFiles(manifest, directory)
  // Preflight every package before publishing the first one.
  const existing = await Promise.all(
    manifest.packages.map(async (pkg) => {
      const published = await lookup(pkg.name, pkg.version)
      if (published && published.dist?.integrity !== pkg.integrity) {
        throw new Error(
          `Refusing to replace ${pkg.name}@${pkg.version}: npm contains a different tarball`
        )
      }
      const current = await lookup(pkg.name, manifest.npmTag)
      let npmTag = manifest.npmTag
      if (
        !published &&
        current &&
        compareVersions(current.version, pkg.version) > 0
      ) {
        if (manifest.npmTag === 'nightly' && isNightly(manifest.version)) {
          npmTag = `nightly-${manifest.commit.slice(0, 12)}`
        } else {
          throw new Error(
            `Refusing to move ${pkg.name}'s ${manifest.npmTag} tag backwards from ${current.version}`
          )
        }
      }
      return { published, npmTag }
    })
  )
  for (const [index, pkg] of manifest.packages.entries()) {
    if (existing[index].published) {
      console.log(`Already published and verified: ${pkg.name}@${pkg.version}`)
      continue
    }
    execute(
      'npm',
      [
        'publish',
        path.join(directory, pkg.filename),
        '--tag',
        existing[index].npmTag,
        '--access',
        'public',
        '--provenance',
        '--ignore-scripts',
      ],
      {
        // npm uses these for provenance source material. Keep the workflow identity
        // variables unchanged: the launcher ran on its original workflow revision.
        env: {
          GITHUB_SHA: manifest.commit,
          GITHUB_REF: `refs/tags/${manifest.tag}`,
        },
      }
    )
    // A registry failure stops the release; a retry uses these same saved tarballs.
    await assertPublishedPackages({ packages: [pkg] }, { lookup })
  }
}

export function saveDraft(
  manifest,
  directory,
  manifestName,
  { lookup = getRelease, execute = run, allowPublished = false } = {}
) {
  const existing = lookup(manifest.repository, manifest.tag)
  if (existing && !existing.draft && !allowPublished)
    throw new Error('Cannot replace assets of a completed release')
  if (existing?.assets.some((asset) => asset.name === manifestName)) {
    throw new Error('Release checkpoint already exists; download and resume it')
  }
  if (!existing) {
    execute('gh', [
      'release',
      'create',
      manifest.tag,
      '--repo',
      manifest.repository,
      '--verify-tag',
      '--draft',
      '--title',
      manifest.tag,
      '--generate-notes',
      '--latest=false',
      ...(parseVersion(manifest.version).prerelease.length
        ? ['--prerelease']
        : []),
    ])
  }
  writeJSON(path.join(directory, manifestName), manifest)
  // Upload the manifest last. Its presence means every immutable tarball was saved.
  for (const pkg of manifest.packages) {
    if (
      existing &&
      !existing.draft &&
      existing.assets.some((asset) => asset.name === pkg.filename)
    ) {
      // A published-release run may have stopped between uploads. Verify its
      // existing bytes instead of replacing a public asset during the retry.
      const saved = path.join(directory, 'existing-assets')
      mkdirSync(saved, { recursive: true })
      execute('gh', [
        'release',
        'download',
        manifest.tag,
        '--repo',
        manifest.repository,
        '--pattern',
        pkg.filename,
        '--dir',
        saved,
      ])
      verifyFiles({ packages: [pkg] }, saved)
      continue
    }
    execute('gh', [
      'release',
      'upload',
      manifest.tag,
      path.join(directory, pkg.filename),
      '--repo',
      manifest.repository,
      ...(!existing || existing.draft ? ['--clobber'] : []),
    ])
  }
  execute('gh', [
    'release',
    'upload',
    manifest.tag,
    path.join(directory, manifestName),
    '--repo',
    manifest.repository,
  ])
}

export function finishRelease(
  manifest,
  { lookup = getRelease, request = github, execute = run } = {}
) {
  const release = lookup(manifest.repository, manifest.tag)
  if (!release) throw new Error('The release checkpoint is missing')
  if (!release.draft) return
  let latest =
    manifest.npmTag === 'latest' &&
    !parseVersion(manifest.version).prerelease.length
  if (latest) {
    const current = request(`repos/${manifest.repository}/releases/latest`, {
      allowNotFound: true,
    })
    if (current && current.tag_name !== manifest.tag) {
      latest =
        compareVersions(manifest.version, current.tag_name.replace(/^v/, '')) >
        0
    }
  }
  execute('gh', [
    'release',
    'edit',
    manifest.tag,
    '--repo',
    manifest.repository,
    '--draft=false',
    `--latest=${latest}`,
  ])
}

export function assertClean(cwd) {
  if (git(['status', '--porcelain'], { cwd }))
    throw new Error('Release requires a clean checkout, including submodules')
}

export function assertCI(repository) {
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.GITHUB_REPOSITORY !== repository
  ) {
    throw new Error(`Run this through ${repository}'s release workflow`)
  }
}
