import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthGate } from './AuthGate'

describe('AuthGate', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], page: 1, page_size: 30, total: 426 }),
    }))
  })

  it('shows login then opens the complete registration form', async () => {
    render(<AuthGate><p>Dashboard</p></AuthGate>)
    expect(screen.getByRole('heading', { name: 'Tiếp tục buổi học' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Tạo tài khoản' }))
    expect(screen.getByLabelText('Họ và tên')).toBeInTheDocument()
    const picker = screen.getByLabelText('Trường đại học đang học')
    expect(picker).toBeInTheDocument()
    fireEvent.focus(picker)
    await waitFor(() => expect(screen.getByText('426 cơ sở phù hợp')).toBeInTheDocument())
  })

  it('keeps the session when the backend is temporarily unavailable', async () => {
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: 'access', refresh_token: 'refresh', token_type: 'bearer', expires_in: 900,
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, json: async () => ({ error: { message: 'Unavailable' } }),
    }))
    render(<AuthGate><p>Dashboard</p></AuthGate>)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(sessionStorage.getItem('studyhub.auth.v1')).not.toBeNull()
  })
})
