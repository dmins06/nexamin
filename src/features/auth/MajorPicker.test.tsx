import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { University } from '../../lib/api'
import { MajorPicker } from './MajorPicker'

const university: University = {
  id: '1',
  official_code: 'BKA',
  name: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI',
  short_name: 'BKA',
  logo_url: '/university-logos/BKA.png',
  website: 'https://hust.edu.vn',
  is_verified: true,
}

describe('MajorPicker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'test',
        snapshot_date: '2026-09-19',
        universities: { BKA: [{ code: 'IT1', name: 'CNTT: Khoa học Máy tính' }] },
      }),
    }))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('loads and selects a program offered by the chosen university', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MajorPicker university={university} value={null} onChange={onChange} />)

    const input = screen.getByLabelText('Ngành học')
    await waitFor(() => expect(input).toBeEnabled())
    await user.click(input)
    await user.click(await screen.findByRole('option', { name: /IT1.*Khoa học Máy tính/ }))
    expect(onChange).toHaveBeenCalledWith({ code: 'IT1', name: 'CNTT: Khoa học Máy tính' })
  })
})
