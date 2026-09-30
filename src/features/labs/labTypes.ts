export type LabCategoryId = 'medicine-biology' | 'computing' | 'electrical' | 'mechanical' | 'chemistry' | 'biology' | 'construction' | 'earth-science'
export type LabStatus = 'available' | 'beta' | 'coming-soon'
export interface LabCategory { id: LabCategoryId; title: string }
export interface LabDefinition {
  id: string
  title: string
  category: LabCategoryId
  description: string
  tags: readonly string[]
  status: LabStatus
  thumbnail?: string
  note?: string
}
export interface LabHubPreferences { version: 1; category: LabCategoryId | 'all'; search: string }
