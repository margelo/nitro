import { describe, expect, test } from 'bun:test'
import { postPerformanceComment } from './github-report'

const report = {
  repository: 'margelo/nitro',
  pullRequestNumber: 123,
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
  workflowRunId: 123456,
  workflowRunNumber: 50,
  runAttempt: 2,
  markdown: '## Nitro performance\n\n| Benchmark | Base | Head |',
}
const pullRequest = {
  state: 'open',
  base: { sha: report.baseSha },
  head: {
    sha: report.headSha,
    ref: 'feature',
    repo: { full_name: 'contributor/nitro' },
  },
}
const marker = '<!-- nitro-performance-paired-comparison -->'
const botLogin = 'github-actions[bot]'
type Comment = {
  id: number
  body: string
  user: { login: string; type: string }
}

function github(comments: Comment[] = []) {
  const writes: { endpoint: string; method: string; body: string }[] = []
  const requests: string[] = []
  const fixture = {
    comments,
    writes,
    requests,
    pullRequest,
    existingRun: {} as Record<string, unknown>,
    async request(endpoint: string, method = 'GET', body?: { body: string }) {
      requests.push(endpoint)
      if (method !== 'GET') {
        writes.push({ endpoint, method, body: body!.body })
        if (method === 'PATCH') {
          comments.find((c) => endpoint.endsWith(`/${c.id}`))!.body = body!.body
        } else {
          comments.push({
            id: 999,
            body: body!.body,
            user: { login: botLogin, type: 'Bot' },
          })
        }
        return {}
      }
      if (endpoint.includes('/pulls/')) return fixture.pullRequest
      if (endpoint.includes('/actions/runs/')) {
        const [, id, attempt] = /\/runs\/(\d+)\/attempts\/(\d+)$/.exec(
          endpoint
        )!
        return {
          id: Number(id),
          run_attempt: Number(attempt),
          run_number: Number(id) - 123406,
          name: 'Nitro Performance',
          status: 'completed',
          conclusion: 'success',
          head_branch: 'feature',
          head_repository: { full_name: 'contributor/nitro' },
          ...fixture.existingRun,
        }
      }
      const page = Number(
        new URL(`https://api.github.com${endpoint}`).searchParams.get('page')
      )
      return comments.slice((page - 1) * 100, page * 100)
    },
  }
  return fixture
}

function previous(runNumber: number, attempt = 1, login = botLogin): Comment {
  return {
    id: 2,
    body: `${marker}\n<!-- nitro-performance-source: ${123406 + runNumber}.${attempt} -->\nPrevious results`,
    user: { login, type: 'Bot' },
  }
}

describe('paired performance PR comment', () => {
  test('creates one report with the trusted measured commit and source attempt', async () => {
    const userComment = {
      id: 1,
      body: marker,
      user: { login: 'user', type: 'User' },
    }
    const api = github([userComment])
    expect(await postPerformanceComment(report, api.request)).toEqual({
      status: 'created',
      current: true,
    })
    expect(api.writes).toHaveLength(1)
    expect(api.writes[0]).toMatchObject({
      endpoint: '/repos/margelo/nitro/issues/123/comments',
      method: 'POST',
    })
    expect(api.writes[0]!.body).toContain(
      '<!-- nitro-performance-source: 123456.2 -->'
    )
    expect(api.writes[0]!.body).toContain(`/commit/${report.headSha}`)
    expect(api.writes[0]!.body).toContain(`/commit/${report.baseSha}`)
    expect(api.writes[0]!.body).toContain('/actions/runs/123456/attempts/2')
    expect(api.writes[0]!.body).toEndWith(report.markdown)
    expect(api.comments[0]).toEqual(userComment)
  })

  test.each(['github-actions[bot]', 'nitro-modules-bot[bot]'])(
    'updates only its existing report as %s',
    async (login) => {
      const otherBot = previous(900, 1, 'another-app[bot]')
      otherBot.id = 1
      const api = github([otherBot, previous(49, 1, login)])
      expect(
        (await postPerformanceComment(report, api.request, login)).status
      ).toBe('updated')
      expect(api.writes[0]).toMatchObject({
        endpoint: '/repos/margelo/nitro/issues/comments/2',
        method: 'PATCH',
      })
      expect(api.comments[0]).toEqual(otherBot)
    }
  )

  test('keeps the existing author when migrating to a custom bot', async () => {
    const old = previous(49)
    const api = github([
      old,
      {
        id: 3,
        body: marker,
        user: { login: 'nitro-modules-bot[bot]', type: 'User' },
      },
    ])
    expect(
      (
        await postPerformanceComment(
          report,
          api.request,
          'nitro-modules-bot[bot]'
        )
      ).status
    ).toBe('created')
    expect(api.comments[0]).toEqual(old)
  })

  test.each(['base', 'head'] as const)(
    'posts completed results after the PR %s advances',
    async (revision) => {
      const api = github()
      api.pullRequest = {
        ...pullRequest,
        [revision]: { ...pullRequest[revision], sha: 'c'.repeat(40) },
      }
      expect(await postPerformanceComment(report, api.request)).toEqual({
        status: 'created',
        current: false,
      })
      expect(api.writes[0]!.body).toContain(
        'The PR has advanced since these measurements.'
      )
      expect(api.writes[0]!.body).toContain(`/commit/${report.headSha}`)
      // A newer running workflow does not suppress the last completed result.
      expect(
        api.requests.some((endpoint) => endpoint.includes('/actions/'))
      ).toBe(false)
    }
  )

  test('never posts to a closed PR', async () => {
    const api = github()
    api.pullRequest = { ...pullRequest, state: 'closed' }
    expect(await postPerformanceComment(report, api.request)).toEqual({
      status: 'closed',
      current: false,
    })
    expect(api.writes).toHaveLength(0)
  })

  test('an old run finishing late cannot overwrite a newer completed report, even on a later rerun', async () => {
    const api = github()
    await postPerformanceComment(
      {
        ...report,
        workflowRunNumber: 51,
        workflowRunId: 123457,
        headSha: 'c'.repeat(40),
      },
      api.request
    )
    const newest = api.comments[0]!.body
    expect(
      (await postPerformanceComment({ ...report, runAttempt: 99 }, api.request))
        .status
    ).toBe('superseded')
    expect(api.comments[0]!.body).toBe(newest)
    expect(api.writes).toHaveLength(1)
  })

  test('a newer attempt replaces the same run, while a delayed earlier attempt cannot', async () => {
    const api = github([previous(50, 1)])
    expect((await postPerformanceComment(report, api.request)).status).toBe(
      'updated'
    )
    const latest = api.comments[0]!.body
    expect(
      (await postPerformanceComment({ ...report, runAttempt: 1 }, api.request))
        .status
    ).toBe('superseded')
    expect(api.comments[0]!.body).toBe(latest)
    expect(api.writes).toHaveLength(1)
  })

  test('retrying the same publication updates the same comment', async () => {
    const api = github()
    await postPerformanceComment(report, api.request)
    expect((await postPerformanceComment(report, api.request)).status).toBe(
      'updated'
    )
    expect(api.comments).toHaveLength(1)
    expect(api.writes[0]!.body).toBe(api.writes[1]!.body)
  })

  test.each(
    [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ].map((order) => ({ order }))
  )(
    'serialized publishers keep the newest report for completion order %j',
    async ({ order }) => {
      const api = github()
      const reports = [
        {
          ...report,
          workflowRunNumber: 49,
          workflowRunId: 123455,
          runAttempt: 20,
        },
        { ...report, runAttempt: 1 },
        report,
      ]
      for (const index of order)
        await postPerformanceComment(reports[index]!, api.request)
      expect(api.comments).toHaveLength(1)
      expect(api.comments[0]!.body).toContain(
        '<!-- nitro-performance-source: 123456.2 -->'
      )
    }
  )

  test('finds a newer bot report beyond the first page before posting', async () => {
    const comments = Array.from({ length: 100 }, (_, id) => ({
      id,
      body: 'User comment',
      user: { login: 'user', type: 'User' },
    }))
    const api = github([...comments, previous(51)])
    expect((await postPerformanceComment(report, api.request)).status).toBe(
      'superseded'
    )
    expect(api.requests).toContain(
      '/repos/margelo/nitro/issues/123/comments?per_page=100&page=2'
    )
    expect(api.writes).toHaveLength(0)
  })

  test.each([49, 51])(
    'migrates a legacy comment without losing newer completed run %i',
    async (runNumber) => {
      const comment = previous(49)
      comment.body = `${marker}\nLegacy report\nRun 123455, attempt 1. Download requires GitHub access.`
      const api = github([comment])
      api.existingRun.run_number = runNumber
      expect((await postPerformanceComment(report, api.request)).status).toBe(
        runNumber < 50 ? 'updated' : 'superseded'
      )
      expect(api.requests).toContain(
        '/repos/margelo/nitro/actions/runs/123455/attempts/1'
      )
      expect(api.writes).toHaveLength(runNumber < 50 ? 1 : 0)
    }
  )

  test('preserves a newer legacy attempt of the same run', async () => {
    const comment = previous(50)
    comment.body = `${marker}\nLegacy report\nRun 123456, attempt 3.`
    const api = github([comment])
    api.existingRun.run_number = 50
    expect((await postPerformanceComment(report, api.request)).status).toBe(
      'superseded'
    )
    expect(api.writes).toHaveLength(0)
  })

  test('does not let unrecognized legacy metadata freeze future reports', async () => {
    const comment = previous(50)
    comment.body = `${marker}\nUnrecognized report`
    const api = github([comment])
    expect((await postPerformanceComment(report, api.request)).status).toBe(
      'updated'
    )
    expect(api.writes).toHaveLength(1)
  })

  test.each([
    { name: 'Unrelated workflow' },
    { head_branch: 'another-feature' },
    { head_repository: { full_name: 'another/nitro' } },
    { status: 'in_progress', conclusion: null },
    { conclusion: 'failure' },
    { run_attempt: 999 },
  ])(
    'ignores forged source metadata outside completed reports from this PR: %j',
    async (source) => {
      const api = github([previous(999)])
      api.existingRun = source
      expect((await postPerformanceComment(report, api.request)).status).toBe(
        'updated'
      )
      expect(api.writes).toHaveLength(1)
    }
  )

  test('resolves marker run IDs instead of trusting a forged sequence number', async () => {
    const api = github([previous(999)])
    api.existingRun.run_number = 49
    expect((await postPerformanceComment(report, api.request)).status).toBe(
      'updated'
    )
    expect(api.writes).toHaveLength(1)
  })

  test('a missing forged source cannot freeze future reports', async () => {
    const api = github([previous(999)])
    const request = async (
      endpoint: string,
      method = 'GET',
      body?: { body: string }
    ) =>
      endpoint.includes('/actions/runs/')
        ? null
        : api.request(endpoint, method, body)
    expect((await postPerformanceComment(report, request)).status).toBe(
      'updated'
    )
    expect(api.writes).toHaveLength(1)
  })

  test('fails safely if source provenance cannot be checked because GitHub is unavailable', async () => {
    const api = github([previous(51)])
    const request = async (
      endpoint: string,
      method = 'GET',
      body?: { body: string }
    ) => {
      if (endpoint.includes('/actions/runs/'))
        throw new Error('GitHub unavailable')
      return api.request(endpoint, method, body)
    }
    await expect(postPerformanceComment(report, request)).rejects.toThrow(
      'GitHub unavailable'
    )
    expect(api.writes).toHaveLength(0)
  })

  test('rejects a human author before making requests', async () => {
    const api = github()
    await expect(
      postPerformanceComment(report, api.request, 'mrousavy')
    ).rejects.toThrow('Performance comment author must be a GitHub bot login.')
    expect(api.requests).toHaveLength(0)
  })

  test.each(['workflowRunId', 'workflowRunNumber', 'runAttempt'] as const)(
    'rejects invalid %s before making requests',
    async (key) => {
      const api = github()
      await expect(
        postPerformanceComment({ ...report, [key]: 0 }, api.request)
      ).rejects.toThrow('Invalid validated PR report metadata')
      expect(api.requests).toHaveLength(0)
    }
  )
})
