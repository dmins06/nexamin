export type AnatomySystem = 'skeletal' | 'muscular' | 'circulatory' | 'respiratory' | 'digestive' | 'nervous' | 'urinary' | 'reproductive' | 'endocrine' | 'lymphatic' | 'integumentary'
export type AnatomyLayer = 'skin' | 'muscles' | 'skeleton' | 'organs' | 'vessels' | 'nerves'
export type SectionAxis = 'off' | 'sagittal' | 'coronal' | 'axial'
export type VectorTuple = [number, number, number]
export type VesselFilter = 'arteries' | 'veins' | 'coronary' | 'major'

export interface AnatomyStructure {
  id: string
  nameVi: string
  nameEn: string
  latinName?: string
  system: AnatomySystem
  layer: AnatomyLayer
  location: string
  function: string
  relatedStructures: string[]
  modelObjectNames: string[]
  source: string
  vessel?: { type: 'arteries' | 'veins'; group: 'coronary' | 'major' }
  demo: { shape: 'sphere' | 'box' | 'cylinder'; position: VectorTuple; scale: VectorTuple; rotation?: VectorTuple }
}

export interface AnatomyPreferences {
  version: 1
  system: AnatomySystem | 'all'
  systems: Record<AnatomySystem, boolean>
  layers: Record<AnatomyLayer, boolean>
  vessels: Record<VesselFilter, boolean>
  labels: boolean
  xray: boolean
}

export interface AnatomySceneState extends AnatomyPreferences {
  selectedId: string | null
  hiddenIds: string[]
  isolatedId: string | null
  section: { axis: SectionAxis; position: number }
}

export interface AnatomyModel {
  id: string
  url: string
  license: string
  attribution: string
  scale: number
  position: VectorTuple
}

export interface AnatomyManifest { version: 1; models: AnatomyModel[] }
export type CameraAction = 'reset' | 'zoom-in' | 'zoom-out' | 'left' | 'right' | 'up' | 'down' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down'
export interface CameraCommand { action: CameraAction; sequence: number }
export interface AnatomyViewerProps {
  state: AnatomySceneState
  models: AnatomyModel[]
  command: CameraCommand
  onSelect: (id: string | null) => void
  onContextLost: () => void
}

// A future quiz can consume the same entity selection without depending on WebGL.
export interface AnatomyLearningPrompt { structureId: string; question: string; revealAnswer: boolean }
