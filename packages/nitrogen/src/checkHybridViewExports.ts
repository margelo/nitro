import path from 'path'
import type { Node, SourceFile, Symbol } from 'ts-morph'
import { getHybridClassRuntimeDirectory } from './createHybridClassRuntime.js'
import { isHybridView } from './getPlatformSpecs.js'
import { getRealPath } from './utils.js'

interface HybridViewExportErrorsOptions {
  sourceFiles: readonly SourceFile[]
  outputDirectory: string
}

/** View component, props and ref exports must reach callers through the spec. */
export function getHybridViewExportErrors({
  sourceFiles,
  outputDirectory,
}: HybridViewExportErrorsOptions): Error[] {
  const runtimeDirectory = getHybridClassRuntimeDirectory(outputDirectory)
  const errors: Error[] = []
  for (const sourceFile of sourceFiles) {
    const views = sourceFile
      .getClasses()
      .filter((declaration) => isHybridView(declaration.getType()))
    const exportedSymbols = sourceFile.getExportSymbols()
    const starExports = sourceFile
      .getExportDeclarations()
      .filter(
        (declaration) =>
          !declaration.hasNamedExports() &&
          declaration.getNamespaceExport() == null
      )
    const sourcePath = sourceFile.getFilePath()
    for (const view of views) {
      const viewName = view.getName()
      if (viewName == null) continue
      const generatedNames = new Set([
        `${viewName}Component`,
        `${viewName}Props`,
        `${viewName}Ref`,
      ])
      const declarationPath = getRealPath(
        path.join(runtimeDirectory, `${viewName}.d.cts`)
      )
      const reportedNames = new Set<string>()
      const report = (symbol: Symbol, location: Node): void => {
        const name = symbol.getName()
        if (!generatedNames.has(name) || reportedNames.has(name)) return
        if (isGeneratedViewExport(symbol, declarationPath)) return
        errors.push(
          new Error(
            `${sourcePath}:${location.getStartLineNumber()}: "${name}" conflicts with the generated export of HybridView "${viewName}". ` +
              'Rename this export or the view so its component, props and ref exports remain accessible.'
          )
        )
        reportedNames.add(name)
      }

      // Direct declarations and named/namespace exports have a declaration in
      // this source. Plain imports are absent from the exported-symbol list.
      for (const symbol of exportedSymbols) {
        const declaration = symbol
          .getDeclarations()
          .find((node) => node.getSourceFile().getFilePath() === sourcePath)
        if (declaration != null) report(symbol, declaration)
      }
      // Inspect every export-star separately. TypeScript's combined export
      // list can select one symbol and hide a collision from another module.
      for (const starExport of starExports) {
        const module = starExport.getModuleSpecifierSourceFile()
        if (module == null) continue
        for (const symbol of module.getExportSymbols()) {
          report(symbol, starExport)
        }
      }
    }
  }
  return errors
}

/** Re-exporting the expected generated symbol again does not shadow it. */
function isGeneratedViewExport(
  symbol: Symbol,
  declarationPath: string
): boolean {
  const resolvedSymbol = symbol.getAliasedSymbol() ?? symbol
  if (resolvedSymbol.getName() !== symbol.getName()) return false
  const declarations = resolvedSymbol.getDeclarations()
  return (
    declarations.length > 0 &&
    declarations.every(
      (declaration) =>
        getRealPath(declaration.getSourceFile().getFilePath()) ===
        declarationPath
    )
  )
}
