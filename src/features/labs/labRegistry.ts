import type { LabCategory, LabDefinition, LabHubPreferences } from './labTypes'

export const labCategories: readonly LabCategory[] = [
  { id: 'medicine-biology', title: 'Y – Sinh' },
  { id: 'computing', title: 'Công nghệ thông tin' },
  { id: 'electrical', title: 'Điện – Điện tử' },
  { id: 'mechanical', title: 'Cơ khí' },
  { id: 'chemistry', title: 'Hóa học' },
  { id: 'biology', title: 'Sinh học' },
  { id: 'construction', title: 'Xây dựng' },
  { id: 'earth-science', title: 'Khoa học Trái Đất' },
]
export const labRegistry: readonly LabDefinition[] = [{
  id: 'anatomy', title: 'Giải phẫu người 3D', category: 'medicine-biology', status: 'available',
  description: 'Khám phá cấu trúc cơ thể người theo từng hệ cơ quan bằng mô hình 3D tương tác.',
  tags: ['3D', 'Tương tác', 'Y – Sinh'],
  note: 'Mô hình BodyParts3D có bản quyền mở; một số cấu trúc nhỏ và hệ cơ quan chưa được bổ sung.',
}]
export function labCategoryTitle(id: LabDefinition['category']) { return labCategories.find((category) => category.id === id)?.title ?? id }
export function normalizeLabSearch(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd') }
export function filterLabs(preferences: Pick<LabHubPreferences, 'category' | 'search'>, registry: readonly LabDefinition[] = labRegistry) {
  const query = normalizeLabSearch(preferences.search).trim()
  return registry.filter((lab) => (preferences.category === 'all' || preferences.category === lab.category) && normalizeLabSearch([lab.title, labCategoryTitle(lab.category), lab.description, ...lab.tags].join(' ')).includes(query))
}
