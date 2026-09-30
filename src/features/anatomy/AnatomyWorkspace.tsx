import { lazy, Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { AnatomySidebar } from './AnatomySidebar'
import { AnatomyInfoPanel } from './AnatomyInfoPanel'
import { AnatomyToolbar } from './AnatomyToolbar'
import { AnatomyErrorBoundary, AnatomyFailure } from './AnatomyErrorBoundary'
import { anatomyById, anatomyStructures, quickSystems, systemLabel } from './anatomyData'
import { defaultAnatomyPreferences, isStructureVisible, loadAnatomyPreferences, revealStructure, saveAnatomyPreferences } from './anatomyState'
import { loadAnatomyManifest } from './anatomyModels'
import type { AnatomyManifest, AnatomySceneState, AnatomySystem, CameraAction, CameraCommand } from './anatomyTypes'

const loadViewer = () => lazy(() => import('./AnatomyViewer'))
export default function AnatomyWorkspace() {
  const [Viewer, setViewer] = useState(loadViewer)
  const [state, setState] = useState<AnatomySceneState>(() => ({ ...loadAnatomyPreferences(), selectedId: null, hiddenIds: [], isolatedId: null, section: { axis: 'off', position: 0 } }))
  const [search, setSearch] = useState('')
  const [learning, setLearning] = useState(false)
  const [manifest, setManifest] = useState<AnatomyManifest | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [command, setCommand] = useState<CameraCommand>({ action: 'reset', sequence: 0 })
  const drawer = useRef<HTMLDialogElement>(null)
  const viewerRoot = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDetailsElement>(null)
  const fullscreenButton = useRef<HTMLElement | null>(null)

  useEffect(() => { const { version, system, systems, layers, vessels, labels, xray } = state; saveAnatomyPreferences({ version, system, systems, layers, vessels, labels, xray }) }, [state])
  useEffect(() => {
    const controller = new AbortController()
    setManifest(null); setFailed(false)
    loadAnatomyManifest(controller.signal).then(setManifest).catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => { if (state.selectedId && sheet.current) sheet.current.open = true }, [state.selectedId])
  useEffect(() => {
    const onChange = () => { setExpanded(document.fullscreenElement === viewerRoot.current) }
    const onEscape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape' && !document.fullscreenElement) setExpanded(false) }
    document.addEventListener('fullscreenchange', onChange); document.addEventListener('keydown', onEscape)
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('keydown', onEscape) }
  }, [])
  useEffect(() => {
    if (!expanded) return
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    viewerRoot.current?.focus()
    return () => { document.body.style.overflow = before; fullscreenButton.current?.focus() }
  }, [expanded])
  const select = useCallback((id: string | null) => { setState((previous) => ({ ...previous, selectedId: id })) }, [])
  const contextLost = useCallback(() => setFailed(true), [])
  const selectFromList = (id: string) => { setState((previous) => ({ ...revealStructure(previous, id), section: { axis: 'off', position: 0 } })); if (drawer.current?.open) drawer.current.close() }
  function chooseSystem(system: AnatomySystem | 'all') {
    setState((previous) => ({ ...previous, system, selectedId: null, hiddenIds: [], isolatedId: null, section: { axis: 'off', position: 0 }, layers: { ...previous.layers, ...(system === 'integumentary' ? { skin: true } : {}) }, systems: system === 'all' ? previous.systems : { ...previous.systems, [system]: true } }))
  }
  function camera(action: CameraAction) { setCommand((previous) => ({ action, sequence: previous.sequence + 1 })) }
  function onKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return
    const actions: Record<string, CameraAction> = { ArrowLeft: event.shiftKey ? 'pan-left' : 'left', ArrowRight: event.shiftKey ? 'pan-right' : 'right', ArrowUp: event.shiftKey ? 'pan-up' : 'up', ArrowDown: event.shiftKey ? 'pan-down' : 'down', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', Home: 'reset' }
    const action = actions[event.key]; if (action) { event.preventDefault(); camera(action) }
  }
  async function fullscreen() {
    if (expanded) { if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined); setExpanded(false); return }
    fullscreenButton.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    try { if (viewerRoot.current?.requestFullscreen) await viewerRoot.current.requestFullscreen(); else setExpanded(true) } catch { setExpanded(true) }
  }
  async function retry() {
    try { const module = await import('./AnatomyViewer'); module.clearModelCache(manifest?.models ?? []) } catch { /* Retrying also recreates the lazy chunk loader. */ }
    setViewer(() => loadViewer()); setAttempt((value) => value + 1)
  }
  const selected = state.selectedId ? anatomyById.get(state.selectedId) : undefined
  const visibleItems = anatomyStructures.filter((item) => isStructureVisible(item, state))
  function step(direction: number) {
    if (!visibleItems.length) return
    const index = visibleItems.findIndex((item) => item.id === state.selectedId)
    const next = index < 0 ? (direction > 0 ? 0 : visibleItems.length - 1) : (index + direction + visibleItems.length) % visibleItems.length
    const item = visibleItems[next]
    if (item) select(item.id)
  }
  const sidebar = <AnatomySidebar state={state} search={search} onSearch={setSearch} onState={setState} onSystem={chooseSystem} onSelect={selectFromList} />
  return <section className="anatomy-feature" aria-labelledby="anatomy-title">
    <header className="anatomy-heading"><div><h1 id="anatomy-title">Giải phẫu 3D</h1><p>Xoay, tách lớp và tìm hiểu từng bộ phận.</p></div><div className="anatomy-heading-actions"><button className="anatomy-filter-button" onClick={() => drawer.current?.showModal()}><SlidersHorizontal size={17} />Hệ & lớp</button><button aria-pressed={learning} onClick={() => setLearning((value) => !value)}>Học bộ phận</button></div></header>
    <div className="anatomy-workspace">
      <aside className="anatomy-sidebar" aria-label="Hệ và lớp giải phẫu">{sidebar}</aside>
      <div ref={viewerRoot} className={`anatomy-viewer-panel${expanded ? ' is-expanded' : ''}`} tabIndex={0} aria-label="Vùng mô hình 3D" aria-describedby="anatomy-camera-help" onKeyDown={onKeyboard}>
        <AnatomyToolbar state={state} expanded={expanded} onCamera={camera} onLabels={() => setState((p) => ({ ...p, labels: !p.labels }))} onXray={() => setState((p) => ({ ...p, xray: !p.xray }))} onSection={(axis, position) => setState((p) => ({ ...p, section: { axis, position } }))} onFullscreen={() => void fullscreen()} />
        <div className="anatomy-canvas-wrap">
          {!manifest && !failed ? <div className="anatomy-status" role="status">Đang tải mô hình giải phẫu 3D...</div> : failed ? <AnatomyFailure onRetry={() => void retry()} /> : manifest && <AnatomyErrorBoundary key={attempt} onRetry={() => void retry()}><Suspense fallback={<div className="anatomy-status" role="status">Đang tải mô hình giải phẫu 3D...</div>}><Viewer state={state} models={manifest.models} command={command} onSelect={select} onContextLost={contextLost} /></Suspense></AnatomyErrorBoundary>}
          {manifest?.models.length === 0 && <p className="anatomy-demo-note">Demo tương tác · Hình khối minh họa, không phải mô hình giải phẫu chính xác.</p>}
          {!visibleItems.length && !failed && manifest && <div className="anatomy-empty-scene"><p>Tất cả bộ phận đang ẩn.</p><button onClick={() => setState((p) => ({ ...p, ...defaultAnatomyPreferences(), hiddenIds: [], isolatedId: null }))}>Hiện lại các lớp</button></div>}
        </div>
        <div className="anatomy-presets" role="group" aria-label="Chọn nhanh hệ cơ quan">{quickSystems.map((system) => <button key={system} aria-pressed={state.system === system} onClick={() => chooseSystem(system)}>{systemLabel(system)}</button>)}</div>
        <p id="anatomy-camera-help" className="anatomy-camera-help">Kéo để xoay · Cuộn/chụm để thu phóng · Kéo hai ngón để dịch chuyển.<br />Bàn phím: mũi tên xoay, Shift + mũi tên dịch chuyển, +/− thu phóng, Home đặt lại.</p>
      </div>
      <details ref={sheet} className="anatomy-info" open><summary>Thông tin bộ phận{selected ? ` · ${selected.nameVi}` : ''}</summary><AnatomyInfoPanel selected={selected} visible={!!selected && isStructureVisible(selected, state)} isolated={state.isolatedId === selected?.id} learning={learning} canStep={!!visibleItems.length} onSelect={selectFromList} onVisibility={() => selected && setState((p) => isStructureVisible(selected, p) ? { ...p, hiddenIds: [...p.hiddenIds, selected.id] } : revealStructure(p, selected.id))} onIsolate={() => selected && setState((p) => p.isolatedId === selected.id ? { ...p, isolatedId: null } : { ...revealStructure(p, selected.id), isolatedId: selected.id })} onStep={step} /></details>
    </div>
    {!!manifest?.models.length && <p className="anatomy-attributions">Mô hình: {manifest.models.map((model) => `${model.attribution} (${model.license})`).join(' · ')}</p>}
    <dialog ref={drawer} className="anatomy-drawer" aria-labelledby="anatomy-drawer-title"><header><h2 id="anatomy-drawer-title">Hệ & lớp giải phẫu</h2><button aria-label="Đóng bộ lọc" onClick={() => drawer.current?.close()}><X size={20} /></button></header>{sidebar}</dialog>
  </section>
}
