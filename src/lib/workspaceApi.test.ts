import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('shows a useful message when an older backend returns the website instead of an API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('<!doctype html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }))
    await expect(workspaceApi.electiveAvailability()).rejects.toThrow('đang cập nhật tính năng')
  })
})

describe('realtime transport security', () => {
  const token = 'synthetic.header.signature'
  beforeEach(() => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: token, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 900,
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sends the JWT in the handshake protocol, never in the URL', () => {
    const captured: { url: string; protocols: string | string[] | undefined }[] = []
    class SocketStub {
      addEventListener = vi.fn()
      constructor(url: string | URL, protocols?: string | string[]) {
        captured.push({ url: String(url), protocols })
      }
    }
    vi.stubGlobal('WebSocket', SocketStub)
    expect(workspaceApi.realtime(() => {})).not.toBeNull()
    expect(captured).toHaveLength(1)
    const call = captured[0]
    if (!call) throw new Error('Missing synthetic socket capture')
    expect(new URL(call.url).search).toBe('')
    expect(call.url).not.toContain(token)
    expect(call.protocols).toEqual(['nexamin', `bearer.${token}`])
  })

  it('keeps polling available when the browser cannot construct a socket', () => {
    class FailingSocket {
      constructor() { throw new Error('Synthetic browser restriction') }
    }
    vi.stubGlobal('WebSocket', FailingSocket)
    expect(workspaceApi.realtime(() => {})).toBeNull()
  })

  it.each([42, 'token with whitespace', 'x'.repeat(4097)])(
    'rejects malformed or oversized stored credentials (case %#)', (accessToken) => {
      const socket = vi.fn()
      vi.stubGlobal('WebSocket', socket)
      sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({ access_token: accessToken }))
      expect(workspaceApi.realtime(() => {})).toBeNull()
      expect(socket).not.toHaveBeenCalled()
    },
  )
})

describe('private binary downloads', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: 'synthetic-file-access', refresh_token: 'synthetic-file-refresh',
      token_type: 'bearer', expires_in: 900,
    }))
  })

  it('fetches by message ID with Authorization, never by the stored attachment URL', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('synthetic', {
      headers: { 'Content-Type': 'text/plain' },
    }))
    const result = await workspaceApi.messageAttachment('message/fixture')
    expect(await readBlob(result)).toBe('synthetic')
    const [url, init] = fetcher.mock.calls[0] ?? []
    expect(String(url)).toContain('/social/messages/message%2Ffixture/attachment')
    expect(String(url)).not.toContain('synthetic-file-access')
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-file-access')
  })

  it('refreshes a binary request once without discarding the original AbortSignal', async () => {
    const controller = new AbortController()
    const fetcher = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'synthetic-refreshed', refresh_token: 'synthetic-next', expires_in: 900,
      })))
      .mockResolvedValueOnce(new Response('synthetic'))
    expect(await readBlob(await workspaceApi.downloadDocument('fixture', controller.signal))).toBe('synthetic')
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls[2]?.[1]?.signal).toBe(controller.signal)
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe('Bearer synthetic-refreshed')
  })

  it('does not turn a forbidden response or old HTML fallback into a downloadable file', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      error: { message: 'Bạn không có quyền xem file.' },
    }), { status: 403 }))
    await expect(workspaceApi.messageAttachment('fixture')).rejects.toThrow('không có quyền')
    vi.mocked(fetch).mockResolvedValueOnce(new Response('<!doctype html>', {
      headers: { 'Content-Type': 'text/html' },
    }))
    await expect(workspaceApi.downloadDocument('fixture')).rejects.toThrow('đang cập nhật')
  })
})

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Expected text'))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}
