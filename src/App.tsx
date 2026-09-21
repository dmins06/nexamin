import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Home,
  Bot,
  Files,
  GraduationCap,
  LogOut,
  Settings,
  Menu,
  X,
  Sparkles,
  Users,
  UserRound,
} from 'lucide-react'
import { initialStudyState } from './data'
import { formatVietnameseDate } from './lib/format'
import { BrandLogo } from './components/BrandLogo'
import { MobileSplash } from './components/MobileSplash'
import { CosmicBackdrop } from './components/CosmicBackdrop'
import { logout } from './lib/api'
import { type CalendarEvent, type UserProfile, workspaceApi } from './lib/workspaceApi'
import { LibraryView, TutorView } from "./features/workspace/WorkspaceViews"
import { CoursesView } from "./features/workspace/AcademicCoursesView"
import { ScheduleView } from './features/schedule/ScheduleView'
import { CommunityView, ProfileView } from "./features/social/SocialViews"
import { SettingsView } from "./features/settings/SettingsView"
import { loadStudyState, saveStudyState } from './lib/storage'
import type { StudyState, StudyTask, ViewId } from './types'

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Trang chủ', icon: Home },
  { id: 'courses', label: 'Môn học', icon: GraduationCap },
  { id: 'schedule', label: 'Lịch học', icon: CalendarDays },
  { id: 'tutor', label: 'EminAI', icon: Bot },
  { id: 'library', label: 'Tài liệu', icon: Files },
  { id: 'community', label: 'Cộng đồng', icon: Users },
]

const mobileNavItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Trang chủ', icon: Home },
  { id: 'courses', label: 'Môn học', icon: GraduationCap },
  { id: 'tutor', label: 'EminAI', icon: Bot },
  { id: 'community', label: 'Thông báo', icon: Users },
  { id: 'profile', label: 'Hồ sơ', icon: UserRound },
]


function eventToTask(event: CalendarEvent): StudyTask | null {
  if (!event.event_type.startsWith('study_session')) return null
  let metadata: { course?: string; tone?: StudyTask['tone'] } = {}
  try { metadata = event.description ? JSON.parse(event.description) as typeof metadata : {} } catch { metadata = {} }
  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const local = new Date(start.getTime() - start.getTimezoneOffset() * 60_000)
  return {
    id: event.id,
    courseId: event.course_id ?? '',
    course: metadata.course ?? 'Môn học',
    title: event.title,
    duration: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000)),
    scheduledDate: local.toISOString().slice(0, 10),
    scheduledTime: local.toISOString().slice(11, 16),
    tone: metadata.tone ?? 'green',
    completed: event.event_type === 'study_session_completed',
  }
}

function taskToEvent(task: StudyTask): Omit<CalendarEvent, 'id' | 'created_at'> {
  const start = new Date(`${task.scheduledDate}T${task.scheduledTime}:00`)
  const end = new Date(start.getTime() + task.duration * 60_000)
  return {
    course_id: task.courseId || null,
    title: task.title,
    description: JSON.stringify({ course: task.course, tone: task.tone }),
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    event_type: task.completed ? 'study_session_completed' : 'study_session',
    recurrence: null,
  }
}

function App() {
  const [view, setView] = useState<ViewId>('overview')
  const [study, setStudy] = useState<StudyState>(() =>
    loadStudyState(initialStudyState),
  )
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const initialTasks = useRef(study.tasks)

  useEffect(() => saveStudyState(study), [study])
  useEffect(() => { void workspaceApi.profile().then(setProfile).catch(() => undefined) }, [])
  useEffect(() => {
    const localTasks = initialTasks.current
    void workspaceApi.calendar().then(async (events) => {
      const serverTasks = events.map(eventToTask).filter((task): task is StudyTask => task !== null)
      if (serverTasks.length || localTasks.length === 0) {
        setStudy((current) => ({ ...current, tasks: serverTasks }))
        return
      }
      const migrated = await Promise.all(localTasks.map(async (task) => eventToTask(
        await workspaceApi.createCalendarEvent(taskToEvent(task)),
      )))
      setStudy((current) => ({ ...current, tasks: migrated.filter((task): task is StudyTask => task !== null) }))
    }).catch(() => undefined)
  }, []) // Migrate version-2 local schedules once when the server calendar is empty.
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
    let stopped = false
    let socket: WebSocket | null = null
    let reconnect: number | undefined
    const connect = () => {
      socket = workspaceApi.realtime((event) => {
        refreshUnread()
        window.dispatchEvent(new CustomEvent('studyhub:message', { detail: event.message }))
      })
      socket?.addEventListener('close', () => {
        if (!stopped) reconnect = window.setTimeout(connect, 2500)
      })
    }
    connect()
    return () => { stopped = true; if (reconnect) window.clearTimeout(reconnect); socket?.close() }
  }, [refreshUnread])


  const toggleTask = async (taskId: string) => {
    const task = study.tasks.find((item) => item.id === taskId)
    if (!task) return
    const next = { ...task, completed: !task.completed }
    setStudy((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === taskId ? next : item) }))
    try { await workspaceApi.updateCalendarEvent(taskId, taskToEvent(next)) } catch { /* Local legacy task: keep it usable. */ }
  }

  const addTask = async (task: StudyTask) => {
    setStudy((current) => ({ ...current, tasks: [...current.tasks, task] }))
    try {
      const event = await workspaceApi.createCalendarEvent(taskToEvent(task))
      const saved = eventToTask(event)
      if (saved) setStudy((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? saved : item) }))
    } catch (reason) {
      setStudy((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== task.id) }))
      throw reason
    }
  }

  const deleteTask = async (taskId: string) => {
    const removed = study.tasks.find((task) => task.id === taskId)
    setStudy((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }))
    try { await workspaceApi.deleteCalendarEvent(taskId) }
    catch (reason) { if (removed) setStudy((current) => ({ ...current, tasks: [...current.tasks, removed] })); throw reason }
  }

  const navigate = useCallback((nextView: ViewId) => {
    if (nextView === view) return
    const transitionDocument = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> }
    }
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion || !transitionDocument.startViewTransition) {
      setView(nextView)
      return
    }
    transitionDocument.startViewTransition(() => setView(nextView))
  }, [view])


  return (
    <div className="app-shell">
      <CosmicBackdrop />
      <MobileSplash />
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <Sidebar active={view} onNavigate={navigate} profile={profile} unreadMessages={unreadMessages} />
      <main className="main-content" id="main-content">
        <Header profile={profile} onNavigate={navigate} />
        <div className={`view-stage view-stage-${view}`} key={view}>
          <span className="view-stage-glint" aria-hidden="true" />
          {view === 'overview' && (
            <Overview study={study} onToggleTask={toggleTask} onNavigate={navigate} />
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
              onOpenCourses={() => navigate('courses')}
            />
          )}
          {view === 'progress' && <ProgressView study={study} />}
          {view === 'community' && <CommunityView ownId={profile?.id} onMessagesRead={refreshUnread} />}
          {view === 'profile' && <ProfileView onProfileChange={setProfile} />}
          {view === 'settings' && <SettingsView />}
        </div>
      </main>
      <RightRail study={study} profile={profile} onNavigate={navigate} />
      <MobileNav active={view} onNavigate={navigate} unreadMessages={unreadMessages} />
    </div>
  )
}

interface NavigationProps {
  active: ViewId
  onNavigate: (view: ViewId) => void
}

function Brand({ onHome }: { onHome: () => void }) {
  return (
    <button className="brand" type="button" onClick={onHome} aria-label="Về Trang chủ StudyHubAI">
      <span className="brand-logo"><BrandLogo /></span>
      <span className="brand-name">StudyHub<span>AI</span></span>
    </button>
  )
}

function Sidebar({ active, onNavigate, profile, unreadMessages }: NavigationProps & { profile: UserProfile | null; unreadMessages: number }) {
  const displayName = profile?.full_name ?? "Sinh viên"
  const initials = displayName.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase()
  return (
    <aside className="sidebar">
      <Brand onHome={() => onNavigate('overview')} />
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
        <button className="settings-button" aria-label="Cài đặt" title="Cài đặt" onClick={() => onNavigate('settings')}><Settings size={16} /></button><button className="logout-button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void logout().finally(() => window.location.reload())}><LogOut size={16} /></button>
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

function RightRail({ study, profile, onNavigate }: { study: StudyState; profile: UserProfile | null; onNavigate: (view: ViewId) => void }) {
  const done = study.tasks.filter((task) => task.completed).length
  const completion = study.tasks.length ? Math.round(done / study.tasks.length * 100) : 0
  const next = [...study.tasks].filter((task) => !task.completed).sort((a, b) => (a.scheduledDate + a.scheduledTime).localeCompare(b.scheduledDate + b.scheduledTime))[0]
  return <aside className="right-rail" aria-label="Tổng quan học tập">
    <div className="rail-heading"><p>ĐỒNG HÀNH CÙNG</p><h2>{profile?.full_name?.split(/\s+/).at(-1) ?? 'bạn'}</h2></div>
    <section className="rail-progress"><div className="progress-ring" style={{ '--progress': completion } as CSSProperties}><span>{completion}%</span></div><div><strong>Tiến độ</strong><p>{done}/{study.tasks.length} việc hoàn thành</p></div></section>
    <section className="rail-card"><span className="rail-icon"><Sparkles size={18} /></span><p>EminAI</p><h3>Cần giải thích một khái niệm?</h3><button onClick={() => onNavigate('tutor')}>Hỏi EminAI <ChevronRight size={15} /></button></section>
    <section className="rail-card rail-upcoming"><p>Sắp tới</p>{next ? <><h3>{next.title}</h3><span>{next.scheduledDate} · {next.scheduledTime}</span></> : <span>Chưa có lịch sắp tới</span>}<button onClick={() => onNavigate('progress')}>Xem tiến độ <ChevronRight size={15} /></button></section>
  </aside>
}

function Header({ profile, onNavigate }: { profile: UserProfile | null; onNavigate: (view: ViewId) => void }) {
  const firstName = profile?.full_name.trim().split(/\s+/).at(-1) ?? 'bạn'
  return <header className="topbar">
    <div className="mobile-brand"><Brand onHome={() => onNavigate('overview')} /></div>
    <div className="topbar-copy"><p className="today">{formatVietnameseDate()}</p><h1>Chào bạn, {firstName}</h1></div>
    <details className="mobile-more"><summary aria-label="Mở thêm điều hướng"><Menu className="menu-open" size={21} /><X className="menu-close" size={21} /></summary><div><button onClick={() => onNavigate('schedule')}><CalendarDays size={17} />Lịch học</button><button onClick={() => onNavigate('library')}><Files size={17} />Tài liệu</button><button onClick={() => onNavigate('progress')}><Sparkles size={17} />Tiến độ</button><button onClick={() => onNavigate('community')}><Users size={17} />Cộng đồng</button><button onClick={() => onNavigate('settings')}><Settings size={17} />Cài đặt</button></div></details>
    <div className="header-signal" aria-hidden="true"><span /><span /></div>
  </header>
}

interface OverviewProps {
  study: StudyState
  onToggleTask: (id: string) => void
  onNavigate: (view: ViewId) => void
}

function Overview({ study, onToggleTask, onNavigate }: OverviewProps) {
  const now = new Date()
  const localToday = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
  const todayTasks = study.tasks.filter((task) => task.scheduledDate === localToday)
  const completed = todayTasks.filter((task) => task.completed).length
  return <div className="view-stack">
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-kicker">LEARN · PLAN · GROW</p>
        <h2 id="hero-title">Học thông minh hơn<br />cùng AI mỗi ngày.</h2>
        <p className="hero-lead">Biến lịch học, tài liệu và mục tiêu thành một nhịp học rõ ràng — với EminAI luôn sẵn sàng hỗ trợ.</p>
        <div className="hero-actions">
          <button className="primary-action" type="button" onClick={() => onNavigate('schedule')}>Bắt đầu ngay <ChevronRight size={17} /></button>
          <button className="secondary-action" type="button" onClick={() => onNavigate('tutor')}>Khám phá tính năng</button>
        </div>
      </div>
      <div className="hero-earth-window" aria-hidden="true"><span /><span /></div>
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
