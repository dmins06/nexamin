import { Component, Suspense, type ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { itLabRegistry } from './itLabRegistry'
import './it.css'
class ITBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <section className="it-panel" role="alert">
        <h2>Không thể mở lab</h2>
        <p>Kiểm tra kết nối, thử lại hoặc quay về CNTT Lab.</p>
        <button className="it-button" onClick={this.props.onRetry}>
          Tải lại lab
        </button>
      </section>
    ) : (
      this.props.children
    )
  }
}
export function ITLabLayout() {
  const location = useLocation()
  const current = itLabRegistry.find((lab) => location.pathname === lab.route)
  return (
    <section className="it-lab">
      <nav className="it-breadcrumb" aria-label="Vị trí trong CNTT Lab">
        <Link to="/labs">Phòng Lab</Link>
        <ChevronRight size={14} aria-hidden="true" />
        {current ? (
          <>
            <Link to="/labs/it">CNTT Lab</Link>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{current.title}</span>
          </>
        ) : (
          <span aria-current="page">CNTT Lab</span>
        )}
      </nav>
      <ITBoundary
        key={location.pathname}
        onRetry={() => window.location.reload()}
      >
        <Suspense fallback={<p role="status">Đang mở lab…</p>}>
          <Outlet />
        </Suspense>
      </ITBoundary>
    </section>
  )
}
