import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { nativeWorkflows, resolveNativeChecks } from './ci-native.mjs'
import { git } from './lib.mjs'

const workflow = Bun.YAML.parse(readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8'))
const androidArtifacts = Bun.YAML.parse(readFileSync(new URL('../../.github/workflows/build-android-release.yml', import.meta.url), 'utf8'))

// These workflow conditions use boolean operators, strings and property access.
// Convert GitHub's hyphenated property names before evaluating that subset.
function evaluate(expression, { cancelled = false, ...context } = {}) {
  const source = expression.replace(/^\$\{\{\s*|\s*\}\}$/g, '').replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => `[${JSON.stringify(name)}]`)
  return new Function(...Object.keys(context), 'cancelled', 'startsWith', 'contains', `return (${source})`)(
    ...Object.values(context),
    () => cancelled,
    (value, prefix) => (value ?? '').startsWith(prefix),
    (value, part) => (value ?? '').includes(part)
  )
}

function nativeConcurrency(name) {
  const config = Bun.YAML.parse(readFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), 'utf8'))
  const cancel = config.concurrency['cancel-in-progress']
  return {
    cancel: (github) => (typeof cancel === 'boolean' ? cancel : evaluate(cancel, { github })),
    group: (github, ref = '') =>
      config.concurrency.group.replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression) => evaluate(expression, { github, inputs: { ref } })),
  }
}

test('native checks cancel superseded v1 pushes and pull request updates', () => {
  for (const name of nativeWorkflows) {
    const concurrency = nativeConcurrency(name)
    for (const [event, ref, refName] of [
      ['push', 'refs/heads/v1', 'v1'],
      ['pull_request', 'refs/pull/1915/merge', '1915/merge'],
    ]) {
      assert.equal(concurrency.cancel({ event_name: event, ref: ref, ref_name: refName }), true, name)
      assert.equal(
        concurrency.group({ event_name: event, ref: ref, ref_name: refName, run_id: 100 }, 'a'.repeat(40)),
        concurrency.group({ event_name: event, ref: ref, ref_name: refName, run_id: 101 }, 'b'.repeat(40)),
        `${name}: ${event} updates on ${ref} must share a group even with an exact commit input`
      )
    }
  }
})

test('main commits keep independent native runs, including pending jobs', () => {
  for (const name of nativeWorkflows) {
    const concurrency = nativeConcurrency(name)
    for (const event of ['push', 'workflow_dispatch']) {
      const first = { event_name: event, ref: 'refs/heads/main', ref_name: 'main', run_id: 100 }
      const second = { event_name: event, ref: 'refs/heads/main', ref_name: 'main', run_id: 101 }
      assert.equal(concurrency.cancel(first), false, name)
      assert.equal(concurrency.cancel(second), false, name)
      assert.notEqual(concurrency.group(first, 'a'.repeat(40)), concurrency.group(second, 'b'.repeat(40)), name)
    }
  }
})

test('native workflows, branches and pull requests have independent groups', () => {
  const groups = []
  for (const name of nativeWorkflows) {
    const concurrency = nativeConcurrency(name)
    for (const [event, ref, refName] of [
      ['push', 'refs/heads/main', 'main'],
      ['push', 'refs/heads/v1', 'v1'],
      ['pull_request', 'refs/pull/1915/merge', '1915/merge'],
      ['pull_request', 'refs/pull/1916/merge', '1916/merge'],
    ]) {
      groups.push(concurrency.group({ event_name: event, ref: ref, ref_name: refName, run_id: 100 }))
    }
  }
  assert.equal(new Set(groups).size, groups.length)
})

test('manual and tagged native validations do not cancel each other or branch pushes', () => {
  for (const name of nativeWorkflows) {
    const concurrency = nativeConcurrency(name)
    const groups = [concurrency.group({ event_name: 'push', ref: 'refs/heads/v1', ref_name: 'v1', run_id: 100 }, 'a'.repeat(40))]
    let run = 101
    for (const [event, ref, refName, input] of [
      ['workflow_dispatch', 'refs/heads/v1', 'v1', ''],
      ['workflow_dispatch', 'refs/heads/v1', 'v1', 'a'.repeat(40)],
      ['release', 'refs/tags/v1.0.0-alpha.1', 'v1.0.0-alpha.1', 'a'.repeat(40)],
    ]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        groups.push(concurrency.group({ event_name: event, ref: ref, ref_name: refName, run_id: run++ }, input))
      }
    }
    assert.equal(new Set(groups).size, groups.length, name)
  }
})

test('publication keeps its noncancelling queue', () => {
  assert.deepEqual(workflow.jobs.release.concurrency, { 'group': 'nitro-release', 'cancel-in-progress': false, 'queue': 'max' })
  for (const name of nativeWorkflows) {
    const concurrency = nativeConcurrency(name)
    assert.notEqual(
      concurrency.group({ event_name: 'push', ref: 'refs/heads/v1', ref_name: 'v1', run_id: 100 }),
      workflow.jobs.release.concurrency.group
    )
  }
})

function prerequisites(branch) {
  const needs = Object.fromEntries(workflow.jobs.release.needs.map((name) => [name, { result: 'success' }]))
  needs.resolve.outputs = { branch, commit: 'a'.repeat(40) }
  for (const name of nativeWorkflows) needs.resolve.outputs[name] = 'true'
  return needs
}

test('main and v1 require every check, including Android', () => {
  for (const branch of ['main', 'v1']) {
    const needs = prerequisites(branch)
    assert.equal(evaluate(workflow.jobs.release.if, { needs }), true)
    assert.equal(evaluate(workflow.jobs.release.if, { needs, cancelled: true }), false)
    for (const name of workflow.jobs.release.needs) {
      for (const result of ['failure', 'cancelled', 'skipped']) {
        const changed = structuredClone(needs)
        changed[name].result = result
        assert.equal(evaluate(workflow.jobs.release.if, { needs: changed }), false, `${branch}: ${name} ${result} must block publication`)
      }
    }
  }
  assert.equal(evaluate(workflow.jobs.release.if, { needs: prerequisites('other') }), false)
})

test('only explicitly unneeded native checks can be skipped for publication', () => {
  for (const branch of ['main', 'v1']) {
    const needs = prerequisites(branch)
    for (const name of nativeWorkflows) {
      needs.resolve.outputs[name] = 'false'
      needs[name].result = 'skipped'
    }
    assert.equal(evaluate(workflow.jobs.release.if, { needs }), true)
    for (const name of nativeWorkflows) {
      assert.equal(evaluate(workflow.jobs[name].if, { needs }), false)
      for (const result of ['failure', 'cancelled']) {
        const changed = structuredClone(needs)
        changed[name].result = result
        assert.equal(evaluate(workflow.jobs.release.if, { needs: changed }), false)
      }
      for (const required of ['true', '', undefined]) {
        const changed = structuredClone(needs)
        changed.resolve.outputs[name] = required
        assert.equal(evaluate(workflow.jobs.release.if, { needs: changed }), false)
        assert.equal(evaluate(workflow.jobs[name].if, { needs: changed }), required === 'true')
      }
    }
  }
})

function nativeFixture(t) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'nitro-ci-native-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  git(['init', '--quiet'], { cwd })
  git(['config', 'user.name', 'Marc Rousavy'], { cwd })
  git(['config', 'user.email', 'me@mrousavy.com'], { cwd })
  mkdirSync(path.join(cwd, '.github/workflows'), { recursive: true })
  for (const name of nativeWorkflows) {
    copyFileSync(new URL(`../../.github/workflows/${name}.yml`, import.meta.url), path.join(cwd, '.github/workflows', `${name}.yml`))
  }
  function commit(filename, content = 'changed\n') {
    mkdirSync(path.dirname(path.join(cwd, filename)), { recursive: true })
    writeFileSync(path.join(cwd, filename), content)
    git(['add', '.'], { cwd })
    git(['commit', '--quiet', '--no-gpg-sign', '--message', 'Update fixture'], { cwd })
    return git(['rev-parse', 'HEAD'], { cwd })
  }
  const baseline = commit('README.md', 'initial\n')
  const run = { id: 42, conclusion: 'success', event: 'push', head_branch: 'v1', head_sha: baseline }
  return {
    cwd: cwd,
    commit: commit,
    baseline: baseline,
    run: run,
    options: (commit, runs = [run]) => ({
      cwd: cwd,
      env: { GITHUB_EVENT_NAME: 'push', GITHUB_REPOSITORY: 'margelo/nitro', RELEASE_BRANCH: 'v1', RELEASE_VALIDATED_COMMIT: commit },
      fetchJSON: async (url) => {
        if (url.pathname.endsWith('/jobs')) return { jobs: [{ name: 'release', conclusion: 'success' }] }
        return { workflow_runs: runs }
      },
    }),
  }
}

function selected(checks) {
  return nativeWorkflows.filter((name) => checks[name])
}

test('docs pushes skip native checks only after a successful ancestor', async (t) => {
  const fixture = nativeFixture(t)
  const commit = fixture.commit('docs/guide.md')
  assert.deepEqual(selected(await resolveNativeChecks(fixture.options(commit))), [])
  for (const runs of [[], [{ ...fixture.run, conclusion: 'cancelled' }], [{ ...fixture.run, conclusion: 'failure' }]]) {
    assert.deepEqual(selected(await resolveNativeChecks(fixture.options(commit, runs))), nativeWorkflows)
  }
})

test('a docs push still validates native changes from failed or cancelled pushes', async (t) => {
  const fixture = nativeFixture(t)
  const nativeCommit = fixture.commit('packages/nitro-core/native/cpp/example.cpp')
  const docsCommit = fixture.commit('docs/guide.md')
  for (const conclusion of ['failure', 'cancelled']) {
    const runs = [{ ...fixture.run, head_sha: nativeCommit, conclusion: conclusion }, fixture.run]
    assert.deepEqual(selected(await resolveNativeChecks(fixture.options(docsCommit, runs))), nativeWorkflows)
  }
})

test('an overall successful run with skipped or missing publication is not a baseline', async (t) => {
  const fixture = nativeFixture(t)
  const commit = fixture.commit('docs/guide.md')
  for (const jobs of [[], undefined, [{ name: 'release', conclusion: 'skipped' }], [{ name: 'release', conclusion: 'cancelled' }]]) {
    const options = fixture.options(commit)
    options.fetchJSON = async (url) => {
      if (url.pathname.endsWith('/jobs')) return { jobs: jobs }
      return { workflow_runs: [fixture.run] }
    }
    assert.deepEqual(selected(await resolveNativeChecks(options)), nativeWorkflows)
  }
})

test('push selection uses the native workflows pull request paths', async (t) => {
  const fixture = nativeFixture(t)
  const standalone = fixture.commit('tests/standalone/test-runner/android/config.properties')
  assert.deepEqual(selected(await resolveNativeChecks(fixture.options(standalone))), ['test-runtime-ios', 'test-runtime-android'])
  const workflowPath = '.github/workflows/harness-ios.yml'
  const harnessWorkflow = readFileSync(path.join(fixture.cwd, workflowPath), 'utf8')
  const harness = fixture.commit(workflowPath, `${harnessWorkflow}\n# Updated workflow\n`)
  const runs = [{ ...fixture.run, head_sha: standalone }]
  assert.deepEqual(selected(await resolveNativeChecks(fixture.options(harness, runs))), ['harness-ios'])
})

test('renaming a native file out of its path still requires validation', async (t) => {
  const fixture = nativeFixture(t)
  const nativeCommit = fixture.commit('packages/nitro-core/native/cpp/example.cpp')
  mkdirSync(path.join(fixture.cwd, 'docs'))
  git(['mv', 'packages/nitro-core/native/cpp/example.cpp', 'docs/example.cpp'], { cwd: fixture.cwd })
  const movedCommit = fixture.commit('README.md', 'renamed\n')
  assert.deepEqual(
    selected(await resolveNativeChecks(fixture.options(movedCommit, [{ ...fixture.run, head_sha: nativeCommit }]))),
    nativeWorkflows
  )
})

test('unknown baselines, lookup failures and changed release policy run every native check', async (t) => {
  const fixture = nativeFixture(t)
  const docsCommit = fixture.commit('docs/guide.md')
  for (const runs of [[{ ...fixture.run, head_branch: 'main' }], [{ ...fixture.run, head_sha: 'a'.repeat(40) }], undefined]) {
    const options = fixture.options(docsCommit)
    options.fetchJSON = async () => ({ workflow_runs: runs })
    assert.deepEqual(selected(await resolveNativeChecks(options)), nativeWorkflows)
  }
  const options = fixture.options(docsCommit)
  options.fetchJSON = async () => {
    throw new Error('GitHub unavailable')
  }
  assert.deepEqual(selected(await resolveNativeChecks(options)), nativeWorkflows)
  const changedPolicy = fixture.commit('.github/workflows/release.yml')
  assert.deepEqual(selected(await resolveNativeChecks(fixture.options(changedPolicy))), nativeWorkflows)
})

test('manual and tagged releases always run all native checks', async () => {
  for (const event of ['workflow_dispatch', 'release']) {
    const checks = await resolveNativeChecks({
      env: { GITHUB_EVENT_NAME: event },
      fetchJSON: () => {
        throw new Error('Manual releases should not look for a baseline')
      },
    })
    assert.deepEqual(selected(checks), nativeWorkflows)
  }
})

test('branch pushes and alpha release events select the correct release branch', () => {
  const expression = workflow.jobs.resolve.outputs.branch
  for (const [event, ref, tag, expected] of [
    ['push', 'main', '', 'main'],
    ['push', 'v1', '', 'v1'],
    ['workflow_dispatch', 'v1', '', 'v1'],
    ['release', '', 'v1.0.0-alpha.nightly.50.g123456789abc', 'v1'],
    ['release', '', 'v1.0.0-alpha.1', 'v1'],
    ['release', '', 'v0.37.2-nightly.45.g123456789abc', 'main'],
    ['release', '', 'v1.0.0', 'main'],
  ]) {
    assert.equal(
      evaluate(expression, {
        github: {
          event_name: event,
          ref_name: ref,
          event: { release: { tag_name: tag } },
        },
      }),
      expected
    )
  }
})

test('Android artifact builds include v1 alpha releases', () => {
  assert.equal(androidArtifacts.jobs.build_release.if, undefined)
  for (const tag of [
    'v1.0.0-alpha.nightly.50.g123456789abc',
    'v1.0.0-alpha.1',
    'v1.2.3-alpha.1',
    'v0.37.2-nightly.45.g123456789abc',
    'v1.0.0',
  ]) {
    assert.equal(
      evaluate(workflow.jobs['android-artifacts'].if, {
        needs: {
          release: { result: 'success', outputs: { tag: tag } },
        },
        github: { event_name: 'push' },
      }),
      true,
      tag
    )
  }
})

test('artifact jobs require successful publication and handle skipped ancestors explicitly', () => {
  for (const name of ['ios-artifacts', 'android-artifacts']) {
    const expression = workflow.jobs[name].if
    assert.match(expression, /!cancelled\(\)/)
    const context = {
      needs: {
        resolve: { result: 'success', outputs: { branch: 'main' } },
        release: { result: 'success', outputs: { tag: 'v0.37.2' } },
      },
      github: { event_name: 'push' },
    }
    assert.equal(evaluate(expression, context), true)
    assert.equal(evaluate(expression, { ...context, cancelled: true }), false)
    assert.equal(evaluate(expression, { ...context, github: { event_name: 'release' } }), false)
    for (const result of ['failure', 'cancelled', 'skipped']) {
      const changed = structuredClone(context)
      changed.needs.release.result = result
      assert.equal(evaluate(expression, changed), false)
    }
    context.needs.release.outputs.tag = ''
    assert.equal(evaluate(expression, context), false)
  }
})
