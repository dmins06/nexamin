import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import App from '../App'
import type { UserProfile } from '../lib/workspaceApi'
import { AppRoutes } from './AppRoutes'

vi.mock('../features/dashboard/DashboardOverview', () => ({ DashboardOverview: () => <h2>route-dashboard</h2> }))
vi.mock('../features/workspace/AcademicCoursesView', () => ({ CoursesView: () => <h2>route-courses</h2> }))
vi.mock('../features/workspace/WorkspaceViews', () => ({ LibraryView: () => <h2>route-notes</h2>, TutorView: () => <h2>route-assistant</h2> }))
vi.mock('../features/schedule/ScheduleView', () => ({ ScheduleView: () => <h2>route-schedule</h2> }))
vi.mock('../features/progress/ProgressView', () => ({ ProgressView: () => <h2>route-planner</h2> }))
vi.mock('../features/practice/PracticeView', () => ({ PracticeView: () => <h2>route-exams</h2> }))
vi.mock('../features/labs/LabHubView', () => ({ LabHubView: ({ activeId }: { activeId?: string }) => {
  const navigate = useNavigate()
  return <section><h2>{activeId ? 'route-anatomy' : 'route-labs'}</h2>{!activeId && <button onClick={() => navigate('/labs/anatomy')}>Khám phá</button>}</section>
} }))
vi.mock('../features/electives/ElectivesView', () => ({ ElectivesView: () => <h2>route-electives</h2> }))
vi.mock('../features/social/SocialViews', () => ({ CommunityFeedView: () => <h2>route-community</h2>, MessagesView: () => <h2>route-messages</h2>, ProfileView: () => <h2>route-profile</h2> }))
vi.mock('../features/settings/SettingsView', () => ({ SettingsView: () => <h2>route-settings</h2> }))
vi.mock('../features/admin/AdminView', () => ({ AdminView: () => <h2>route-admin</h2> }))

const profile: UserProfile = { id: 'student', email: 'student@example.edu', full_name: 'Sinh viên', avatar_url: null, university: null, major: null, student_year: 1, role: 'admin' }
const study = { version: 2 as const, tasks: [], focusSeconds: 1500, completedSessions: 0 }
const noopAsync = async () => undefined

function RouteLocation() {
  const location = useLocation()
  return <output data-testid="route-location">{location.pathname}</output>
}

function renderRoute(path: string, routeProfile: UserProfile = profile) {
  return render(<MemoryRouter initialEntries={[path]}>
    <AppRoutes study={study} profile={routeProfile} profileLoading={false} onNavigate={vi.fn()} onToggleTask={noopAsync} onAddTask={noopAsync} onDeleteTask={noopAsync} onProfileChange={vi.fn()} onMessagesRead={vi.fn()} />
    <RouteLocation />
  </MemoryRouter>)
}

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  sessionStorage.setItem('studyhub.auth.v1', JSON.stringify({ access_token: 'test', refresh_token: 'test', token_type: 'bearer', expires_in: 3600 }))
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const body = String(input).includes('/users/me') || String(input).includes('/auth/me') ? profile : []
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals() })

describe('URL route map', () => {
  it.each([
    ['/dashboard', 'route-dashboard'], ['/courses', 'route-courses'], ['/schedule', 'route-schedule'],
    ['/planner', 'route-planner'], ['/exams', 'route-exams'], ['/labs', 'route-labs'],
    ['/labs/anatomy', 'route-anatomy'], ['/notes', 'route-notes'], ['/assistant', 'route-assistant'],
    ['/community', 'route-community'], ['/messages', 'route-messages'], ['/profile', 'route-profile'],
    ['/settings', 'route-settings'], ['/electives', 'route-electives'], ['/admin', 'route-admin'],
  ])('renders direct path %s', async (path, heading) => {
    renderRoute(path)
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByTestId('route-location')).toHaveTextContent(path)
  })

  it('redirects the authenticated root and shows a useful 404', async () => {
    renderRoute('/')
    expect(await screen.findByRole('heading', { name: 'route-dashboard' })).toBeInTheDocument()
    expect(screen.getByTestId('route-location')).toHaveTextContent('/dashboard')
    cleanup()
    renderRoute('/missing')
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Về Trang chủ' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeInTheDocument()
  })

  it('does not expose the admin page to a non-admin', () => {
    renderRoute('/admin', { ...profile, role: 'student' })
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument()
  })
})

describe('browser navigation', () => {
  it('uses URL history and keeps Lab active on the nested Anatomy path', async () => {
    const user = userEvent.setup()
    window.history.replaceState({}, '', '/dashboard')
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
    await user.click(within(nav).getByRole('button', { name: 'Phòng Lab' }))
    expect(window.location.pathname).toBe('/labs')
    await user.click(await screen.findByRole('button', { name: 'Khám phá' }))
    expect(window.location.pathname).toBe('/labs/anatomy')
    expect(within(nav).getByRole('button', { name: 'Phòng Lab' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Giải phẫu người 3D | Nexamin')
    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe('/labs'))
    window.history.back()
    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'))
    window.history.forward()
    await waitFor(() => expect(window.location.pathname).toBe('/labs'))
  })
})
