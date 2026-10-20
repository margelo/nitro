import type { SourceFile } from './syntax/SourceFile.js'
import path from 'path'
import fs from 'fs'
import type { Type } from 'ts-morph'
import { isNotDuplicate } from './syntax/helpers.js'
import { readUserConfig } from './config/getConfig.js'
import { NitroConfig } from './config/NitroConfig.js'

export function capitalizeName(name: string): string {
  if (name.length === 0) return name
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function createIndentation(spacesCount: number): string {
  return Array.from(Array(spacesCount)).fill(' ').join('')
}

export function indent(string: string, spacesCount: number): string
export function indent(string: string, indentation: string): string
export function indent(string: string, indentation: string | number): string {
  let spaces: string
  if (typeof indentation === 'number') {
    spaces = createIndentation(indentation)
  } else {
    spaces = indentation
  }
  return string.replaceAll('\n', `\n${spaces}`)
}

export function errorToString(error: unknown): string {
  if (error == null) {
    return `null`
  }
  if (typeof error !== 'object') {
    return `${error}`
  }
  if (error instanceof Error) {
    let message = `${error.name}: ${error.message}`
    if (error.cause != null) {
      // JSON.stringify() turns an Error into `{}`.
      const cause =
        error.cause instanceof Error
          ? errorToString(error.cause)
          : JSON.stringify(error.cause)
      message += ` (cause: ${cause})`
    }
    return message
  }
  if ('toString' in error) {
    return error.toString()
  }
  return JSON.stringify(error)
}

export function escapeComments(string: string): string {
  return string
    .replace(/\/\*/g, '/ *') // Escape start of comment
    .replace(/\*\//g, '* /') // Escape end of comment
    .replace(/\/\//g, '/ /') // Escape single-line comment
}

const HAS_UNIX_PATHS = path.join('a', 'b').includes('/')
export function toUnixPath(p: string): string {
  if (HAS_UNIX_PATHS) return p
  return p.replaceAll('\\', '/')
}

/**
 * Resolves symlinks in `filePath`, which may not exist yet. A missing part is
 * appended to the real path of its nearest existing parent.
 */
export function getRealPath(filePath: string): string {
  const absolutePath = path.resolve(filePath)
  const parentPath = path.dirname(absolutePath)
  if (fs.existsSync(absolutePath) || parentPath === absolutePath) {
    return fs.realpathSync(absolutePath)
  }
  return path.join(getRealPath(parentPath), path.basename(absolutePath))
}

const sep = path.sep
export function unsafeFastJoin(...segments: string[]): string {
  // this function should really not take any unsafe strings like `/` or `\`.
  return segments.join(sep)
}

function getFullPath(file: SourceFile): string {
  return unsafeFastJoin(
    file.platform,
    file.language,
    ...file.subdirectory,
    file.name
  )
}

/**
 * Deduplicates all files via their full path.
 * If content differs, you are f*cked.
 */
export function deduplicateFiles(files: SourceFile[]): SourceFile[] {
  const map = new Map<string, SourceFile>()
  for (const file of files) {
    const filePath = getFullPath(file)

    if (!map.has(filePath)) {
      map.set(filePath, file)
    }
  }
  return [...map.values()]
}

export function toLowerCamelCase(string: string): string {
  const parts = string.split('_').filter((part) => part !== '')

  if (parts.length === 0) return ''

  const camelCaseString = parts[0]!.toLowerCase()

  const camelCased = parts
    .slice(1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())

  return camelCaseString + camelCased.join('')
}

export function getDirectBaseTypes(type: Type): Type[] {
  const baseTypes = type.getBaseTypes()
  const symbol = type.getSymbol()
  if (symbol != null) {
    baseTypes.push(...symbol.getDeclaredType().getBaseTypes())
  }
  return baseTypes.filter(isNotDuplicate)
}

export function getHybridObjectNitroModuleConfig(
  type: Type
): NitroConfig | undefined {
  const symbol = type.getSymbol() ?? type.getAliasSymbol()
  if (!symbol) return undefined

  const declarations =
    symbol.getValueDeclaration() || symbol.getDeclarations()[0]
  if (!declarations) return undefined

  const sourceFile = declarations.getSourceFile()
  const directory = getNitroModuleDirectory(sourceFile.getFilePath())
  if (directory == null) return undefined

  const config = readUserConfig(path.join(directory, 'nitro.json'))
  return new NitroConfig(config)
}

/** Returns the directory of the nitro.json that configures the given file. */
export function getNitroModuleDirectory(filePath: string): string | undefined {
  let directory = filePath

  while (true) {
    // go up one dir
    const parentDirectory = path.resolve(path.join(directory, '..'))
    if (directory === parentDirectory) {
      // going 'cd ..' in that path didn't change a thing - so we
      // reached the root directory. we didn't find a nitro.json anywhere.
      return undefined
    }
    directory = parentDirectory
    // An installed package's nitro.json is inside the package, never above its node_modules.
    if (path.basename(directory) === 'node_modules') return undefined

    const hasNitroJson = fs.existsSync(path.join(directory, 'nitro.json'))
    if (hasNitroJson) return directory
  }
}
