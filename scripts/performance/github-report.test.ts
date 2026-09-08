import { describe, expect, test } from 'bun:test'
import { postPerformanceComment } from './github-report'

const report = {
  repository: 'margelo/nitro',
  pullRequestNumber: 123,
  workflowRunId: 456,
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
  markdown: '## Nitro performance\n\n| Benchmark | Base | Head |',
}
const pullRequest = {
  state: 'open',
  base: { sha: report.baseSha },
  head: { sha: report.headSha },
}
const marker = '<!-- nitro-performance-paired-comparison:456 -->'

describe('paired performance PR comment', () => {
  test('creates a comment without modifying user comments', async () => {
    const writes: unknown[] = []
    const status = await postPerformanceComment(
      report,
      async (endpoint, method = 'GET', body) => {
        if (method !== 'GET') {
          writes.push({ endpoint, method, body })
          return {}
        }
        if (endpoint.includes('/pulls/')) return pullRequest
        return [{ id: 1, body: marker, user: { login: 'user', type: 'User' } }]
      }
    )
    expect(status).toBe('created')
    expect(writes).toEqual([
      {
        endpoint: '/repos/margelo/nitro/issues/123/comments',
        method: 'POST',
        body: { body: `${marker}\n${report.markdown}` },
      },
    ])
  })

  test.each(['github-actions[bot]', 'nitro-modules-bot[bot]'])(
    'updates only the existing paired comparison from %s',
    async (botLogin) => {
      const writes: unknown[] = []
      const status = await postPerformanceComment(
        report,
        async (endpoint, method = 'GET', body) => {
          if (method !== 'GET') {
            writes.push({ endpoint, method, body })
            return {}
          }
          if (endpoint.includes('/pulls/')) return pullRequest
          return [
            {
              id: 1,
              body: `${marker}\nother bot's report`,
              user: { login: 'another-app[bot]', type: 'Bot' },
            },
            {
              id: 2,
              body: `${marker}\nold report`,
              user: { login: botLogin, type: 'Bot' },
            },
          ]
        },
        botLogin
      )
      expect(status).toBe('updated')
      expect(writes).toEqual([
        {
          endpoint: '/repos/margelo/nitro/issues/comments/2',
          method: 'PATCH',
          body: { body: `${marker}\n${report.markdown}` },
        },
      ])
    }
  )

  test('new requests on the same commits create reports and reruns update only their own report', async () => {
    const comments = [
      {
        id: 1,
        body: '<!-- nitro-performance-paired-comparison -->\nlegacy report',
        user: { login: 'github-actions[bot]', type: 'Bot' },
      },
    ]
    const request = async (
      endpoint: string,
      method = 'GET',
      body?: { body: string }
    ) => {
      if (endpoint.includes('/pulls/')) return pullRequest
      if (method === 'POST') {
        comments.push({
          id: comments.length + 1,
          body: body!.body,
          user: { login: 'github-actions[bot]', type: 'Bot' },
        })
        return {}
      }
      if (method === 'PATCH') {
        comments.find((comment) => endpoint.endsWith(`/${comment.id}`))!.body =
          body!.body
        return {}
      }
      return comments
    }
    expect(await postPerformanceComment(report, request)).toBe('created')
    const nextRun = {
      ...report,
      workflowRunId: 789,
      markdown: 'Second request',
    }
    expect(await postPerformanceComment(nextRun, request)).toBe('created')
    expect(
      await postPerformanceComment(
        { ...report, markdown: 'First run, attempt 2' },
        request
      )
    ).toBe('updated')
    expect(comments.map((comment) => comment.body)).toEqual([
      '<!-- nitro-performance-paired-comparison -->\nlegacy report',
      `${marker}\nFirst run, attempt 2`,
      '<!-- nitro-performance-paired-comparison:789 -->\nSecond request',
    ])
    expect(
      await postPerformanceComment(
        { ...nextRun, markdown: 'Second run, attempt 2' },
        request
      )
    ).toBe('updated')
    expect(comments).toHaveLength(3)
    expect(comments[1]!.body).toBe(`${marker}\nFirst run, attempt 2`)
    expect(comments[2]!.body).toBe(
      '<!-- nitro-performance-paired-comparison:789 -->\nSecond run, attempt 2'
    )
  })

  test('finds the same run on a later page before creating a comment', async () => {
    const writes: unknown[] = []
    const status = await postPerformanceComment(
      report,
      async (endpoint, method = 'GET', body) => {
        if (method !== 'GET') {
          writes.push({ endpoint, method, body })
          return {}
        }
        if (endpoint.includes('/pulls/')) return pullRequest
        if (endpoint.endsWith('page=1')) {
          return Array.from({ length: 100 }, (_, id) => ({
            id,
            body: '<!-- nitro-performance-paired-comparison:123 -->\nOther run',
            user: { login: 'github-actions[bot]', type: 'Bot' },
          }))
        }
        return [
          {
            id: 101,
            body: marker,
            user: { login: 'github-actions[bot]', type: 'Bot' },
          },
        ]
      }
    )
    expect(status).toBe('updated')
    expect(writes).toEqual([
      {
        endpoint: '/repos/margelo/nitro/issues/comments/101',
        method: 'PATCH',
        body: { body: `${marker}\n${report.markdown}` },
      },
    ])
  })

  test.each([0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid run ID %s before making requests',
    async (workflowRunId) => {
      let requests = 0
      await expect(
        postPerformanceComment({ ...report, workflowRunId }, async () => {
          requests++
          return {}
        })
      ).rejects.toThrow('Invalid validated PR report metadata or size.')
      expect(requests).toBe(0)
    }
  )

  test('creates a new custom bot comment when migrating from GitHub Actions', async () => {
    const writes: unknown[] = []
    const status = await postPerformanceComment(
      report,
      async (endpoint, method = 'GET', body) => {
        if (method !== 'GET') {
          writes.push({ endpoint, method, body })
          return {}
        }
        if (endpoint.includes('/pulls/')) return pullRequest
        return [
          {
            id: 1,
            body: `${marker}\nold report`,
            user: { login: 'github-actions[bot]', type: 'Bot' },
          },
          {
            id: 2,
            body: marker,
            user: { login: 'nitro-modules-bot[bot]', type: 'User' },
          },
        ]
      },
      'nitro-modules-bot[bot]'
    )
    expect(status).toBe('created')
    expect(writes).toEqual([
      {
        endpoint: '/repos/margelo/nitro/issues/123/comments',
        method: 'POST',
        body: { body: `${marker}\n${report.markdown}` },
      },
    ])
  })

  test('rejects a human author before making requests', async () => {
    let requests = 0
    await expect(
      postPerformanceComment(
        report,
        async () => {
          requests++
          return {}
        },
        'mrousavy'
      )
    ).rejects.toThrow('Performance comment author must be a GitHub bot login.')
    expect(requests).toBe(0)
  })

  test('does not post stale results after a PR advances', async () => {
    let requests = 0
    const status = await postPerformanceComment(report, async () => {
      requests++
      return { ...pullRequest, head: { sha: 'c'.repeat(40) } }
    })
    expect(status).toBe('stale')
    expect(requests).toBe(1)
  })
})
