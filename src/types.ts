export type ViewId = 'overview' | 'courses' | 'library' | 'tutor' | 'schedule' | 'focus' | 'progress'

export interface StudyTask {
  id: string
  course: string
  title: string
  duration: number
  due: string
  tone: 'green' | 'amber' | 'clay'
  completed: boolean
}

export interface StudyState {
  version: 1
  tasks: StudyTask[]
  focusSeconds: number
  completedSessions: number
}
