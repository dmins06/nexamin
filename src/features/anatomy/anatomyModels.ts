import type { AnatomyManifest, AnatomyModel, VectorTuple } from './anatomyTypes'
import { anatomyById } from './anatomyData'

function vector(value: unknown): value is VectorTuple { return Array.isArray(value) && value.length === 3 && value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)) }
function model(value: unknown): value is AnatomyModel {
  if (!value || typeof value !== 'object') return false
  return 'id' in value && typeof value.id === 'string' && value.id.length > 0
    && 'url' in value && typeof value.url === 'string' && /^\/models\/anatomy\/[a-zA-Z0-9_./-]+\.glb$/.test(value.url) && !value.url.includes('..')
    && 'license' in value && typeof value.license === 'string' && value.license.length > 0
    && 'attribution' in value && typeof value.attribution === 'string' && value.attribution.length > 0
    && 'scale' in value && typeof value.scale === 'number' && Number.isFinite(value.scale) && value.scale > 0
    && 'position' in value && vector(value.position)
    && 'structureIds' in value && Array.isArray(value.structureIds) && value.structureIds.length > 0
    && value.structureIds.every((id: unknown) => typeof id === 'string' && anatomyById.has(id))
    && new Set(value.structureIds).size === value.structureIds.length
}
export function parseAnatomyManifest(value: unknown): AnatomyManifest {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('models' in value) || !Array.isArray(value.models) || !value.models.every(model)) throw new Error('Cấu hình mô hình không hợp lệ.')
  if (new Set(value.models.map((item) => item.id)).size !== value.models.length) throw new Error('Mã mô hình bị trùng.')
  return { version: 1, models: value.models }
}
export async function loadAnatomyManifest(signal: AbortSignal) {
  const response = await fetch('/models/anatomy/manifest.json', { signal })
  if (!response.ok) throw new Error('Không tải được danh mục mô hình.')
  const data: unknown = await response.json()
  return parseAnatomyManifest(data)
}
