import { anatomyById, anatomyLayers, anatomySystems } from './anatomyData'
import type { AnatomyPreferences, AnatomySceneState, AnatomyStructure } from './anatomyTypes'

const KEY = 'nexamin.anatomy.v1'
export function defaultAnatomyPreferences(): AnatomyPreferences {
  return {
    version: 1, system: 'skeletal', labels: false, xray: false,
    systems: { skeletal: true, muscular: true, circulatory: true, respiratory: true, digestive: true, nervous: true, urinary: true, reproductive: true, endocrine: true, lymphatic: true, integumentary: true },
    layers: { skin: false, muscles: true, skeleton: true, organs: true, vessels: true, nerves: true },
    vessels: { arteries: true, veins: true, coronary: true, major: true },
  }
}
function isPreferences(value: unknown): value is AnatomyPreferences {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return false
  if (!('system' in value) || !(value.system === 'all' || anatomySystems.some((item) => item.id === value.system))) return false
  if (!('labels' in value) || typeof value.labels !== 'boolean' || !('xray' in value) || typeof value.xray !== 'boolean') return false
  if (!('systems' in value) || !('layers' in value) || !('vessels' in value)) return false
  const booleanMap = (map: unknown, keys: string[]) => !!map && typeof map === 'object' && keys.every((key) => typeof Reflect.get(map, key) === 'boolean')
  return booleanMap(value.systems, anatomySystems.map((item) => item.id)) && booleanMap(value.layers, anatomyLayers.map((item) => item.id)) && booleanMap(value.vessels, ['arteries', 'veins', 'coronary', 'major'])
}
export function loadAnatomyPreferences(): AnatomyPreferences {
  try { const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return isPreferences(value) ? value : defaultAnatomyPreferences() } catch { return defaultAnatomyPreferences() }
}
export function saveAnatomyPreferences(value: AnatomyPreferences) { try { localStorage.setItem(KEY, JSON.stringify(value)) } catch { /* The viewer remains usable without storage. */ } }
export function isStructureVisible(item: AnatomyStructure, state: AnatomySceneState): boolean {
  return (state.system === 'all' || state.system === item.system) && state.systems[item.system] && state.layers[item.layer]
    && !state.hiddenIds.includes(item.id) && (!state.isolatedId || state.isolatedId === item.id)
    && (!item.vessel || (state.vessels[item.vessel.type] && state.vessels[item.vessel.group]))
}
export function revealStructure(state: AnatomySceneState, id: string): AnatomySceneState {
  const item = anatomyById.get(id)
  if (!item) return state
  return { ...state, selectedId: id, system: item.system,
    isolatedId: null, hiddenIds: state.hiddenIds.filter((hidden) => hidden !== id),
    systems: { ...state.systems, [item.system]: true }, layers: { ...state.layers, [item.layer]: true },
    vessels: item.vessel ? { ...state.vessels, [item.vessel.type]: true, [item.vessel.group]: true } : state.vessels,
  }
}
