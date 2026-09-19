export interface MajorOption {
  code: string
  name: string
}

interface MajorSnapshot {
  source: string
  snapshot_date: string
  universities: Record<string, MajorOption[]>
}

let snapshotPromise: Promise<MajorSnapshot> | null = null

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase('vi')
}

function loadSnapshot() {
  snapshotPromise ??= fetch('/university-majors.json').then((response) => {
    if (!response.ok) throw new Error('Không tải được danh sách ngành đào tạo.')
    return response.json() as Promise<MajorSnapshot>
  })
  return snapshotPromise
}

export async function getUniversityMajors(universityCode: string) {
  const snapshot = await loadSnapshot()
  return snapshot.universities[universityCode] ?? []
}

export function filterMajors(majors: MajorOption[], query: string) {
  const keyword = normalized(query.trim())
  if (!keyword) return majors
  return majors.filter((major) => normalized(`${major.code} ${major.name}`).includes(keyword))
}
