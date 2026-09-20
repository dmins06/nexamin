import { CalendarPlus, Check, Clock3, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { type Course, workspaceApi } from '../../lib/workspaceApi'
import type { StudyTask } from '../../types'

interface ScheduleViewProps {
  tasks: StudyTask[]
  onAddTask: (task: StudyTask) => Promise<void>
  onToggleTask: (id: string) => void | Promise<void>
  onDeleteTask: (id: string) => Promise<void>
  onOpenCourses: () => void
}

const tones: StudyTask['tone'][] = ['green', 'amber', 'clay']

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function readableDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

export function ScheduleView({
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onOpenCourses,
}: ScheduleViewProps) {
  const today = localDateValue()
  const [selectedDate, setSelectedDate] = useState(today)
  const [courses, setCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(true)
  const [courseError, setCourseError] = useState('')
  const [actionError, setActionError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  useEffect(() => {
    workspaceApi.courses()
      .then((page) => setCourses(page.items))
      .catch((reason: unknown) => {
        setCourseError(reason instanceof Error ? reason.message : 'Không tải được danh sách môn học.')
      })
      .finally(() => setLoadingCourses(false))
  }, [])

  const dayTasks = useMemo(
    () => tasks
      .filter((task) => task.scheduledDate === selectedDate)
      .sort((first, second) => first.scheduledTime.localeCompare(second.scheduledTime)),
    [selectedDate, tasks],
  )

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const courseId = String(data.get('courseId'))
    const courseIndex = courses.findIndex((course) => course.id === courseId)
    const course = courses[courseIndex]
    if (!course) return

    setSaving(true)
    setActionError('')
    const task: StudyTask = {
      id: crypto.randomUUID(),
      courseId: course.id,
      course: course.name,
      title: String(data.get('title')).trim(),
      duration: Number(data.get('duration')),
      scheduledDate: String(data.get('scheduledDate')),
      scheduledTime: String(data.get('scheduledTime')),
      tone: tones[Math.max(0, courseIndex) % tones.length] ?? 'green',
      completed: false,
    }
    setSelectedDate(task.scheduledDate)
    try {
      await onAddTask(task)
      form.reset()
      setFormOpen(false)
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Không thể lưu lịch học.')
    } finally { setSaving(false) }
  }

  return (
    <section className="page-view schedule-page" aria-labelledby="schedule-title">
      <div className="schedule-heading">
        <div>
          <h2 id="schedule-title">Lịch học của bạn</h2>
          <p>Chọn ngày, môn học và thời gian phù hợp. Lịch chỉ xuất hiện khi bạn tự thêm.</p>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={loadingCourses || courses.length === 0}
          onClick={() => setFormOpen((current) => !current)}
        >
          {formOpen ? <X size={18} /> : <Plus size={18} />}
          {formOpen ? 'Đóng biểu mẫu' : 'Thêm buổi học'}
        </button>
      </div>

      <div className="date-toolbar">
        <label htmlFor="schedule-date">Ngày học</label>
        <input
          id="schedule-date"
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
        />
        <button className="secondary-action" type="button" onClick={() => setSelectedDate(today)}>
          Hôm nay
        </button>
        <strong>{readableDate(selectedDate)}</strong>
      </div>

      {(courseError || actionError) && <p className="inline-error" role="alert">{courseError || actionError}</p>}

      {!loadingCourses && courses.length === 0 && (
        <div className="schedule-course-notice">
          <CalendarPlus size={22} aria-hidden="true" />
          <div><strong>Chưa có môn học</strong><p>Thêm môn trước, sau đó quay lại xếp lịch.</p></div>
          <button className="secondary-action" type="button" onClick={onOpenCourses}>Đến mục Môn học</button>
        </div>
      )}

      {formOpen && (
        <form className="schedule-form" onSubmit={addTask}>
          <label>Môn học
            <select name="courseId" required defaultValue="">
              <option value="" disabled>Chọn môn học</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
          </label>
          <label>Nội dung học
            <input name="title" required minLength={2} maxLength={180} placeholder="Ví dụ: Ôn chương 2" />
          </label>
          <label>Ngày
            <input name="scheduledDate" type="date" required defaultValue={selectedDate} />
          </label>
          <label>Giờ bắt đầu
            <input name="scheduledTime" type="time" required defaultValue="08:00" />
          </label>
          <label>Thời lượng (phút)
            <input name="duration" type="number" required min={5} max={480} step={5} defaultValue={45} />
          </label>
          <button className="primary-action" type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
            {saving ? 'Đang lưu…' : 'Lưu vào lịch'}
          </button>
        </form>
      )}

      {dayTasks.length === 0 ? (
        <div className="schedule-empty">
          <CalendarPlus size={28} aria-hidden="true" />
          <h3>Ngày này chưa có lịch học</h3>
          <p>{courses.length > 0 ? 'Thêm một buổi học để bắt đầu lên kế hoạch.' : 'Danh sách sẽ xuất hiện sau khi bạn tạo môn và thêm buổi học.'}</p>
        </div>
      ) : (
        <div className="timeline" aria-label={`Lịch ${readableDate(selectedDate)}`}>
          {dayTasks.map((task, index) => (
            <article className={task.completed ? 'schedule-entry completed' : 'schedule-entry'} key={task.id}>
              <div className="schedule-time"><strong>{task.scheduledTime}</strong><span>{task.duration} phút</span></div>
              <button
                className="check-button"
                type="button"
                aria-label={task.completed ? `Đánh dấu chưa xong: ${task.title}` : `Hoàn thành: ${task.title}`}
                aria-pressed={task.completed}
                onClick={() => onToggleTask(task.id)}
              >
                {task.completed && <Check size={16} strokeWidth={3} />}
              </button>
              <div className="schedule-entry-copy"><small>{task.course}</small><h3>{task.title}</h3><p><Clock3 size={14} /> {task.duration} phút tập trung</p></div>
              {confirmingId === task.id ? (
                <div className="delete-confirm">
                  <span>Xóa buổi này?</span>
                  <button type="button" onClick={() => void onDeleteTask(task.id).then(() => setConfirmingId(null)).catch((reason: unknown) => setActionError(reason instanceof Error ? reason.message : 'Không thể xóa lịch học.'))}>Xóa</button>
                  <button type="button" onClick={() => setConfirmingId(null)}>Giữ lại</button>
                </div>
              ) : (
                <button className="icon-button" type="button" onClick={() => setConfirmingId(task.id)} aria-label={`Xóa ${task.title}`}>
                  <Trash2 size={17} />
                </button>
              )}
              <span className={`schedule-tone ${task.tone}`} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
