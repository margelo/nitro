export function parseArguments(argv: readonly string[]): Map<string, string[]> {
  const values = new Map<string, string[]>()
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!
    if (!argument.startsWith('--')) {
      throw new Error(`Unexpected argument: ${argument}`)
    }
    const value = argv[index + 1]
    if (value == null || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}.`)
    }
    const key = argument.slice(2)
    values.set(key, [...(values.get(key) ?? []), value])
    index += 1
  }
  return values
}

export function requiredArgument(
  argumentsMap: Map<string, string[]>,
  name: string
): string {
  const value = argumentsMap.get(name)?.[0]
  if (value == null) throw new Error(`Missing --${name}.`)
  return value
}

export function repeatedArgument(
  argumentsMap: Map<string, string[]>,
  name: string
): string[] {
  const values = argumentsMap.get(name) ?? []
  if (values.length === 0) throw new Error(`Missing --${name}.`)
  return values
}
