import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElectivesView } from './ElectivesView'

const api = vi.hoisted(() => ({
  availability: vi.fn(),
}))

vi.mock('../../lib/workspaceApi', () => ({
  workspaceApi: {
    electiveAvailability: api.availability,
  },
}))

describe('ElectivesView', () => {
  beforeEach(() => {
    api.availability.mockResolvedValue({
      status: 'unsupported',
      university_code: 'OTHER',
      message: 'Chức năng này hiện chỉ khả dụng cho sinh viên UTH.',
    })
  })

  it('does not offer UTH curricula to another university', async () => {
    render(<ElectivesView onOpenProfile={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Chức năng này hiện chỉ khả dụng cho sinh viên UTH.')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Xem gợi ý/ })).not.toBeInTheDocument()
  })
})
