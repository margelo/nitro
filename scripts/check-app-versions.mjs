import { readFile } from 'node:fs/promises'

const appDirectories = ['apps/example', 'apps/benchmark']

/** Compare declared versions; app-specific dependencies are intentionally allowed. */
export function findAppVersionMismatches(manifests) {
  const problems = []
  const dependencies = new Map()
  for (const [directory, manifest] of Object.entries(manifests)) {
    for (const [name, version] of Object.entries({
      ...manifest.devDependencies,
      ...manifest.dependencies,
    })) {
      const declarations = dependencies.get(name) ?? []
      declarations.push({ directory, version })
      dependencies.set(name, declarations)
    }
  }

  for (const directory of appDirectories) {
    const manifest = manifests[directory]
    if (manifest == null) {
      problems.push(`${directory}/package.json is missing.`)
      continue
    }
    if (manifest.version !== manifests['.']?.version) {
      problems.push(
        `${directory}: app version ${manifest.version} must match root ${manifests['.']?.version}.`
      )
    }
    for (const name of ['react', 'react-native']) {
      if (manifest.dependencies?.[name] == null) {
        problems.push(`${directory}: ${name} must be a direct dependency.`)
      }
    }
  }

  for (const [name, declarations] of dependencies) {
    if (new Set(declarations.map(({ version }) => version)).size > 1) {
      problems.push(
        `${name}: ${declarations
          .map(({ directory, version }) => `${directory}=${version}`)
          .join(', ')}`
      )
    }
  }
  return problems
}

if (import.meta.main) {
  const manifests = Object.fromEntries(
    await Promise.all(
      ['.', ...appDirectories].map(async (directory) => [
        directory,
        JSON.parse(
          await readFile(
            new URL(`../${directory}/package.json`, import.meta.url),
            'utf8'
          )
        ),
      ])
    )
  )
  const problems = findAppVersionMismatches(manifests)
  if (problems.length > 0) {
    console.error('App versions have drifted:\n' + problems.join('\n'))
    process.exitCode = 1
  } else {
    console.log('App versions and shared dependency declarations are aligned.')
  }
}
