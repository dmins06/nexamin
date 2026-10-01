export const appPaths = {
  dashboard: '/dashboard',
  schedule: '/schedule',
  courses: '/courses',
  planner: '/planner',
  exams: '/exams',
  labs: '/labs',
  anatomy: '/labs/anatomy',
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
