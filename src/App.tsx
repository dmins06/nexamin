import { useCallback, useEffect, useRef, useState } from 'react'
import { BrowserRouter, matchPath, useLocation, useNavigate } from 'react-router'
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
  BadgeCheck,
  Shield,
  FlaskConical,
} from 'lucide-react'
import { initialStudyState } from './data'
import { formatVietnameseDate } from './lib/format'
import { BrandLogo } from './components/BrandLogo'
import { MobileSplash } from './components/MobileSplash'
import { CosmicBackdrop } from './components/CosmicBackdrop'
import { type CalendarEvent, type UserProfile, workspaceApi } from './lib/workspaceApi'
import { loadStudyState, saveStudyState } from './lib/storage'
import { AppRoutes } from './routing/AppRoutes'
import { appPaths, titleForPath, type AppPath } from './routing/paths'
import type { StudyState, StudyTask } from './types'

const navItems: Array<{ path: AppPath; label: string; icon: typeof Home }> = [
  { path: appPaths.dashboard, label: 'Trang chủ', icon: Home },
  { path: appPaths.schedule, label: 'Lịch học', icon: CalendarDays },
  { path: appPaths.courses, label: 'Học phần', icon: GraduationCap },
  { path: appPaths.planner, label: 'Kế hoạch', icon: BookOpen },
  { path: appPaths.exams, label: 'Luyện đề', icon: ClipboardList },
  { path: appPaths.labs, label: 'Phòng Lab', icon: FlaskConical },
  { path: appPaths.electives, label: 'Môn tự chọn', icon: Compass },
  { path: appPaths.notes, label: 'Ghi chú', icon: NotebookPen },
  { path: appPaths.assistant, label: 'AI Assistant', icon: Bot },
  { path: appPaths.community, label: 'Cộng đồng', icon: Users },
  { path: appPaths.messages, label: 'Tin nhắn', icon: MessageCircle },
  { path: appPaths.settings, label: 'Cài đặt', icon: Settings },
]

const mobileNavItems: Array<{ path: AppPath; label: string; icon: typeof Home }> = [
  { path: appPaths.dashboard, label: 'Trang chủ', icon: Home },
  { path: appPaths.courses, label: 'Môn học', icon: GraduationCap },
  { path: appPaths.assistant, label: 'EminAI', icon: Bot },
  { path: appPaths.community, label: 'Cộng đồng', icon: Users },
  { path: appPaths.messages, label: 'Tin nhắn', icon: MessageCircle },
]

const mobileMoreItems: Array<{ path: AppPath; label: string; icon: typeof Home }> = [
  { path: appPaths.schedule, label: 'Lịch học', icon: CalendarDays },
  { path: appPaths.notes, label: 'Ghi chú', icon: Files },
  { path: appPaths.planner, label: 'Kế hoạch', icon: BarChart3 },
  { path: appPaths.exams, label: 'Luyện đề', icon: ClipboardList },
  { path: appPaths.labs, label: 'Phòng Lab', icon: FlaskConical },
  { path: appPaths.electives, label: 'Môn tự chọn', icon: Compass },
  { path: appPaths.community, label: 'Cộng đồng', icon: Users },
  { path: appPaths.messages, label: 'Tin nhắn', icon: MessageCircle },
  { path: appPaths.settings, label: 'Cài đặt', icon: Settings },
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

function AppContent() {
  const location = useLocation()
  const routerNavigate = useNavigate()
  const [study, setStudy] = useState<StudyState>(() =>
    loadStudyState(initialStudyState),
  )
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
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
  useEffect(() => { void workspaceApi.profile().then(setProfile).catch(() => undefined).finally(() => setProfileLoading(false)) }, [])
  useEffect(() => { document.title = `${titleForPath(location.pathname)} | Nexamin` }, [location.pathname])
  useEffect(() => {
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [location.pathname])
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

  const navigate = useCallback((path: AppPath) => {
    if (location.pathname !== path) routerNavigate(path)
  }, [location.pathname, routerNavigate])


  return (
    <div className="app-shell">
      <CosmicBackdrop />
      <MobileSplash />
      <a className="skip-link" href="#main-content">Bỏ qua điều hướng</a>
      <Sidebar pathname={location.pathname} onNavigate={navigate} profile={profile} unreadMessages={unreadMessages} friendRequestCount={friendRequestCount} />
      <main className="main-content" id="main-content">
        <Header pathname={location.pathname} profile={profile} onNavigate={navigate} theme={theme} onToggleTheme={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} unreadMessages={unreadMessages} friendRequestCount={friendRequestCount} />
        <div className="view-stage" key={location.pathname}>
          <span className="view-stage-glint" aria-hidden="true" />
          <AppRoutes study={study} profile={profile} profileLoading={profileLoading} onNavigate={navigate} onToggleTask={toggleTask} onAddTask={addTask} onDeleteTask={deleteTask} onProfileChange={setProfile} onMessagesRead={refreshSocialIndicators} />
        </div>
      </main>
      <MobileNav pathname={location.pathname} onNavigate={navigate} unreadMessages={unreadMessages} friendRequestCount={friendRequestCount} />
    </div>
  )
}

interface NavigationProps {
  pathname: string
  onNavigate: (path: AppPath) => void
}

function isActivePath(pathname: string, path: AppPath) {
  return matchPath({ path, end: false }, pathname) !== null
}

function Brand({ onHome }: { onHome: () => void }) {
  return (
    <button className="brand" type="button" onClick={onHome} aria-label="Về Trang chủ Nexamin">
      <span className="brand-logo"><BrandLogo /></span>
      <span className="brand-name">Nexamin</span>
    </button>
  )
}

function Sidebar({ pathname, onNavigate, profile, unreadMessages, friendRequestCount }: NavigationProps & { profile: UserProfile | null; unreadMessages: number; friendRequestCount: number }) {
  const displayName = profile?.full_name ?? "Sinh viên"
  const initials = displayName.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase()
  return (
    <aside className="sidebar">
      <Brand onHome={() => onNavigate(appPaths.dashboard)} />
      <nav aria-label="Điều hướng chính">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={isActivePath(pathname, item.path) ? 'nav-item active' : 'nav-item'}
              key={item.path}
              onClick={() => onNavigate(item.path)}
              aria-label={item.label}
              title={item.label}
              aria-current={isActivePath(pathname, item.path) ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.path === appPaths.messages && unreadMessages > 0 && <span className="nav-unread-dot" aria-label="Có tin nhắn mới" />}
              {item.path === appPaths.community && friendRequestCount > 0 && <span className="nav-unread-dot" aria-label="Có lời mời kết bạn mới" />}
            </button>
          )
        })}
        {profile?.role === 'admin' && <button className={isActivePath(pathname, appPaths.admin) ? 'nav-item active' : 'nav-item'} onClick={() => onNavigate(appPaths.admin)} aria-current={isActivePath(pathname, appPaths.admin) ? 'page' : undefined}><Shield size={19} strokeWidth={1.8} /><span>Quản trị</span></button>}
      </nav>
      <div className="sidebar-note">
        <Sparkles size={17} aria-hidden="true" />
        <p>Mỗi phiên học là một dấu mốc nhỏ.</p>
      </div>
      <div className="student-chip">
        <button className="student-profile-button" type="button" onClick={() => onNavigate(appPaths.profile)}>{profile?.avatar_url ? <img className="avatar" src={profile.avatar_url} alt="" /> : <span className="avatar">{initials}</span>}<span><strong>{displayName} {profile?.role === 'admin' && <BadgeCheck size={15} color="#48a8ff" aria-label="Quản trị viên Nexamin" />}</strong><small>{profile?.university?.short_name ?? "Sinh viên"}</small></span><UserRound size={16} aria-hidden="true" /></button>
        <button className="settings-button" aria-label="Cài đặt" title="Cài đặt" onClick={() => onNavigate(appPaths.settings)}><Settings size={16} /></button>
      </div>
    </aside>
  )
}

function MobileNav({ pathname, onNavigate, unreadMessages, friendRequestCount }: NavigationProps & { unreadMessages: number; friendRequestCount: number }) {
  return (
    <nav className="mobile-nav" aria-label="Điều hướng di động">
      {mobileNavItems.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.path}
            className={isActivePath(pathname, item.path) ? 'active' : ''}
            onClick={() => onNavigate(item.path)}
            aria-label={item.label}
            aria-current={isActivePath(pathname, item.path) ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{item.label}</span>
              {item.path === appPaths.messages && unreadMessages > 0 && <span className="nav-unread-dot" aria-label="Có tin nhắn mới" />}
              {item.path === appPaths.community && friendRequestCount > 0 && <span className="nav-unread-dot" aria-label="Có lời mời kết bạn mới" />}
          </button>
        )
      })}
    </nav>
  )
}

interface HeaderProps {
  pathname: string
  profile: UserProfile | null
  onNavigate: (path: AppPath) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  unreadMessages: number
  friendRequestCount: number
}

function Header({ pathname, profile, onNavigate, theme, onToggleTheme, unreadMessages, friendRequestCount }: HeaderProps) {
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

  function mobileNavigate(path: AppPath) {
    document.querySelector<HTMLDetailsElement>('.mobile-more')?.removeAttribute('open')
    onNavigate(path)
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const query = new FormData(form).get('dashboard-search')?.toString().trim().toLocaleLowerCase('vi') ?? ''
    if (!query) return
    if (/phòng lab|phong lab|\blab\b|giải phẫu|giai phau|anatomy|3d/.test(query)) onNavigate(appPaths.labs)
    else if (/ai|emin|hỏi|trợ lý/.test(query)) onNavigate(appPaths.assistant)
    else if (/lịch|buổi|ngày/.test(query)) onNavigate(appPaths.schedule)
    else if (/tài liệu|ghi chú|file/.test(query)) onNavigate(appPaths.notes)
    else if (/cộng đồng|bạn bè|người dùng/.test(query)) onNavigate(appPaths.community)
    else if (/tin nhắn|trò chuyện/.test(query)) onNavigate(appPaths.messages)
    else if (/gpa|tiến độ|kế hoạch|thống kê/.test(query)) onNavigate(appPaths.planner)
    else if (/luyện đề|ôn tập|trắc nghiệm|đề thi/.test(query)) onNavigate(appPaths.exams)
    else if (/tự chọn|định hướng nghề/.test(query)) onNavigate(appPaths.electives)
    else onNavigate(appPaths.courses)
    form.reset()
  }

  return <header className="topbar">
    <div className="mobile-brand"><Brand onHome={() => onNavigate(appPaths.dashboard)} /></div>
    <div className="topbar-copy"><p className="today">{formatVietnameseDate()}</p><h1>Chào {firstName}, sẵn sàng học chưa?</h1></div>
    <form className="command-search" role="search" onSubmit={search}>
      <Search size={17} aria-hidden="true" />
      <label className="sr-only" htmlFor="dashboard-search">Tìm môn học, tài liệu hoặc tính năng</label>
      <input ref={searchInputRef} id="dashboard-search" name="dashboard-search" type="search" placeholder="Tìm môn học, tài liệu, hoặc hỏi AI..." autoComplete="off" />
      <kbd>Ctrl K</kbd>
    </form>
    <div className="topbar-actions">
      <button className="topbar-icon-button" type="button" onClick={() => onNavigate(unreadMessages ? appPaths.messages : appPaths.community)} aria-label={notificationCount ? `${notificationCount} thông báo mới` : 'Thông báo'}>
        <Bell size={18} />{notificationCount > 0 && <span className="notification-count">{notificationCount > 9 ? '9+' : notificationCount}</span>}
      </button>
      <button className="topbar-icon-button theme-toggle" type="button" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Chuyển sang giao diện ban ngày' : 'Chuyển sang giao diện không gian'} aria-pressed={theme === 'light'}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button className="header-avatar" type="button" onClick={() => onNavigate(appPaths.profile)} aria-label="Mở hồ sơ cá nhân">
        {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : <UserRound size={18} />}
      </button>
    </div>
    <details className="mobile-more">
      <summary aria-label="Mở thêm điều hướng"><Menu className="menu-open" size={21} /><X className="menu-close" size={21} /></summary>
      <div>{mobileMoreItems.map(({ path, label, icon: Icon }) => <button key={path} type="button" aria-current={isActivePath(pathname, path) ? 'page' : undefined} onClick={() => mobileNavigate(path)}><Icon size={17} aria-hidden="true" />{label}</button>)}</div>
    </details>
  </header>
}

function App() {
  return <BrowserRouter><AppContent /></BrowserRouter>
}

export default App
