import { existsSync } from 'fs'
import { readFile, realpath, writeFile } from 'fs/promises'
import path from 'path'
import chalk from 'chalk'
import { Logger } from '../../Logger.js'
import type { NitroConfig } from '../../config/NitroConfig.js'
import { prettifyDirectory } from '../../prettifyDirectory.js'
import { checkSwiftPMConfig } from './checkSwiftPMConfig.js'
import {
  createSwiftPackageTargets,
  SWIFT_PACKAGE_FUNCTION_NAME,
  SWIFT_PACKAGE_SECTION_BEGIN,
  SWIFT_PACKAGE_SECTION_END,
} from './createSwiftPackageTargets.js'

interface UpdateSwiftPackageManifestOptions {
  /**
   * The root directory of the Swift package, containing `Package.swift`.
   */
  packageDirectory: string
  /**
   * The directory nitrogen writes generated files to.
   */
  outputDirectory: string
  /**
   * Other Nitro modules whose types the specs use.
   */
  moduleDependencies: NitroConfig[]
}

/**
 * Updates nitrogen's section in the Swift package's `Package.swift`.
 *
 * If the manifest has no section yet but calls the generated function,
 * the section is appended. Manifests that use neither are left untouched.
 */
export async function updateSwiftPackageManifest({
  packageDirectory,
  outputDirectory,
  moduleDependencies,
}: UpdateSwiftPackageManifestOptions): Promise<void> {
  const manifestPath = path.join(packageDirectory, 'Package.swift')
  if (!existsSync(manifestPath)) {
    Logger.debug(
      `    No ${chalk.dim('Package.swift')} found in ${chalk.underline(prettifyDirectory(packageDirectory))}, skipping Swift package setup.`
    )
    return
  }

  const manifest = await readFile(manifestPath, 'utf8')
  const lines = manifest.split('\n')
  const beginIndexes = getLineIndexes(lines, SWIFT_PACKAGE_SECTION_BEGIN)
  const endIndexes = getLineIndexes(lines, SWIFT_PACKAGE_SECTION_END)
  const callsFunction = lines.some(
    (line) =>
      !line.trim().startsWith('//') &&
      line.includes(`${SWIFT_PACKAGE_FUNCTION_NAME}(`)
  )
  if (beginIndexes.length === 0 && endIndexes.length === 0 && !callsFunction) {
    Logger.debug(
      `    ${chalk.dim('Package.swift')} does not call ${SWIFT_PACKAGE_FUNCTION_NAME}(...), skipping Swift package setup.`
    )
    return
  }
  checkSwiftPMConfig(packageDirectory)

  const generatedDirectory = await getGeneratedDirectory(
    packageDirectory,
    outputDirectory
  )
  const section = createSwiftPackageTargets({
    generatedDirectory: generatedDirectory,
    moduleDependencies: moduleDependencies,
  })

  const [beginIndex, ...otherBeginIndexes] = beginIndexes
  const [endIndex, ...otherEndIndexes] = endIndexes
  let updatedManifest: string
  if (beginIndex == null && endIndex == null) {
    updatedManifest = [manifest.trimEnd(), '', section, ''].join('\n')
  } else if (
    beginIndex != null &&
    endIndex != null &&
    beginIndex < endIndex &&
    otherBeginIndexes.length === 0 &&
    otherEndIndexes.length === 0
  ) {
    const linesBefore = lines.slice(0, beginIndex)
    const linesAfter = lines.slice(endIndex + 1)
    updatedManifest = [...linesBefore, section, ...linesAfter].join('\n')
  } else {
    throw new Error(
      `${prettifyDirectory(manifestPath)} must contain exactly one "${SWIFT_PACKAGE_SECTION_BEGIN}" line, followed by exactly one "${SWIFT_PACKAGE_SECTION_END}" line.`
    )
  }

  if (updatedManifest === manifest) {
    return
  }
  Logger.info(
    `    Updating Swift package targets in ${chalk.dim('Package.swift')}...`
  )
  await writeFile(manifestPath, updatedManifest, 'utf8')
}

function getLineIndexes(lines: string[], marker: string): number[] {
  const indexes: number[] = []
  for (const [index, line] of lines.entries()) {
    if (line.trim() === marker) {
      indexes.push(index)
    }
  }
  return indexes
}

async function getGeneratedDirectory(
  packageDirectory: string,
  outputDirectory: string
): Promise<string> {
  // Both directories exist at this point. Resolve symlinks, since process.cwd() is a real path.
  const relativePath = path.relative(
    await realpath(packageDirectory),
    await realpath(outputDirectory)
  )
  const isOutsidePackage =
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  if (relativePath === '' || isOutsidePackage) {
    throw new Error(
      `Nitrogen's output directory (${prettifyDirectory(outputDirectory)}) must be a subdirectory of the Swift package (${prettifyDirectory(packageDirectory)}).`
    )
  }
  return relativePath.split(path.sep).join('/')
}
