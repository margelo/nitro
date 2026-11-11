#!/usr/bin/env node

import yargs from 'yargs/yargs'
import { hideBin } from 'yargs/helpers'
import chalk from 'chalk'
import { prettifyDirectory } from './prettifyDirectory.js'
import { getFiles } from './getFiles.js'
import { runNitrogen } from './nitrogen.js'
import { promises as fs } from 'fs'
import { isValidLogLevel, setLogLevel } from './Logger.js'
import { initNewNitroModule } from './init.js'
import { NITROGEN_VERSION } from './config/nitrogenVersion.js'

const commandName = 'nitrogen'

// Maximum of 100 col width
const cliWidth = Math.min(process.stdout.columns * 0.9, 100)

// Set up yargs CLI app
await yargs(hideBin(process.argv))
  .option('log-level', {
    type: 'string',
    description: 'Configures the log-level of nitrogen.',
    default: 'info',
    choices: ['debug', 'info', 'warning', 'error'],
  })
  .middleware((args) => {
    if (!isValidLogLevel(args.logLevel)) {
      throw new Error(`Invalid log-level ("${args.logLevel}")!`)
    }
    setLogLevel(args.logLevel)
  })
  // 🔥 nitrogen [path]
  .command(
    '$0 [basePath]',
    `Usage: ${chalk.bold(`${commandName} <basePath> [options]`)}\n` +
      `Run the nitro code-generator on all ${chalk.underline('**/*.nitro.ts')} files found ` +
      `in the current directory and generate C++, Swift or Kotlin outputs in ${chalk.underline('./nitrogen/generated')}.`,
    (y) =>
      y
        .positional('basePath', {
          type: 'string',
          description: `The base path of where Nitrogen will start looking for ${chalk.underline('**/*.nitro.ts')} specs.`,
          default: process.cwd(),
        })
        .option('out', {
          type: 'string',
          description:
            'Configures the output path of the generated C++, Swift or Kotlin files.',
          default: './nitrogen/generated',
        })
        .option('config', {
          type: 'string',
          description: `A custom path to a ${chalk.underline('nitro.json')} config file.`,
          default: './nitro.json',
        }),
    async (argv) => {
      const basePath = argv.basePath
      const outputDirectory = argv.out
      await runNitrogenCommand(basePath, outputDirectory)
    }
  )
  // 🔥 nitrogen init <moduleName>
  .command(
    'init <moduleName>',
    `Usage: ${chalk.bold(`${commandName} init <moduleName> [options]`)}\n` +
      `Create a new Nitro Module.`,
    (y) =>
      y
        .positional('moduleName', {
          type: 'string',
          description: 'The name of the Nitro Module that will be created.',
          demandOption: true,
        })
        .option('path', {
          type: 'string',
          description: `A custom path to create the new Nitro Module in - instead of the current working directory.`,
          default: process.cwd(),
        }),
    async (argv) => {
      await initNewNitroModule(argv.path, argv.moduleName)
    }
  )
  .usage(
    `Usage: ${chalk.bold('$0 [options]')}\n` +
      `$0 is a code-generater for Nitro Modules (${chalk.underline('https://github.com/margelo/nitro')})\n` +
      `It converts all TypeScript specs found in ${chalk.underline('**/*.nitro.ts')} to C++, Swift or Kotlin specs.\n` +
      `Each library/module must have a ${chalk.underline('nitro.json')} configuration file in its root directory.\n` +
      `$Nitrogen Version: ${chalk.bold(NITROGEN_VERSION)}`
  )
  .help()
  .strict()
  .version(NITROGEN_VERSION)
  .wrap(cliWidth).argv

async function runNitrogenCommand(
  baseDirectory: string,
  outputDirectory: string
): Promise<void> {
  // 1. Prepare output folders
  const filesBefore = await getFiles(outputDirectory)

  const start = performance.now()

  // 2. Run Nitrogen
  const { generatedFiles, generatedSpecsCount, targetSpecsCount } =
    await runNitrogen({
      baseDirectory: baseDirectory,
      outputDirectory: outputDirectory,
    })

  const end = performance.now()
  const timeS = ((end - start) / 1000).toFixed(1)
  console.log(
    `🎉  Generated ${generatedSpecsCount}/${targetSpecsCount} HybridObject${generatedSpecsCount === 1 ? '' : 's'} in ${timeS}s!`
  )
  console.log(
    `💡  Your code is in ${chalk.underline(prettifyDirectory(outputDirectory))}`
  )

  // 3. Delete all old dangling files
  const addedFiles = generatedFiles.filter((f) => !filesBefore.includes(f))
  const removedFiles = filesBefore.filter((f) => !generatedFiles.includes(f))
  if (addedFiles.length > 0 || removedFiles.length > 0) {
    let text = ''
    const as = addedFiles.length > 1 ? 's' : ''
    const rs = removedFiles.length > 1 ? 's' : ''
    if (addedFiles.length > 0 && removedFiles.length === 0) {
      text = `Added ${addedFiles.length} file${as}`
    } else if (addedFiles.length === 0 && removedFiles.length > 0) {
      text = `Removed ${removedFiles.length} file${rs}`
    } else {
      text = `Added ${addedFiles.length} file${as} and removed ${removedFiles.length} file${rs}`
    }

    console.log(
      `‼️   ${text} - ${chalk.bold('you need to run `pod install`/sync gradle to update files!')}`
    )
  }
  const promises = removedFiles.map(async (file) => {
    const stat = await fs.stat(file)
    if (stat.isFile()) {
      await fs.rm(file)
    }
  })
  await Promise.all(promises)
}
