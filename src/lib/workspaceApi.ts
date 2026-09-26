import { clearSession, getSession, setSession } from './api'
import { API_BASE, REALTIME_BASE } from './apiBase'

export interface Course {
  id: string
  name: string
  code: string | null
  description: string | null
  semester: string | null
  academic_year: string | null
  credits: number
  final_score: number | null
  is_completed: boolean
  completed_at: string | null
  color: string | null
  visibility: 'private' | 'university' | 'public'
}

export interface AcademicSummary {
  policy: { id: string; name: string; source_url: string; is_school_specific: boolean; bands: Array<{ minimum: number; letter: string; points: number }> }
  gpa: number | null
  completed_credits: number
  graded_credits: number
  degree_classification: string
  grades: Array<{ course_id: string; score10: number; grade4: number; letter: string; passed: boolean; credits: number }>
}

export interface StudyDocument {
  id: string
  course_id: string
  original_filename: string
  mime_type: string
  size: number
  processing_status: 'uploaded' | 'processing' | 'ready' | 'failed'
  processing_error: string | null
  page_count: number | null
  created_at: string
}

export interface UserProfile {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  university: { id: string; name: string; short_name: string; logo_url: string | null } | null
  major: string | null
  student_year: number | null
  bio?: string | null
  role?: string
  is_verified?: boolean
  created_at?: string
  study_statistics?: {
    courses_count: number
    documents_count: number
    quizzes_completed: number
    average_mastery: number
  }
}

export interface PublicProfile {
  id: string
  full_name: string
  avatar_url: string | null
  university: UserProfile['university']
  major: string | null
  student_year?: number | null
  bio?: string | null
  friendship_id: string | null
  friendship_status: 'pending' | 'accepted' | null
  request_incoming: boolean
  is_online?: boolean
  last_seen_at?: string | null
}

export interface Friendship {
  id: string
  status: 'pending' | 'accepted'
  request_incoming: boolean
  profile: PublicProfile
  created_at: string
}


export type SocialVisibility = 'public' | 'friends' | 'private'

export interface SocialComment {
  id: string
  author: PublicProfile
  content: string
  created_at: string
}

export interface SocialPostPreview {
  id: string
  author: PublicProfile
  content: string
  image_url: string | null
  created_at: string
}

export interface SocialPost {
  id: string
  author: PublicProfile
  content: string
  image_url: string | null
  visibility: SocialVisibility
  repost_of_id: string | null
  repost_of: SocialPostPreview | null
  like_count: number
  comment_count: number
  repost_count: number
  liked_by_me: boolean
  comments: SocialComment[]
  created_at: string
  updated_at: string
}
export interface DirectMessage {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
  read_at: string | null
}

export interface MessageAttachment {
  url: string
  name: string
  mime_type: string
}

export function serializeMessageContent(content: string, attachment?: MessageAttachment | null) {
  const text = content.trim()
  if (!attachment) return text
  return JSON.stringify({
    text,
    attachment: {
      url: attachment.url,
      name: attachment.name,
      mime_type: attachment.mime_type,
    },
  })
}

export function parseMessageContent(raw: string) {
  const fallback = { text: raw, attachment: null as MessageAttachment | null }
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw) as { text?: string; attachment?: Partial<MessageAttachment> }
    if (!parsed || typeof parsed !== 'object' || !parsed.attachment || typeof parsed.attachment.url !== 'string') {
      return fallback
    }
    return {
      text: typeof parsed.text === 'string' ? parsed.text : '',
      attachment: {
        url: parsed.attachment.url,
        name: parsed.attachment.name ?? 'Tệp đính kèm',
        mime_type: parsed.attachment.mime_type ?? 'application/octet-stream',
      },
    }
  } catch {
    return fallback
  }
}

export interface CalendarEvent {
  id: string
  course_id: string | null
  title: string
  description: string | null
  start_at: string
  end_at: string
  event_type: string
  recurrence: Record<string, unknown> | null
  created_at: string
}

export interface RealtimeMessageEvent {
  type: 'message.new'
  message: DirectMessage
}

export interface TutorReply {
  answer: string
  conversation_id: string
  citations: Array<{ document_id: string; filename: string; page: number | null; chunk_id: string }>
}

export interface PracticeSubject {
  id: string
  name: string
  code: string | null
  question_count: number
  exam_count: number
  completed_exams: number
  latest_score: number | null
  best_score: number | null
}

export interface PracticeExam {
  id: string
  subject_id: string
  title: string
  description: string | null
  kind: string
  question_count: number
  time_limit_seconds: number | null
}

export interface PracticeChapter {
  id: string
  title: string
  topics: Array<{ id: string; title: string }>
}

export interface PracticeQuestion {
  id: string
  question_id: string
  order_index: number
  text: string
  question_type: 'single_choice' | 'multiple_choice' | 'true_false'
  difficulty: string
  chapter: string | null
  topic: string | null
  options: Array<{ key: string; text: string }>
  selected_keys: string[]
  marked_for_review: boolean
}

export interface PracticeAttempt {
  id: string
  exam_id: string
  subject_id: string
  exam_title: string
  status: string
  started_at: string
  deadline_at: string | null
  questions: PracticeQuestion[]
}

export interface PracticeResult {
  attempt_id: string
  exam_id: string
  subject_id: string
  score: number
  correct: number
  incorrect: number
  unanswered: number
  accuracy: number
  duration_seconds: number
  submitted_at: string
  questions: Array<{
    id: string
    question_id: string
    text: string
    selected_keys: string[]
    correct_keys: string[]
    options: Array<{ key: string; text: string }>
    is_correct: boolean
    explanation: string
    source_name: string
    source_url: string | null
    topic: string | null
  }>
}

export interface PracticeHistory {
  attempt_id: string
  exam_id: string
  subject_id: string
  exam_title: string
  score: number
  submitted_at: string
}

export interface PracticeWeakTopic {
  topic: string
  answered: number
  correct: number
  accuracy: number
}

export interface ElectiveAvailability {
  status: 'supported' | 'unsupported' | 'missing_university' | 'missing_major'
  university_code: string | null
  message: string
}

export interface Curriculum {
  id: string
  program_id: string
  major: string
  specialization: string
  cohort: number
  source_file: string
  source_url: string | null
  imported_at: string
  elective_count: number
}

export interface Career {
  code: string
  label: string
  skills: string[]
}

export interface ElectivePlan {
  curriculum: Curriculum
  career: Career
  status: 'valid_known_rules' | 'partial'
  selected_credits: number
  required_credits: number | null
  courses: Array<{
    catalog_course_id: string
    curriculum_course_id: string
    code: string | null
    name: string
    credits: number
    group: string
    semester: string | null
    academic_year: string | null
    prerequisite: string | null
    relevance_score: number
    matched_skills: string[]
    reasons: string[]
    source_url: string | null
  }>
  groups: Array<{ name: string; required_credits: number | null; selected_credits: number; status: 'satisfied' | 'unresolved' }>
  skill_coverage: Record<string, number>
  warnings: string[]
  explanation: string
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

let refreshInFlight: Promise<TokenPair | null> | null = null

async function performRefresh(): Promise<TokenPair | null> {
  const session = getSession()
  if (!session) return null
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      clearSession()
      return null
    }
    throw new Error('Máy chủ Nexamin tạm thời chưa sẵn sàng. Vui lòng thử lại sau.')
  }
  const next = (await response.json()) as TokenPair
  setSession(next)
  return next
}

function refreshAccess(): Promise<TokenPair | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => { refreshInFlight = null })
  }
  return refreshInFlight
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
    throw new Error('Không thể kết nối máy chủ Nexamin.')
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
  practiceSubjects: () => authorized<PracticeSubject[]>('/practice/subjects'),
  practiceExams: (subjectId: string) => authorized<PracticeExam[]>(`/practice/subjects/${subjectId}/exams`),
  practiceChapters: (subjectId: string) => authorized<PracticeChapter[]>(`/practice/subjects/${subjectId}/chapters`),
  practiceRandomExam: (subjectId: string, questionCount: number, options?: { chapterId?: string; topicId?: string; difficulty?: string; timeLimitMinutes?: number }) =>
    authorized<PracticeExam>('/practice/exams/random', {
      method: 'POST', body: JSON.stringify({
        subject_id: subjectId, question_count: questionCount,
        chapter_id: options?.chapterId || null, topic_id: options?.topicId || null,
        difficulty: options?.difficulty || null, time_limit_minutes: options?.timeLimitMinutes || null,
      }),
    }),
  practiceStart: (examId: string) => authorized<PracticeAttempt>(`/practice/exams/${examId}/start`, { method: 'POST' }),
  practiceLoad: (attemptId: string) => authorized<PracticeAttempt>(`/practice/attempts/${attemptId}`),
  practiceSave: (attemptId: string, questionId: string, selectedKeys: string[], markedForReview: boolean) =>
    authorized<void>(`/practice/attempts/${attemptId}/questions/${questionId}`, {
      method: 'PATCH', body: JSON.stringify({ selected_keys: selectedKeys, marked_for_review: markedForReview }),
    }),
  practiceSubmit: (attemptId: string) => authorized<PracticeResult>(`/practice/attempts/${attemptId}/submit`, { method: 'POST' }),
  practiceMistakesExam: (attemptId: string) => authorized<PracticeExam>(`/practice/attempts/${attemptId}/mistakes-exam`, { method: 'POST' }),
  practiceResult: (attemptId: string) => authorized<PracticeResult>(`/practice/attempts/${attemptId}/result`),
  practiceHistory: (subjectId?: string) => authorized<PracticeHistory[]>(`/practice/history${subjectId ? `?subject_id=${subjectId}` : ''}`),
  practiceWeakTopics: (subjectId: string) => authorized<PracticeWeakTopic[]>(`/practice/subjects/${subjectId}/weak-topics`),
  practiceReport: (questionId: string, reason: string, comment?: string) =>
    authorized<void>('/practice/reports', { method: 'POST', body: JSON.stringify({ question_id: questionId, reason, comment }) }),
  electiveAvailability: () => authorized<ElectiveAvailability>('/electives/availability'),
  electiveCurricula: () => authorized<Curriculum[]>('/electives/curricula'),
  electiveCareers: () => authorized<Career[]>('/electives/careers'),
  electiveRecommend: (curriculumId: string, careerCode: string) =>
    authorized<ElectivePlan>('/electives/recommend', { method: 'POST', body: JSON.stringify({ curriculum_id: curriculumId, career_code: careerCode }) }),
  electiveCompare: (curriculumId: string, firstCode: string, secondCode: string) =>
    authorized<{ first: ElectivePlan; second: ElectivePlan }>('/electives/compare', { method: 'POST', body: JSON.stringify({ curriculum_id: curriculumId, first_career_code: firstCode, second_career_code: secondCode }) }),
  profile: () => authorized<UserProfile>('/auth/me'),
  fullProfile: () => authorized<UserProfile>('/users/me'),
  updateProfile: (payload: { full_name?: string; student_year?: number | null; bio?: string | null }) =>
    authorized<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  changePassword: (payload: { current_password: string; new_password: string }) =>
    authorized<{ message: string }>("/users/me/change-password", { method: "POST", body: JSON.stringify(payload) }),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.set('avatar', file)
    return authorized<UserProfile>('/users/me/avatar', { method: 'POST', body: form })
  },
  courses: () => authorized<Page<Course>>('/courses?page=1&page_size=100'),
  createCourse: (payload: { name: string; code?: string; semester?: string; color?: string; credits?: number }) =>
    authorized<Course>('/courses', { method: 'POST', body: JSON.stringify(payload) }),
  updateCourse: (id: string, payload: { credits?: number; final_score?: number | null; is_completed?: boolean }) =>
    authorized<Course>(`/courses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  academicSummary: () => authorized<AcademicSummary>("/courses/summary/academic"),
  deleteCourse: (id: string) => authorized<void>(`/courses/${id}`, { method: "DELETE" }),
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
  socialFeed: (profileId?: string) =>
    authorized<SocialPost[]>(`/social/feed${profileId ? `?profile_id=${profileId}` : ''}`),
  createSocialPost: (payload: { content: string; image_url?: string | null; visibility: SocialVisibility }) =>
    authorized<SocialPost>('/social/posts', { method: 'POST', body: JSON.stringify(payload) }),
  uploadSocialImage: (file: File) => {
    const form = new FormData()
    form.set('image', file)
    return authorized<MessageAttachment>('/social/posts/upload', { method: 'POST', body: form })
  },
  togglePostLike: (postId: string) =>
    authorized<SocialPost>(`/social/posts/${postId}/like`, { method: 'POST' }),
  commentPost: (postId: string, content: string) =>
    authorized<SocialPost>(`/social/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
  repostPost: (postId: string, visibility: SocialVisibility) =>
    authorized<SocialPost>(`/social/posts/${postId}/repost`, {
      method: 'POST',
      body: JSON.stringify({ content: '', visibility }),
    }),
  deleteSocialPost: (postId: string) =>
    authorized<void>(`/social/posts/${postId}`, { method: 'DELETE' }),
  people: (query = '') => authorized<PublicProfile[]>(`/social/people?${new URLSearchParams({ q: query })}`),
  friendships: () => authorized<Friendship[]>('/social/friendships'),
  requestFriend: (userId: string) => authorized<Friendship>(`/social/friendships/${userId}`, { method: 'POST' }),
  acceptFriend: (id: string) => authorized<Friendship>(`/social/friendships/${id}/accept`, { method: 'POST' }),
  removeFriend: (id: string) => authorized<void>(`/social/friendships/${id}`, { method: 'DELETE' }),
  publicProfile: (userId: string) => authorized<PublicProfile>(`/social/profiles/${userId}`),
  messages: (userId: string) => authorized<DirectMessage[]>(`/social/messages/${userId}`),
  unreadMessages: () => authorized<{ total: number; by_sender: Record<string, number> }>("/social/messages/unread"),
  sendMessage: (userId: string, content: string, attachment?: MessageAttachment | null) =>
    authorized<DirectMessage>(`/social/messages/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ content: serializeMessageContent(content, attachment) }),
    }),
  uploadMessageAttachment: (file: File) => {
    const form = new FormData()
    form.set('file', file)
    return authorized<MessageAttachment>('/social/messages/upload', { method: 'POST', body: form })
  },
  calendar: () => authorized<CalendarEvent[]>('/calendar'),
  createCalendarEvent: (payload: Omit<CalendarEvent, 'id' | 'created_at'>) =>
    authorized<CalendarEvent>('/calendar/events', { method: 'POST', body: JSON.stringify(payload) }),
  updateCalendarEvent: (id: string, payload: Omit<CalendarEvent, 'id' | 'created_at'>) =>
    authorized<CalendarEvent>(`/calendar/events/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCalendarEvent: (id: string) => authorized<void>(`/calendar/events/${id}`, { method: 'DELETE' }),
  realtime: (onEvent: (event: RealtimeMessageEvent) => void) => {
    const session = getSession()
    if (!session || typeof WebSocket === 'undefined') return null
    const url = new URL(`${REALTIME_BASE}/social/ws`, window.location.origin)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('token', session.access_token)
    const socket = new WebSocket(url)
    socket.addEventListener('message', (message) => {
      try {
        const event = JSON.parse(String(message.data)) as RealtimeMessageEvent
        if (event.type === 'message.new' && event.message) onEvent(event)
      } catch {
        // Persisted messages remain available through the API fallback.
      }
    })
    return socket
  },
}
