import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setSession } from './api'
import { workspaceApi } from './workspaceApi'

describe('workspace API session refresh', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('rotates one refresh token only once for concurrent expired requests', async () => {
    setSession({
      access_token: 'expired-access',
      refresh_token: 'valid-refresh-token-that-is-long-enough',
      token_type: 'bearer',
      expires_in: 0,
    })
    let refreshCalls = 0
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input)
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1
        return new Response(JSON.stringify({
          access_token: 'new-access',
          refresh_token: 'new-refresh-token-that-is-long-enough',
          token_type: 'bearer',
          expires_in: 900,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      const authorization = new Headers(init?.headers).get('Authorization')
      if (authorization === 'Bearer expired-access') return new Response('{}', { status: 401 })
      if (url.includes('/auth/me')) {
        return new Response(JSON.stringify({ id: 'user', email: 'student@example.com', full_name: 'Student', avatar_url: null, university: null, major: null, student_year: null }), { status: 200 })
      }
      return new Response('[]', { status: 200 })
    })

    await Promise.all([workspaceApi.profile(), workspaceApi.calendar()])

    expect(refreshCalls).toBe(1)
    expect(fetchMock).toHaveBeenCalled()
  })
})
