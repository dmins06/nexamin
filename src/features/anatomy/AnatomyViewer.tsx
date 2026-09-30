import { useEffect, useMemo, useRef, useState, type ElementRef } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Material, Mesh, MeshStandardMaterial, Plane, Spherical, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { anatomyById, anatomyStructures } from './anatomyData'
import { isStructureVisible } from './anatomyState'
import { clippingPlanes, resolveStructureId, structureColor } from './anatomyScene'
import { AnatomyLabels, type AnatomyAnchor } from './AnatomyLabels'
import type { AnatomyModel, AnatomySceneState, AnatomyViewerProps, CameraCommand } from './anatomyTypes'

// Retry helper intentionally shares the lazy viewer chunk: importing it must not eagerly load Three.js.
// eslint-disable-next-line react-refresh/only-export-components
export function clearModelCache(models: AnatomyModel[]) { models.forEach((model) => useGLTF.clear(model.url)) }
function CameraRig({ command }: { command: CameraCommand }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)
  const { camera, invalidate } = useThree()
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    const offset = camera.position.clone().sub(orbit.target)
    const action = command.action
    if (action === 'reset') { camera.position.set(0, 0.1, 7.5); orbit.target.set(0, 0.1, 0) }
    else if (action.startsWith('zoom-')) camera.position.copy(orbit.target).add(offset.multiplyScalar(action === 'zoom-in' ? 0.8 : 1.25).clampLength(1.1, 14))
    else if (action.startsWith('pan-')) {
      const vector = new Vector3().setFromMatrixColumn(camera.matrix, action === 'pan-left' || action === 'pan-right' ? 0 : 1).multiplyScalar(action === 'pan-left' || action === 'pan-down' ? -0.2 : 0.2)
      orbit.target.add(vector); camera.position.add(vector)
    } else {
      const spherical = new Spherical().setFromVector3(offset)
      if (action === 'left') spherical.theta += 0.18
      if (action === 'right') spherical.theta -= 0.18
      if (action === 'up') spherical.phi -= 0.18
      if (action === 'down') spherical.phi += 0.18
      spherical.makeSafe(); camera.position.copy(orbit.target).add(new Vector3().setFromSpherical(spherical))
    }
    orbit.update(); invalidate()
  }, [camera, command, invalidate])
  return <OrbitControls ref={controls} makeDefault enableDamping={false} minDistance={1.1} maxDistance={14} />
}
function ContextMonitor({ onLost }: { onLost: () => void }) {
  const { gl } = useThree()
  useEffect(() => { const canvas = gl.domElement; const handler = (event: Event) => { event.preventDefault(); onLost() }; canvas.addEventListener('webglcontextlost', handler); return () => canvas.removeEventListener('webglcontextlost', handler) }, [gl, onLost])
  return null
}
function choose(event: ThreeEvent<MouseEvent>, id: string, planes: Plane[], onSelect: AnatomyViewerProps['onSelect']) {
  if (planes.some((plane) => plane.distanceToPoint(event.point) < 0)) return
  event.stopPropagation(); onSelect(id)
}
function DemoScene({ state, planes, onSelect }: { state: AnatomySceneState; planes: Plane[]; onSelect: AnatomyViewerProps['onSelect'] }) {
  return <>{anatomyStructures.filter((item) => isStructureVisible(item, state)).map((item) => <mesh key={item.id} name={item.id} position={item.demo.position} rotation={item.demo.rotation} scale={item.demo.scale} onClick={(event) => choose(event, item.id, planes, onSelect)}>
    {item.demo.shape === 'sphere' ? <sphereGeometry args={[1, 24, 16]} /> : item.demo.shape === 'cylinder' ? <cylinderGeometry args={[1, 1, 1, 16]} /> : <boxGeometry args={[1, 1, 1]} />}
    <meshStandardMaterial color={structureColor(item)} emissive={state.selectedId === item.id ? '#30c7de' : '#000000'} emissiveIntensity={state.selectedId === item.id ? 0.65 : 0} transparent={state.xray} opacity={state.xray && state.selectedId !== item.id ? 0.2 : 1} depthWrite={!state.xray || state.selectedId === item.id} roughness={0.65} wireframe={item.id === 'skin' || item.id === 'skull'} clippingPlanes={planes} />
  </mesh>)}</>
}
interface ModelProps { model: AnatomyModel; state: AnatomySceneState; planes: Plane[]; onSelect: AnatomyViewerProps['onSelect']; onAnchors: (modelId: string, anchors: AnatomyAnchor[]) => void }
function ModelScene({ model, state, planes, onSelect, onAnchors }: ModelProps) {
  // GLTF's immutable geometries and textures stay cached; only the owned scene/materials are disposed.
  // Uncompressed/self-contained GLBs are the baseline. Compression decoders can be self-hosted later.
  const gltf = useGLTF(model.url, false)
  const { scene, entries, ownedMaterials } = useMemo(() => {
    const scene = clone(gltf.scene)
    scene.scale.multiplyScalar(model.scale); scene.position.add(new Vector3(...model.position))
    const entries: Array<{ mesh: Mesh; id: string; materials: Material[] }> = []
    const ownedMaterials: Material[] = []
    scene.traverse((object) => {
      if (!(object instanceof Mesh)) return
      const id = resolveStructureId(object)
      if (!id) { object.visible = false; return }
      const original = Array.isArray(object.material) ? object.material : [object.material]
      const materials = original.map((material) => material.clone())
      object.material = Array.isArray(object.material) ? materials : materials[0]
      ownedMaterials.push(...materials); entries.push({ mesh: object, id, materials })
    })
    return { scene, entries, ownedMaterials }
  }, [gltf.scene, model])
  const { invalidate } = useThree()
  useEffect(() => () => ownedMaterials.forEach((material) => material.dispose()), [ownedMaterials])
  useEffect(() => {
    scene.updateMatrixWorld(true)
    const boxes = new Map<string, Box3>()
    entries.forEach(({ mesh, id }) => { const box = new Box3().setFromObject(mesh); boxes.set(id, boxes.get(id)?.union(box) ?? box) })
    const anchors: AnatomyAnchor[] = Array.from(boxes, ([id, box]) => { const center = box.getCenter(new Vector3()); return { id, position: [center.x, center.y, center.z] } })
    onAnchors(model.id, anchors)
    return () => onAnchors(model.id, [])
  }, [entries, model.id, onAnchors, scene])
  useEffect(() => {
    entries.forEach(({ mesh, id, materials }) => {
      const item = anatomyById.get(id)
      mesh.visible = !!item && isStructureVisible(item, state)
      materials.forEach((material) => {
        material.clippingPlanes = planes; material.transparent = state.xray; material.opacity = state.xray && id !== state.selectedId ? 0.2 : 1; material.depthWrite = !state.xray || id === state.selectedId
        if (material instanceof MeshStandardMaterial) {
          if (item?.vessel) material.color.set(structureColor(item))
          material.emissive.set(id === state.selectedId ? '#30c7de' : '#000000'); material.emissiveIntensity = id === state.selectedId ? 0.65 : 0
        }
        material.needsUpdate = true
      })
    }); invalidate()
  }, [entries, invalidate, planes, state])
  if (!entries.length) throw new Error(`Không có đối tượng được ánh xạ trong mô hình ${model.id}.`)
  return <primitive object={scene} dispose={null} onClick={(event: ThreeEvent<MouseEvent>) => { const id = resolveStructureId(event.object); if (id) choose(event, id, planes, onSelect) }} />
}
function Scene({ state, models, command, onSelect, onContextLost }: AnatomyViewerProps) {
  const planes = useMemo(() => clippingPlanes(state.section), [state.section])
  const [modelAnchors, setModelAnchors] = useState<Record<string, AnatomyAnchor[]>>({})
  const [onAnchors] = useState(() => (id: string, anchors: AnatomyAnchor[]) => setModelAnchors((previous) => ({ ...previous, [id]: anchors })))
  const anchors = models.length ? Object.values(modelAnchors).flat() : anatomyStructures.map((item) => ({ id: item.id, position: item.demo.position }))
  const visibleAnchors = Array.from(new Map(anchors.filter((anchor) => { const item = anatomyById.get(anchor.id); return item && isStructureVisible(item, state) }).map((anchor) => [anchor.id, anchor])).values())
  return <><ambientLight intensity={1.15} /><directionalLight position={[4, 5, 6]} intensity={2.2} /><directionalLight position={[-3, 1, -3]} intensity={1} color="#84c9e3" /><CameraRig command={command} /><ContextMonitor onLost={onContextLost} />
    {models.length ? models.map((model) => <ModelScene key={model.id} model={model} state={state} planes={planes} onSelect={onSelect} onAnchors={onAnchors} />) : <DemoScene state={state} planes={planes} onSelect={onSelect} />}
    {state.labels && <AnatomyLabels anchors={visibleAnchors} selectedId={state.selectedId} planes={planes} onSelect={onSelect} />}
  </>
}
export default function AnatomyViewer(props: AnatomyViewerProps) {
  return <Canvas camera={{ position: [0, 0.1, 7.5], fov: 42, near: 0.05, far: 100 }} dpr={[1, 1.5]} frameloop="demand" gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} onCreated={({ gl }) => { gl.localClippingEnabled = true }} onPointerMissed={() => props.onSelect(null)} fallback={<p>Trình duyệt chưa hỗ trợ canvas. Hãy mở bằng trình duyệt hỗ trợ WebGL.</p>}><Scene {...props} /></Canvas>
}
