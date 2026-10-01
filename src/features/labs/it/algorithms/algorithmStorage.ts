import { algorithms } from './algorithmRegistry'
import type { AlgorithmId } from './algorithmTypes'
export interface AlgorithmPreferences {
  version: 1
  algorithm: AlgorithmId
  values: string
  target: string
  edges: string
  nodeCount: number
  start: number
  directed: boolean
  speed: number
}
export const algorithmKey = 'nexamin.it.algorithms.v1'
export function defaultAlgorithmPreferences(): AlgorithmPreferences {
  return {
    version: 1,
    algorithm: 'bubble',
    values: '5, 2, 8, 1, 4',
    target: '4',
    edges: '0 1 4\n0 2 1\n2 1 2\n1 3 1\n2 4 5\n3 4 3',
    nodeCount: 5,
    start: 0,
    directed: false,
    speed: 1,
  }
}
export function loadAlgorithmPreferences(): AlgorithmPreferences {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(algorithmKey) ?? 'null')
    if (!v || typeof v !== 'object' || !('version' in v) || v.version !== 1)
      return defaultAlgorithmPreferences()
    const defaults = defaultAlgorithmPreferences()
    return {
      ...defaults,
      ...('algorithm' in v
        ? {
            algorithm:
              algorithms.find((a) => a.id === v.algorithm)?.id ??
              defaults.algorithm,
          }
        : {}),
      values:
        'values' in v && typeof v.values === 'string'
          ? v.values.slice(0, 300)
          : defaults.values,
      target:
        'target' in v && typeof v.target === 'string'
          ? v.target.slice(0, 8)
          : defaults.target,
      edges:
        'edges' in v && typeof v.edges === 'string'
          ? v.edges.slice(0, 2000)
          : defaults.edges,
      nodeCount:
        'nodeCount' in v &&
        typeof v.nodeCount === 'number' &&
        Number.isInteger(v.nodeCount) &&
        v.nodeCount >= 2 &&
        v.nodeCount <= 10
          ? v.nodeCount
          : defaults.nodeCount,
      start:
        'start' in v &&
        typeof v.start === 'number' &&
        Number.isInteger(v.start) &&
        v.start >= 0 &&
        v.start < 10
          ? v.start
          : 0,
      directed: 'directed' in v && v.directed === true,
      speed:
        'speed' in v && [0.5, 1, 2].includes(Number(v.speed))
          ? Number(v.speed)
          : 1,
    }
  } catch {
    return defaultAlgorithmPreferences()
  }
}
export function saveAlgorithmPreferences(v: AlgorithmPreferences) {
  try {
    localStorage.setItem(algorithmKey, JSON.stringify(v))
  } catch {
    /* Optional persistence. */
  }
}
