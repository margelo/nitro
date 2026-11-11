import { ZodError } from 'zod'
import fs from 'fs'
import {
  NitroUserConfigSchema,
  type NitroUserConfig,
} from './NitroUserConfig.js'
import chalk from 'chalk'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function getLegacyAutolinkingEntries(config: unknown): string[] {
  if (!isObject(config)) return []

  const autolinking = config.autolinking
  if (!isObject(autolinking)) return []

  const entries: string[] = []
  for (const [hybridObjectName, entry] of Object.entries(autolinking)) {
    if (!isObject(entry)) continue

    const hasLegacySyntax =
      'cpp' in entry || 'swift' in entry || 'kotlin' in entry
    if (hasLegacySyntax) {
      entries.push(hybridObjectName)
    }
  }

  return entries
}

// TODO: Remove this once users have migrated to new `nitro.json`
function logLegacyAutolinkingDeprecation(config: unknown): void {
  const legacyEntries = getLegacyAutolinkingEntries(config)
  if (legacyEntries.length === 0) return

  console.warn(
    chalk.yellow(
      `Warning: nitro.json uses deprecated autolinking syntax ("cpp"/"swift"/"kotlin") for [${legacyEntries.join(', ')}]. ` +
        `Use "all"/"ios"/"android" entries with { language, implementationClassName } instead.`
    )
  )
}

function readFile(configPath: string): string {
  try {
    return fs.readFileSync(configPath, 'utf8')
  } catch (error) {
    if (typeof error === 'object' && error != null && 'code' in error) {
      switch (error.code) {
        case 'ENOENT':
        case 'ENOTDIR':
          console.error(
            `❌  The path ${chalk.underline(configPath)} does not exist! Create a ${chalk.underline('nitro.json')} file and try again.`
          )
          process.exit(1)
          // @ts-expect-error
          break
        default:
          throw error
      }
    } else {
      // different kind of error, throw it.
      throw error
    }
  }
}

function propPathToString(propPath: PropertyKey[]): string {
  if (propPath.length === 0) return ''
  const prop = propPath.reduce<string>((prev, curr) => {
    if (typeof curr === 'string') {
      return `${prev}.${curr}`
    } else if (typeof curr === 'number') {
      return `${prev}[${curr}]`
    } else {
      return prev
    }
  }, '')
  return prop.slice(1)
}

function parseConfig(json: string): NitroUserConfig {
  let object: unknown
  try {
    object = JSON.parse(json)
  } catch (error) {
    throw new Error(
      `Failed to parse nitro.json config as JSON! Make sure it has a valid JSON syntax. JSON: ${json}`,
      {
        cause: error,
      }
    )
  }

  try {
    logLegacyAutolinkingDeprecation(object)
    return NitroUserConfigSchema.parse(object)
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((i) => {
        const prop = propPathToString(i.path)
        switch (i.code) {
          case 'invalid_type':
            return `\`${prop}\` must be ${i.expected}, but is ${i.input}.`
          case 'invalid_value':
          case 'invalid_union':
          case 'invalid_element':
            return `\`${prop}\` is not a valid & safe string. It must only contain alphanumeric characters and must not start with a number.`
          default:
            return `\`${prop}\`: ${i.message} (${i.code})`
        }
      })
      console.error(
        `❌  Invalid nitro.json config file! ${issues.join(' - also, ')}`
      )
      process.exit(1)
    } else {
      throw error
    }
  }
}

export function readUserConfig(configPath: string): NitroUserConfig {
  const json = readFile(configPath)
  const config = parseConfig(json)
  return config
}
