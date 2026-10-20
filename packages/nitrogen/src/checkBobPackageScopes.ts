import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { findPackageJson } from './checkHybridClassRuntimeImports.js'
import { prettifyDirectory } from './prettifyDirectory.js'
import { readJsonFile } from './readJsonFile.js'

// react-native-builder-bob reads its config from these files before the
// package.json field.
const BOB_CONFIG_FILE_NAMES = [
  'bob.config.mjs',
  'bob.config.cjs',
  'bob.config.js',
]

// The parts of a react-native-builder-bob config in package.json that decide
// whether bob writes a package.json with a `type` field to its output.
const bobPackageJsonSchema = z.object({
  'react-native-builder-bob': z.object({
    output: z.string(),
    // A target is a name, or a name with options, e.g. ["module", { "esm": true }].
    targets: z.array(
      z.union([
        z.string(),
        z.tuple([
          z.string(),
          z.object({ esm: z.boolean().optional() }).optional(),
        ]),
      ])
    ),
  }),
})

const listFormat = new Intl.ListFormat('en', { type: 'conjunction' })

/**
 * Returns a warning for each package.json of a spec whose
 * react-native-builder-bob config writes a package.json with a `type` field
 * to its output. That file scopes the built specs and has no "imports", so
 * they cannot resolve `#nitro/*`.
 */
export function getBobPackageScopeWarnings(
  realSpecPaths: readonly string[]
): string[] {
  const packageJsonPaths = new Set<string>()
  for (const specPath of realSpecPaths) {
    const packageJsonPath = findPackageJson(specPath)
    if (packageJsonPath != null) packageJsonPaths.add(packageJsonPath)
  }
  return [...packageJsonPaths].flatMap((packageJsonPath) => {
    const warning = getBobPackageScopeWarning(packageJsonPath)
    return warning == null ? [] : [warning]
  })
}

type BobTarget = z.infer<
  typeof bobPackageJsonSchema
>['react-native-builder-bob']['targets'][number]

function getBobPackageScopeWarning(
  packageJsonPath: string
): string | undefined {
  // Nitrogen never runs a bob.config file, so it can't tell what bob builds.
  const packageDirectory = path.dirname(packageJsonPath)
  const hasBobConfigFile = BOB_CONFIG_FILE_NAMES.some((fileName) =>
    fs.existsSync(path.join(packageDirectory, fileName))
  )
  if (hasBobConfigFile) return undefined

  const packageJson = readJsonFile(packageJsonPath, z.unknown())
  // Skip packages without a bob config in package.json, or with one we don't expect.
  const result = bobPackageJsonSchema.safeParse(packageJson)
  if (!result.success) return undefined

  const { output, targets } = result.data['react-native-builder-bob']
  const typedDirectories = getTypedOutputDirectories(targets)
  if (typedDirectories.length === 0) return undefined

  const packageJsonName = prettifyDirectory(packageJsonPath)
  const typedPackageJsons = typedDirectories.map((directory) =>
    path.posix.join(output, directory, 'package.json')
  )
  const typedPackageJsonsText = listFormat.format(typedPackageJsons)
  return (
    `${packageJsonName} configures react-native-builder-bob to write ${typedPackageJsonsText} with a "type" field. ` +
    'Metro, TypeScript and Node resolve `#nitro/*` through the nearest package.json, so they cannot resolve it from the built specs. ' +
    'To fix it, build JavaScript with only the `module` target and set `esm: false` on it.'
  )
}

/**
 * Returns the directories inside bob's output that bob writes a package.json
 * with a `type` field to. bob 0.43.2 writes them even if the root
 * package.json has the same `type`. callstack/react-native-builder-bob#957
 * would skip them in that case.
 */
function getTypedOutputDirectories(targets: readonly BobTarget[]): string[] {
  const names = targets.map((target) =>
    typeof target === 'string' ? target : target[0]
  )
  const hasCommonjs = names.includes('commonjs')
  // The `typescript` target uses the `esm` option of the `module` target.
  const esm = targets.some(
    (target) =>
      typeof target !== 'string' &&
      target[0] === 'module' &&
      target[1]?.esm === true
  )
  return names.flatMap((name) => {
    switch (name) {
      case 'commonjs':
        return ['commonjs']
      case 'module':
        return esm ? ['module'] : []
      case 'typescript':
        if (!esm) return []
        // With both JavaScript targets, bob splits the declarations into one
        // folder per target.
        return hasCommonjs
          ? ['typescript/commonjs', 'typescript/module']
          : ['typescript']
      default:
        return []
    }
  })
}
