import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PracticeView } from './PracticeView'

const api = vi.hoisted(() => ({
  subjects: vi.fn(),
  history: vi.fn(),
}))

vi.mock('../../lib/workspaceApi', () => ({
  workspaceApi: {
    practiceSubjects: api.subjects,
    practiceHistory: api.history,
  },
}))

describe('PracticeView', () => {
  beforeEach(() => {
    window.localStorage.removeItem('nexamin.practice.active.v1')
    api.subjects.mockResolvedValue([])
    api.history.mockResolvedValue([])
  })

  it('shows an honest empty bank until questions are reviewed', async () => {
    render(<PracticeView />)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Chưa có bộ câu hỏi được duyệt' })).toBeInTheDocument())
    expect(screen.getByText(/có nguồn và kiểm duyệt/)).toBeInTheDocument()
  })
})
