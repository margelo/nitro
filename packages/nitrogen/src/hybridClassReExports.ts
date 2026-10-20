import path from 'path'
import type {
  ExportDeclaration,
  Project,
  SourceFile,
  StringLiteral,
} from 'ts-morph'
import { getHybridClassRuntimeDirectory } from './createHybridClassRuntime.js'
import { getRealPath } from './utils.js'

/** Specs re-export each class from this package import, e.g. `#nitro/Image`. */
export const RUNTIME_IMPORT_PREFIX = '#nitro/'

/** A spec's `export * from '#nitro/<ClassName>'` declaration. */
export interface HybridClassReExport {
  declaration: ExportDeclaration
  specifier: StringLiteral
  className: string
}

/** Returns a spec's `export * from '#nitro/...'` declarations. */
export function getHybridClassReExports(
  sourceFile: SourceFile
): HybridClassReExport[] {
  return sourceFile.getExportDeclarations().flatMap((declaration) => {
    const specifier = declaration.getModuleSpecifier()
    if (specifier == null || declaration.isTypeOnly()) return []
    if (declaration.hasNamedExports()) return []
    if (declaration.getNamespaceExport() != null) return []
    const value = specifier.getLiteralValue()
    if (!value.startsWith(RUNTIME_IMPORT_PREFIX)) return []
    const className = value.slice(RUNTIME_IMPORT_PREFIX.length)
    return [
      { declaration: declaration, specifier: specifier, className: className },
    ]
  })
}

interface AddHybridClassRuntimeStubsOptions {
  project: Project
  /** Spec files, added at their real paths. */
  specSourceFiles: readonly SourceFile[]
  outputDirectory: string
}

/**
 * Adds an empty in-memory `<ClassName>.d.cts` for each `#nitro/<ClassName>`
 * re-export whose declaration is not on disk yet, e.g. on the first run.
 * TypeScript then resolves the re-export through the package.json `imports`
 * entry like it does once Nitrogen has written the file. Nitrogen never saves
 * the project, so the stubs stay in memory.
 */
export function addHybridClassRuntimeStubs({
  project,
  specSourceFiles,
  outputDirectory,
}: AddHybridClassRuntimeStubsOptions): void {
  // TypeScript resolves the re-exports from the real spec paths, so it looks
  // in the real runtime directory, e.g. when `--out` is a symlink.
  const runtimeDirectory = getRealPath(
    getHybridClassRuntimeDirectory(outputDirectory)
  )
  const declarationPaths = specSourceFiles.flatMap((sourceFile) =>
    getHybridClassReExports(sourceFile).map((reExport) =>
      path.join(runtimeDirectory, `${reExport.className}.d.cts`)
    )
  )
  // Several specs can re-export the same class.
  const uniqueDeclarationPaths = new Set(declarationPaths)
  for (const declarationPath of uniqueDeclarationPaths) {
    if (project.getFileSystem().fileExistsSync(declarationPath)) continue
    project.createSourceFile(declarationPath, 'export {}\n')
  }
}
