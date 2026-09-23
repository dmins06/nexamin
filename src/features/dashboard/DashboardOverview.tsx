import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CalendarDays,
  Check,
  CircleCheckBig,
  GraduationCap,
  LibraryBig,
  Sparkles,
  Target,
} from 'lucide-react'
import { type AcademicSummary, type Course, workspaceApi } from '../../lib/workspaceApi'
import type { StudyState, StudyTask, ViewId } from '../../types'

interface DashboardOverviewProps {
  study: StudyState
  onToggleTask: (id: string) => void
  onNavigate: (view: ViewId) => void
}

const promptOptions = [
  'Tóm tắt tài liệu gần đây',
  'Giải thích một khái niệm',
  'Lập kế hoạch ôn tập',
]

function localDateKey(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function formatTaskTime(task: StudyTask) {
  return `${task.scheduledTime} · ${task.duration} phút`
}

export function DashboardOverview({ study, onToggleTask, onNavigate }: DashboardOverviewProps) {
  const [courses, setCourses] = useState<Course[]>([])
  const [summary, setSummary] = useState<AcademicSummary | null>(null)
  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all([
      workspaceApi.courses().then((page) => Array.isArray(page?.items) ? page.items : []),
      workspaceApi.academicSummary(),
    ]).then(([nextCourses, nextSummary]) => {
      if (!active) return
      setCourses(nextCourses)
      setSummary(nextSummary)
    }).catch(() => undefined).finally(() => {
      if (active) setDataReady(true)
    })
    return () => { active = false }
  }, [])

  const todayKey = localDateKey()
  const todayTasks = useMemo(() => study.tasks
    .filter((task) => task.scheduledDate === todayKey)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)), [study.tasks, todayKey])
  const upcomingTasks = useMemo(() => study.tasks
    .filter((task) => !task.completed && `${task.scheduledDate}T${task.scheduledTime}` >= `${todayKey}T00:00`)
    .sort((a, b) => `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`))
    .slice(0, 4), [study.tasks, todayKey])

  const completedCourses = courses.filter((course) => course.is_completed).length
  const completedTasks = study.tasks.filter((task) => task.completed).length
  const progress = courses.length
    ? Math.round((completedCourses / courses.length) * 100)
    : study.tasks.length ? Math.round((completedTasks / study.tasks.length) * 100) : 0

  function openTutor(prompt?: string) {
    if (prompt) window.sessionStorage.setItem('studyhub.ai.draft.v1', prompt)
    onNavigate('tutor')
  }

  const stats = [
    { label: 'Học phần', value: dataReady ? String(courses.length) : '—', note: `${completedCourses} đã hoàn thành`, icon: GraduationCap },
    { label: 'Tín chỉ tích lũy', value: summary ? String(summary.completed_credits) : '—', note: summary ? `${summary.graded_credits} tín chỉ đã chấm` : 'Chưa có điểm', icon: BookOpenCheck },
    { label: 'Lịch hôm nay', value: String(todayTasks.length), note: `${todayTasks.filter((task) => task.completed).length} đã hoàn thành`, icon: CalendarDays },
    { label: 'GPA hiện tại', value: summary?.gpa == null ? '—' : summary.gpa.toFixed(2), note: summary?.degree_classification || 'Chưa đủ dữ liệu', icon: Target },
  ]

  return (
    <div className="dashboard-overview">
      <section className="dashboard-stats" aria-label="Tổng quan học tập">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <article className="metric-card glass-panel" key={label}>
            <span className="metric-icon"><Icon size={19} aria-hidden="true" /></span>
            <div><p>{label}</p><strong>{value}</strong><small>{note}</small></div>
          </article>
        ))}
      </section>

      <section className="dashboard-grid dashboard-grid-primary">
        <article className="dashboard-card schedule-glance glass-panel" aria-labelledby="today-schedule-title">
          <header className="dashboard-card-heading">
            <div><span>Lịch trình</span><h2 id="today-schedule-title">Hôm nay</h2></div>
            <button className="card-link" type="button" onClick={() => onNavigate('schedule')}>Xem lịch <ArrowRight size={15} /></button>
          </header>
          <div className="schedule-timeline">
            {todayTasks.length === 0 && (
              <div className="dashboard-empty"><CalendarDays size={24} /><p>Hôm nay chưa có buổi học.</p><button type="button" onClick={() => onNavigate('schedule')}>Thêm lịch học</button></div>
            )}
            {todayTasks.slice(0, 4).map((task) => (
              <div className={task.completed ? 'timeline-item is-complete' : 'timeline-item'} key={task.id}>
                <time>{task.scheduledTime}</time>
                <i className={`timeline-tone ${task.tone}`} aria-hidden="true" />
                <div><strong>{task.title}</strong><span>{task.course} · {task.duration} phút</span></div>
                <button type="button" className="timeline-check" onClick={() => onToggleTask(task.id)} aria-label={task.completed ? `Đánh dấu chưa xong: ${task.title}` : `Hoàn thành: ${task.title}`} aria-pressed={task.completed}>{task.completed && <Check size={14} />}</button>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card ai-companion glass-panel" aria-labelledby="ai-card-title">
          <div className="ai-orb" aria-hidden="true"><Bot size={28} /></div>
          <div className="ai-copy"><span>Emin AI · Trợ lý học tập</span><h2 id="ai-card-title">Bạn muốn học gì hôm nay?</h2><p>Hỏi trực tiếp trên tài liệu đã tải lên để nhận câu trả lời có trích dẫn.</p></div>
          <div className="ai-quick-actions">
            {promptOptions.map((prompt) => <button type="button" key={prompt} onClick={() => openTutor(prompt)}>{prompt}<ArrowRight size={14} /></button>)}
          </div>
          <button className="primary-action ai-main-action" type="button" onClick={() => openTutor()}>Mở Emin AI <Sparkles size={16} /></button>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid-secondary">
        <article className="dashboard-card progress-card glass-panel" aria-labelledby="learning-progress-title">
          <header className="dashboard-card-heading"><div><span>Dữ liệu thật</span><h2 id="learning-progress-title">Tiến độ học tập</h2></div><button className="card-link" type="button" onClick={() => onNavigate('progress')}>Xem tiến độ <ArrowRight size={15} /></button></header>
          <div className="progress-card-body">
            <div className="dashboard-progress-ring" style={{ '--progress': progress } as CSSProperties}><span><strong>{progress}%</strong><small>hoàn thành</small></span></div>
            <div className="progress-facts">
              <div><CircleCheckBig size={17} /><span><strong>{completedCourses || completedTasks}</strong><small>{courses.length ? 'học phần hoàn thành' : 'việc đã hoàn thành'}</small></span></div>
              <div><LibraryBig size={17} /><span><strong>{summary?.completed_credits ?? 0}</strong><small>tín chỉ tích lũy</small></span></div>
              <p>{summary?.policy?.name ?? 'Thêm điểm học phần để bắt đầu theo dõi GPA.'}</p>
            </div>
          </div>
        </article>

        <article className="dashboard-card goals-card glass-panel" aria-labelledby="goals-title">
          <header className="dashboard-card-heading"><div><span>Kế hoạch</span><h2 id="goals-title">Mục tiêu sắp tới</h2></div><button className="card-link" type="button" onClick={() => onNavigate('progress')}>Tất cả <ArrowRight size={15} /></button></header>
          <div className="goal-list">
            {upcomingTasks.length === 0 && <div className="dashboard-empty compact"><Target size={22} /><p>Chưa có mục tiêu sắp tới.</p></div>}
            {upcomingTasks.map((task) => (
              <button type="button" className="goal-row" key={task.id} onClick={() => onNavigate('schedule')}>
                <span className={`goal-marker ${task.tone}`} aria-hidden="true" />
                <span><strong>{task.title}</strong><small>{task.scheduledDate === todayKey ? 'Hôm nay' : task.scheduledDate} · {formatTaskTime(task)}</small></span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
