import { anatomyLayers, anatomyStructures, anatomySystems, normalizeAnatomySearch } from './anatomyData'
import { isStructureVisible } from './anatomyState'
import type { AnatomySceneState, AnatomySystem, VesselFilter } from './anatomyTypes'

interface Props {
  state: AnatomySceneState
  search: string
  onSearch: (value: string) => void
  onState: (update: (previous: AnatomySceneState) => AnatomySceneState) => void
  onSystem: (system: AnatomySystem | 'all') => void
  onSelect: (id: string) => void
}
const vesselOptions: ReadonlyArray<{ id: VesselFilter; label: string }> = [{ id: 'arteries', label: 'Động mạch · đỏ' }, { id: 'veins', label: 'Tĩnh mạch · xanh' }, { id: 'coronary', label: 'Mạch vành' }, { id: 'major', label: 'Mạch máu lớn' }]
export function AnatomySidebar({ state, search, onSearch, onState, onSystem, onSelect }: Props) {
  const query = normalizeAnatomySearch(search)
  const matches = anatomyStructures.filter((item) => (search || state.system === 'all' || state.system === item.system) && normalizeAnatomySearch(`${item.nameVi} ${item.nameEn} ${item.latinName ?? ''}`).includes(query))
  return <div className="anatomy-sidebar-content">
    <label className="anatomy-search">Tìm bộ phận<input type="search" placeholder="Tìm bộ phận..." value={search} onChange={(event) => onSearch(event.target.value)} /></label>
    <details open={!search}><summary>Hệ cơ quan</summary><div className="anatomy-system-list"><button aria-pressed={state.system === 'all'} onClick={() => onSystem('all')}>Toàn bộ cơ thể</button>{anatomySystems.map((system) => <div className="anatomy-system-row" key={system.id}><button aria-pressed={state.system === system.id} onClick={() => onSystem(system.id)}>{system.label}</button><input type="checkbox" aria-label={`Hiện ${system.label.toLowerCase()}`} checked={state.systems[system.id]} onChange={(event) => onState((previous) => ({ ...previous, systems: { ...previous.systems, [system.id]: event.target.checked } }))} /></div>)}</div></details>
    <details><summary>Lớp giải phẫu</summary><div className="anatomy-checks">{anatomyLayers.map((layer) => <label key={layer.id}><input type="checkbox" checked={state.layers[layer.id]} onChange={(event) => { const checked = event.target.checked; onState((previous) => ({ ...previous, layers: { ...previous.layers, [layer.id]: checked } })) }} />{layer.label}</label>)}</div></details>
    <details><summary>Mạch máu</summary><div className="anatomy-checks">{vesselOptions.map((option) => <label key={option.id}><input type="checkbox" checked={state.vessels[option.id]} onChange={(event) => { const checked = event.target.checked; onState((previous) => ({ ...previous, vessels: { ...previous.vessels, [option.id]: checked } })) }} />{option.label}</label>)}</div></details>
    <section className="anatomy-entities" aria-label="Danh sách bộ phận"><h3>Bộ phận <span>{matches.length}</span></h3>{matches.length ? <ul>{matches.map((item) => <li key={item.id}><button aria-pressed={state.selectedId === item.id} onClick={() => onSelect(item.id)}><span>{item.nameVi}<small>{item.nameEn}</small></span>{!isStructureVisible(item, state) && <small>Ẩn</small>}</button></li>)}</ul> : <p>Không tìm thấy bộ phận. Thử tên tiếng Việt hoặc tiếng Anh.</p>}</section>
  </div>
}
