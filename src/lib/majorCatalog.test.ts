import { describe, expect, it } from 'vitest'
import { filterMajors } from './majorCatalog'

const majors = [
  { code: '7480201', name: 'Công nghệ thông tin' },
  { code: '7340101', name: 'Quản trị kinh doanh' },
]

describe('major catalog', () => {
  it('finds a major without requiring Vietnamese accents', () => {
    expect(filterMajors(majors, 'cong nghe')).toEqual([majors[0]])
  })

  it('finds a major by code', () => {
    expect(filterMajors(majors, '7340101')).toEqual([majors[1]])
  })
})
