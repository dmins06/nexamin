import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSession } from './api'
import { workspaceApi } from './workspaceApi'

describe('session refresh', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: 'expired', refresh_token: 'valid', token_type: 'bearer', expires_in: 900,
    }))
  })

  it('preserves the session when refresh fails temporarily', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))

    await expect(workspaceApi.profile()).rejects.toThrow('tạm thời chưa sẵn sàng')
    expect(getSession()?.refresh_token).toBe('valid')
  })

  it('clears the session when the refresh token is invalid', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(workspaceApi.profile()).rejects.toThrow('Phiên đăng nhập đã hết hạn')
    expect(getSession()).toBeNull()
  })
})
