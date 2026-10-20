import { appendFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  git,
  nightlyVersion,
  parseVersion,
  readJSON,
  versionFromTag,
} from './lib.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))

export function resolveCICommit({ cwd = root, env = process.env } = {}) {
  const sourceCommit = git(['rev-parse', 'HEAD'], { cwd })
  const releaseEventTag = env.RELEASE_EVENT_TAG || undefined
  const version =
    env.RELEASE_MODE === 'nightly'
      ? nightlyVersion(
          readJSON(path.join(cwd, 'package.json')).version,
          env.GITHUB_RUN_NUMBER,
          sourceCommit
        )
      : releaseEventTag
        ? versionFromTag(releaseEventTag)
        : env.RELEASE_VERSION
  parseVersion(version)
  const tag = `v${version}`
  if (git(['tag', '--list', tag], { cwd })) {
    return git(['rev-parse', `refs/tags/${tag}^{commit}`], { cwd })
  }
  if (releaseEventTag) throw new Error('The GitHub release tag is missing')
  return sourceCommit
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commit = resolveCICommit()
  appendFileSync(process.env.GITHUB_OUTPUT, `commit=${commit}\n`)
}
