import { renderPerformanceReportMarkdown } from './report-markdown'
import { readFile } from 'node:fs/promises'
import { compareRuns, toBencherMetricFormat } from './comparison'
import { parseArguments, repeatedArgument, requiredArgument } from './args'
import { validateBenchmarkRun } from './schema'

const argumentsMap = parseArguments(Bun.argv.slice(2))
const baseFiles = repeatedArgument(argumentsMap, 'base')
const headFiles = repeatedArgument(argumentsMap, 'head')
const output = requiredArgument(argumentsMap, 'output')
const markdownOutput = requiredArgument(argumentsMap, 'markdown-output')
const bencherOutput = requiredArgument(argumentsMap, 'bencher-output')

async function readRun(file: string) {
  return validateBenchmarkRun(JSON.parse(await readFile(file, 'utf8')))
}

const baseRuns = await Promise.all(baseFiles.map(readRun))
const headRuns = await Promise.all(headFiles.map(readRun))
const comparison = compareRuns(baseRuns, headRuns)

await Promise.all([
  Bun.write(output, `${JSON.stringify(comparison, null, 2)}\n`),
  Bun.write(
    markdownOutput,
    renderPerformanceReportMarkdown([comparison], {
      repository: requiredArgument(argumentsMap, 'repository'),
      baseSha: comparison.baseSha,
      headSha: comparison.headSha,
    })
  ),
  Bun.write(
    bencherOutput,
    `${JSON.stringify(toBencherMetricFormat(headRuns), null, 2)}\n`
  ),
])
