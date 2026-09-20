import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('Study progress', () => {
  afterEach(cleanup)
  beforeEach(() => window.localStorage.clear())

  it('calculates progress only from user-scheduled tasks', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem('studyhub-ai:state:v2', JSON.stringify({
      version: 2,
      focusSeconds: 1500,
      completedSessions: 0,
      tasks: [
        { id: 'one', courseId: 'course-a', course: 'Giải tích', title: 'Bài 1', duration: 30, scheduledDate: '2026-09-20', scheduledTime: '08:00', tone: 'green', completed: true },
        { id: 'two', courseId: 'course-a', course: 'Giải tích', title: 'Bài 2', duration: 45, scheduledDate: '2026-09-21', scheduledTime: '09:00', tone: 'green', completed: false },
      ],
    }))
    render(<App />)
    const progressButton = screen.getAllByRole('button', { name: 'Tiến độ' }).at(0)
    if (!progressButton) throw new Error('Progress navigation is missing')
    await user.click(progressButton)
    expect(screen.getByText('50%', { selector: '.big-number' })).toBeInTheDocument()
    expect(screen.getByText('Giải tích')).toBeInTheDocument()
    expect(screen.getByText('1 trong 2 việc đã hoàn thành. Dữ liệu được lưu trên thiết bị này.')).toBeInTheDocument()
  })
})
