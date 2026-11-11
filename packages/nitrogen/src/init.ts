import path from 'path'
import { prettifyDirectory } from './prettifyDirectory.js'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { Logger } from './Logger.js'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { randomUUID } from 'crypto'

export async function initNewNitroModule(
  baseDirectory: string,
  moduleName: string,
  ref: string = 'main'
): Promise<void> {
  Logger.info(
    `⚙️  Creating new Nitro Module "${chalk.bold(moduleName)}" in ${chalk.underline(prettifyDirectory(baseDirectory))}...`
  )

  const directory = path.join(baseDirectory, moduleName)
  if (existsSync(directory)) {
    Logger.error(
      `❌ A folder named "${chalk.underline(moduleName)}" already exists in the directory ${chalk.underline(prettifyDirectory(baseDirectory))}!`
    )
    process.exit(1)
  }

  await fs.mkdir(directory)

  const modulePath = await downloadGitHubFolder(
    'margelo',
    'nitro',
    ref,
    'packages/template',
    directory
  )
  Logger.info(`🏗️  Constructing template...`)

  const cleanLibraryName = moduleName.replace('react-native-', '')
  const cxxNamespace = cleanLibraryName.replaceAll('-', '')
  let camelCaseName = cleanLibraryName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
  if (!camelCaseName.startsWith('Nitro')) {
    camelCaseName = 'Nitro' + camelCaseName
  }

  await replaceTemplate(modulePath, `cxxNamespace`, cxxNamespace)
  await replaceTemplate(modulePath, `androidNamespace`, cxxNamespace)
  await replaceTemplate(modulePath, `androidCxxLibName`, camelCaseName)
  await replaceTemplate(modulePath, `iosModuleName`, camelCaseName)
  await replaceTemplate(modulePath, `packageName`, moduleName)
  await replaceTemplate(modulePath, `packageDescription`, moduleName)

  Logger.info(
    `🎉 Created Nitro Module "${chalk.bold(moduleName)}" in ${chalk.underline(prettifyDirectory(directory))}!`
  )
  Logger.info(
    `👉 To install dependencies, use your package manager of choice (e.g. ${chalk.bold('npm install')})`
  )
  Logger.info(
    `👉 To create your first Hybrid Object, add a ${chalk.underline(`*.nitro.ts`)} file, declare a TypeScript interface that extends ${chalk.bold('HybridObject<...>')}, and run ${chalk.bold('npx nitrogen')}.`
  )
  Logger.info(
    `👉 To test your module in an app, create a new React Native app somewhere (e.g. in ${chalk.underline(`./${moduleName}/example`)}) and add ${chalk.bold(moduleName)} as a local dependency.`
  )
}

async function isGitInstalled(): Promise<boolean> {
  try {
    execSync('git --version')
    return true
  } catch {
    return false
  }
}

async function downloadGitHubFolder(
  owner: string,
  repo: string,
  branch: string,
  folder: string,
  outputPath: string
): Promise<string> {
  if (!isGitInstalled()) {
    console.error(
      `❌ ${chalk.bold('git')} is not installed or available in the current path! Make sure to install ${chalk.bold('git')} and try again.`
    )
    process.exit(1)
  }

  const repoUrl = `https://github.com/${owner}/${repo}`
  Logger.info(`⏳ Cloning ${chalk.underline(repoUrl)}...`)
  const tempPath = randomUUID()
  const tempDir = path.join(outputPath, tempPath)
  execSync(
    `git clone --depth 1 --filter=blob:none -b ${branch} --quiet --sparse ${repoUrl} "${tempDir}"`
  )
  const prettyOutputPath = prettifyDirectory(outputPath)

  const initialDir = process.cwd()
  try {
    process.chdir(tempDir)

    Logger.debug(`⏳ Checking out ${chalk.underline(folder)}...`)
    execSync(`git sparse-checkout set ${folder}`)

    Logger.debug(
      `📁 Copying files from ${chalk.underline(`${prettyOutputPath}/${tempPath}`)} to ${chalk.underline(prettyOutputPath)}...`
    )
    const sourcePath = path.join(tempDir, folder)
    await fs.mkdir(outputPath, { recursive: true })
    await copyFolder(sourcePath, outputPath)

    return outputPath
  } finally {
    // change dir back to original
    process.chdir(initialDir)

    Logger.debug(
      `🗑️  Removing temporary folder ${chalk.underline(prettifyDirectory(tempDir))}...`
    )
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

async function copyFolder(src: string, dest: string) {
  const entries = await fs.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await fs.mkdir(destPath, { recursive: true })
      await copyFolder(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

async function replaceTemplate(
  dir: string,
  templateName: string,
  replacementValue: string
): Promise<void> {
  const replaceInFile = async (filePath: string) => {
    const content = await fs.readFile(filePath, 'utf8')
    const updatedContent = content.replaceAll(
      `$$${templateName}$$`,
      replacementValue
    )
    if (content !== updatedContent) {
      await fs.writeFile(filePath, updatedContent, 'utf8')
    }
  }

  const replaceInName = (name: string) => {
    return name.replaceAll(`$$${templateName}$$`, replacementValue)
  }

  const processDirectory = async (currentDir: string) => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const oldPath = path.join(currentDir, entry.name)
      const updatedName = replaceInName(entry.name)
      const newPath = path.join(currentDir, updatedName)

      if (oldPath !== newPath) {
        await fs.rename(oldPath, newPath)
      }

      if (entry.isDirectory()) {
        await processDirectory(newPath)
      } else if (entry.isFile()) {
        await replaceInFile(newPath)
      }
    }
  }

  if (!existsSync(dir)) {
    throw new Error(`The directory "${dir}" does not exist.`)
  }

  await processDirectory(dir)
}
