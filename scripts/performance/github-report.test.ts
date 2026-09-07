import { describe, expect, test } from 'bun:test'
import { postPerformanceComment } from './github-report'

const report = {
  repository: 'margelo/nitro',
  pullRequestNumber: 123,
  baseSha: 'a'.repeat(40),
  headSha: 'b'.repeat(40),
  markdown: '## Nitro performance\n\n| Benchmark | Base | Head |',
}
const pullRequest = {
  state: 'open',
  base: { sha: report.baseSha },
  head: { sha: report.headSha },
}
const marker = '<!-- nitro-performance-paired-comparison -->'

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
