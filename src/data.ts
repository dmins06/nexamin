import type { StudyState } from './types'

export const initialStudyState: StudyState = {
  version: 1,
  focusSeconds: 25 * 60,
  completedSessions: 3,
  tasks: [
    {
      id: 'tree-reading',
      course: 'Cấu trúc dữ liệu',
      title: 'Đọc cây nhị phân & ghi 3 ý chính',
      duration: 35,
      due: 'Hôm nay · 10:30',
      tone: 'green',
      completed: false,
    },
    {
      id: 'probability-set',
      course: 'Xác suất thống kê',
      title: 'Giải bộ bài tập phân phối xác suất',
      duration: 45,
      due: 'Hôm nay · 14:00',
      tone: 'amber',
      completed: false,
    },
    {
      id: 'database-notes',
      course: 'Cơ sở dữ liệu',
      title: 'Hoàn thiện ghi chú mô hình quan hệ',
      duration: 30,
      due: 'Ngày mai',
      tone: 'clay',
      completed: false,
    },
  ],
}

export const weekData = [
  { day: 'T2', minutes: 78 },
  { day: 'T3', minutes: 112 },
  { day: 'T4', minutes: 65 },
  { day: 'T5', minutes: 135 },
  { day: 'T6', minutes: 95 },
  { day: 'T7', minutes: 148 },
  { day: 'CN', minutes: 42 },
]
