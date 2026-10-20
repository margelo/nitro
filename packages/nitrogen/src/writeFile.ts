import path from 'path'
import { promises as fs } from 'fs'
import { capitalizeName } from './utils.js'
import type { SourceFile } from './syntax/SourceFile.js'
import chalk from 'chalk'
import { Logger } from './Logger.js'
import { NitroConfig } from './config/NitroConfig.js'

/**
 * Writes the given file to disk and returns its actual path.
 */
export async function writeFile(
  basePath: string,
  file: SourceFile
): Promise<string> {
  let directory = file.subdirectory
  if (file.language === 'c++' && file.name.endsWith('.hpp')) {
    const visibility =
      file.headerVisibility ??
      (file.platform === 'shared' ? 'public' : 'private')
    directory = [
      ...directory,
      ...NitroConfig.current.getCxxHeaderDirectory(visibility),
    ]
  }
  const filepath = path.join(basePath, ...directory, file.name)
  const language = capitalizeName(file.language)
  Logger.debug(`          ${chalk.dim(language)}: Creating ${file.name}...`)

  const dir = path.dirname(filepath)
  // Create directory if it doesn't exist yet
  await fs.mkdir(dir, { recursive: true })

  // Write file
  await fs.writeFile(
    filepath,
    file.content.replaceAll(/[ \t]+$/gm, '').trim() + '\n',
    'utf8'
  )

  return filepath
}
