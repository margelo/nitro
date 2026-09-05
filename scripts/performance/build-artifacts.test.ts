import { expect, test } from 'bun:test'
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  rm,
  stat,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// Execute the real packaging/selection steps with tiny stand-ins for native
// compilers. This checks missing-base handling and tar permissions/symlinks.
for (const platform of ['android', 'ios'] as const) {
  test.each(['paired', 'same-sha', 'changed-suite'])(
    `${platform} app artifacts preserve exact build selection: %s`,
    async (mode) => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'nitro-app-artifacts-'))
      try {
        const workflow = Bun.YAML.parse(
          await readFile(
            new URL('../../.github/workflows/performance.yml', import.meta.url),
            'utf8'
          )
        ) as any
        const command = workflow.jobs[`build-${platform}`].steps.find(
          (step: any) => step.name?.startsWith('Build and package')
        ).run
        await mkdir(path.join(root, 'head/scripts/performance'), {
          recursive: true,
        })
        await mkdir(path.join(root, 'bin'))
        const bun = path.join(root, 'bin/bun')
        await Bun.write(
          bun,
          '#!/bin/sh\ncp "$GITHUB_WORKSPACE/metadata.json" apps/build.json\n'
        )
        await chmod(bun, 0o755)
        for (const tool of ['java', 'xcodebuild']) {
          const file = path.join(root, 'bin', tool)
          await Bun.write(file, '#!/bin/sh\necho fixture-tool-version\n')
          await chmod(file, 0o755)
        }
        const script = path.join(
          root,
          `head/scripts/performance/build-${platform}.sh`
        )
        await Bun.write(
          script,
          `#!/bin/bash
set -eu
echo "$(basename "$1")" >> "$GITHUB_WORKSPACE/builds"
if [[ '${platform}' == android ]]; then
  mkdir -p "$1/apps/benchmark/android/app/build/outputs/apk/release"
  echo "$(basename "$1")" > "$1/apps/benchmark/android/app/build/outputs/apk/release/app-release.apk"
else
  APP="$1/apps/benchmark/ios/build-benchmark/Build/Products/Release-iphonesimulator/NitroBenchmark.app"
  mkdir -p "$APP"
  echo "$(basename "$1")" > "$APP/NitroBenchmark"
  chmod 755 "$APP/NitroBenchmark"
  ln -s NitroBenchmark "$APP/executable-link"
fi
`
        )
        await Bun.write(
          path.join(root, 'metadata.json'),
          JSON.stringify({
            baseSha: 'a',
            headSha: mode === 'same-sha' ? 'a' : 'b',
            baseSuiteHash: 'c',
            headSuiteHash: mode === 'changed-suite' ? 'd' : 'c',
          })
        )
        const child = Bun.spawn(['bash', '-euo', 'pipefail', '-c', command], {
          cwd: root,
          env: {
            ...process.env,
            GITHUB_WORKSPACE: root,
            PATH: `${root}/bin:${process.env.PATH}`,
          },
          stdout: 'pipe',
          stderr: 'pipe',
        })
        const [exitCode, stderr] = await Promise.all([
          child.exited,
          new Response(child.stderr).text(),
        ])
        expect({ exitCode, error: exitCode === 0 ? '' : stderr }).toEqual({
          exitCode: 0,
          error: '',
        })
        expect(
          (await Bun.file(path.join(root, 'builds')).text()).trim().split('\n')
        ).toEqual(mode === 'paired' ? ['head', 'base'] : ['head'])
        const base = path.join(
          root,
          `apps/base.${platform === 'ios' ? 'app.tar.gz' : 'apk'}`
        )
        expect(await Bun.file(base).exists()).toBe(mode !== 'changed-suite')
        if (platform === 'ios') {
          const unpack = path.join(root, 'unpacked')
          await mkdir(unpack)
          expect(
            await Bun.spawn([
              'tar',
              '-xzf',
              path.join(root, 'apps/head.app.tar.gz'),
              '-C',
              unpack,
            ]).exited
          ).toBe(0)
          expect(
            (await stat(path.join(unpack, 'NitroBenchmark.app/NitroBenchmark')))
              .mode & 0o111
          ).toBe(0o111)
          expect(
            await readlink(
              path.join(unpack, 'NitroBenchmark.app/executable-link')
            )
          ).toBe('NitroBenchmark')
        }
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  )
}
