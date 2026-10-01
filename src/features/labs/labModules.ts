import type { ComponentType } from 'react'

type LabLoader = () => Promise<{ default: ComponentType }>
// Add future released modules here. Metadata alone never downloads or enables a simulation.
export const labModules: ReadonlyMap<string, LabLoader> = new Map([
  ['anatomy', () => import('../anatomy/AnatomyView').then((module) => ({ default: module.AnatomyView }))],
  ['it', () => import('./it/ITLabHub').then(module => ({default:module.ITLabHub}))],
])
