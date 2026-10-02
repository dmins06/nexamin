import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { ITLabHub } from './ITLabHub'
import { CodeLab } from './code/CodeLab'
import { AlgorithmLab } from './algorithms/AlgorithmLab'
import { loadCodePreferences } from './code/codeStorage'
import {exercises} from './code/codeRegistry'
import type { ExecutionResult } from './code/codeTypes'
const runner = vi.hoisted(() => ({ execute: vi.fn() }))
vi.mock('./code/runner/providers', () => ({ codeRunner: runner }))
vi.mock('./code/CodeEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
    disabled,
  }: {
    value: string
    onChange: (code: string) => void
    disabled: boolean
  }) => (
    <textarea
      aria-label="Trình soạn thảo code"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ),
}))
beforeEach(() => {
  localStorage.clear()
  runner.execute.mockReset()
  runner.execute.mockResolvedValue({
    status: 'success',
    stdout: 'Hello World\n',
    stderr: '',
    exitCode: 0,
    executionTime: 20,
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)
describe('IT teaching workspaces', () => {
  it('renders eight launchable teaching workspaces', () => {
    render(<ITLabHub />, { wrapper })
    expect(screen.getAllByRole('article')).toHaveLength(8)
    expect(screen.getAllByRole('link', { name: 'Mở lab' })).toHaveLength(8)
    expect(screen.queryByRole('link', { name: 'Xem lộ trình' })).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'CNTT Lab' }),
    ).toBeInTheDocument()
  })
  it('keeps drafts by language/exercise and sends actual source/stdin to provider', async () => {
    const user = userEvent.setup()
    render(<CodeLab />, { wrapper })
    const editor = screen.getByLabelText('Trình soạn thảo code')
    await user.clear(editor)
    await user.type(editor, 'print(7)')
    await user.selectOptions(screen.getByLabelText('Ngôn ngữ'), 'c')
    expect(editor).toHaveValue(exercises[0]?.languageTemplates.c)
    await user.selectOptions(screen.getByLabelText('Ngôn ngữ'), 'python')
    expect(editor).toHaveValue('print(7)')
    expect(loadCodePreferences().drafts['hello:python']).toBe('print(7)')
    await user.type(screen.getByLabelText('stdin'), '3 4')
    await user.click(screen.getByRole('button', { name: 'Chạy' }))
    expect(runner.execute).toHaveBeenCalledWith(
      { language: 'python', sourceCode: 'print(7)', stdin: '3 4' },
      expect.any(AbortSignal),
      expect.any(Function),
    )
    expect(await screen.findByText('Chạy thành công')).toBeInTheDocument()
  })
  it('runs public test cases, displays failure honestly and supports reset cancellation', async () => {
    const user = userEvent.setup()
    render(<CodeLab />, { wrapper })
    await user.selectOptions(screen.getByLabelText('Bài tập'), 'sum')
    runner.execute
      .mockResolvedValueOnce({
        status: 'success',
        stdout: '7',
        stderr: '',
        exitCode: 0,
        executionTime: 1,
      })
      .mockResolvedValueOnce({
        status: 'success',
        stdout: 'oops',
        stderr: '',
        exitCode: 0,
        executionTime: 1,
      })
      .mockResolvedValueOnce({
        status: 'success',
        stdout: '0',
        stderr: '',
        exitCode: 0,
        executionTime: 1,
      })
    await user.click(screen.getByRole('button', { name: 'Kiểm tra bài' }))
    expect(
      await screen.findByText('2 / 3 đạt · đã chạy 3 test'),
    ).toBeInTheDocument()
    const editor = screen.getByLabelText('Trình soạn thảo code')
    await user.clear(editor)
    await user.type(editor, 'print(8)')
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await user.click(screen.getByRole('button', { name: 'Code mẫu' }))
    expect(editor).toHaveValue('print(8)')
  })
  it('locks duplicate runs and aborts when Stop or unmount is used', async () => {
    let finish: (result: ExecutionResult) => void = () => undefined
    runner.execute.mockImplementation(
      (_req, signal: AbortSignal) =>
        new Promise<ExecutionResult>((resolve) => {
          finish = resolve
          signal.addEventListener('abort', () =>
            resolve({
              status: 'stopped',
              stdout: '',
              stderr: 'Đã dừng chương trình.',
              exitCode: null,
              executionTime: 1,
            }),
          )
        }),
    )
    const user = userEvent.setup()
    const view = render(<CodeLab />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Chạy' }))
    expect(
      screen.getByRole('button', { name: 'Chạy' }),
    ).toBeDisabled()
    expect(screen.getByLabelText('Ngôn ngữ')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Dừng' }))
    expect(await screen.findByText('Đã dừng')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chạy' }))
    const signal = runner.execute.mock.calls.at(-1)?.[1]
    view.unmount()
    expect(signal.aborted).toBe(true)
    finish({
      status: 'success',
      stdout: 'late',
      stderr: '',
      exitCode: 0,
      executionTime: 0,
    })
  })
  it('shows provider errors without crashing the workspace', async () => {
    runner.execute.mockRejectedValue(new Error('network'))
    const user = userEvent.setup()
    render(<CodeLab />, { wrapper })
    await user.click(screen.getByRole('button', { name: 'Chạy' }))
    expect(
      await screen.findByText('Trình chạy chưa sẵn sàng'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Chạy' }),
    ).toBeEnabled()
  })
  it('synchronizes steps/code highlight, restarts and clears invalid input', async () => {
    const user = userEvent.setup()
    render(<AlgorithmLab />, { wrapper })
    expect(screen.getByText('Bắt đầu với dãy đã nhập')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bước tiếp' }))
    expect(screen.getByText('Bắt đầu một lượt')).toBeInTheDocument()
    expect(screen.getByText('changed = false').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )
    await user.click(screen.getByRole('button', { name: 'Bắt đầu lại' }))
    expect(screen.getByRole('button', { name: 'Bước trước' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Dãy số'))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Phát' })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Thuật toán'), 'dijkstra')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: /Đồ thị 5 đỉnh/ }),
    ).toBeInTheDocument()
  })
})
