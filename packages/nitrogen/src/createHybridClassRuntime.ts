import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import path from 'path'
import { NitroConfig } from './config/NitroConfig.js'
import { createFileMetadataString } from './syntax/helpers.js'
import { getRealPath, indent, toUnixPath } from './utils.js'

interface HybridClassRuntimeFile {
  /** The file name inside the runtime directory (e.g. `Image.cjs`). */
  name: string
  content: string
}

/** The additional runtime and type exports of a React Native view class. */
export interface HybridViewRuntimeSpec {
  name: string
  /** Public writable properties, including inherited properties. */
  propertyNames: readonly string[]
  sourceFilePath: string
  /** The matching component name registered with Fabric. */
  componentName: string
}

interface WriteHybridClassRuntimeOptions {
  classNames: readonly string[]
  views?: readonly HybridViewRuntimeSpec[]
  outputDirectory: string
}

interface LazyExportOptions {
  name: string
  cacheName: string
  setupCode?: string
  initializer: string
}

/** Copies of the getter share its cache, including Babel's re-export getters. */
function createLazyExport({
  name,
  cacheName,
  setupCode,
  initializer,
}: LazyExportOptions): string {
  const initializationCode: string[] = []
  if (setupCode != null) initializationCode.push(setupCode)
  initializationCode.push(`${cacheName} = ${initializer}`)
  return `
get ${name}() {
  if (${cacheName} === undefined) {
    ${indent(initializationCode.join('\n'), '    ')}
  }
  return ${cacheName}
},
`.trim()
}

/** The component's native implementation uses the same property-name list. */
function createComponentInitializer(view: HybridViewRuntimeSpec): string {
  const attributeNames = [...view.propertyNames, 'hybridRef']
  const attributesCode = attributeNames.map((name) => {
    const nameCode = JSON.stringify(name)
    // __proto__ must be a property, not an object literal's prototype setter.
    const keyCode = name === '__proto__' ? `[${nameCode}]` : nameCode
    return `${keyCode}: NitroViewProp,`
  })
  const componentNameCode = JSON.stringify(view.componentName)
  return `
getHostComponent(${componentNameCode}, {
  ${indent(attributesCode.join('\n'), '  ')}
})
`.trim()
}

interface ViewDeclarationOptions {
  view: HybridViewRuntimeSpec
  runtimeDirectory: string
}

function createViewDeclarations({
  view,
  runtimeDirectory,
}: ViewDeclarationOptions): string {
  const { name, propertyNames, sourceFilePath } = view
  // Use a JavaScript extension so this also resolves under NodeNext. TypeScript
  // resolves it to the source .ts (or .d.ts) without importing JavaScript.
  const specPath = getRealPath(sourceFilePath).replace(/(?:\.d)?\.tsx?$/, '.js')
  const relativeSpecPath = toUnixPath(path.relative(runtimeDirectory, specPath))
  const specifier = relativeSpecPath.startsWith('.')
    ? relativeSpecPath
    : `./${relativeSpecPath}`
  const specifierCode = JSON.stringify(specifier)
  const propertyNameCodes = propertyNames.map((propertyName) =>
    JSON.stringify(propertyName)
  )
  const propertyNamesCode =
    propertyNameCodes.length === 0 ? 'never' : propertyNameCodes.join(' | ')
  return `
import type { HostComponent, ViewProps } from 'react-native'
import type { ${name} } from ${specifierCode} with { 'resolution-mode': 'import' }

export type ${name}Props = ViewProps & Pick<${name}, ${propertyNamesCode}>

export type ${name}Ref = ${name}

export declare const ${name}Component: HostComponent<
  ${name}Props & {
    hybridRef?: (view: ${name}Ref) => void
  }
>
`.trim()
}

/** Returns the directory of the generated JavaScript runtime modules. */
export function getHybridClassRuntimeDirectory(
  outputDirectory: string
): string {
  return path.join(outputDirectory, 'shared', 'javascript')
}

/**
 * Returns the output directory of a runtime module, the inverse of
 * getHybridClassRuntimeDirectory.
 */
export function getHybridClassOutputDirectory(runtimeFilePath: string): string {
  return path.join(path.dirname(runtimeFilePath), '..', '..')
}

/** Creates the `.cjs` runtime module and its `.d.cts` declaration for each class. */
function createHybridClassRuntime({
  classNames,
  views = [],
  outputDirectory,
}: WriteHybridClassRuntimeOptions): HybridClassRuntimeFile[] {
  const runtimeDirectory = getRealPath(
    getHybridClassRuntimeDirectory(outputDirectory)
  )
  return classNames.flatMap((name) => {
    const registryName = NitroConfig.current.getHybridClassRegistryName(name)
    const view = views.find((candidate) => candidate.name === name)
    const jsFileName = `${name}.cjs`
    const declarationFileName = `${name}.d.cts`
    const classExportCode = createLazyExport({
      name: name,
      cacheName: 'hybridClass',
      initializer: `NitroModules.getHybridClass('${registryName}')`,
    })
    const exportsCode = [classExportCode]
    const cacheDeclarationsCode = ['let hybridClass']
    let declarationsCode: string
    let cacheComment: string
    if (view != null) {
      cacheComment =
        "// Copies of these getters, e.g. from Babel's interop helpers, share the caches."
      const componentInitializerCode = createComponentInitializer(view)
      const componentExportCode = createLazyExport({
        name: `${name}Component`,
        cacheName: 'hybridComponent',
        setupCode:
          "const { getHostComponent, NitroViewProp } = require('react-native-nitro-modules')",
        initializer: componentInitializerCode,
      })
      exportsCode.push(componentExportCode)
      cacheDeclarationsCode.push('let hybridComponent')
      declarationsCode = createViewDeclarations({
        view: view,
        runtimeDirectory: runtimeDirectory,
      })
    } else {
      cacheComment =
        "// Copies of this getter, e.g. from Babel's interop helpers, share the cached class."
      declarationsCode = `
// The spec's \`export declare class ${name}\` types this runtime export.
export {}
`.trim()
    }
    const jsCode = `
${createFileMetadataString(jsFileName)}

const { NitroModules } = require('${NitroConfig.current.getRuntimePackageName()}')

${cacheComment}
${cacheDeclarationsCode.join('\n')}

module.exports = {
  ${indent(exportsCode.join('\n'), '  ')}
}
`.trim()
    const declarationCode = `
${createFileMetadataString(declarationFileName)}

${declarationsCode}
`.trim()
    return [
      { name: jsFileName, content: jsCode },
      { name: declarationFileName, content: declarationCode },
    ]
  })
}

/**
 * Writes the runtime modules for all classes and returns their paths.
 * Class names must be unique ignoring case, since each one names a file.
 */
export async function writeHybridClassRuntime({
  classNames,
  views,
  outputDirectory,
}: WriteHybridClassRuntimeOptions): Promise<string[]> {
  const directory = getHybridClassRuntimeDirectory(outputDirectory)
  await mkdir(directory, { recursive: true })
  const existingFileNames = await readdir(directory)
  const files = createHybridClassRuntime({
    classNames: classNames,
    views: views,
    outputDirectory: outputDirectory,
  })
  const filePaths: string[] = []
  for (const file of files) {
    const filePath = path.join(directory, file.name)
    const differentlyCasedName = existingFileNames.find(
      (name) =>
        name !== file.name && name.toLowerCase() === file.name.toLowerCase()
    )
    if (differentlyCasedName != null) {
      // Adopt the class name's casing on case-insensitive file systems.
      await rm(path.join(directory, differentlyCasedName))
    }
    await writeFile(filePath, [file.content, ''].join('\n'), 'utf8')
    filePaths.push(filePath)
  }
  return filePaths
}
