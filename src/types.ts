export type ViewId = 'overview' | 'courses' | 'library' | 'tutor' | 'schedule' | 'focus' | 'progress' | 'practice' | 'lab' | 'electives' | 'community' | 'messages' | 'profile' | 'settings' | 'admin'

export interface StudyTask {
  id: string
  courseId: string
  course: string
  title: string
  duration: number
  scheduledDate: string
  scheduledTime: string
  tone: 'green' | 'amber' | 'clay'
  completed: boolean
}

export interface StudyState {
  version: 2
  tasks: StudyTask[]
  focusSeconds: number
  completedSessions: number
}
