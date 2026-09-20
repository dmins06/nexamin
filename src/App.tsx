import { useCallback, useEffect, useState } from 'react'
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
  Users,
  UserRound,
} from 'lucide-react'
import { initialStudyState } from './data'
import { formatTime, formatVietnameseDate } from './lib/format'
import { logout } from './lib/api'
import { type UserProfile, workspaceApi } from './lib/workspaceApi'
import { CoursesView, LibraryView, TutorView } from './features/workspace/WorkspaceViews'
import { ScheduleView } from './features/schedule/ScheduleView'
import { CommunityView, ProfileView } from './features/social/SocialViews'
import { loadStudyState, saveStudyState } from './lib/storage'
import type { StudyState, StudyTask, ViewId } from './types'

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Tổng quan', icon: Home },
  { id: 'courses', label: 'Môn học', icon: GraduationCap },
  { id: 'library', label: 'Tài liệu', icon: Files },
  { id: 'tutor', label: 'Emin AI', icon: Bot },
  { id: 'schedule', label: 'Lịch học', icon: CalendarDays },
  { id: 'focus', label: 'Tập trung', icon: TimerReset },
  { id: 'progress', label: 'Tiến độ', icon: BarChart3 },
  { id: 'community', label: 'Bạn học', icon: Users },
]

const mobileNavItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  ...navItems,
  { id: 'profile', label: 'Hồ sơ', icon: UserRound },
]

function App() {
  const [view, setView] = useState<ViewId>('overview')
  const [study, setStudy] = useState<StudyState>(() =>
    loadStudyState(initialStudyState),
  )
  const [timerRunning, setTimerRunning] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => saveStudyState(study), [study])
  useEffect(() => { void workspaceApi.profile().then(setProfile).catch(() => undefined) }, [])
  const refreshUnread = useCallback(() => {
    void workspaceApi.unreadMessages().then((summary) => setUnreadMessages(summary.total)).catch(() => undefined)
  }, [])
  useEffect(() => {
    refreshUnread()
    const timer = window.setInterval(refreshUnread, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refreshUnread() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [refreshUnread])

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

  const addTask = (task: StudyTask) => {
    setStudy((current) => ({ ...current, tasks: [...current.tasks, task] }))
  }

  const deleteTask = (taskId: string) => {
    setStudy((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }))
  }

  const resetTimer = () => {
    setTimerRunning(false)
    setStudy((current) => ({ ...current, focusSeconds: 25 * 60 }))
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <Sidebar active={view} onNavigate={setView} profile={profile} unreadMessages={unreadMessages} />
      <main className="main-content" id="main-content">
        <Header profile={profile} sessions={study.completedSessions} />
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
          <ScheduleView
            tasks={study.tasks}
            onAddTask={addTask}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            onOpenCourses={() => setView('courses')}
          />
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
        {view === 'community' && <CommunityView ownId={profile?.id} onMessagesRead={refreshUnread} />}
        {view === 'profile' && <ProfileView onProfileChange={setProfile} />}
      </main>
      <MobileNav active={view} onNavigate={setView} unreadMessages={unreadMessages} />
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

function Sidebar({ active, onNavigate, profile, unreadMessages }: NavigationProps & { profile: UserProfile | null; unreadMessages: number }) {
  const displayName = profile?.full_name ?? "Sinh viên"
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
              {item.id === 'community' && unreadMessages > 0 && <span className="nav-unread-dot" aria-label="Có tin nhắn mới" />}
            </button>
          )
        })}
      </nav>
      <div className="sidebar-note">
        <Sparkles size={17} aria-hidden="true" />
        <p>Mỗi phiên học là một dấu mốc nhỏ.</p>
      </div>
      <div className="student-chip">
        <button className="student-profile-button" type="button" onClick={() => onNavigate('profile')}>{profile?.avatar_url ? <img className="avatar" src={profile.avatar_url} alt="" /> : <span className="avatar">{initials}</span>}<span><strong>{displayName}</strong><small>{profile?.university?.short_name ?? "Sinh viên"}</small></span><UserRound size={16} aria-hidden="true" /></button>
        <button className="logout-button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void logout().finally(() => window.location.reload())}><LogOut size={16} /></button>
      </div>
    </aside>
  )
}

function MobileNav({ active, onNavigate, unreadMessages }: NavigationProps & { unreadMessages: number }) {
  return (
    <nav className="mobile-nav" aria-label="Điều hướng di động">
      {mobileNavItems.map((item) => {
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
              {item.id === 'community' && unreadMessages > 0 && <span className="nav-unread-dot" aria-label="Có tin nhắn mới" />}
          </button>
        )
      })}
    </nav>
  )
}

function Header({ profile, sessions }: { profile: UserProfile | null; sessions: number }) {
  const firstName = profile?.full_name.trim().split(/\s+/).at(-1) ?? "bạn"
  return (
    <header className="topbar">
      <div>
        <p className="today">{formatVietnameseDate()}</p>
        <h1>Chào buổi sáng, {firstName}</h1>
      </div>
      <div className="day-pulse" aria-label={`${sessions} phiên tập trung đã hoàn thành`}>
        <span className="pulse-leaf" aria-hidden="true" />
        <span><strong>{sessions} phiên</strong><small>đã hoàn thành</small></span>
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

function Overview({ study, timerRunning, onToggleTimer, onResetTimer, onToggleTask, onNavigate }: OverviewProps) {
  const now = new Date()
  const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  const todayTasks = study.tasks.filter((task) => task.scheduledDate === localToday)
  const completed = todayTasks.filter((task) => task.completed).length
  const upcoming = [...study.tasks].filter((task) => !task.completed).sort((first, second) => `${first.scheduledDate}T${first.scheduledTime}`.localeCompare(`${second.scheduledDate}T${second.scheduledTime}`))[0]
  return <div className="view-stack">
    <section className="study-spread" aria-labelledby="continue-title">
      <div className="focus-specimen">
        <div className="section-heading"><div><h2 id="continue-title">Tiếp tục nhịp học</h2><p>{upcoming ? 'Buổi gần nhất trong lịch của bạn' : 'Bắt đầu bằng một kế hoạch vừa sức'}</p></div>{upcoming && <span className="course-code">{upcoming.scheduledDate} · {upcoming.scheduledTime}</span>}</div>
        <div className="specimen-body">
          {upcoming ? <div className="course-copy"><span className="subject-mark" aria-hidden="true" /><h3>{upcoming.course}</h3><p className="lesson">{upcoming.title}</p><p className="objective">Buổi học {upcoming.duration} phút do bạn lên lịch.</p><div className="course-meta"><span><BookOpen size={16} /> {upcoming.scheduledDate}</span><span><Target size={16} /> {upcoming.scheduledTime}</span></div></div> :
            <div className="course-copy empty-plan"><CalendarDays size={26} /><h3>Chưa có lịch học</h3><p className="objective">Thêm môn học và xếp buổi đầu tiên để StudyHubAI đồng hành cùng bạn.</p><button className="secondary-action" type="button" onClick={() => onNavigate('schedule')}>Mở lịch học</button></div>}
          <MiniTimer seconds={study.focusSeconds} running={timerRunning} onToggle={onToggleTimer} onReset={onResetTimer} />
        </div>
      </div>
      <WeekChart />
    </section>
    <section className="task-ledger" aria-labelledby="today-title">
      <div className="section-heading ledger-heading"><div><h2 id="today-title">Hôm nay</h2><p>{completed}/{todayTasks.length} việc đã hoàn thành</p></div><button className="text-button" onClick={() => onNavigate('schedule')}>Xem lịch học <ChevronRight size={16} /></button></div>
      <div className="task-list">
        {todayTasks.length === 0 && <div className="ledger-empty"><p>Hôm nay chưa có lịch học.</p><button className="text-button" type="button" onClick={() => onNavigate('schedule')}>Thêm buổi học <ChevronRight size={16} /></button></div>}
        {todayTasks.map((task, index) => <TaskRow key={task.id} task={task} index={index} onToggle={onToggleTask} />)}
      </div>
    </section>
  </div>
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
  return (
    <section className="week-chart" aria-labelledby="week-title">
      <div className="section-heading">
        <div>
          <h2 id="week-title">Nhịp học tuần này</h2>
          <p>Chưa có phiên nào được ghi nhận</p>
        </div>
      </div>
      <div className="chart-empty">
        <CalendarDays size={27} aria-hidden="true" />
        <strong>Dữ liệu sẽ được tạo từ hoạt động của bạn</strong>
        <p>Hoàn thành buổi học và phiên tập trung để xem nhịp học.</p>
      </div>
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
        <small>{task.scheduledDate} · {task.scheduledTime}</small>
      </div>
    </article>
  )
}


function FocusView({ seconds, running, sessions, onToggle, onReset }: { seconds: number; running: boolean; sessions: number; onToggle: () => void; onReset: () => void }) {
  return (
    <section className="page-view focus-page" aria-labelledby="focus-title">
      <div className="page-intro">
        <span className="folio">Phiên {sessions + 1}</span>
        <h2 id="focus-title">Một việc, trọn một nhịp</h2>
        <p>Tắt bớt tiếng ồn và dành trọn phiên này cho mục tiêu bạn đã chọn.</p>
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
  const completion = study.tasks.length ? Math.round((done / study.tasks.length) * 100) : 0
  const grouped = study.tasks.reduce<Map<string, { total: number; done: number }>>((result, task) => {
    const current = result.get(task.course) ?? { total: 0, done: 0 }
    current.total += 1
    if (task.completed) current.done += 1
    result.set(task.course, current)
    return result
  }, new Map())
  const courseProgress = [...grouped].map(([name, value]) => ({ name, value: Math.round(value.done / value.total * 100) }))
  return <section className="page-view" aria-labelledby="progress-title">
    <div className="page-intro"><span className="folio">Nhật ký tuần</span><h2 id="progress-title">Tiến bộ đang bén rễ</h2><p>Nhìn lại vừa đủ để biết bước tiếp theo nên đặt ở đâu.</p></div>
    <div className="progress-spread">
      <div className="progress-summary"><span className="big-number">{completion}%</span><h3>Kế hoạch của bạn</h3><p>{done} trong {study.tasks.length} việc đã hoàn thành. Dữ liệu được lưu trên thiết bị này.</p></div>
      <div className="course-progress">
        {courseProgress.length === 0 && <p className="progress-empty">Chưa có dữ liệu môn học. Hãy thêm lịch và hoàn thành buổi học đầu tiên.</p>}
        {courseProgress.map((course) => <div className="progress-line" key={course.name}><div><span>{course.name}</span><strong>{course.value}%</strong></div><span className="progress-track"><i style={{ width: `${course.value}%` }} /></span></div>)}
      </div>
    </div>
    <div className="insight-note"><Sparkles size={20} /><div><h3>Dữ liệu thuộc về bạn</h3><p>StudyHubAI chỉ tạo nhận xét sau khi bạn có đủ hoạt động học tập thực tế.</p></div></div>
  </section>
}


export default App
