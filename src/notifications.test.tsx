import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { CommunityView } from './features/social/SocialViews'

const profile = {
  id: 'user-1',
  email: 'student@example.edu',
  full_name: 'Nguyễn Minh Anh',
  avatar_url: null,
  university: null,
  major: 'Công nghệ thông tin',
  student_year: 2,
}

describe('social navigation', () => {
  it('shows a separate messages view alongside the community feed', async () => {
    render(<App />)
    expect(await screen.findAllByRole('button', { name: /Cộng đồng/i })).not.toHaveLength(0)
    expect(await screen.findAllByRole('button', { name: /Tin nhắn/i })).not.toHaveLength(0)
  })
})

describe('community notification', () => {
  beforeEach(() => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: 'access', refresh_token: 'r'.repeat(32), token_type: 'bearer', expires_in: 900,
    }))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/social/messages/unread')) {
        return new Response(JSON.stringify({ total: 0, by_sender: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/social/friendships')) {
        return new Response(JSON.stringify([
          {
            id: 'friendship-1',
            status: 'pending',
            request_incoming: true,
            created_at: '2025-01-01T00:00:00Z',
            profile: {
              id: 'user-2',
              full_name: 'Nguyễn Thảo',
              avatar_url: null,
              university: { id: 'uni-1', name: 'ĐH Sư phạm', short_name: 'SP', official_code: 'SP', logo_url: null },
              major: 'Kỹ thuật phần mềm',
              friendship_id: 'friendship-1',
              friendship_status: 'pending',
              request_incoming: true,
            },
          },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/auth/me') || url.includes('/users/me')) {
        return new Response(JSON.stringify(profile), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/calendar')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('shows a community red-dot only for incoming friend requests and no message red-dot', async () => {
    render(<App />)
    expect(await screen.findAllByLabelText('Có lời mời kết bạn mới')).toHaveLength(2)
    expect(screen.queryByLabelText('Có tin nhắn mới')).not.toBeInTheDocument()
  })

  it('does not render seeded sample posts in the community feed', () => {
    render(<CommunityView ownId={undefined} onMessagesRead={() => undefined} />)
    expect(screen.queryByText(/Hôm nay mình hoàn xong/)).not.toBeInTheDocument()
  })
})

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

  it('refreshes the unread notification state after accepting a friend request', async () => {
    const onMessagesRead = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/social/people')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/social/friendships')) {
        if (url.endsWith('/social/friendships')) {
          return new Response(JSON.stringify([
            {
              id: 'friendship-1',
              status: 'pending',
              request_incoming: true,
              created_at: '2025-01-01T00:00:00Z',
              profile: {
                id: 'user-2',
                full_name: 'Nguyễn Thảo',
                avatar_url: null,
                university: { id: 'uni-1', name: 'ĐH Sư phạm', short_name: 'SP', official_code: 'SP', logo_url: null },
                major: 'Kỹ thuật phần mềm',
                friendship_id: 'friendship-1',
                friendship_status: 'pending',
                request_incoming: true,
              },
            },
          ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        if (url.includes('/accept')) {
          return new Response(JSON.stringify({
            id: 'friendship-1',
            status: 'accepted',
            request_incoming: false,
            created_at: '2025-01-01T00:00:00Z',
            profile: {
              id: 'user-2',
              full_name: 'Nguyễn Thảo',
              avatar_url: null,
              university: { id: 'uni-1', name: 'ĐH Sư phạm', short_name: 'SP', official_code: 'SP', logo_url: null },
              major: 'Kỹ thuật phần mềm',
              friendship_id: 'friendship-1',
              friendship_status: 'accepted',
              request_incoming: false,
            },
          }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
      }
      if (url.includes('/social/messages')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/auth/me')) {
        return new Response(JSON.stringify(profile), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    render(<CommunityView ownId="user-1" onMessagesRead={onMessagesRead} />)
    fireEvent.click(await screen.findByLabelText('Chấp nhận Nguyễn Thảo'))

    await waitFor(() => expect(onMessagesRead.mock.calls.length).toBeGreaterThan(0))
  })

  it('refreshes the unread notification state after sending a private message', async () => {
    const onMessagesRead = vi.fn()
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/social/people')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/social/friendships')) {
        return new Response(JSON.stringify([
          {
            id: 'friendship-2',
            status: 'accepted',
            request_incoming: false,
            created_at: '2025-01-01T00:00:00Z',
            profile: {
              id: 'user-2',
              full_name: 'Nguyễn Thảo',
              avatar_url: null,
              university: { id: 'uni-1', name: 'ĐH Sư phạm', short_name: 'SP', official_code: 'SP', logo_url: null },
              major: 'Kỹ thuật phần mềm',
              friendship_id: 'friendship-2',
              friendship_status: 'accepted',
              request_incoming: false,
            },
          },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes("/social/messages/user-2") && init?.method === "POST") {
        return new Response(JSON.stringify({
          id: 'message-1',
          sender_id: 'user-1',
          recipient_id: 'user-2',
          content: 'Chào bạn',
          created_at: '2025-01-01T00:00:00Z',
          read_at: null,
        }), { status: 201, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/social/messages/user-2')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    render(<CommunityView ownId="user-1" onMessagesRead={onMessagesRead} />)
    fireEvent.click((await screen.findByText('Nguyễn Thảo')).closest('button')!)
    fireEvent.change(screen.getByPlaceholderText('Nhắn cho Nguyễn Thảo…'), { target: { value: 'Chào bạn' } })
    fireEvent.click(screen.getByLabelText('Gửi tin nhắn'))

    await waitFor(() => expect(onMessagesRead.mock.calls.length).toBeGreaterThan(0))
  })
})
