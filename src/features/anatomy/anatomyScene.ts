import { Object3D, Plane, Vector3 } from 'three'
import { anatomyById, anatomyObjectMap } from './anatomyData'
import type { AnatomySceneState, AnatomyStructure } from './anatomyTypes'

export function resolveStructureId(object: Object3D): string | undefined {
  let current: Object3D | null = object
  while (current) {
    const id: unknown = current.userData.anatomyId
    if (typeof id === 'string' && anatomyById.has(id)) return id
    const mapped = anatomyObjectMap.get(current.name.toLowerCase())
    if (mapped) return mapped
    current = current.parent
  }
}
export function clippingPlanes(section: AnatomySceneState['section']): Plane[] {
  if (section.axis === 'off') return []
  const normal = section.axis === 'sagittal' ? new Vector3(1, 0, 0) : section.axis === 'coronal' ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0)
  const extent = section.axis === 'sagittal' ? 1.5 : section.axis === 'coronal' ? 0.8 : 2.5
  return [new Plane(normal, section.position * extent)]
}
export function structureColor(item: AnatomyStructure) {
  if (item.vessel) return item.vessel.type === 'arteries' ? '#ee4c55' : '#438ff5'
  const colors = { skin: '#c89577', muscles: '#b96158', skeleton: '#e9dec4', organs: '#d89a7d', vessels: '#ee4c55', nerves: '#e9c46a' }
  return colors[item.layer]
}
export function anatomyFocusDistance(radius: number, fov: number, aspect: number) {
  const vertical = fov * Math.PI / 360
  const horizontal = Math.atan(Math.tan(vertical) * aspect)
  return Math.min(10, Math.max(0.15, radius / Math.sin(Math.min(vertical, horizontal)) * 1.45))
}
