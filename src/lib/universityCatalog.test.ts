import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchLocalUniversities } from './universityCatalog'

describe('local university catalog', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('searches Vietnamese names without requiring accents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: '1', official_code: 'BKA', name: 'ĐẠI HỌC BÁCH KHOA HÀ NỘI', short_name: 'BKA', logo_url: null, website: null, is_verified: true },
      ],
    }))
    const result = await searchLocalUniversities('bach khoa ha noi')
    expect(result.total).toBe(1)
    expect(result.items[0]?.official_code).toBe('BKA')
  })
})
