import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseVersion } from './releases/lib.mjs'
import { releasePackages, versionedManifests } from './releases/packages.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifests = versionedManifests.map((relativePath) => {
  const filename = path.join(root, relativePath)
  return { filename, json: JSON.parse(readFileSync(filename, 'utf8')) }
})
const check = process.argv[2] === '--check'
const version = check
  ? manifests[0].json.version
  : (process.argv[2] ?? manifests[0].json.version)
parseVersion(version)

const sourceVersions = [
  {
    path: 'packages/nitro-core/native/cpp/utils/NitroDefines.hpp',
    pattern: /^#define NITRO_VERSION "([^"]+)"$/m,
    line: `#define NITRO_VERSION "${version}"`,
  },
  {
    path: 'packages/nitro-core/js/src/version.ts',
    pattern: /^export const version = '([^']+)'$/m,
    line: `export const version = '${version}'`,
  },
].map((entry) => {
  const filename = path.join(root, entry.path)
  const source = readFileSync(filename, 'utf8')
  const match = source.match(entry.pattern)
  if (match === null) throw new Error(`Could not find version in ${entry.path}`)
  return { ...entry, filename, source, match }
})

if (check) {
  for (const { filename, json } of manifests) {
    if (json.version !== version)
      throw new Error(
        `${filename}: expected version ${version}, found ${json.version}`
      )
  }
  for (const { filename, json } of manifests) {
    for (const field of ['dependencies', 'devDependencies']) {
      for (const name of releasePackages) {
        const dependency = json[field]?.[name]
        if (dependency !== undefined && dependency !== version) {
          throw new Error(`${filename}: ${field}.${name} must pin ${version}`)
        }
      }
    }
  }
  for (const entry of sourceVersions) {
    if (entry.match[1] !== version)
      throw new Error(`${entry.path} must use ${version}`)
  }
  console.log(`Nitro packages, test apps and native versions match: ${version}`)
} else {
  for (const { filename, json } of manifests) {
    json.version = version
    for (const field of ['dependencies', 'devDependencies']) {
      for (const name of releasePackages) {
        if (json[field]?.[name] !== undefined) json[field][name] = version
      }
    }
    writeFileSync(filename, `${JSON.stringify(json, null, 2)}\n`)
  }
  for (const entry of sourceVersions) {
    writeFileSync(
      entry.filename,
      entry.source.replace(entry.match[0], entry.line)
    )
  }
  console.log(
    `Updated Nitro packages and test apps to ${version}. Run bun install to update bun.lock.`
  )
}
