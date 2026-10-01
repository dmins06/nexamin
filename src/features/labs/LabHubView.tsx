import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronRight, Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router'
import { appPaths } from '../../routing/paths'
import { LabCard } from './LabCard'
import { LabCategoryFilter } from './LabCategoryFilter'
import { filterLabs, labCategories, labCategoryTitle, labRegistry, normalizeLabSearch } from './labRegistry'
import { labModules } from './labModules'
import { defaultLabPreferences, loadLabPreferences, saveLabPreferences } from './labStorage'
import type { LabDefinition } from './labTypes'
import './labs.css'

class LabErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="lab-empty" role="alert"><h2>Không thể mở phòng lab.</h2><p>Kiểm tra kết nối rồi thử lại. Bạn vẫn có thể quay về Phòng Lab.</p><button onClick={this.props.onRetry}>Thử lại</button></div> : this.props.children }
}
export function LabHubView({ activeId }: { activeId?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [preferences, setPreferences] = useState(loadLabPreferences)
  const [attempt, setAttempt] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const active = labRegistry.find((lab) => lab.id === activeId)
  const loader = active && active.status !== 'coming-soon' ? labModules.get(active.id) : undefined
  const module = useMemo(() => ({ View: loader ? lazy(loader) : null, attempt }), [loader, attempt])
  const ActiveLab = module.View
  const labs = filterLabs(preferences)
  const query = normalizeLabSearch(preferences.search).trim()
  const matchingUnreleasedCategory = labs.length === 0 && query
    ? labCategories.find((category) => (preferences.category === 'all' || preferences.category === category.id)
      && normalizeLabSearch(category.title).includes(query)
      && !labRegistry.some((lab) => lab.category === category.id && lab.status !== 'coming-soon'))
    : undefined
  useEffect(() => saveLabPreferences(preferences), [preferences])
  useEffect(() => {
    const routeState: unknown = location.state
    if (!activeId && routeState !== null && typeof routeState === 'object' && 'focusLabHeading' in routeState && routeState.focusLabHeading === true) heading.current?.focus()
  }, [activeId, location.state])
  function back(category?: LabDefinition['category']) {
    if (category) {
      const next = { ...preferences, category, search: '' }
      saveLabPreferences(next)
      setPreferences(next)
    }
    navigate(appPaths.labs, { state: { focusLabHeading: true } })
  }
  if (active && ActiveLab) return <section className="lab-area lab-open" aria-label="Không gian phòng lab">
    <div className="lab-workspace-nav"><button onClick={() => back()} aria-label="Quay lại Phòng Lab"><ArrowLeft size={17} aria-hidden="true" />Phòng Lab</button><nav className="lab-breadcrumb" aria-label="Vị trí trong Phòng Lab"><button onClick={() => back()}>Phòng Lab</button><ChevronRight size={13} aria-hidden="true" /><button onClick={() => back(active.category)}>{labCategoryTitle(active.category)}</button><ChevronRight size={13} aria-hidden="true" /><span aria-current="page">{active.title}</span></nav></div>
    <LabErrorBoundary key={`${active.id}-${module.attempt}`} onRetry={() => setAttempt((value) => value + 1)}><Suspense fallback={<div className="lab-loading" role="status">Đang mở {active.title}...</div>}><ActiveLab /></Suspense></LabErrorBoundary>
  </section>
  return <section className="lab-area" aria-labelledby="lab-hub-title">
    <header className="lab-heading"><h1 ref={heading} tabIndex={-1} id="lab-hub-title">Phòng Lab</h1><p>Khám phá, thực hành và hiểu sâu kiến thức qua mô phỏng tương tác.</p></header>
    <label className="lab-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Tìm phòng lab, lĩnh vực hoặc chủ đề</span><input type="search" placeholder="Tìm phòng lab, lĩnh vực hoặc chủ đề..." value={preferences.search} maxLength={160} onChange={(event) => { const search = event.target.value; setPreferences((p) => ({ ...p, search })) }} /></label>
    <div className="lab-results-heading"><h2>{preferences.category === 'all' ? 'Khám phá phòng lab' : labCategoryTitle(preferences.category)}</h2><span role="status">{labs.length} kết quả</span></div>
    <div className="lab-results">{labs.length ? labs.map((lab) => <LabCard key={lab.id} lab={lab} canLaunch={lab.status !== 'coming-soon' && labModules.has(lab.id)} onLaunch={() => navigate(`${appPaths.labs}/${lab.id}`)} />) : <div className="lab-empty"><h3>{matchingUnreleasedCategory ? `${matchingUnreleasedCategory.title} đang phát triển.` : query ? 'Không tìm thấy lab phù hợp.' : 'Lĩnh vực này đang phát triển.'}</h3><p>{matchingUnreleasedCategory ? 'Chưa có lab được phát hành trong lĩnh vực này. Bạn có thể khám phá những lab hiện có.' : query ? 'Thử tên lab, lĩnh vực hoặc chủ đề khác.' : 'Chưa có lab được phát hành trong lĩnh vực này. Bạn có thể khám phá những lab hiện có.'}</p><button onClick={() => setPreferences(defaultLabPreferences())}>Xem tất cả lab</button></div>}</div>
    <LabCategoryFilter selected={preferences.category} labs={labRegistry} onSelect={(category) => setPreferences((p) => ({ ...p, category }))} />
  </section>
}
