import { useEffect, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Home,
  Bot,
  Files,
  GraduationCap,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  TimerReset,
} from 'lucide-react'
import { initialStudyState, weekData } from './data'
import { formatTime, formatVietnameseDate } from './lib/format'
import { logout } from './lib/api'
import { type UserProfile, workspaceApi } from './lib/workspaceApi'
import { CoursesView, LibraryView, TutorView } from './features/workspace/WorkspaceViews'
import { loadStudyState, saveStudyState } from './lib/storage'
import type { StudyState, StudyTask, ViewId } from './types'

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Tổng quan', icon: Home },
  { id: 'courses', label: 'Môn học', icon: GraduationCap },
  { id: 'library', label: 'Tài liệu', icon: Files },
  { id: 'tutor', label: 'Trợ lý AI', icon: Bot },
  { id: 'schedule', label: 'Lịch học', icon: CalendarDays },
  { id: 'focus', label: 'Tập trung', icon: TimerReset },
  { id: 'progress', label: 'Tiến độ', icon: BarChart3 },
]

function App() {
  const [view, setView] = useState<ViewId>('overview')
  const [study, setStudy] = useState<StudyState>(() =>
    loadStudyState(initialStudyState),
  )
  const [timerRunning, setTimerRunning] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  useEffect(() => saveStudyState(study), [study])
  useEffect(() => { void workspaceApi.profile().then(setProfile).catch(() => undefined) }, [])

  useEffect(() => {
    if (!timerRunning) return
    const timer = window.setInterval(() => {
      setStudy((current) => {
        if (current.focusSeconds <= 1) {
          setTimerRunning(false)
          return {
            ...current,
            focusSeconds: 25 * 60,
            completedSessions: current.completedSessions + 1,
          }
        }
        return { ...current, focusSeconds: current.focusSeconds - 1 }
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timerRunning])

  const toggleTask = (taskId: string) => {
    setStudy((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    }))
  }

  const resetTimer = () => {
    setTimerRunning(false)
    setStudy((current) => ({ ...current, focusSeconds: 25 * 60 }))
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <Sidebar active={view} onNavigate={setView} profile={profile} />
      <main className="main-content" id="main-content">
        <Header profile={profile} />
        {view === 'overview' && (
          <Overview
            study={study}
            timerRunning={timerRunning}
            onToggleTimer={() => setTimerRunning((value) => !value)}
            onResetTimer={resetTimer}
            onToggleTask={toggleTask}
            onNavigate={setView}
          />
        )}
        {view === 'courses' && <CoursesView />}
        {view === 'library' && <LibraryView />}
        {view === 'tutor' && <TutorView />}
        {view === 'schedule' && (
          <ScheduleView tasks={study.tasks} onToggleTask={toggleTask} />
        )}
        {view === 'focus' && (
          <FocusView
            seconds={study.focusSeconds}
            running={timerRunning}
            sessions={study.completedSessions}
            onToggle={() => setTimerRunning((value) => !value)}
            onReset={resetTimer}
          />
        )}
        {view === 'progress' && <ProgressView study={study} />}
      </main>
      <MobileNav active={view} onNavigate={setView} />
    </div>
  )
}

interface NavigationProps {
  active: ViewId
  onNavigate: (view: ViewId) => void
}

function Brand() {
  return (
    <div className="brand" aria-label="StudyHubAI">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-name">StudyHub<span>AI</span></span>
    </div>
  )
}

function Sidebar({ active, onNavigate, profile }: NavigationProps & { profile: UserProfile | null }) {
  const displayName = profile?.full_name ?? "Minh An"
  const initials = displayName.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase()
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Điều hướng chính">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={active === item.id ? 'nav-item active' : 'nav-item'}
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={active === item.id ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="sidebar-note">
        <Sparkles size={17} aria-hidden="true" />
        <p>Mỗi phiên học là một dấu mốc nhỏ.</p>
      </div>
      <div className="student-chip">
        <span className="avatar">{initials}</span>
        <span><strong>{displayName}</strong><small>{profile?.university?.short_name ?? "Sinh viên"}</small></span>
        <button className="logout-button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void logout().finally(() => window.location.reload())}><LogOut size={16} /></button>
      </div>
    </aside>
  )
}

function MobileNav({ active, onNavigate }: NavigationProps) {
  return (
    <nav className="mobile-nav" aria-label="Điều hướng di động">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            className={active === item.id ? 'active' : ''}
            onClick={() => onNavigate(item.id)}
            aria-label={item.label}
            aria-current={active === item.id ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Header({ profile }: { profile: UserProfile | null }) {
  const firstName = profile?.full_name.trim().split(/\s+/).at(-1) ?? "Minh"
  return (
    <header className="topbar">
      <div>
        <p className="today">{formatVietnameseDate()}</p>
        <h1>Chào buổi sáng, {firstName}</h1>
      </div>
      <div className="day-pulse" aria-label="Chuỗi học 8 ngày">
        <span className="pulse-leaf" aria-hidden="true" />
        <span><strong>8 ngày</strong><small>duy trì nhịp học</small></span>
      </div>
    </header>
  )
}

interface OverviewProps {
  study: StudyState
  timerRunning: boolean
  onToggleTimer: () => void
  onResetTimer: () => void
  onToggleTask: (id: string) => void
  onNavigate: (view: ViewId) => void
}

function Overview({
  study,
  timerRunning,
  onToggleTimer,
  onResetTimer,
  onToggleTask,
  onNavigate,
}: OverviewProps) {
  const completed = study.tasks.filter((task) => task.completed).length
  return (
    <div className="view-stack">
      <section className="study-spread" aria-labelledby="continue-title">
        <div className="focus-specimen">
          <div className="section-heading">
            <div>
              <h2 id="continue-title">Tiếp tục nhịp học</h2>
              <p>Khuyến nghị dựa trên kế hoạch hôm nay</p>
            </div>
            <span className="course-code">CTDL · 04</span>
          </div>
          <div className="specimen-body">
            <div className="course-copy">
              <span className="subject-mark" aria-hidden="true" />
              <h3>Cấu trúc dữ liệu</h3>
              <p className="lesson">Cây nhị phân và phép duyệt</p>
              <p className="objective">Mục tiêu: nắm vững ba cách duyệt cây và hoàn thành bài 4.1–4.3.</p>
              <div className="course-meta">
                <span><BookOpen size={16} /> Chương 4</span>
                <span><Target size={16} /> 1 mục tiêu</span>
              </div>
            </div>
            <MiniTimer
              seconds={study.focusSeconds}
              running={timerRunning}
              onToggle={onToggleTimer}
              onReset={onResetTimer}
            />
          </div>
        </div>
        <WeekChart />
      </section>

      <section className="task-ledger" aria-labelledby="today-title">
        <div className="section-heading ledger-heading">
          <div>
            <h2 id="today-title">Hôm nay</h2>
            <p>{completed}/{study.tasks.length} việc đã hoàn thành</p>
          </div>
          <button className="text-button" onClick={() => onNavigate('schedule')}>
            Xem lịch học <ChevronRight size={16} />
          </button>
        </div>
        <div className="task-list">
          {study.tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              index={index}
              onToggle={onToggleTask}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

interface MiniTimerProps {
  seconds: number
  running: boolean
  onToggle: () => void
  onReset: () => void
}

function MiniTimer({ seconds, running, onToggle, onReset }: MiniTimerProps) {
  return (
    <div className={running ? 'mini-timer running' : 'mini-timer'}>
      <span className="timer-leaf" aria-hidden="true" />
      <span className="timer-value">{formatTime(seconds)}</span>
      <span className="timer-label">Pomodoro · phiên sâu</span>
      <div className="timer-actions">
        <button className="primary-action" onClick={onToggle}>
          {running ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          {running ? 'Tạm dừng' : 'Bắt đầu tập trung'}
        </button>
        <button className="icon-button" onClick={onReset} aria-label="Đặt lại bộ đếm">
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  )
}

function WeekChart() {
  const max = Math.max(...weekData.map((item) => item.minutes))
  const total = weekData.reduce((sum, item) => sum + item.minutes, 0)
  return (
    <section className="week-chart" aria-labelledby="week-title">
      <div className="section-heading">
        <div>
          <h2 id="week-title">Nhịp học tuần này</h2>
          <p>{Math.floor(total / 60)} giờ {total % 60} phút tập trung</p>
        </div>
        <span className="trend">+12%</span>
      </div>
      <div className="bars" role="img" aria-label="Biểu đồ phút học từ thứ Hai đến Chủ nhật">
        {weekData.map((item) => (
          <div className="bar-item" key={item.day}>
            <span className="bar-value">{item.minutes}</span>
            <span className="bar-stem" style={{ height: `${Math.round((item.minutes / max) * 100)}%` }}>
              <span aria-hidden="true" />
            </span>
            <span className="bar-day">{item.day}</span>
          </div>
        ))}
      </div>
      <p className="chart-note">Nhịp tốt nhất của bạn thường bắt đầu sau 9 giờ sáng.</p>
    </section>
  )
}

interface TaskRowProps {
  task: StudyTask
  index: number
  onToggle: (id: string) => void
}

function TaskRow({ task, index, onToggle }: TaskRowProps) {
  return (
    <article className={task.completed ? 'task-row completed' : 'task-row'}>
      <span className={`task-index ${task.tone}`}>{String(index + 1).padStart(2, '0')}</span>
      <button
        className="check-button"
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? `Đánh dấu chưa xong: ${task.title}` : `Hoàn thành: ${task.title}`}
        aria-pressed={task.completed}
      >
        {task.completed && <Check size={16} strokeWidth={3} />}
      </button>
      <div className="task-copy">
        <p>{task.course}</p>
        <h3>{task.title}</h3>
      </div>
      <div className="task-time">
        <span><Clock3 size={14} /> {task.duration} phút</span>
        <small>{task.due}</small>
      </div>
    </article>
  )
}

function ScheduleView({ tasks, onToggleTask }: { tasks: StudyTask[]; onToggleTask: (id: string) => void }) {
  const groups = ['Buổi sáng', 'Buổi chiều', 'Ngày mai']
  return (
    <section className="page-view" aria-labelledby="schedule-title">
      <div className="page-intro">
        <span className="folio">Tuần 12</span>
        <h2 id="schedule-title">Lịch học đang mở</h2>
        <p>Ba điểm hẹn học tập được xếp theo năng lượng trong ngày.</p>
      </div>
      <div className="timeline">
        {tasks.map((task, index) => (
          <div className="timeline-entry" key={task.id}>
            <div className="timeline-time"><strong>{index === 0 ? '09:00' : index === 1 ? '14:00' : '19:30'}</strong><span>{groups[index]}</span></div>
            <TaskRow task={task} index={index} onToggle={onToggleTask} />
          </div>
        ))}
      </div>
    </section>
  )
}

function FocusView({ seconds, running, sessions, onToggle, onReset }: { seconds: number; running: boolean; sessions: number; onToggle: () => void; onReset: () => void }) {
  return (
    <section className="page-view focus-page" aria-labelledby="focus-title">
      <div className="page-intro">
        <span className="folio">Phiên {sessions + 1}</span>
        <h2 id="focus-title">Một việc, trọn một nhịp</h2>
        <p>Tắt bớt tiếng ồn. Phiên này dành cho cây nhị phân và phép duyệt.</p>
      </div>
      <div className={running ? 'focus-clock active' : 'focus-clock'}>
        <span className="focus-sprout" aria-hidden="true"><i /><i /><i /></span>
        <time>{formatTime(seconds)}</time>
        <p>{running ? 'Đang giữ nhịp tập trung' : 'Sẵn sàng khi bạn bắt đầu'}</p>
        <div className="focus-controls">
          <button className="primary-action" onClick={onToggle}>
            {running ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
            {running ? 'Tạm dừng' : 'Bắt đầu phiên'}
          </button>
          <button className="secondary-action" onClick={onReset}><RotateCcw size={18} /> Đặt lại</button>
        </div>
      </div>
      <div className="focus-footnotes">
        <span><strong>{sessions}</strong> phiên đã hoàn thành hôm nay</span>
        <span><strong>5 phút</strong> nghỉ sau phiên này</span>
        <span><strong>1 mục tiêu</strong> cần ghi lại</span>
      </div>
    </section>
  )
}

function ProgressView({ study }: { study: StudyState }) {
  const done = study.tasks.filter((task) => task.completed).length
  const completion = Math.round((done / study.tasks.length) * 100)
  const courseProgress = [
    { name: 'Cấu trúc dữ liệu', value: 72 },
    { name: 'Xác suất thống kê', value: 58 },
    { name: 'Cơ sở dữ liệu', value: 46 },
  ]
  return (
    <section className="page-view" aria-labelledby="progress-title">
      <div className="page-intro">
        <span className="folio">Nhật ký tuần</span>
        <h2 id="progress-title">Tiến bộ đang bén rễ</h2>
        <p>Nhìn lại vừa đủ để biết bước tiếp theo nên đặt ở đâu.</p>
      </div>
      <div className="progress-spread">
        <div className="progress-summary">
          <span className="big-number">{completion}%</span>
          <h3>Kế hoạch hôm nay</h3>
          <p>{done} trong {study.tasks.length} việc đã hoàn thành. Dữ liệu được lưu trên thiết bị này.</p>
        </div>
        <div className="course-progress">
          {courseProgress.map((course) => (
            <div className="progress-line" key={course.name}>
              <div><span>{course.name}</span><strong>{course.value}%</strong></div>
              <span className="progress-track"><i style={{ width: `${course.value}%` }} /></span>
            </div>
          ))}
        </div>
      </div>
      <div className="insight-note">
        <Sparkles size={20} />
        <div><h3>Một quan sát nhỏ</h3><p>Bạn hoàn thành nhiều hơn khi phiên đầu tiên dưới 40 phút. Hãy giữ nhịp mở đầu vừa sức.</p></div>
      </div>
    </section>
  )
}

export default App
