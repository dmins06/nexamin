import { searchLocalUniversities } from './universityCatalog'

export interface University {
  id: string
  official_code: string | null
  name: string
  short_name: string
  logo_url: string | null
  website: string | null
  is_verified: boolean
}

interface Page<T> {
  items: T[]
  page: number
  page_size: number
  total: number
}

export interface RegistrationChallenge {
  challenge_id: string
  masked_email: string
  expires_in: number
}

export interface RegistrationPayload {
  email: string
  password: string
  full_name: string
  university_id: string
  major?: string
  student_year?: number
}

interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

interface ApiErrorBody {
  error?: { message?: string }
  detail?: string | Array<{ msg?: string }>
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
const SESSION_KEY = 'studyhub.auth.v1'

function errorMessage(body: ApiErrorBody, fallback: string) {
  if (body.error?.message) return body.error.message
  if (typeof body.detail === 'string') return body.detail
  if (Array.isArray(body.detail)) return body.detail[0]?.msg ?? fallback
  return fallback
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new Error('Không thể kết nối máy chủ. Hãy kiểm tra backend đang chạy.')
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody
    throw new Error(errorMessage(body, 'Yêu cầu chưa thể hoàn tất.'))
  }
  return response.json() as Promise<T>
}

export function getSession(): TokenPair | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as TokenPair) : null
  } catch {
    return null
  }
}

export function setSession(tokens: TokenPair) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens))
  window.dispatchEvent(new Event('studyhub:auth-changed'))
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
  window.dispatchEvent(new Event('studyhub:auth-changed'))
}

export async function searchUniversities(query: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: '1', page_size: '30' })
  const path = query.trim()
    ? `/universities/search?${new URLSearchParams({ q: query.trim(), page: '1', page_size: '30' })}`
    : `/universities?${params}`
  try {
    const page = await request<Page<University>>(path, { signal })
    if (page.total > 0) return page
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') throw reason
  }
  return searchLocalUniversities(query)
}

export async function login(email: string, password: string) {
  const tokens = await request<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setSession(tokens)
  return tokens
}

export async function register(payload: RegistrationPayload) {
  const result = await request<TokenPair | RegistrationChallenge>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  })

  if ('access_token' in result && 'refresh_token' in result) {
    setSession(result)
  }

  return result
}

export async function resendRegistration(payload: RegistrationPayload) {
  return request<RegistrationChallenge>("/auth/register/resend", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function verifyRegistration(challengeId: string, otp: string, email: string, password: string) {
  await request("/auth/register/verify", {
    method: "POST",
    body: JSON.stringify({ challenge_id: challengeId, otp }),
  })
  return login(email, password)
}

export async function logout() {
  const session = getSession()
  clearSession()
  if (!session) return
  await request('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  }).catch(() => undefined)
}
