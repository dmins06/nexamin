import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession, login } from './api'
import { API_BASE } from './apiBase'

describe('login request', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('posts credentials to the API and stores the returned session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'bearer',
        expires_in: 900,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )

    await login('student@example.com', 'correct-password')

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/auth/login`, expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'student@example.com', password: 'correct-password' }),
    }))
    expect(getSession()?.access_token).toBe('access')
  })
})
