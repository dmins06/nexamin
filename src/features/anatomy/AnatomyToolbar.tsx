import { Maximize, Minimize, RotateCcw, Tags, ScanLine, Layers, ZoomIn, ZoomOut } from 'lucide-react'
import type { AnatomySceneState, CameraAction, SectionAxis } from './anatomyTypes'

const sectionAxes: ReadonlyArray<{ id: SectionAxis; label: string }> = [{ id: 'off', label: 'Tắt mặt cắt' }, { id: 'sagittal', label: 'Sagittal · dọc giữa' }, { id: 'coronal', label: 'Coronal · trán' }, { id: 'axial', label: 'Axial · ngang' }]
interface Props { state: AnatomySceneState; expanded: boolean; onCamera: (action: CameraAction) => void; onLabels: () => void; onXray: () => void; onSection: (axis: SectionAxis, position: number) => void; onFullscreen: () => void }
export function AnatomyToolbar({ state, expanded, onCamera, onLabels, onXray, onSection, onFullscreen }: Props) {
  return <><div className="anatomy-toolbar" role="group" aria-label="Điều khiển mô hình">
    <button aria-label="Đặt lại góc nhìn" title="Đặt lại góc nhìn" onClick={() => onCamera('reset')}><RotateCcw size={18} /></button>
    <button aria-label="Phóng to" title="Phóng to" onClick={() => onCamera('zoom-in')}><ZoomIn size={18} /></button><button aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => onCamera('zoom-out')}><ZoomOut size={18} /></button>
    <button aria-label="Nhãn giải phẫu" aria-pressed={state.labels} onClick={onLabels}><Tags size={18} /><span>Nhãn giải phẫu</span></button>
    <button aria-label="Trong suốt / X-ray" aria-pressed={state.xray} onClick={onXray}><Layers size={18} /><span>Trong suốt</span></button>
    <button aria-label="Cắt lớp" aria-pressed={state.section.axis !== 'off'} onClick={() => onSection(state.section.axis === 'off' ? 'sagittal' : 'off', 0)}><ScanLine size={18} /><span>Cắt lớp</span></button>
    <button aria-label={expanded ? 'Thoát toàn màn hình' : 'Toàn màn hình'} title="Toàn màn hình" onClick={onFullscreen}>{expanded ? <Minimize size={18} /> : <Maximize size={18} />}</button>
  </div>{state.section.axis !== 'off' && <div className="anatomy-section-controls"><label>Mặt cắt<select aria-label="Mặt cắt" value={state.section.axis} onChange={(event) => { const axis = sectionAxes.find((item) => item.id === event.target.value); if (axis) onSection(axis.id, 0) }}>{sectionAxes.map((axis) => <option key={axis.id} value={axis.id}>{axis.label}</option>)}</select></label><label>Vị trí mặt cắt<input type="range" min={-1} max={1} step={0.01} value={state.section.position} onChange={(event) => onSection(state.section.axis, Number(event.target.value))} /></label></div>}</>
}
