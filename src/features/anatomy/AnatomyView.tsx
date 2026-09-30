import { lazy, Suspense, useState } from 'react'
import { AnatomyErrorBoundary } from './AnatomyErrorBoundary'
import './anatomy.css'

// Re-create the lazy boundary on retry so a failed network chunk can be requested again.
const loadWorkspace = () => lazy(() => import('./AnatomyWorkspace'))
export function AnatomyView() {
  const [Workspace, setWorkspace] = useState(loadWorkspace)
  return <AnatomyErrorBoundary onRetry={() => setWorkspace(() => loadWorkspace())}><Suspense fallback={<div className="anatomy-status" role="status">Đang tải mô hình giải phẫu 3D...</div>}><Workspace /></Suspense></AnatomyErrorBoundary>
}
