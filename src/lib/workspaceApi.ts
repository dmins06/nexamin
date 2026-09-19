import { clearSession, getSession, setSession } from './api'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8010/api/v1').replace(/\/$/, '')

export interface Course {
  id: string
  name: string
  code: string | null
  description: string | null
  semester: string | null
  academic_year: string | null
  color: string | null
  visibility: 'private' | 'university' | 'public'
}

export interface StudyDocument {
  id: string
  course_id: string
  original_filename: string
  mime_type: string
  size: number
  processing_status: 'pending' | 'processing' | 'completed' | 'failed'
  processing_error: string | null
  page_count: number | null
  created_at: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string
  university: { id: string; name: string; short_name: string; logo_url: string | null } | null
  major: string | null
  student_year: number | null
}

export interface TutorReply {
  answer: string
  conversation_id: string
  citations: Array<{ document_id: string; filename: string; page: number | null; chunk_id: string }>
}

interface Page<T> {
  items: T[]
  total: number
}

interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

function messageFrom(body: unknown) {
  if (typeof body !== 'object' || body === null) return 'Yêu cầu chưa thể hoàn tất.'
  const data = body as { error?: { message?: string }; detail?: string }
  return data.error?.message ?? data.detail ?? 'Yêu cầu chưa thể hoàn tất.'
}

async function refreshAccess(): Promise<TokenPair | null> {
  const session = getSession()
  if (!session) return null
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  if (!response.ok) {
    clearSession()
    return null
  }
  const next = (await response.json()) as TokenPair
  setSession(next)
  return next
}

async function authorized<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const session = getSession()
  if (!session) throw new Error('Phiên đăng nhập đã hết hạn.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new Error('Không thể kết nối máy chủ StudyHubAI.')
  }
  if (response.status === 401 && retry) {
    const next = await refreshAccess()
    if (!next) throw new Error('Phiên đăng nhập đã hết hạn.')
    return authorized<T>(path, init, false)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(messageFrom(body))
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const workspaceApi = {
  profile: () => authorized<UserProfile>('/auth/me'),
  courses: () => authorized<Page<Course>>('/courses?page=1&page_size=100'),
  createCourse: (payload: { name: string; code?: string; semester?: string; color?: string }) =>
    authorized<Course>('/courses', { method: 'POST', body: JSON.stringify(payload) }),
  documents: () => authorized<Page<StudyDocument>>('/documents?page=1&page_size=100'),
  uploadDocument: (courseId: string, file: File) => {
    const form = new FormData()
    form.set('course_id', courseId)
    form.set('file', file)
    return authorized<StudyDocument>('/documents/upload', { method: 'POST', body: form })
  },
  deleteDocument: (id: string) => authorized<void>(`/documents/${id}`, { method: 'DELETE' }),
  chat: (payload: { course_id: string; conversation_id?: string; message: string }) =>
    authorized<TutorReply>('/ai/chat', { method: 'POST', body: JSON.stringify(payload) }),
}
