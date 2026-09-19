import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('StudyHubAI dashboard', () => {
  afterEach(cleanup)
  beforeEach(() => window.localStorage.clear())

  it('shows the next study action and toggles task completion', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Tiếp tục nhịp học' })).toBeInTheDocument()
    const task = screen.getByRole('button', {
      name: 'Hoàn thành: Đọc cây nhị phân & ghi 3 ý chính',
    })
    await user.click(task)
    expect(task).toHaveAttribute('aria-pressed', 'true')
    expect(window.localStorage.getItem('studyhub-ai:state:v1')).toContain('"completed":true')
  })

  it('navigates to focus view and starts a session', async () => {
    const user = userEvent.setup()
    render(<App />)

    const focusButton = screen.getAllByRole('button', { name: 'Tập trung' }).at(0)
    if (!focusButton) throw new Error('Focus navigation is missing')
    await user.click(focusButton)
    expect(screen.getByRole('heading', { name: 'Một việc, trọn một nhịp' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bắt đầu phiên' }))
    expect(screen.getByRole('button', { name: 'Tạm dừng' })).toBeInTheDocument()
  })
})
