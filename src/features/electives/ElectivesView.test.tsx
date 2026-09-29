import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElectivesView } from './ElectivesView'

const api = vi.hoisted(() => ({
  availability: vi.fn(),
  resolution: vi.fn(),
  careers: vi.fn(),
}))

vi.mock('../../lib/workspaceApi', () => ({
  workspaceApi: {
    electiveAvailability: api.availability,
    electiveResolution: api.resolution,
    electiveCareers: api.careers,
  },
}))

describe('ElectivesView', () => {
  beforeEach(() => {
    api.resolution.mockReset()
    api.careers.mockReset()
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

  it('explains an unmapped UTH major and offers a profile action', async () => {
    api.availability.mockResolvedValueOnce({ status: 'supported', university_code: 'UTH', message: '' })
    api.resolution.mockResolvedValueOnce({
      status: 'program_not_mapped', message: 'Ngành trong hồ sơ chưa khớp CTĐT UTH.', curricula: [],
    })
    const onOpenProfile = vi.fn()
    render(<ElectivesView onOpenProfile={onOpenProfile} />)
    expect(await screen.findByText('Ngành trong hồ sơ chưa khớp CTĐT UTH.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra hồ sơ/ }))
    expect(onOpenProfile).toHaveBeenCalledOnce()
  })

  it('requires a cohort and career choice when several UTH curricula match', async () => {
    api.availability.mockResolvedValueOnce({ status: 'supported', university_code: 'UTH', message: '' })
    api.resolution.mockResolvedValueOnce({
      status: 'ready', message: '', curricula: [
        { id: '2024', specialization: 'Khoa học dữ liệu và AI', cohort: 2024 },
        { id: '2025', specialization: 'Khoa học dữ liệu và AI', cohort: 2025 },
      ],
    })
    api.careers.mockResolvedValueOnce([{
      code: 'ai_engineer', label: 'AI Engineer', skills: [],
      evidence_label: 'Bosch Việt Nam', evidence_url: 'https://www.bosch.com.vn/careers/fields-of-work/',
    }])
    render(<ElectivesView onOpenProfile={vi.fn()} />)
    const cohort = await screen.findByLabelText('Chuyên ngành và khóa học') as HTMLSelectElement
    const career = screen.getByLabelText('Định hướng nghề nghiệp') as HTMLSelectElement
    const submit = screen.getByRole('button', { name: /Xem gợi ý/ })
    expect(cohort.value).toBe('')
    expect(career.value).toBe('')
    expect(submit).toBeDisabled()
    fireEvent.change(cohort, { target: { value: '2024' } })
    await waitFor(() => expect(api.careers).toHaveBeenCalledWith('2024'))
    await screen.findByRole('option', { name: 'AI Engineer' })
    fireEvent.change(career, { target: { value: 'ai_engineer' } })
    expect(submit).toBeEnabled()
  })
})
