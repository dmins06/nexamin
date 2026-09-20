import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('StudyHubAI dashboard', () => {
  afterEach(cleanup)
  beforeEach(() => window.localStorage.clear())

  it('persists completion for a user-created study session', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
    window.localStorage.setItem('studyhub-ai:state:v2', JSON.stringify({
      version: 2,
      focusSeconds: 1500,
      completedSessions: 0,
      tasks: [{
        id: 'user-session',
        courseId: 'course-1',
        course: 'Môn của tôi',
        title: 'Ôn bài do người dùng tạo',
        duration: 30,
        scheduledDate: today,
        scheduledTime: '09:00',
        tone: 'green',
        completed: false,
      }],
    }))
    render(<App />)

    expect(screen.getByRole('heading', { name: /Học thông minh hơn/ })).toBeInTheDocument()
    const task = screen.getByRole('button', {
      name: 'Hoàn thành: Ôn bài do người dùng tạo',
    })
    await user.click(task)
    expect(task).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('studyhub-ai:state:v2')).toContain('"completed":true')
  })

  it('opens the schedule from the primary hero action', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Bắt đầu ngay/ }))
    expect(screen.getByRole('heading', { name: 'Lịch học của bạn' })).toBeInTheDocument()
  })
})
