import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const require = createRequire(import.meta.url)
const tsc = require.resolve('typescript/bin/tsc')

rmSync(new URL('js/lib/', root), { recursive: true, force: true })

for (const format of ['module', 'commonjs']) {
  execFileSync(
    process.execPath,
    [
      tsc,
      '--project',
      'js/tsconfig.json',
      '--noEmit',
      'false',
      '--declaration',
      '--declarationMap',
      '--sourceMap',
      '--inlineSources',
      '--outDir',
      `js/lib/${format}`,
      '--declarationDir',
      `js/lib/typescript/${format}`,
      ...(format === 'commonjs'
        ? [
            '--module',
            'Node16',
            '--moduleResolution',
            'Node16',
            '--verbatimModuleSyntax',
            'false',
          ]
        : []),
    ],
    { cwd: fileURLToPath(root), stdio: 'inherit' }
  )
  for (const directory of [format, `typescript/${format}`]) {
    writeFileSync(
      new URL(`js/lib/${directory}/package.json`, root),
      `${JSON.stringify({ type: format })}\n`
    )
  }
}
