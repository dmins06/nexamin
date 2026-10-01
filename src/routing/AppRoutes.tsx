import { lazy, Suspense } from 'react'
import { ArrowLeft, Home } from 'lucide-react'
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router'
import type { UserProfile } from '../lib/workspaceApi'
import type { StudyState, StudyTask } from '../types'
import { appPaths, type AppPath } from './paths'
import './routing.css'

const DashboardOverview = lazy(() => import('../features/dashboard/DashboardOverview').then((module) => ({ default: module.DashboardOverview })))
const CoursesView = lazy(() => import('../features/workspace/AcademicCoursesView').then((module) => ({ default: module.CoursesView })))
const LibraryView = lazy(() => import('../features/workspace/WorkspaceViews').then((module) => ({ default: module.LibraryView })))
const TutorView = lazy(() => import('../features/workspace/WorkspaceViews').then((module) => ({ default: module.TutorView })))
const ScheduleView = lazy(() => import('../features/schedule/ScheduleView').then((module) => ({ default: module.ScheduleView })))
const ProgressView = lazy(() => import('../features/progress/ProgressView').then((module) => ({ default: module.ProgressView })))
const PracticeView = lazy(() => import('../features/practice/PracticeView').then((module) => ({ default: module.PracticeView })))
const LabHubView = lazy(() => import('../features/labs/LabHubView').then((module) => ({ default: module.LabHubView })))
const ITLabLayout = lazy(() => import('../features/labs/it/ITLabLayout').then(m => ({default:m.ITLabLayout})))
const ITLabHub = lazy(() => import('../features/labs/it/ITLabHub').then(m => ({default:m.ITLabHub})))
const CodeLab = lazy(() => import('../features/labs/it/code/CodeLab').then(m => ({default:m.CodeLab})))
const AlgorithmLab = lazy(() => import('../features/labs/it/algorithms/AlgorithmLab').then(m => ({default:m.AlgorithmLab})))
const ITLabPlanned = lazy(() => import('../features/labs/it/ITLabPlanned').then(m => ({default:m.ITLabPlanned})))
const ElectivesView = lazy(() => import('../features/electives/ElectivesView').then((module) => ({ default: module.ElectivesView })))
const CommunityFeedView = lazy(() => import('../features/social/SocialViews').then((module) => ({ default: module.CommunityFeedView })))
const MessagesView = lazy(() => import('../features/social/SocialViews').then((module) => ({ default: module.MessagesView })))
const ProfileView = lazy(() => import('../features/social/SocialViews').then((module) => ({ default: module.ProfileView })))
const SettingsView = lazy(() => import('../features/settings/SettingsView').then((module) => ({ default: module.SettingsView })))
const AdminView = lazy(() => import('../features/admin/AdminView').then((module) => ({ default: module.AdminView })))

interface AppRoutesProps {
  study: StudyState
  profile: UserProfile | null
  profileLoading: boolean
  onNavigate: (path: AppPath) => void
  onToggleTask: (taskId: string) => Promise<void>
  onAddTask: (task: StudyTask) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onProfileChange: (profile: UserProfile) => void
  onMessagesRead: () => void
}

export function NotFoundPage() {
  const navigate = useNavigate()
  return <section className="page-view route-not-found" aria-labelledby="not-found-title">
    <div className="page-intro"><h2 id="not-found-title">Không tìm thấy trang</h2><p>Đường dẫn này không tồn tại hoặc đã được thay đổi.</p></div>
    <div className="route-not-found-actions">
      <Link className="secondary-action" to={appPaths.dashboard}><Home size={17} aria-hidden="true" />Về Trang chủ</Link>
      <button className="secondary-action" type="button" onClick={() => window.history.length > 1 ? navigate(-1) : navigate(appPaths.dashboard)}><ArrowLeft size={17} aria-hidden="true" />Quay lại</button>
    </div>
  </section>
}

export function AppRoutes({ study, profile, profileLoading, onNavigate, onToggleTask, onAddTask, onDeleteTask, onProfileChange, onMessagesRead }: AppRoutesProps) {
  return <Suspense fallback={<div className="route-loading" role="status">Đang tải nội dung…</div>}>
    <Routes>
      <Route path="/" element={<Navigate to={appPaths.dashboard} replace />} />
      <Route path={appPaths.dashboard} element={<DashboardOverview study={study} onToggleTask={onToggleTask} onNavigate={onNavigate} />} />
      <Route path={appPaths.courses} element={<CoursesView />} />
      <Route path={appPaths.schedule} element={<ScheduleView tasks={study.tasks} onAddTask={onAddTask} onToggleTask={onToggleTask} onDeleteTask={onDeleteTask} onOpenCourses={() => onNavigate(appPaths.courses)} />} />
      <Route path={appPaths.planner} element={<ProgressView study={study} />} />
      <Route path={appPaths.exams} element={<PracticeView />} />
      <Route path="/labs">
        <Route index element={<LabHubView />} />
        <Route path="anatomy" element={<LabHubView activeId="anatomy" />} />
        <Route path="it" element={<ITLabLayout />}>
          <Route index element={<ITLabHub />} />
          <Route path="code" element={<CodeLab />} />
          <Route path="algorithms" element={<AlgorithmLab />} />
          {['computer','network','os','database','ai','security'].map(path => <Route key={path} path={path} element={<ITLabPlanned />} />)}
        </Route>
      </Route>
      <Route path={appPaths.electives} element={<ElectivesView onOpenProfile={() => onNavigate(appPaths.profile)} />} />
      <Route path={appPaths.notes} element={<LibraryView />} />
      <Route path={appPaths.assistant} element={<TutorView />} />
      <Route path={appPaths.community} element={<CommunityFeedView profile={profile} />} />
      <Route path={appPaths.messages} element={<MessagesView ownId={profile?.id} onMessagesRead={onMessagesRead} />} />
      <Route path={appPaths.profile} element={<ProfileView onProfileChange={onProfileChange} />} />
      <Route path={appPaths.settings} element={<SettingsView />} />
      <Route path={appPaths.admin} element={profileLoading ? <div className="route-loading" role="status">Đang kiểm tra quyền quản trị…</div> : profile?.role === 'admin' ? <AdminView ownId={profile.id} /> : <NotFoundPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>
}
