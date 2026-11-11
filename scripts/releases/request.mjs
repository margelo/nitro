import { npmTagFor, parseVersion, run } from './lib.mjs'

const [version, requestedTag] = process.argv.slice(2)
if (process.argv.length < 3 || process.argv.length > 4)
  throw new Error('Usage: bun release VERSION [npm-tag]')
parseVersion(version)
const npmTag = npmTagFor(version, requestedTag)
run('gh', [
  'workflow',
  'run',
  'release.yml',
  '--repo',
  'margelo/nitro',
  '--ref',
  'main',
  '--raw-field',
  `version=${version}`,
  '--raw-field',
  `npm-tag=${npmTag}`,
])
console.log(
  `Requested ${version} from main. Follow https://github.com/margelo/nitro/actions/workflows/release.yml`
)
