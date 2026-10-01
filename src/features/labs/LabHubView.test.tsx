import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LabHubView } from './LabHubView'
import { LabCard } from './LabCard'
import { filterLabs, labCategories, labRegistry } from './labRegistry'
import { loadLabPreferences } from './labStorage'
import type { LabDefinition } from './labTypes'

const simulation = vi.hoisted(() => ({ rendered: vi.fn(), fail: false }))
vi.mock('../anatomy/AnatomyView', () => ({ AnatomyView: () => { simulation.rendered(); if (simulation.fail) throw new Error('chunk failed'); return <h2>Anatomy hiện có</h2> } }))
beforeEach(() => { localStorage.clear(); simulation.rendered.mockClear(); simulation.fail = false })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

function renderLab(initialPath = '/labs') {
  return render(<MemoryRouter initialEntries={[initialPath]}><Routes>
    <Route path="/labs" element={<LabHubView />} />
    <Route path="/labs/anatomy" element={<LabHubView activeId="anatomy" />} />
  </Routes></MemoryRouter>)
}

describe('Lab Hub', () => {
  it('starts at All and exposes Anatomy as the only released lab without rendering it', () => {
    renderLab()
    expect(screen.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('article', { name: 'Giải phẫu người 3D' })).toBeInTheDocument()
    expect(simulation.rendered).not.toHaveBeenCalled()
    expect(screen.getAllByRole('button', { name: 'Khám phá' })).toHaveLength(1)
  })
  it('filters medicine and every future category without inventing available simulations', async () => {
    const user = userEvent.setup(); renderLab()
    const fields = within(screen.getByRole('group', { name: 'Lọc theo lĩnh vực' }))
    await user.click(fields.getByRole('button', { name: 'Y – Sinh' }))
    expect(screen.getByRole('article', { name: 'Giải phẫu người 3D' })).toBeInTheDocument()
    for (const category of labCategories.filter((item) => item.id !== 'medicine-biology')) {
      await user.click(fields.getByRole('button', { name: category.title }))
      expect(fields.getByRole('button', { name: category.title })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText('Lĩnh vực này đang phát triển.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Khám phá' })).not.toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Xem tất cả lab' }))
    expect(screen.getByRole('button', { name: 'Khám phá' })).toBeInTheDocument()
  })
  it('finds Anatomy without accents, opens the existing lazy view and returns with context', async () => {
    const user = userEvent.setup(); renderLab()
    await user.type(screen.getByRole('searchbox'), 'giai phau')
    await user.click(screen.getByRole('button', { name: 'Khám phá' }))
    expect(await screen.findByRole('heading', { name: 'Anatomy hiện có' })).toBeInTheDocument()
    const breadcrumb = screen.getByRole('navigation', { name: 'Vị trí trong Phòng Lab' })
    expect(within(breadcrumb).getByRole('button', { name: 'Y – Sinh' })).toBeInTheDocument()
    expect(within(breadcrumb).getByText('Giải phẫu người 3D')).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('button', { name: 'Quay lại Phòng Lab' }))
    expect(screen.getByRole('searchbox')).toHaveValue('giai phau')
    expect(screen.getByRole('heading', { name: 'Phòng Lab' })).toHaveFocus()
    expect(loadLabPreferences().search).toBe('giai phau')
  })
  it('handles no matches and safely recovers invalid persisted state', async () => {
    localStorage.setItem('nexamin.labs.v1', '{"version":55,"category":"bogus"}')
    const user = userEvent.setup(); renderLab()
    expect(screen.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'true')
    await user.type(screen.getByRole('searchbox'), 'khong co lab nay')
    expect(screen.getByText('Không tìm thấy lab phù hợp.')).toBeInTheDocument()
    expect(simulation.rendered).not.toHaveBeenCalled()
  })
  it('recognizes an unreleased field in search without suggesting a missing lab', async () => {
    const user = userEvent.setup(); renderLab()
    await user.type(screen.getByRole('searchbox'), 'cong nghe thong tin')
    expect(screen.getByText('Công nghệ thông tin đang phát triển.')).toBeInTheDocument()
    expect(screen.queryByText('Không tìm thấy lab phù hợp.')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Khám phá' })).not.toBeInTheDocument()
  })
  it('contains a module failure while keeping Back available and retries', async () => {
    simulation.fail = true; vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const user = userEvent.setup(); renderLab()
    await user.click(screen.getByRole('button', { name: 'Khám phá' }))
    expect(await screen.findByText('Không thể mở phòng lab.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quay lại Phòng Lab' })).toBeInTheDocument()
    simulation.fail = false
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('heading', { name: 'Anatomy hiện có' })).toBeInTheDocument()
  })
  it('accepts future registry entries without making unreleased labs interactive', () => {
    const future: LabDefinition = { id: 'future-network', title: 'Network Lab', category: 'computing', description: 'Future', tags: ['Network'], status: 'coming-soon' }
    expect(filterLabs({ category: 'computing', search: 'network' }, [...labRegistry, future])).toEqual([future])
    const launch = vi.fn(); render(<LabCard lab={future} canLaunch={false} onLaunch={launch} />)
    expect(screen.getByRole('button', { name: 'Chưa phát hành' })).toBeDisabled()
    expect(launch).not.toHaveBeenCalled()
  })
})
