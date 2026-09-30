import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Plane, Vector3 } from 'three'
import { anatomyById } from './anatomyData'
import type { VectorTuple } from './anatomyTypes'

export interface AnatomyAnchor { id: string; position: VectorTuple }
interface LabelPosition { id: string; x: number; y: number; anchorX: number; anchorY: number; right: boolean; height: number }
export function AnatomyLabels({ anchors, selectedId, planes, onSelect }: { anchors: AnatomyAnchor[]; selectedId: string | null; planes: Plane[]; onSelect: (id: string) => void }) {
  const [positions, setPositions] = useState<LabelPosition[]>([])
  const lastSignature = useRef('')
  // Demand rendering already limits work. Skipping its last frame leaves labels stale after pan/reset.
  useFrame(({ camera, size }) => {
    const limit = camera.position.length() < 5 ? 12 : 6
    const height = window.matchMedia('(max-width: 760px)').matches ? 44 : 26
    const candidates = anchors.flatMap((anchor) => {
      const point = new Vector3(...anchor.position)
      if (planes.some((plane) => plane.distanceToPoint(point) < 0)) return []
      point.project(camera)
      if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 0.92) return []
      return [{ id: anchor.id, anchorX: Math.round((point.x + 1) * size.width / 2), anchorY: Math.round((1 - point.y) * size.height / 2) }]
    }).sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId)).slice(0, limit).sort((a, b) => a.anchorY - b.anchorY)
    const lanes = [12, 12]
    const next: LabelPosition[] = []
    candidates.forEach((label, index) => {
      const right = index % 2 === 1
      const lane = Number(right)
      const y = Math.max(lanes[lane] ?? 12, Math.min(size.height - height - 18, label.anchorY))
      if (y > size.height - height - 10) return
      lanes[lane] = y + height + 8
      next.push({ ...label, x: right ? size.width - 8 : 8, y, right, height })
    })
    const signature = JSON.stringify(next)
    if (signature !== lastSignature.current) { lastSignature.current = signature; setPositions(next) }
  })
  return <Html fullscreen calculatePosition={(_object, _camera, size) => [size.width / 2, size.height / 2]} className="anatomy-label-root" style={{ pointerEvents: 'none' }} zIndexRange={[2, 1]}><svg className="anatomy-leader-lines" aria-hidden="true">{positions.map((label) => <line key={label.id} x1={label.anchorX} y1={label.anchorY} x2={label.right ? label.x - 104 : label.x + 104} y2={label.y + label.height / 2} />)}</svg>{positions.map((label) => <button key={label.id} className="anatomy-label" style={{ left: label.x, top: label.y, transform: label.right ? 'translateX(-100%)' : undefined }} title={anatomyById.get(label.id)?.nameVi} aria-pressed={label.id === selectedId} onClick={(event) => { event.stopPropagation(); onSelect(label.id) }}><span>{anatomyById.get(label.id)?.nameVi}</span></button>)}</Html>
}
