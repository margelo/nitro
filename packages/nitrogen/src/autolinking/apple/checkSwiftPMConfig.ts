import { existsSync } from 'fs'
import path from 'path'
import chalk from 'chalk'
import { z } from 'zod'
import { Logger } from '../../Logger.js'
import { NitroConfig } from '../../config/NitroConfig.js'
import { readJsonFile } from '../../readJsonFile.js'
import { NITRO_MODULES_PACKAGE_NAME } from './createSwiftPackageTargets.js'

const packageJsonSchema = z.looseObject({
  swiftpmConfig: z
    .looseObject({
      name: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
    })
    .optional(),
})

/**
 * React Native's SwiftPM autolinking links the product named after `swiftpmConfig.name`,
 * and only links the libraries listed in `swiftpmConfig.dependencies` transitively.
 * Warns if the library's `package.json` does not match its `nitro.json`.
 */
export function checkSwiftPMConfig(packageDirectory: string): void {
  const packageJsonPath = path.join(packageDirectory, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return
  }
  const packageJson = readJsonFile(packageJsonPath, packageJsonSchema)
  const moduleName = NitroConfig.current.getAppleModuleName()
  const swiftName = packageJson.swiftpmConfig?.name
  if (swiftName !== moduleName) {
    Logger.warn(
      `⚠️  ${chalk.dim('package.json')} should set ${chalk.bold(`"swiftpmConfig": { "name": "${moduleName}" }`)} ` +
        `(the \`appleModuleName\` in nitro.json), so React Native's Swift Package Manager autolinking links the \`${moduleName}\` product.`
    )
  }
  const dependencies = packageJson.swiftpmConfig?.dependencies ?? []
  if (!dependencies.includes('react-native-nitro-modules')) {
    Logger.warn(
      `⚠️  ${chalk.dim('package.json')} should list ${chalk.bold('"react-native-nitro-modules"')} in ${chalk.bold('swiftpmConfig.dependencies')}, ` +
        `so React Native's Swift Package Manager autolinking always links the \`${NITRO_MODULES_PACKAGE_NAME}\` package.`
    )
  }
}
