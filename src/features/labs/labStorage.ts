import { labCategories } from './labRegistry'
import type { LabHubPreferences } from './labTypes'

const KEY = 'nexamin.labs.v1'
export function defaultLabPreferences(): LabHubPreferences { return { version: 1, category: 'all', search: '' } }
export function loadLabPreferences(): LabHubPreferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (value && typeof value === 'object' && 'version' in value && value.version === 1 && 'category' in value && 'search' in value && typeof value.search === 'string') {
      const category = value.category === 'all' ? 'all' : labCategories.find((item) => item.id === value.category)?.id
      if (category) return { version: 1, category, search: value.search.slice(0, 160) }
    }
  } catch { /* A malformed/blocked store must not block discovery. */ }
  return defaultLabPreferences()
}
export function saveLabPreferences(value: LabHubPreferences) { try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* Usable without storage. */ } }
