import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

vi.mock('./features/anatomy/AnatomyView', () => ({ AnatomyView: () => <h2>Phòng học giải phẫu</h2> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('places Anatomy between Practice and Electives and preserves the mobile bottom bar', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('[]', { status: 200 })))
  const user = userEvent.setup(); const { container } = render(<App />)
  const navigation = screen.getByRole('navigation', { name: 'Điều hướng chính' })
  const buttons = within(navigation).getAllByRole('button').map((button) => button.textContent)
  const index = buttons.indexOf('Giải phẫu 3D')
  expect(index).toBeGreaterThan(0); expect(buttons[index - 1]).toBe('Luyện đề'); expect(buttons[index + 1]).toBe('Môn tự chọn')
  expect(container.querySelectorAll('.mobile-nav button')).toHaveLength(5)
  expect(container.querySelector('.mobile-more')?.textContent).toContain('Giải phẫu 3D')
  await user.click(within(navigation).getByRole('button', { name: 'Giải phẫu 3D' }))
  expect(screen.getByRole('heading', { name: 'Phòng học giải phẫu' })).toBeInTheDocument()
})
