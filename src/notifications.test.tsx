import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const profile = {
  id: 'user-1',
  email: 'student@example.edu',
  full_name: 'Nguyễn Minh Anh',
  avatar_url: null,
  university: null,
  major: 'Công nghệ thông tin',
  student_year: 2,
}

describe('message notification', () => {
  beforeEach(() => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: 'access', refresh_token: 'r'.repeat(32), token_type: 'bearer', expires_in: 900,
    }))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/social/messages/unread') ? { total: 2, by_sender: { friend: 2 } } : profile
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows a red-dot status in friend navigation when messages are unread', async () => {
    render(<App />)
    expect(await screen.findAllByLabelText('Có tin nhắn mới')).toHaveLength(2)
  })
})
