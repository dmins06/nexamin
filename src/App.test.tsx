import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

describe('StudyHubAI dashboard', () => {
  afterEach(cleanup)
  beforeEach(() => {
    window.localStorage.clear()
    sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
    }))
  })

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

  it('creates a course and immediately shows it in the course list', async () => {
    const user = userEvent.setup()

    const courseList = [{
      id: 'course-1',
      name: 'Khai thác dữ liệu',
      code: '012012204103',
      semester: 'HKHe',
      credits: 3,
      color: '#7c6cff',
      description: 'Sẵn sàng để thêm tài liệu và chủ đề học.',
      final_score: 8.5,
      is_completed: true,
    }]

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url.includes('/auth/me') || url.includes('/users/me')) {
        return new Response(JSON.stringify({
          id: 'user-1',
          email: 'student@example.edu',
          full_name: 'Nguyễn Minh Anh',
          avatar_url: null,
          university: null,
          major: 'Công nghệ thông tin',
          student_year: 2,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.includes('/social/messages/unread')) {
        return new Response(JSON.stringify({ total: 0, by_sender: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.includes('/social/friendships')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.includes('/calendar')) {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.includes('/courses/summary/academic')) {
        return new Response(JSON.stringify({
          gpa: 4,
          completed_credits: 3,
          degree_classification: 'Xuất sắc',
          grades: [{ course_id: 'course-1', letter: 'A', grade4: 4, grade10: 8.5 }],
          policy: {
            id: 'policy-1',
            name: 'Khung tín chỉ Bộ GD&ĐT',
            source_url: 'https://example.com',
            is_school_specific: false,
            bands: [],
          },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.includes('/courses')) {
        if (init?.method === 'POST') {
          const payload = JSON.parse(String(init.body ?? '{}'))
          const created = {
            id: 'course-2',
            name: payload.name,
            code: payload.code ?? 'LTPNC',
            semester: payload.semester ?? 'HK1',
            credits: payload.credits ?? 3,
            color: payload.color ?? '#315c45',
            description: 'Mới tạo',
            final_score: null,
            is_completed: false,
            completed_at: null,
            academic_year: null,
            visibility: 'private',
          }
          courseList.push(created)
          return new Response(JSON.stringify(created), { status: 201, headers: { 'Content-Type': 'application/json' } })
        }

        return new Response(JSON.stringify({
          items: courseList,
          page: 1,
          page_size: 100,
          total: courseList.length,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }))

    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /^Môn học$/i })[0])
    await user.click(screen.getByRole('button', { name: /Thêm môn học/i }))
    await user.type(screen.getByLabelText('Tên môn'), 'Lập trình nâng cao')
    await user.type(screen.getByLabelText('Mã môn'), 'LTPNC')
    await user.click(screen.getByRole('button', { name: /Lưu môn học/i }))

    await waitFor(() => {
      expect(screen.getByText('Lập trình nâng cao')).toBeInTheDocument()
    })
    expect(screen.queryByText('Cannot read properties of null (reading \'reset\')')).not.toBeInTheDocument()
  })
})
