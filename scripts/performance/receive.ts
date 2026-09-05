import { parseArguments, requiredArgument } from './args'
import { validateBenchmarkRun, validateExpectedRun } from './schema'
import type { BenchmarkRunConfiguration } from '../../apps/benchmark/src/benchmarks/types'

const MAX_BODY_BYTES = 5 * 1024 * 1024

const argumentsMap = parseArguments(Bun.argv.slice(2))
const output = requiredArgument(argumentsMap, 'output')
const timeoutMs = Number(argumentsMap.get('timeout-ms')?.[0] ?? '900000')
const port = Number(argumentsMap.get('port')?.[0] ?? '8173')
const platform = requiredArgument(argumentsMap, 'platform')
if (platform !== 'android' && platform !== 'ios') {
  throw new Error('--platform must be android or ios.')
}

const configuration: BenchmarkRunConfiguration = {
  ...(argumentsMap.has('calibration') ? { calibration: true as const } : {}),
  ...(argumentsMap.has('work-id')
    ? {
        work: {
          id: requiredArgument(argumentsMap, 'work-id'),
          iterations: Number(requiredArgument(argumentsMap, 'iterations')),
          chunkIterations: Number(
            requiredArgument(argumentsMap, 'chunk-iterations')
          ),
        },
      }
    : {}),
  ...(argumentsMap.has('benchmark-index')
    ? {
        benchmarkIndex: Number(
          requiredArgument(argumentsMap, 'benchmark-index')
        ),
      }
    : {}),
  runId: requiredArgument(argumentsMap, 'run-id'),
  reverse: requiredArgument(argumentsMap, 'reverse') === 'true',
  commitSha: requiredArgument(argumentsMap, 'commit-sha'),
  suiteHash: requiredArgument(argumentsMap, 'suite-hash'),
  platform,
  device: requiredArgument(argumentsMap, 'device'),
  osVersion: requiredArgument(argumentsMap, 'os-version'),
  architecture: requiredArgument(argumentsMap, 'architecture'),
  toolchain: requiredArgument(argumentsMap, 'toolchain'),
}

let resolveCompletion: () => void = () => {}
let rejectCompletion: (error: Error) => void = () => {}
const completion = new Promise<void>((resolve, reject) => {
  resolveCompletion = resolve
  rejectCompletion = reject
})

const timeout = setTimeout(() => {
  rejectCompletion(new Error(`Timed out waiting for ${configuration.runId}.`))
}, timeoutMs)

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  maxRequestBodySize: MAX_BODY_BYTES,
  async fetch(request) {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/config') {
      return Response.json(configuration)
    }
    if (request.method === 'POST' && url.pathname === '/error') {
      const value: unknown = await request.json()
      const message =
        value != null &&
        typeof value === 'object' &&
        'message' in value &&
        typeof value.message === 'string'
          ? value.message.slice(0, 1_000)
          : 'Unknown on-device benchmark failure.'
      rejectCompletion(new Error(message))
      return new Response(null, { status: 202 })
    }
    if (request.method === 'POST' && url.pathname === '/result') {
      try {
        const value: unknown = await request.json()
        const result = validateBenchmarkRun(value)
        validateExpectedRun(result, configuration)
        await Bun.write(output, `${JSON.stringify(result, null, 2)}\n`)
        resolveCompletion()
        return new Response(null, { status: 202 })
      } catch (error) {
        const failure =
          error instanceof Error ? error : new Error(String(error))
        rejectCompletion(failure)
        return new Response(failure.message, { status: 400 })
      }
    }
    return new Response('Not found.', { status: 404 })
  },
})

try {
  await completion
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  clearTimeout(timeout)
  // Finish the accepted HTTP response before closing the receiver.
  await server.stop()
}
