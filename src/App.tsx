import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Home,
  Bot,
  Files,
  GraduationCap,
  ClipboardList,
  Compass,
  Settings,
  Menu,
  MessageCircle,
  Moon,
  NotebookPen,
  Search,
  Sun,
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
import { DashboardOverview } from './features/dashboard/DashboardOverview'
import { type CalendarEvent, type UserProfile, workspaceApi } from './lib/workspaceApi'
import { LibraryView, TutorView } from "./features/workspace/WorkspaceViews"
import { CoursesView } from "./features/workspace/AcademicCoursesView"
import { ScheduleView } from './features/schedule/ScheduleView'
import { CommunityFeedView, MessagesView, ProfileView } from "./features/social/SocialViews"
import { SettingsView } from "./features/settings/SettingsView"
import { PracticeView } from './features/practice/PracticeView'
import { ElectivesView } from './features/electives/ElectivesView'
import { loadStudyState, saveStudyState } from './lib/storage'
import type { StudyState, StudyTask, ViewId } from './types'

const navItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Trang chủ', icon: Home },
  { id: 'schedule', label: 'Lịch học', icon: CalendarDays },
  { id: 'courses', label: 'Học phần', icon: GraduationCap },
  { id: 'progress', label: 'Kế hoạch', icon: BookOpen },
  { id: 'practice', label: 'Luyện đề', icon: ClipboardList },
  { id: 'electives', label: 'Môn tự chọn', icon: Compass },
  { id: 'library', label: 'Ghi chú', icon: NotebookPen },
  { id: 'tutor', label: 'AI Assistant', icon: Bot },
  { id: 'community', label: 'Cộng đồng', icon: Users },
  { id: 'messages', label: 'Tin nhắn', icon: MessageCircle },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
]

const mobileNavItems: Array<{ id: ViewId; label: string; icon: typeof Home }> = [
  { id: 'overview', label: 'Trang chủ', icon: Home },
  { id: 'courses', label: 'Môn học', icon: GraduationCap },
  { id: 'tutor', label: 'EminAI', icon: Bot },
  { id: 'community', label: 'Cộng đồng', icon: Users },
  { id: 'messages', label: 'Tin nhắn', icon: MessageCircle },
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
  const [friendRequestCount, setFriendRequestCount] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('studyhub.theme.v1') === 'light' ? 'light' : 'dark')
  const initialTasks = useRef(study.tasks)

  useEffect(() => saveStudyState(study), [study])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem('studyhub.theme.v1', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070b14' : '#8bc9f0')
  }, [theme])
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
  const refreshSocialIndicators = useCallback(() => {
    void Promise.all([
      workspaceApi.unreadMessages().catch(() => ({ total: 0, by_sender: {} })),
      workspaceApi.friendships().catch(() => []),
    ]).then(([summary, friendships]) => {
      const list = Array.isArray(friendships) ? friendships : []
      setUnreadMessages(typeof summary?.total === 'number' ? summary.total : 0)
      setFriendRequestCount(list.filter((item) => item.status === 'pending' && item.request_incoming).length)
    }).catch(() => {
      setUnreadMessages(0)
      setFriendRequestCount(0)
    })
  }, [])
  useEffect(() => {
    refreshSocialIndicators()
    const timer = window.setInterval(refreshSocialIndicators, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') refreshSocialIndicators() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [refreshSocialIndicators])

  useEffect(() => {
    let stopped = false
    let socket: WebSocket | null = null
    let reconnect: number | undefined
    const connect = () => {
      socket = workspaceApi.realtime((event) => {
        refreshSocialIndicators()
        window.dispatchEvent(new CustomEvent('studyhub:message', { detail: event.message }))
      })
      socket?.addEventListener('close', () => {
        if (!stopped) reconnect = window.setTimeout(connect, 2500)
      })
    }
    connect()
    return () => { stopped = true; if (reconnect) window.clearTimeout(reconnect); socket?.close() }
  }, [refreshSocialIndicators])


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
      <Sidebar active={view} onNavigate={navigate} profile={profile} unreadMessages={unreadMessages} friendRequestCount={friendRequestCount} />
      <main className="main-content" id="main-content">
        <Header profile={profile} onNavigate={navigate} theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} unreadMessages={unreadMessages} friendRequestCount={friendRequestCount} />
        <div className={`view-stage view-stage-${view}`} key={view}>
          <span className="view-stage-glint" aria-hidden="true" />
          {view === 'overview' && (
            <DashboardOverview study={study} onToggleTask={toggleTask} onNavigate={navigate} />
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
          {view === 'practice' && <PracticeView />}
          {view === 'electives' && <ElectivesView onOpenProfile={() => navigate('profile')} />}
          {view === 'community' && <CommunityFeedView profile={profile} />}
          {view === 'messages' && <MessagesView ownId={profile?.id} onMessagesRead={refreshSocialIndicators} />}
          {view === 'profile' && <ProfileView onProfileChange={setProfile} />}
          {view === 'settings' && <SettingsView />}
        </div>
      </main>
      <MobileNav active={view} onNavigate={navigate} unreadMessages={unreadMessages} friendRequestCount={friendRequestCount} />
    </div>
  )
}

interface NavigationProps {
  active: ViewId
  onNavigate: (view: ViewId) => void
}

function Brand({ onHome }: { onHome: () => void }) {
  return (
    <button className="brand" type="button" onClick={onHome} aria-label="Về Trang chủ Nexamin">
      <span className="brand-logo"><BrandLogo /></span>
      <span className="brand-name">Nexamin</span>
    </button>
  )
}

function Sidebar({ active, onNavigate, profile, unreadMessages, friendRequestCount }: NavigationProps & { profile: UserProfile | null; unreadMessages: number; friendRequestCount: number }) {
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
              {item.id === 'messages' && unreadMessages > 0 && <span className="nav-unread-dot" aria-label="Có tin nhắn mới" />}
              {item.id === 'community' && friendRequestCount > 0 && <span className="nav-unread-dot" aria-label="Có lời mời kết bạn mới" />}
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
        <button className="settings-button" aria-label="Cài đặt" title="Cài đặt" onClick={() => onNavigate('settings')}><Settings size={16} /></button>
      </div>
    </aside>
  )
}

function MobileNav({ active, onNavigate, unreadMessages, friendRequestCount }: NavigationProps & { unreadMessages: number; friendRequestCount: number }) {
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
              {item.id === 'messages' && unreadMessages > 0 && <span className="nav-unread-dot" aria-label="Có tin nhắn mới" />}
              {item.id === 'community' && friendRequestCount > 0 && <span className="nav-unread-dot" aria-label="Có lời mời kết bạn mới" />}
          </button>
        )
      })}
    </nav>
  )
}

interface HeaderProps {
  profile: UserProfile | null
  onNavigate: (view: ViewId) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  unreadMessages: number
  friendRequestCount: number
}

function Header({ profile, onNavigate, theme, onToggleTheme, unreadMessages, friendRequestCount }: HeaderProps) {
  const firstName = profile?.full_name.trim().split(/\s+/).at(-1) ?? 'bạn'
  const notificationCount = unreadMessages + friendRequestCount
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  function mobileNavigate(nextView: ViewId) {
    document.querySelector<HTMLDetailsElement>('.mobile-more')?.removeAttribute('open')
    onNavigate(nextView)
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const query = new FormData(form).get('dashboard-search')?.toString().trim().toLocaleLowerCase('vi') ?? ''
    if (!query) return
    if (/ai|emin|hỏi|trợ lý/.test(query)) onNavigate('tutor')
    else if (/lịch|buổi|ngày/.test(query)) onNavigate('schedule')
    else if (/tài liệu|ghi chú|file/.test(query)) onNavigate('library')
    else if (/cộng đồng|bạn bè|người dùng/.test(query)) onNavigate('community')
    else if (/tin nhắn|trò chuyện/.test(query)) onNavigate('messages')
    else if (/gpa|tiến độ|kế hoạch|thống kê/.test(query)) onNavigate('progress')
    else if (/luyện đề|ôn tập|trắc nghiệm|đề thi/.test(query)) onNavigate('practice')
    else if (/tự chọn|định hướng nghề/.test(query)) onNavigate('electives')
    else onNavigate('courses')
    form.reset()
  }

  return <header className="topbar">
    <div className="mobile-brand"><Brand onHome={() => onNavigate('overview')} /></div>
    <div className="topbar-copy"><p className="today">{formatVietnameseDate()}</p><h1>Chào {firstName}, sẵn sàng học chưa?</h1></div>
    <form className="command-search" role="search" onSubmit={search}>
      <Search size={17} aria-hidden="true" />
      <label className="sr-only" htmlFor="dashboard-search">Tìm môn học, tài liệu hoặc tính năng</label>
      <input ref={searchInputRef} id="dashboard-search" name="dashboard-search" type="search" placeholder="Tìm môn học, tài liệu, hoặc hỏi AI..." autoComplete="off" />
      <kbd>Ctrl K</kbd>
    </form>
    <div className="topbar-actions">
      <button className="topbar-icon-button" type="button" onClick={() => onNavigate(unreadMessages ? 'messages' : 'community')} aria-label={notificationCount ? `${notificationCount} thông báo mới` : 'Thông báo'}>
        <Bell size={18} />{notificationCount > 0 && <span className="notification-count">{notificationCount > 9 ? '9+' : notificationCount}</span>}
      </button>
      <button className="topbar-icon-button theme-toggle" type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Chuyển sang giao diện ban ngày' : 'Chuyển sang giao diện không gian'} aria-pressed={theme === 'light'}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button className="header-avatar" type="button" onClick={() => onNavigate('profile')} aria-label="Mở hồ sơ cá nhân">
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={18} />}
      </button>
    </div>
    <details className="mobile-more"><summary aria-label="Mở thêm điều hướng"><Menu className="menu-open" size={21} /><X className="menu-close" size={21} /></summary><div><button onClick={() => mobileNavigate('schedule')}><CalendarDays size={17} />Lịch học</button><button onClick={() => mobileNavigate('library')}><Files size={17} />Ghi chú</button><button onClick={() => mobileNavigate('progress')}><BarChart3 size={17} />Kế hoạch</button><button onClick={() => mobileNavigate('practice')}><ClipboardList size={17} />Luyện đề</button><button onClick={() => mobileNavigate('electives')}><Compass size={17} />Môn tự chọn</button><button onClick={() => mobileNavigate('community')}><Users size={17} />Cộng đồng</button><button onClick={() => mobileNavigate('messages')}><MessageCircle size={17} />Tin nhắn</button><button onClick={() => mobileNavigate('settings')}><Settings size={17} />Cài đặt</button></div></details>
  </header>
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
    <div className="insight-note"><Sparkles size={20} /><div><h3>Dữ liệu thuộc về bạn</h3><p>Nexamin chỉ tạo nhận xét sau khi bạn có đủ hoạt động học tập thực tế.</p></div></div>
  </section>
}


export default App
