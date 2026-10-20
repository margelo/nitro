import fs from 'fs'
import { z } from 'zod'
import { prettifyDirectory } from './prettifyDirectory.js'

/** Reads a JSON file and validates its content with `schema`. */
export function readJsonFile<T>(filePath: string, schema: z.ZodType<T>): T {
  const text = fs.readFileSync(filePath, 'utf8')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to parse ${prettifyDirectory(filePath)} as JSON: ${reason}`
    )
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    throw new Error(
      `Invalid ${prettifyDirectory(filePath)}: ${z.prettifyError(result.error)}`
    )
  }
  return result.data
}
