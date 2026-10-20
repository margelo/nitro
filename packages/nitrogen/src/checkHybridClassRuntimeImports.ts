import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { RUNTIME_IMPORT_PREFIX } from './hybridClassReExports.js'
import { getHybridClassRuntimeDirectory } from './createHybridClassRuntime.js'
import { prettifyDirectory } from './prettifyDirectory.js'
import { readJsonFile } from './readJsonFile.js'
import { getRealPath, toUnixPath } from './utils.js'

/** The package.json `imports` key that resolves `#nitro/<ClassName>`. */
const RUNTIME_IMPORTS_KEY = `${RUNTIME_IMPORT_PREFIX}*`

const packageJsonSchema = z.object({
  imports: z.record(z.string(), z.unknown()).optional(),
})

// A target is a path, or conditions that map to targets.
type ImportsTarget = string | ImportsConditions
interface ImportsConditions {
  [condition: string]: ImportsTarget
}
const importsTargetSchema: z.ZodType<ImportsTarget> = z.lazy(() =>
  z.union([z.string(), z.record(z.string(), importsTargetSchema)])
)

const conditionsListFormat = new Intl.ListFormat('en', { type: 'conjunction' })

interface RuntimeImportsErrorsOptions {
  /** Real paths of the spec files, which re-export `#nitro/<ClassName>`. */
  realSpecPaths: readonly string[]
  outputDirectory: string
}

/** The paths that `#nitro/*` can point to in a package. */
interface RuntimeImportsTargets {
  /** The runtime modules, `<out>/shared/javascript/*.cjs`. */
  modules: string
  /** Their declarations, which a `types` condition can point to instead. */
  declarations: string
}

/** A condition of an `imports` entry that resolves somewhere else. */
interface WrongCondition {
  /** The condition path, e.g. `default` or `react-native.import`. */
  name: string
  /** Whether it is a `types` condition, which can point to the declarations. */
  isTypes: boolean
}

interface ImportsEntryOptions {
  packageJsonPath: string
  imports: Record<string, unknown> | undefined
  targets: RuntimeImportsTargets
  runtimeDirectory: string
}

/**
 * Returns an error for each package.json of a spec that does not map
 * `#nitro/*` to the generated runtime modules.
 */
export function getRuntimeImportsErrors({
  realSpecPaths,
  outputDirectory,
}: RuntimeImportsErrorsOptions): string[] {
  // Compare real paths, so a symlink in the base path or the output path
  // doesn't move the runtime directory outside the package.
  const runtimeDirectory = getRealPath(
    getHybridClassRuntimeDirectory(outputDirectory)
  )
  const errors: string[] = []
  const packageJsonPaths = new Set<string>()
  for (const specPath of realSpecPaths) {
    const packageJsonPath = findPackageJson(specPath)
    if (packageJsonPath == null) {
      errors.push(
        `${prettifyDirectory(specPath)} is not inside a package. Specs import \`#nitro/*\` through the "imports" field of their nearest package.json.`
      )
      continue
    }
    if (packageJsonPaths.has(packageJsonPath)) continue
    packageJsonPaths.add(packageJsonPath)

    const packageJsonName = prettifyDirectory(packageJsonPath)
    const packageDirectory = path.dirname(packageJsonPath)
    const targets = getRuntimeImportsTargets(packageDirectory, runtimeDirectory)
    if (targets == null) {
      errors.push(
        `${prettifyDirectory(specPath)} resolves \`#nitro/*\` through ${packageJsonName}, but Nitrogen writes the runtime modules to ${prettifyDirectory(runtimeDirectory)}, outside that package. ` +
          `Package imports cannot point outside their package. Run Nitrogen from the package directory or set --out to a directory inside it. If ${packageJsonName} is not the package root, remove it.`
      )
      continue
    }
    let imports: Record<string, unknown> | undefined
    try {
      imports = readJsonFile(packageJsonPath, packageJsonSchema).imports
    } catch (error) {
      // Report it along with the errors of other packages.
      errors.push(error instanceof Error ? error.message : String(error))
      continue
    }
    const problem = getImportsEntryProblem({
      packageJsonPath: packageJsonPath,
      imports: imports,
      targets: targets,
      runtimeDirectory: runtimeDirectory,
    })
    if (problem != null) errors.push(problem)
  }
  return errors
}

/** Returns the nearest package.json above `filePath`, which scopes its imports. */
export function findPackageJson(filePath: string): string | undefined {
  let directory = path.dirname(path.resolve(filePath))
  while (true) {
    // Like Node, don't look past node_modules into the enclosing package.
    if (path.basename(directory) === 'node_modules') return undefined
    const packageJsonPath = path.join(directory, 'package.json')
    if (fs.existsSync(packageJsonPath)) return packageJsonPath
    const parentDirectory = path.dirname(directory)
    if (parentDirectory === directory) return undefined
    directory = parentDirectory
  }
}

/**
 * Returns the `#nitro/*` targets for a package, or `undefined` if the runtime
 * directory is outside the package, where package imports cannot point.
 */
function getRuntimeImportsTargets(
  packageDirectory: string,
  runtimeDirectory: string
): RuntimeImportsTargets | undefined {
  const relativePath = path.relative(packageDirectory, runtimeDirectory)
  const isOutside =
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  if (isOutside) return undefined
  return {
    modules: `./${toUnixPath(path.join(relativePath, '*.cjs'))}`,
    declarations: `./${toUnixPath(path.join(relativePath, '*.d.cts'))}`,
  }
}

/** Returns why the package.json does not map `#nitro/*` to the runtime modules. */
function getImportsEntryProblem({
  packageJsonPath,
  imports,
  targets,
  runtimeDirectory,
}: ImportsEntryOptions): string | undefined {
  const packageJsonName = prettifyDirectory(packageJsonPath)
  const target = targets.modules
  const entryCode = `"${RUNTIME_IMPORTS_KEY}": ${JSON.stringify(target)}`
  if (imports == null) {
    const importsCode = `
"imports": {
  ${entryCode}
}
`.trim()
    return [
      `${packageJsonName} does not map \`#nitro/*\` to Nitrogen's runtime modules. Add this to it:`,
      importsCode,
    ].join('\n')
  }
  const entry = imports[RUNTIME_IMPORTS_KEY]
  if (entry === undefined) {
    return [
      `${packageJsonName} does not map \`#nitro/*\` to Nitrogen's runtime modules. Add this to its "imports":`,
      entryCode,
    ].join('\n')
  }

  const result = importsTargetSchema.safeParse(entry)
  if (result.success && result.data === target) return undefined
  const mismatch = `${packageJsonName} maps \`#nitro/*\` to ${JSON.stringify(entry)}, but Nitrogen writes the runtime modules to ${prettifyDirectory(runtimeDirectory)}.`
  if (result.success && typeof result.data === 'object') {
    // Keep the entry's other conditions, e.g. `types`, and only fix the wrong ones.
    const wrongConditions = getWrongConditions(result.data, targets)
    if (result.data.default === undefined) {
      wrongConditions.push({ name: 'default', isTypes: false })
    }
    if (wrongConditions.length === 0) return undefined
    const conditionsCode = conditionsListFormat.format(
      wrongConditions.map((condition) => `\`${condition.name}\``)
    )
    const s = wrongConditions.length === 1 ? '' : 's'
    // If only `types` conditions are wrong, suggest the declarations like the README.
    const isOnlyTypes = wrongConditions.every((condition) => condition.isTypes)
    const suggestedTarget = isOnlyTypes ? targets.declarations : targets.modules
    return `${mismatch} In that entry, set the ${conditionsCode} condition${s} to ${JSON.stringify(suggestedTarget)}.`
  }
  return [`${mismatch} Change it in "imports" to:`, entryCode].join('\n')
}

/**
 * Returns the conditions that resolve somewhere other than the runtime
 * modules, e.g. `default` or `react-native.import`. TypeScript resolves the
 * spec re-exports through `types`, so a `types` condition must point to the
 * runtime modules or their declarations.
 */
function getWrongConditions(
  conditions: ImportsConditions,
  targets: RuntimeImportsTargets
): WrongCondition[] {
  return Object.entries(conditions).flatMap(([condition, conditionTarget]) => {
    if (typeof conditionTarget === 'string') {
      const isTypes = condition === 'types'
      const isTypesTarget = isTypes && conditionTarget === targets.declarations
      const isCorrect = conditionTarget === targets.modules || isTypesTarget
      return isCorrect ? [] : [{ name: condition, isTypes: isTypes }]
    }
    const nestedConditions = getWrongConditions(conditionTarget, targets)
    return nestedConditions.map((nested) => ({
      name: `${condition}.${nested.name}`,
      isTypes: nested.isTypes,
    }))
  })
}
