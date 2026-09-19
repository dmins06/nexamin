import type { University } from './api'

interface UniversityPage {
  items: University[]
  page: number
  page_size: number
  total: number
}

let catalogPromise: Promise<University[]> | null = null

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
}

function loadCatalog() {
  catalogPromise ??= fetch('/universities.json')
    .then((response) => {
      if (!response.ok) throw new Error('Không tải được danh mục trường dự phòng.')
      return response.json() as Promise<University[]>
    })
  return catalogPromise
}

export async function searchLocalUniversities(query: string): Promise<UniversityPage> {
  const catalog = await loadCatalog()
  const keyword = normalized(query.trim())
  const matches = keyword
    ? catalog.filter((university) => normalized(`${university.official_code ?? ''} ${university.short_name} ${university.name}`).includes(keyword))
    : catalog
  return { items: matches.slice(0, 30), page: 1, page_size: 30, total: matches.length }
}
