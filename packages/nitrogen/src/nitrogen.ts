import { ModuleKind, ModuleResolutionKind, Project, type ClassDeclaration, type Node } from 'ts-morph'
import { mkdir } from 'fs/promises'
import {
  isSomeHybridObject,
  getHybridObjectLiteralOptions,
  parseHybridObjectPlatforms,
  type Platform,
  type Language,
} from './getPlatformSpecs.js'
import { generatePlatformFiles } from './createPlatformSpec.js'
import path from 'path'
import { prettifyDirectory } from './prettifyDirectory.js'
import { capitalizeName, deduplicateFiles, errorToString, getRealPath, toUnixPath } from './utils.js'
import { writeFile } from './writeFile.js'
import chalk from 'chalk'
import { getPlatformDirectory, groupByPlatform, type SourceFile } from './syntax/SourceFile.js'
import { Logger } from './Logger.js'
import { NitroConfig } from './config/NitroConfig.js'
import { createAndroidAutolinking } from './autolinking/createAndroidAutolinking.js'
import { createAppleAutolinking } from './autolinking/createAppleAutolinking.js'
import { updateSwiftPackageManifest } from './autolinking/apple/updateSwiftPackageManifest.js'
import { getImportsCode } from './syntax/getImportCode.js'
import { getModuleDependencies } from './syntax/getModuleDependencies.js'
import type { Autolinking } from './autolinking/Autolinking.js'
import { createGitAttributes } from './createGitAttributes.js'
import { NITROGEN_VERSION } from './config/nitrogenVersion.js'
import type { HybridObjectSpec } from './syntax/HybridObjectSpec.js'
import { writeHybridClassRuntime, type HybridViewRuntimeSpec } from './createHybridClassRuntime.js'
import { getHybridViewComponentName, getHybridViewProperties } from './views/CppHybridViewComponent.js'
import { addHybridClassRuntimeStubs } from './hybridClassReExports.js'
import { addMissingHybridClassReExports, getHybridClassReExportErrors, type HybridClassSpecFile } from './addHybridClassReExports.js'
import { getRuntimeImportsErrors } from './checkHybridClassRuntimeImports.js'
import { getHybridViewExportErrors } from './checkHybridViewExports.js'
import { getBobPackageScopeWarnings } from './checkBobPackageScopes.js'
import { writeHybridClassManifest, type HybridClassManifestEntry } from './hybridClassManifest.js'
import { SourceError } from './SourceError.js'

interface NitrogenOptions {
  baseDirectory: string
  outputDirectory: string
}

interface NitrogenResult {
  generatedFiles: string[]
  targetSpecsCount: number
  generatedSpecsCount: number
}

export async function runNitrogen({ baseDirectory, outputDirectory }: NitrogenOptions): Promise<NitrogenResult> {
  let targetSpecs = 0
  let generatedSpecs = 0
  const generationErrors: Error[] = []

  // Create the TS project
  const project = new Project({
    compilerOptions: {
      strict: true,
      strictNullChecks: true,
      noUncheckedIndexedAccess: true,
      skipLibCheck: false,
      // Resolves the package.json `imports` entry for `#nitro/*`.
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
    },
  })

  const ignorePaths = NitroConfig.current.getIgnorePaths()
  const specPaths = project.getFileSystem().globSync([
    path.join(baseDirectory, '**', '*.nitro.ts'),
    // Installed packages can publish their own specs.
    '!' + path.join(baseDirectory, '**', 'node_modules', '**'),
    ...ignorePaths.map((ignorePath) => '!' + path.join(baseDirectory, ignorePath)),
  ])
  if (specPaths.length === 0) {
    const searchDir = prettifyDirectory(path.join(path.resolve(baseDirectory), '**', '*.nitro.ts'))
    throw new Error(
      `Nitrogen didn't find any spec files in ${chalk.underline(searchDir)}. ` +
        `To create a Nitro Module, create a TypeScript file with the "${chalk.underline('.nitro.ts')}" suffix ` +
        'and export a declared class that extends HybridObject.'
    )
  }
  // Add matched files individually so excluded directories aren't traversed again.
  // Add them by real path, because TypeScript resolves `#nitro/*` from the path
  // it was given, and Node and bundlers resolve it from the real path.
  // A symlink can match the same spec twice.
  // Use forward slashes like the glob, so the order is the same on every platform.
  const uniqueRealSpecPaths = new Set(specPaths.map((filePath) => toUnixPath(getRealPath(filePath))))
  // Sort the real paths, so a symlink doesn't change the order of the specs.
  const realSpecPaths = Array.from(uniqueRealSpecPaths).toSorted()
  // The project also gets runtime stubs below, so use this list for the specs.
  const specSourceFiles = realSpecPaths.map((filePath) => project.addSourceFileAtPath(filePath))

  // Report the selected spec files before resolving their imported types.
  Logger.info(chalk.reset(`🚀  Nitrogen ${chalk.bold(NITROGEN_VERSION)} runs at ${chalk.underline(prettifyDirectory(baseDirectory))}`))
  const specDirectories = new Set(specSourceFiles.map((sourceFile) => sourceFile.getDirectoryPath()))
  for (const directory of specDirectories) {
    const specs = specSourceFiles.filter((sourceFile) => sourceFile.getDirectoryPath() === directory).length
    const relativePath = prettifyDirectory(directory)
    Logger.info(`    🔍  Nitrogen found ${specs} spec${specs === 1 ? '' : 's'} in ${chalk.underline(relativePath)}`)
  }

  // Specs resolve `#nitro/*` through the "imports" field of their nearest package.json.
  const importsErrors = getRuntimeImportsErrors({
    realSpecPaths: realSpecPaths,
    outputDirectory: outputDirectory,
  })
  if (importsErrors.length > 0) {
    throw new Error(importsErrors.join('\n'))
  }
  // A package.json that react-native-builder-bob writes to its output hides that field.
  for (const warning of getBobPackageScopeWarnings(realSpecPaths)) {
    Logger.warn(`⚠️   ${warning}`)
  }

  addHybridClassRuntimeStubs({
    project: project,
    specSourceFiles: specSourceFiles,
    outputDirectory: outputDirectory,
  })
  const program = project.getProgram()
  const diagnostics = specSourceFiles.flatMap((sourceFile) => [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ])
  if (diagnostics.length > 0) {
    throw new Error(project.formatDiagnosticsWithColorAndContext(diagnostics))
  }

  // Check all names first, so no class overwrites another class's files
  // and every name can reach JavaScript through JSI's ASCII functions.
  const classDeclarations = specSourceFiles.flatMap((sourceFile) => sourceFile.getClasses())
  const nameErrors = [
    ...getHybridClassNameErrors(classDeclarations),
    ...getNonAsciiNameErrors(classDeclarations),
    ...getHybridViewExportErrors({
      sourceFiles: specSourceFiles,
      outputDirectory: outputDirectory,
    }),
  ]
  if (nameErrors.length > 0) {
    const messages = nameErrors.map((error) => error.message)
    throw new AggregateError(nameErrors, messages.join('\n'))
  }

  const usedPlatforms: Platform[] = []
  const specsByPlatform: Record<Platform, HybridObjectSpec[]> = {
    ios: [],
    android: [],
  }
  const filesAfter: string[] = []
  const generatedSources: SourceFile[] = []
  const specFiles: HybridClassSpecFile[] = []
  const hybridClasses: HybridClassManifestEntry[] = []
  const views = new Map<string, HybridViewRuntimeSpec>()

  for (const sourceFile of specSourceFiles) {
    Logger.info(`⏳  Parsing ${sourceFile.getBaseName()}...`)

    const classNames: string[] = []

    for (const declaration of sourceFile.getInterfaces()) {
      if (isSomeHybridObject(declaration.getType())) {
        throw new Error(
          `${declaration.getName()}: HybridObject interfaces are no longer supported. Use export declare class in a .nitro.ts spec.`
        )
      }
    }
    const declarations = sourceFile.getClasses()
    for (const declaration of declarations) {
      const typeName = declaration.getName() ?? '<anonymous>'
      try {
        if (!isSomeHybridObject(declaration.getType())) {
          continue
        }
        targetSpecs++
        classNames.push(typeName)
        const literalOptions = getHybridObjectLiteralOptions(declaration)
        const platformSpec = parseHybridObjectPlatforms({
          declaration: declaration,
          literalOptions: literalOptions,
        })
        hybridClasses.push({ name: typeName, platforms: literalOptions })

        const allPlatforms: Platform[] = ['ios', 'android']
        const platforms = allPlatforms.filter((platform) => platformSpec[platform] != null)
        if (platforms.length === 0) {
          throw new Error(
            `${typeName} does not declare any platforms - nothing can be generated. ` +
              `Add \`@iOS(...)\` or \`@Android(...)\` to the declared class.`
          )
        }

        Logger.info(`    ⚙️   Generating specs for HybridObject "${chalk.bold(typeName)}"...`)

        // Create all files and throw it into a big list
        let allFiles = platforms.flatMap((p) => {
          usedPlatforms.push(p)
          const options = platformSpec[p]
          if (options == null) {
            throw new Error(`${typeName}: Missing platform options for ${p}.`)
          }
          const { spec, files } = generatePlatformFiles(declaration.getType(), p, options)
          specsByPlatform[p].push(spec)
          if (spec.isHybridView) {
            const properties = getHybridViewProperties(spec)
            views.set(spec.name, {
              name: spec.name,
              propertyNames: properties.map(({ property }) => property.name),
              sourceFilePath: sourceFile.getFilePath(),
              componentName: getHybridViewComponentName(spec),
            })
          }
          return files
        })
        allFiles = deduplicateFiles(allFiles)
        generatedSources.push(...allFiles)
        // Group the files by platform ({ ios: [], android: [], shared: [] })
        const filesPerPlatform = groupByPlatform(allFiles)
        // Loop through each platform one by one so that it has some kind of order (per-platform)
        for (const platform of ['shared', 'ios', 'android'] as const) {
          const files = filesPerPlatform[platform]
          let language: Language | undefined
          if (platform === 'shared') {
            language = 'c++'
          } else {
            language = platformSpec[platform]?.language
          }
          if (language == null) {
            // if the language was never specified in the spec, skip it
            continue
          }
          if (files.length === 0) {
            // if no files exist on this platform, skip it
            continue
          }

          Logger.info(`        ${chalk.dim(platform)}: Generating ${capitalizeName(language)} code...`)
          // Write the actual files for this specific platform.
          for (const file of files) {
            const basePath = path.join(outputDirectory, getPlatformDirectory(file.platform), file.language)
            const actualPath = await writeFile(basePath, file)
            filesAfter.push(actualPath)
          }
        }

        // Done!
        generatedSpecs++
      } catch (error) {
        if (error instanceof SourceError) {
          generationErrors.push(error)
        } else {
          const location = `${sourceFile.getFilePath()}:${declaration.getStartLineNumber()}`
          generationErrors.push(new Error(`${location}: Failed to generate ${typeName}: ${errorToString(error)}`, { cause: error }))
        }
      }
    }

    if (classNames.length === 0) {
      generationErrors.push(
        new Error(
          `${sourceFile.getFilePath()}: No HybridObject specs found. Export a declared HybridObject class, or remove the .nitro suffix from this file.`
        )
      )
    }

    const specFile: HybridClassSpecFile = {
      sourceFile: sourceFile,
      classNames: classNames,
    }
    generationErrors.push(...getHybridClassReExportErrors(specFile))
    specFiles.push(specFile)
  }

  if (generationErrors.length > 0) {
    const messages = generationErrors.map((error) => error.message)
    throw new AggregateError(generationErrors, messages.join('\n'))
  }

  // SwiftPM always exposes the shared C++ target, including for Swift-only
  // modules that have no native C++ specs or values.
  const sharedCppDirectory = path.join(outputDirectory, 'shared', 'c++')
  if (usedPlatforms.includes('ios') && !generatedSources.some((file) => file.platform === 'shared' && file.language === 'c++')) {
    const name = `${NitroConfig.current.getIosModuleName()}CxxModule`
    const headerName = `${name}.hpp`
    const sourceName = `${name}.cpp`
    const headerImports = getImportsCode([{ language: 'c++', declaration: NitroConfig.current.getCxxHeader(headerName) }])
    const headerCode = `
// Generated by nitrogen. Keeps the SwiftPM C++ module available to its Swift bridge.
#pragma once
`.trim()
    const sourceCode = `
// Generated by nitrogen. Keeps the SwiftPM C++ module available to its Swift bridge.
${headerImports}
`.trim()
    const anchors: SourceFile[] = [
      {
        name: headerName,
        content: headerCode,
        language: 'c++',
        platform: 'shared',
        headerVisibility: 'public',
        subdirectory: [],
      },
      {
        name: sourceName,
        content: sourceCode,
        language: 'c++',
        platform: 'shared',
        subdirectory: [],
      },
    ]
    for (const anchor of anchors) {
      const actualPath = await writeFile(sharedCppDirectory, anchor)
      filesAfter.push(actualPath)
      generatedSources.push(anchor)
    }
  }

  // SwiftPM still needs a Swift module when only C++ consumers and external
  // Swift adapters are present: the private bridge includes its exported header.
  if (usedPlatforms.includes('ios') && !generatedSources.some((file) => file.language === 'swift')) {
    const moduleName = `${NitroConfig.current.getIosModuleName()}Module.swift`
    const imports = getImportsCode([{ language: 'swift', name: 'NitroModules', access: 'internal' }])
    const code = `
// Generated by nitrogen. Keeps the SwiftPM module available to its C++ bridge.
${imports}
`.trim()
    const anchor: SourceFile = {
      name: moduleName,
      content: code,
      language: 'swift',
      platform: 'ios',
      subdirectory: [],
    }
    const actualPath = await writeFile(path.join(outputDirectory, getPlatformDirectory(anchor.platform), anchor.language), anchor)
    filesAfter.push(actualPath)
    generatedSources.push(anchor)
  }

  // Autolinking
  Logger.info(`⛓️   Setting up build configs for autolinking...`)

  const autolinkingFiles: Autolinking[] = []

  if (usedPlatforms.includes('ios')) {
    autolinkingFiles.push(createAppleAutolinking(specsByPlatform.ios))
  }
  if (usedPlatforms.includes('android')) {
    autolinkingFiles.push(createAndroidAutolinking(specsByPlatform.android, generatedSources))
  }

  for (const autolinking of autolinkingFiles) {
    Logger.info(`    Creating autolinking build setup for ${chalk.dim(autolinking.platform)}...`)
    for (const file of autolinking.sourceFiles) {
      const basePath = path.join(outputDirectory, getPlatformDirectory(file.platform))
      const actualPath = await writeFile(basePath, file)
      filesAfter.push(actualPath)
    }
  }
  if (usedPlatforms.includes('ios')) {
    const moduleDependencies = getModuleDependencies(specsByPlatform.ios, NitroConfig.current)
    await updateSwiftPackageManifest({
      packageDirectory: process.cwd(),
      outputDirectory: outputDirectory,
      moduleDependencies: moduleDependencies,
    })
  }

  Logger.info(`📦  Generating JavaScript runtime modules...`)
  const runtimeFiles = await writeHybridClassRuntime({
    classNames: specFiles.flatMap((specFile) => specFile.classNames),
    views: [...views.values()],
    outputDirectory: outputDirectory,
  })
  filesAfter.push(...runtimeFiles)

  Logger.info(`📋  Generating hybrid-classes.json...`)
  const manifestFile = await writeHybridClassManifest({
    hybridClasses: hybridClasses,
    outputDirectory: outputDirectory,
  })
  filesAfter.push(manifestFile)

  for (const specFile of specFiles) {
    const addedLines = await addMissingHybridClassReExports(specFile)
    const specPath = prettifyDirectory(specFile.sourceFile.getFilePath())
    for (const line of addedLines) {
      Logger.info(`📝  Added ${chalk.bold(line)} to ${chalk.underline(specPath)}`)
    }
  }

  try {
    // write a .gitattributes file
    await mkdir(outputDirectory, { recursive: true })
    const file = await createGitAttributes(outputDirectory)
    filesAfter.push(file)
  } catch {
    Logger.error(`❌  Failed to write ${chalk.dim(`.gitattributes`)}!`)
  }

  return {
    generatedFiles: filesAfter,
    targetSpecsCount: targetSpecs,
    generatedSpecsCount: generatedSpecs,
  }
}

/**
 * Returns errors for HybridObject classes whose names are equal ignoring case.
 * Class names name the generated files, and file systems can ignore case.
 */
function getHybridClassNameErrors(declarations: readonly ClassDeclaration[]): Error[] {
  const firstClasses = new Map<string, { name: string; location: string }>()
  const errors: Error[] = []
  for (const declaration of declarations) {
    const name = declaration.getName()
    if (name == null || !isSomeHybridObject(declaration.getType())) continue
    const location = `${declaration.getSourceFile().getFilePath()}:${declaration.getStartLineNumber()}`
    const key = name.toLowerCase()
    const firstClass = firstClasses.get(key)
    if (firstClass == null) {
      firstClasses.set(key, { name: name, location: location })
      continue
    }
    errors.push(
      new Error(
        `${location}: "${name}" conflicts with "${firstClass.name}" (${firstClass.location}). ` +
          'HybridObject class names must be unique ignoring case, because they name the generated files.'
      )
    )
  }
  return errors
}

// A character outside ASCII, e.g. `é` in `café`.
const NON_ASCII_CHARACTER_PATTERN = /\P{ASCII}/u

/**
 * Returns errors for HybridObject classes and members whose names are not ASCII.
 * Nitro creates their JavaScript names with JSI's ASCII functions.
 */
function getNonAsciiNameErrors(declarations: readonly ClassDeclaration[]): Error[] {
  const errors: Error[] = []
  for (const declaration of declarations) {
    const className = declaration.getName()
    if (className == null || !isSomeHybridObject(declaration.getType())) continue
    // Point at the class name, not at the decorators above it.
    const classNameNode = declaration.getNameNode() ?? declaration
    const names: { name: string; displayName: string; node: Node }[] = [{ name: className, displayName: className, node: classNameNode }]
    const members = [...declaration.getInstanceMembers(), ...declaration.getStaticMembers()]
    for (const member of members) {
      // The symbol's name has no quotes or escape sequences, unlike the source text.
      const memberName = member.getSymbol()?.getName()
      if (memberName == null) continue
      names.push({
        name: memberName,
        displayName: `${className}.${memberName}`,
        node: member,
      })
    }
    for (const { name, displayName, node } of names) {
      const character = NON_ASCII_CHARACTER_PATTERN.exec(name)?.[0]
      if (character == null) continue
      const location = `${node.getSourceFile().getFilePath()}:${node.getStartLineNumber()}`
      errors.push(
        new Error(
          `${location}: "${displayName}" contains the non-ASCII character "${character}". ` +
            "HybridObject class and member names must be ASCII, because Nitro creates their JavaScript names with JSI's ASCII functions."
        )
      )
    }
  }
  return errors
}
