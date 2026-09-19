import type { StudyState } from '../types'

const STORAGE_KEY = 'studyhub-ai:state:v1'

export function loadStudyState(fallback: StudyState): StudyState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (!isStudyState(parsed)) return fallback
    return parsed
  } catch {
    return fallback
  }
}

export function saveStudyState(state: StudyState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable in private browsing; the UI remains usable.
  }
}

function isStudyState(value: unknown): value is StudyState {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<StudyState>
  return (
    candidate.version === 1 &&
    typeof candidate.focusSeconds === 'number' &&
    typeof candidate.completedSessions === 'number' &&
    Array.isArray(candidate.tasks)
  )
}
