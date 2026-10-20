import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

async function filesRecursively(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(directory, entry.name)
      return entry.isDirectory() ? filesRecursively(resolved) : [resolved]
    })
  )
  return files.flat()
}

export async function calculateSuiteHash(root: string): Promise<string> {
  const benchmarkDirectory = path.join(root, 'tests/react-native/apps/benchmark/src/benchmarks')
  const files = [
    path.join(root, 'tests/react-native/apps/benchmark/index.js'),
    ...(await filesRecursively(benchmarkDirectory)),
  ].sort()
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(path.relative(root, file))
    hash.update(await readFile(file))
  }
  return hash.digest('hex')
}

if (import.meta.main) {
  const root = Bun.argv[2]
  if (root == null) throw new Error('Usage: suite-hash.ts <checkout-root>')
  console.log(await calculateSuiteHash(path.resolve(root)))
}
