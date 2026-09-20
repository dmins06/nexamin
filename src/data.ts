import type { StudyState } from './types'

export const initialStudyState: StudyState = {
  version: 2,
  focusSeconds: 25 * 60,
  completedSessions: 0,
  tasks: [],
}
