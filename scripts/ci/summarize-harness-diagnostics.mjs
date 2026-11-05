import { existsSync } from 'node:fs'
import { appendFile, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const [profileDir, diagnosticsDir] = process.argv.slice(2)
const finishedNs = process.hrtime.bigint()
const finishedMs = Number(finishedNs / 1_000_000n)
const labels = new Set([
  'session.setup',
  'platform.init',
  'metro.init',
  'metro.prewarm',
  'app.ready.total',
  'run.file',
  'run.total',
  'client.test',
  'platform.android.adb.installApp',
  'platform.android.adb.uninstallApp',
])
const spans = {}
const traceFiles = []

if (existsSync(diagnosticsDir)) {
  const files = await readdir(diagnosticsDir)
  for (const file of files) {
    if (file.endsWith('.json')) {
      const tracePath = path.join(diagnosticsDir, file)
      const content = await readFile(tracePath, 'utf8')
      const trace = JSON.parse(content)
      traceFiles.push(file)

      for (const event of trace.traceEvents) {
        if (event.ph === 'X' && labels.has(event.name)) {
          const durationMs = event.dur / 1000
          const span = spans[event.name] ?? {
            count: 0,
            totalMs: 0,
            maxMs: 0,
            statuses: {},
          }
          span.count += 1
          span.totalMs += durationMs
          span.maxMs = Math.max(span.maxMs, durationMs)
          const status = event.args?.status
          if (status) {
            span.statuses[status] = (span.statuses[status] ?? 0) + 1
          }
          spans[event.name] = span
        }
      }
    }
  }
}

const elapsed = {}
for (const phase of ['profile', 'harness-action']) {
  const startedPath = path.join(profileDir, `${phase}-started-ms`)
  if (existsSync(startedPath)) {
    const content = await readFile(startedPath, 'utf8')
    const startedMs = Number(content)
    elapsed[phase] = finishedMs - startedMs
  }
}

const timings = {}
for (const name of ['workflow', 'redroid']) {
  const timingsPath = path.join(profileDir, `${name}-timings.tsv`)
  if (existsSync(timingsPath)) {
    const content = await readFile(timingsPath, 'utf8')
    const trimmed = content.trim()
    const lines = trimmed.split('\n')
    const rows = lines.slice(1)
    timings[name] = rows.map((row) => {
      const [phase, started, finished, duration] = row.split('\t')
      return {
        phase,
        startedMs: Number(started),
        finishedMs: Number(finished),
        durationMs: Number(duration),
      }
    })
  }
}

let apkSha256 = null
const hashPath = path.join(profileDir, 'apk-sha256.txt')
if (existsSync(hashPath)) {
  const content = await readFile(hashPath, 'utf8')
  const parts = content.split(' ')
  apkSha256 = parts[0]
}

const summary = {
  backend: process.env.DEVICE_BACKEND,
  repeat: Number(process.env.DEVICE_REPEAT),
  sourceSha: process.env.GITHUB_SHA,
  artifactId: process.env.APK_ARTIFACT_ID,
  apkSha256,
  workflowRunId: process.env.GITHUB_RUN_ID,
  workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
  runnerImage: process.env.ImageOS,
  runnerImageVersion: process.env.ImageVersion,
  harnessOutcome: process.env.HARNESS_OUTCOME,
  clock: {
    elapsedAndTimings: 'CLOCK_MONOTONIC',
    unit: 'milliseconds',
    androidBootOrigin: 'before docker run',
  },
  elapsedMs: elapsed,
  timings,
  traceFiles,
  spans,
}
const summaryPath = path.join(profileDir, 'summary.json')
const serialized = JSON.stringify(summary, null, 2)
await writeFile(summaryPath, `${serialized}\n`)
console.log(serialized)

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    `### ${summary.backend}, repeat ${summary.repeat}`,
    '',
    `APK SHA-256: \`${apkSha256}\``,
    '',
    '| Measurement | Count | Total (ms) | Maximum (ms) |',
    '| --- | ---: | ---: | ---: |',
  ]
  for (const [name, durationMs] of Object.entries(elapsed)) {
    const roundedMs = Math.round(durationMs)
    lines.push(`| ${name} | 1 | ${roundedMs} | ${roundedMs} |`)
  }
  for (const [name, span] of Object.entries(spans)) {
    const totalMs = Math.round(span.totalMs)
    const maxMs = Math.round(span.maxMs)
    lines.push(`| ${name} | ${span.count} | ${totalMs} | ${maxMs} |`)
  }
  lines.push('', 'Spans overlap; their durations must not be added together.', '')
  const markdown = lines.join('\n')
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown)
}
