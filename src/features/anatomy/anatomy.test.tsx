import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Object3D, Vector3 } from 'three'
import AnatomyWorkspace from './AnatomyWorkspace'
import { anatomyById, anatomyStructures, anatomySystems } from './anatomyData'
import expansion from './anatomyExpansion.json'
import shippedManifest from '../../../public/models/anatomy/manifest.json'
import { defaultAnatomyPreferences, isStructureVisible, loadAnatomyPreferences, revealStructure, revealSystem } from './anatomyState'
import { parseAnatomyManifest } from './anatomyModels'
import { createAnatomyQuiz } from './anatomyQuiz'
import { anatomyFocusDistance, clippingPlanes, resolveStructureId, structureColor } from './anatomyScene'
import type { AnatomySceneState, AnatomyViewerProps } from './anatomyTypes'

const mock = vi.hoisted(() => ({ fail: false }))
vi.mock('./AnatomyViewer', () => ({ clearModelCache: vi.fn(), default: ({ state, onSelect, onContextLost }: AnatomyViewerProps) => {
  if (mock.fail) throw new Error('Model unavailable')
  return <div data-testid="mock-viewer"><button onClick={() => onSelect('heart')}>Chọn tim trên canvas</button><button onClick={onContextLost}>Mất WebGL</button><output data-testid="scene-state">{JSON.stringify(state)}</output></div>
} }))
function state(): AnatomySceneState { return { ...defaultAnatomyPreferences(), selectedId: null, hiddenIds: [], isolatedId: null, section: { axis: 'off', position: 0 } } }
describe('Anatomy workspace without a GPU', () => {
  beforeEach(() => { localStorage.clear(); mock.fail = false; vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ version: 1, models: [] }), { status: 200 }))) })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
  it('changes system, selects bilingual metadata, hides and reveals a structure', async () => {
    const user = userEvent.setup(); render(<AnatomyWorkspace />)
    await screen.findByTestId('mock-viewer')
    const presets = screen.getByRole('group', { name: 'Chọn nhanh hệ cơ quan' })
    await user.click(within(presets).getByRole('button', { name: 'Hệ tuần hoàn' }))
    expect(within(presets).getByRole('button', { name: 'Hệ tuần hoàn' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByText('Chọn tim trên canvas'))
    expect(screen.getByRole('heading', { name: 'Tim' })).toBeInTheDocument()
    expect(screen.getByText('Cor')).toBeInTheDocument()
    expect(screen.getByText('Trung thất, trong lồng ngực.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ẩn bộ phận' }))
    expect(screen.getByText('Bộ phận đang ẩn khỏi mô hình.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hiện bộ phận' }))
    expect(screen.queryByText('Bộ phận đang ẩn khỏi mô hình.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tách riêng' }))
    expect(screen.getByTestId('scene-state')).toHaveTextContent('"isolatedId":"heart"')
  })
  it('persists layer and vessel visibility, supports accent-free search and learning', async () => {
    const user = userEvent.setup(); render(<AnatomyWorkspace />); await screen.findByTestId('mock-viewer')
    const sidebar = within(screen.getByRole('complementary', { name: 'Hệ và lớp giải phẫu' }))
    await user.click(sidebar.getByText('Lớp giải phẫu'))
    await user.click(sidebar.getByRole('checkbox', { name: 'Xương' }))
    expect(loadAnatomyPreferences().layers.skeleton).toBe(false)
    await user.click(sidebar.getByText('Mạch máu', { selector: 'summary' }))
    await user.click(sidebar.getByRole('checkbox', { name: 'Động mạch · đỏ' }))
    expect(loadAnatomyPreferences().vessels.arteries).toBe(false)
    await user.type(sidebar.getByRole('searchbox'), 'dong mach chu')
    await user.click(sidebar.getByRole('button', { name: /Động mạch chủ Aorta/ }))
    expect(screen.getByRole('heading', { name: 'Động mạch chủ' })).toBeInTheDocument()
    expect(loadAnatomyPreferences().vessels.arteries).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Học bộ phận' }))
    await user.click(screen.getByRole('button', { name: 'Bộ phận tiếp theo' }))
    expect(screen.getByRole('navigation', { name: 'Học bộ phận' })).toBeInTheDocument()
  })
  it('contains a renderer exception and retries without losing the surrounding workspace', async () => {
    mock.fail = true; vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup(); render(<AnatomyWorkspace />)
    expect(await screen.findByText('Không thể tải mô hình giải phẫu.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Giải phẫu 3D' })).toBeInTheDocument()
    mock.fail = false; await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByTestId('mock-viewer')
    await user.click(screen.getByText('Mất WebGL'))
    expect(await screen.findByText('Không thể tải mô hình giải phẫu.')).toBeInTheDocument()
  })
  it('runs a small real-structure quiz without revealing the answer first', async () => {
    const user = userEvent.setup(); render(<AnatomyWorkspace />); await screen.findByTestId('mock-viewer')
    await user.click(screen.getByRole('button', { name: 'Tự kiểm tra' }))
    expect(screen.getByRole('heading', { name: 'Đây là bộ phận nào?' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Hộp sọ' })).not.toBeInTheDocument()
    expect(screen.getByTestId('scene-state')).toHaveTextContent('"isolatedId":"skull"')
    await user.click(within(screen.getByRole('region', { name: 'Tự kiểm tra giải phẫu' })).getByRole('button', { name: 'Hộp sọ' }))
    expect(within(screen.getByRole('region', { name: 'Tự kiểm tra giải phẫu' })).getByRole('status')).toHaveTextContent('Chính xác!')
    await user.click(screen.getByRole('button', { name: 'Câu tiếp theo' }))
    expect(screen.getByTestId('scene-state')).toHaveTextContent('"isolatedId":"spine"')
    await user.click(screen.getByRole('button', { name: 'Kết thúc' }))
    expect(screen.queryByRole('heading', { name: 'Đây là bộ phận nào?' })).not.toBeInTheDocument()
    expect(screen.getByTestId('scene-state')).toHaveTextContent('"isolatedId":null')
  })
  it('handles manifest failure and retry', async () => {
    const fetcher = vi.mocked(fetch); fetcher.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup(); render(<AnatomyWorkspace />)
    await screen.findByText('Không thể tải mô hình giải phẫu.')
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(screen.getByTestId('mock-viewer')).toBeInTheDocument())
  })
  it('reveals the required layer when choosing a system after hiding organs', async () => {
    const user = userEvent.setup(); render(<AnatomyWorkspace />); await screen.findByTestId('mock-viewer')
    const sidebar = within(screen.getByRole('complementary', { name: 'Hệ và lớp giải phẫu' }))
    await user.click(sidebar.getByText('Lớp giải phẫu'))
    await user.click(sidebar.getByRole('checkbox', { name: 'Nội tạng' }))
    expect(loadAnatomyPreferences().layers.organs).toBe(false)
    await user.click(sidebar.getByRole('button', { name: 'Hệ tiết niệu' }))
    expect(loadAnatomyPreferences().layers.organs).toBe(true)
    expect(screen.queryByText('Tất cả bộ phận đang ẩn.')).not.toBeInTheDocument()
  })
})
describe('Anatomy data, mapping and visibility', () => {
  it('focuses small glands and accounts for a narrow mobile camera', () => {
    expect(anatomyFocusDistance(0.03, 42, 1)).toBe(0.15)
    expect(anatomyFocusDistance(0.3, 42, 0.7)).toBeGreaterThan(anatomyFocusDistance(0.3, 42, 1.3))
    expect(anatomyFocusDistance(5, 42, 0.5)).toBe(10)
  })
  it('ships real expanded structures in all eleven systems without fake demo geometry', () => {
    const manifest = parseAnatomyManifest(shippedManifest)
    expect(manifest.models).toHaveLength(11)
    const ids = new Set(manifest.models.flatMap((model) => model.structureIds))
    expect(ids.size).toBe(84)
    for (const system of anatomySystems) expect(manifest.models.some((model) => model.id === system.id && model.structureIds.length > 0)).toBe(true)
    for (const entry of expansion) {
      expect(ids.has(entry.id)).toBe(true)
      expect(entry.fma.every((id) => /^(partof|isa):FMA\d+$/.test(id))).toBe(true)
      expect(anatomyById.get(entry.id)?.demo).toBeUndefined()
      expect(anatomyById.get(entry.id)?.system).toBe(entry.group)
    }
    expect(ids.has('uterus')).toBe(false)
    expect(ids.has('thyroid')).toBe(false)
    expect(anatomyById.get('thyroid-cartilage')?.system).toBe('respiratory')
  })
  it('reveals only the chosen system layers and vessel filters, preserving unrelated preferences', () => {
    const current = state(); current.layers.organs = false; current.layers.skin = false
    current.layers.vessels = false; current.vessels.arteries = false; current.vessels.major = false
    const urinary = revealSystem(current, 'urinary')
    expect(urinary.layers.organs).toBe(true); expect(urinary.layers.skin).toBe(false)
    expect(urinary.layers.vessels).toBe(false)
    const vascular = revealSystem(current, 'circulatory')
    expect(vascular.layers.vessels).toBe(true); expect(vascular.vessels.arteries).toBe(true); expect(vascular.vessels.major).toBe(true)
    expect(revealSystem(current, 'all').layers).toEqual(current.layers)
  })
  it('validates metadata references and alias uniqueness', () => {
    const aliases = anatomyStructures.flatMap((item) => item.modelObjectNames.map((name) => name.toLowerCase()))
    // Duplicate aliases inside one entity are harmless; an alias must never map to different entities.
    const owners = new Map<string, string>()
    anatomyStructures.forEach((item) => { item.relatedStructures.forEach((id) => expect(anatomyById.has(id)).toBe(true)); item.modelObjectNames.forEach((name) => { expect(owners.get(name.toLowerCase()) ?? item.id).toBe(item.id); owners.set(name.toLowerCase(), item.id) }) })
    expect(aliases.length).toBeGreaterThan(28)
  })
  it('maps GLB children by a named ancestor or explicit stable ID', () => {
    const parent = new Object3D(); parent.name = 'Heart'; const child = new Object3D(); parent.add(child)
    expect(resolveStructureId(child)).toBe('heart')
    child.userData.anatomyId = 'brain'; expect(resolveStructureId(child)).toBe('brain')
    expect(resolveStructureId(new Object3D())).toBeUndefined()
  })
  it('intersects systems, layers, vessel filters and isolation, then reveals safely', () => {
    const item = anatomyById.get('aorta'); if (!item) throw new Error('Missing fixture')
    let current: AnatomySceneState = { ...state(), system: 'circulatory' }; expect(isStructureVisible(item, current)).toBe(true)
    current.vessels.arteries = false; expect(isStructureVisible(item, current)).toBe(false)
    current.hiddenIds = [item.id]; current.isolatedId = 'brain'; current.layers.vessels = false
    current = revealStructure(current, item.id); expect(isStructureVisible(item, current)).toBe(true)
    expect(structureColor(item)).toBe('#ee4c55')
  })
  it('generates each clipping plane and rejects unsafe model paths', () => {
    expect(clippingPlanes({ axis: 'off', position: 0 })).toEqual([])
    for (const axis of ['sagittal', 'coronal', 'axial'] as const) {
      const plane = clippingPlanes({ axis, position: 0 })[0]
      expect(plane?.distanceToPoint(new Vector3(1, 1, 1))).toBe(1)
      expect(plane?.distanceToPoint(new Vector3(-1, -1, -1))).toBe(-1)
    }
    expect(parseAnatomyManifest({ version: 1, models: [] }).models).toEqual([])
    expect(() => parseAnatomyManifest({ version: 2, models: [] })).toThrow()
    expect(() => parseAnatomyManifest({ version: 1, models: [{ id: 'a', url: '/models/anatomy/../private.glb', license: 'CC0', attribution: 'Author', scale: 1, position: [0, 0, 0] }] })).toThrow()
  })
  it('recovers from corrupt or obsolete persisted state', () => {
    localStorage.setItem('nexamin.anatomy.v1', '{broken'); expect(loadAnatomyPreferences()).toEqual(defaultAnatomyPreferences())
    localStorage.setItem('nexamin.anatomy.v1', '{"version":0}'); expect(loadAnatomyPreferences()).toEqual(defaultAnatomyPreferences())
  })
  it('only asks quiz questions about available real meshes with unique answers', () => {
    expect(createAnatomyQuiz(new Set(['heart', 'liver', 'brain']), 0)).toBeNull()
    const prompt = createAnatomyQuiz(new Set(['skull', 'spine', 'heart', 'brain', 'liver']), 4)
    expect(prompt).not.toBeNull()
    expect(prompt?.choices).toHaveLength(4)
    expect(new Set(prompt?.choices).size).toBe(4)
    expect(prompt?.choices).toContain(prompt?.structureId)
  })
})
