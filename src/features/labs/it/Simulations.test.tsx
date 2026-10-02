import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { webcrypto } from 'node:crypto'
import initSqlJs from 'sql.js'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { ComputerLab } from './computer/ComputerLab'
import { OSLab } from './os/OSLab'
import { NetworkLab } from './network/NetworkLab'
import { MLLab } from './ai/MLLab'
import { SecurityLab } from './security/SecurityLab'
import { DatabaseLab } from './database/DatabaseLab'
import { executeLocalSQL, sampleSQL, type SQLRun } from './database/sqlEngine'
import { loadSQLSnapshot, saveSQLSnapshot } from './database/sqlStorage'
import { readLabSettings } from './shared/useLabSettings'

class MockWorker {
  static instances: MockWorker[] = []
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: (() => void) | null = null
  postMessage = vi.fn()
  terminate = vi.fn()
  constructor() {
    MockWorker.instances.push(this)
  }
  emit(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)
let sqlResult: SQLRun
beforeAll(async () => {
  const SQL = await initSqlJs(),
    db = new SQL.Database()
  try {
    db.run(sampleSQL)
    sqlResult = executeLocalSQL(db, 'SELECT COUNT(*) AS learners FROM students')
  } finally {
    db.close()
  }
})
beforeEach(() => {
  localStorage.clear()
  MockWorker.instances = []
  vi.stubGlobal('Worker', MockWorker)
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function latestWorker() {
  const worker = MockWorker.instances.at(-1)
  if (!worker) throw Error('Expected SQLite worker')
  return worker
}
describe('independent teaching workspaces', () => {
  it('steps CPU state, persists source and stops on invalid instructions', async () => {
    const user = userEvent.setup()
    render(<ComputerLab />, { wrapper })
    expect(screen.getByRole('button', { name: 'Bước trước' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Bước tiếp' }))
    expect(screen.getByRole('button', { name: 'Bước trước' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Lệnh CPU'), {
      target: { value: 'INVALID' },
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Phát' })).toBeDisabled()
    expect(readLabSettings('cpu', { program: '' }).program).toBe('INVALID')
    await user.click(screen.getByRole('button', { name: 'Dữ liệu mẫu' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it('does not let an invalid hidden RR quantum block FCFS and detects circular wait', async () => {
    const user = userEvent.setup()
    render(<OSLab />, { wrapper })
    fireEvent.change(screen.getByLabelText('Quantum'), {
      target: { value: '0' },
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Chính sách'), 'fcfs')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Waiting trung bình: 3.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deadlock' }))
    expect(screen.getByRole('status')).toHaveTextContent('Có deadlock')
    fireEvent.change(screen.getByLabelText('Cạnh yêu cầu hoặc cấp phát'), {
      target: { value: 'P1 -> R1\nR1 -> P2' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Không có chu trình')
  })
  it('explains unreachable links and runs the two-subnet sample', async () => {
    const user = userEvent.setup()
    render(<NetworkLab />, { wrapper })
    fireEvent.change(screen.getByLabelText('Link: ID đầu ID cuối'), {
      target: { value: '' },
    })
    expect(screen.getByRole('status')).toHaveTextContent('Unreachable')
    await user.click(screen.getByRole('button', { name: 'Hai subnet mẫu' }))
    expect(screen.getByRole('status')).toHaveTextContent('Application')
    await user.click(screen.getByRole('button', { name: 'Bước tiếp' }))
    expect(screen.getByRole('status')).toHaveTextContent('Transport')
  })
  it('runs every ML model and ignores irrelevant invalid learning rates for KNN', async () => {
    const user = userEvent.setup()
    render(<MLLab />, { wrapper })
    fireEvent.change(screen.getByLabelText('Learning rate'), {
      target: { value: '' },
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Mô hình'), 'knn')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bước tiếp' }))
    expect(screen.getByRole('status')).toHaveTextContent('2 phiếu nhãn 1')
    for (const model of ['kmeans', 'decision-tree', 'neural-network']) {
      await user.selectOptions(screen.getByLabelText('Mô hình'), model)
      if (model === 'neural-network')
        fireEvent.change(screen.getByLabelText('Learning rate'), {
          target: { value: '.2' },
        })
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(
        screen.getByRole('img', {
          name: 'Điểm dữ liệu, tâm cụm hoặc đường hồi quy',
        }),
      ).toBeInTheDocument()
    }
  })
  it('uses real browser crypto, keeps input ephemeral and denies even demo admins password access', async () => {
    const user = userEvent.setup()
    render(<SecurityLab />, { wrapper })
    fireEvent.change(screen.getByLabelText('Chuỗi minh họa'), {
      target: { value: 'abc' },
    })
    await user.click(screen.getByRole('button', { name: 'Tính SHA-256' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'ba7816bf8f01cfea',
    )
    const stored = Array.from({ length: localStorage.length }, (_, i) =>
      localStorage.getItem(localStorage.key(i) ?? ''),
    ).join('')
    expect(stored).not.toContain('abc')
    expect(
      screen.queryByRole('button', { name: /Emin/ }),
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Authentication / Authorization' }),
    )
    await user.selectOptions(screen.getByLabelText('Role giả lập'), 'admin')
    await user.selectOptions(screen.getByLabelText('Hành động'), 'password')
    expect(screen.getByRole('status')).toHaveTextContent('Từ chối')
  })
})
describe('SQLite UI lifecycle', () => {
  it('sends device snapshot only to Worker, saves success and preserves it after a failed run', async () => {
    const user = userEvent.setup()
    saveSQLSnapshot(sqlResult.snapshot)
    render(<DatabaseLab />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Chạy SQL' }))
    expect(latestWorker().postMessage).toHaveBeenCalledWith({
      sql: expect.any(String),
      snapshot: sqlResult.snapshot,
    })
    act(() => latestWorker().emit({ ok: true, result: sqlResult }))
    expect(screen.getByRole('cell', { name: '3' })).toBeInTheDocument()
    expect(
      screen.getByText('Đã lưu database thực hành trên thiết bị.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chạy SQL' }))
    act(() => latestWorker().emit({ ok: false, error: 'no such table' }))
    expect(screen.getByRole('alert')).toHaveTextContent('no such table')
    expect(loadSQLSnapshot()).toEqual(sqlResult.snapshot)
  })
  it('stops and terminates pending execution on unmount', async () => {
    const user = userEvent.setup(),
      view = render(<DatabaseLab />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Chạy SQL' }))
    const first = latestWorker()
    expect(screen.getByRole('button', { name: 'Chạy SQL' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Dừng SQL' }))
    expect(first.terminate).toHaveBeenCalledOnce()
    act(() => first.emit({ ok: true, result: sqlResult }))
    expect(loadSQLSnapshot()).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Chạy SQL' }))
    const second = latestWorker()
    view.unmount()
    expect(second.terminate).toHaveBeenCalledOnce()
  })
  it('requires confirmation before clearing the practice DB and preserves other preferences', async () => {
    const user = userEvent.setup()
    saveSQLSnapshot(sqlResult.snapshot)
    localStorage.setItem('other-feature', 'preserve')
    render(<DatabaseLab />, { wrapper })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(
      screen.getByRole('button', { name: 'Khôi phục dữ liệu mẫu' }),
    )
    expect(loadSQLSnapshot()).not.toBeNull()
    confirm.mockReturnValue(true)
    await user.click(
      screen.getByRole('button', { name: 'Khôi phục dữ liệu mẫu' }),
    )
    expect(loadSQLSnapshot()).toBeNull()
    expect(localStorage.getItem('other-feature')).toBe('preserve')
  })
  it('recovers versioned settings without admitting unknown fields', () => {
    localStorage.setItem(
      'nexamin.it.example.v1',
      JSON.stringify({ version: 1, values: { valid: 'ok', extra: 'discard' } }),
    )
    expect(readLabSettings('example', { valid: 'fallback' })).toEqual({
      valid: 'ok',
    })
    localStorage.setItem('nexamin.it.example.v1', '{"version":2}')
    expect(readLabSettings('example', { valid: 'fallback' })).toEqual({
      valid: 'fallback',
    })
  })
})
