import { appendFile, readFile } from 'node:fs/promises'

interface Artifact {
  id: number
  name: string
  expired: boolean
}
interface Job {
  name: string
  conclusion: string | null
}

export function selectReportArtifact(
  conclusion: string | null,
  attempt: number,
  artifacts: readonly Artifact[],
  jobs: readonly Job[]
): number | undefined {
  if (conclusion === 'cancelled' || conclusion === 'skipped') return undefined
  if (conclusion !== 'success')
    throw new Error(
      `Performance workflow ${conclusion}; no measurements published.`
    )
  const name = `performance-report-${attempt}`
  const matches = artifacts.filter(
    (artifact) => artifact.name === name && !artifact.expired
  )
  if (
    matches.length === 0 &&
    jobs.some(
      (job) => job.name === 'nitro-performance' && job.conclusion === 'skipped'
    )
  )
    return undefined
  if (matches.length !== 1)
    throw new Error(`Expected exactly one unexpired ${name} artifact.`)
  const id = matches[0]!.id
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error('Invalid artifact ID.')
  return id
}

if (import.meta.main) {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH!, 'utf8')
  )
  const run = event.workflow_run
  const root = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${run.id}`
  async function get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${root}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: 'application/vnd.github+json',
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok)
      throw new Error(`GitHub artifact lookup failed: ${response.status}`)
    return (await response.json()) as T
  }
  // Query the exact attempt; rerunning collection must not pick another attempt's results.
  const [artifactResponse, jobResponse] = await Promise.all([
    get<{ total_count: number; artifacts: Artifact[] }>(
      '/artifacts?per_page=100'
    ),
    get<{ total_count: number; jobs: Job[] }>(
      `/attempts/${run.run_attempt}/jobs?per_page=100`
    ),
  ])
  if (artifactResponse.total_count > 100 || jobResponse.total_count > 100)
    throw new Error('Performance run exceeds the artifact/job lookup limit.')
  const id = selectReportArtifact(
    run.conclusion,
    run.run_attempt,
    artifactResponse.artifacts,
    jobResponse.jobs
  )
  await appendFile(process.env.GITHUB_OUTPUT!, `artifact_id=${id ?? ''}\n`)
}
