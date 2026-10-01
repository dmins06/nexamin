export const appPaths = {
  dashboard: '/dashboard',
  schedule: '/schedule',
  courses: '/courses',
  planner: '/planner',
  exams: '/exams',
  labs: '/labs',
  anatomy: '/labs/anatomy',
  it: '/labs/it',
  itCode: '/labs/it/code',
  itAlgorithms: '/labs/it/algorithms',
  itComputer: '/labs/it/computer',
  itNetwork: '/labs/it/network',
  itOs: '/labs/it/os',
  itDatabase: '/labs/it/database',
  itAi: '/labs/it/ai',
  itSecurity: '/labs/it/security',
  electives: '/electives',
  notes: '/notes',
  assistant: '/assistant',
  community: '/community',
  messages: '/messages',
  profile: '/profile',
  settings: '/settings',
  admin: '/admin',
} as const

export type AppPath = typeof appPaths[keyof typeof appPaths]

const titles: Readonly<Record<AppPath, string>> = {
  '/dashboard': 'Trang chủ',
  '/schedule': 'Lịch học',
  '/courses': 'Học phần',
  '/planner': 'Kế hoạch',
  '/exams': 'Luyện đề',
  '/labs': 'Phòng Lab',
  '/labs/anatomy': 'Giải phẫu người 3D',
  '/labs/it': 'CNTT Lab',
  '/labs/it/code': 'Code Lab',
  '/labs/it/algorithms': 'Algorithm Lab',
  '/labs/it/computer': 'Computer Architecture',
  '/labs/it/network': 'Network Lab',
  '/labs/it/os': 'Operating System',
  '/labs/it/database': 'Database Lab',
  '/labs/it/ai': 'AI / Machine Learning',
  '/labs/it/security': 'Security Lab',
  '/electives': 'Môn tự chọn',
  '/notes': 'Ghi chú',
  '/assistant': 'AI Assistant',
  '/community': 'Cộng đồng',
  '/messages': 'Tin nhắn',
  '/profile': 'Hồ sơ',
  '/settings': 'Cài đặt',
  '/admin': 'Quản trị',
}

export function titleForPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  return normalized === '/' ? 'Trang chủ' : normalized in titles ? titles[normalized as AppPath] : 'Không tìm thấy trang'
}
