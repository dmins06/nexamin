import { Component, Suspense, useEffect, useMemo, useRef, useState, type ElementRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls, useGLTF, useProgress } from '@react-three/drei'
import { Box3, Material, Mesh, MeshStandardMaterial, PerspectiveCamera, Plane, Spherical, Vector3 } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { anatomyById, anatomyStructures, anatomySystems } from './anatomyData'
import { isStructureVisible } from './anatomyState'
import { anatomyFocusDistance, clippingPlanes, resolveStructureId, structureColor } from './anatomyScene'
import { AnatomyLabels, type AnatomyAnchor } from './AnatomyLabels'
import type { AnatomyModel, AnatomySceneState, AnatomyViewerProps, CameraCommand } from './anatomyTypes'

// Retry helper intentionally shares the lazy viewer chunk: importing it must not eagerly load Three.js.
// eslint-disable-next-line react-refresh/only-export-components
export function clearModelCache(models: AnatomyModel[]) { models.forEach((model) => useGLTF.clear(model.url)) }
interface AnatomyBounds extends AnatomyAnchor { radius: number }
function CameraRig({ command, focus }: { command: CameraCommand; focus?: AnatomyBounds }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)
  const { camera, invalidate } = useThree()
  const destination = useRef<{ target: Vector3; position: Vector3 } | null>(null)
  useEffect(() => {
    const orbit = controls.current
    if (!orbit) return
    const offset = camera.position.clone().sub(orbit.target)
    const action = command.action
    destination.current = null
    if (action === 'reset') { camera.position.set(0, 0.1, 6.3); orbit.target.set(0, 0.1, 0) }
    else if (action.startsWith('zoom-')) camera.position.copy(orbit.target).add(offset.multiplyScalar(action === 'zoom-in' ? 0.8 : 1.25).clampLength(0.15, 14))
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
  useEffect(() => {
    if (!focus || !controls.current) return
    const target = new Vector3(...focus.position)
    const direction = camera.position.clone().sub(controls.current.target).normalize()
    const fov = camera instanceof PerspectiveCamera ? camera.fov : 42
    const distance = anatomyFocusDistance(focus.radius, fov, camera instanceof PerspectiveCamera ? camera.aspect : 1)
    const position = target.clone().addScaledVector(direction, distance)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      destination.current = null; controls.current.target.copy(target); camera.position.copy(position); controls.current.update()
    } else destination.current = { target, position }
    invalidate()
  }, [camera, focus, invalidate])
  useFrame(() => {
    const orbit = controls.current, next = destination.current
    if (!orbit || !next) return
    orbit.target.lerp(next.target, 0.24); camera.position.lerp(next.position, 0.24)
    orbit.update()
    if (orbit.target.distanceTo(next.target) + camera.position.distanceTo(next.position) < 0.008) destination.current = null
    else invalidate()
  })
  return <OrbitControls ref={controls} makeDefault enableDamping={false} minDistance={0.15} maxDistance={14} />
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
  return <>{anatomyStructures.flatMap((item) => { const demo = item.demo; if (!demo || !isStructureVisible(item, state)) return []; return <mesh key={item.id} name={item.id} position={demo.position} rotation={demo.rotation} scale={demo.scale} onClick={(event) => choose(event, item.id, planes, onSelect)}>
    {demo.shape === 'sphere' ? <sphereGeometry args={[1, 24, 16]} /> : demo.shape === 'cylinder' ? <cylinderGeometry args={[1, 1, 1, 16]} /> : <boxGeometry args={[1, 1, 1]} />}
    <meshStandardMaterial color={structureColor(item)} emissive={state.selectedId === item.id ? '#30c7de' : '#000000'} emissiveIntensity={state.selectedId === item.id ? 0.65 : 0} transparent={state.xray} opacity={state.xray && state.selectedId !== item.id ? 0.2 : 1} depthWrite={!state.xray || state.selectedId === item.id} roughness={0.65} wireframe={item.id === 'skin' || item.id === 'skull'} clippingPlanes={planes} />
  </mesh> })}</>
}
interface ModelProps { model: AnatomyModel; state: AnatomySceneState; planes: Plane[]; onSelect: AnatomyViewerProps['onSelect']; onAnchors: (modelId: string, anchors: AnatomyBounds[]) => void }
function ModelScene({ model, state, planes, onSelect, onAnchors }: ModelProps) {
  // GLTF's immutable geometries and textures stay cached; only the owned scene/materials are disposed.
  // Drei bundles MeshoptDecoder locally: no Draco CDN or third-party runtime.
  const gltf = useGLTF(model.url, false, true)
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
    const anchors: AnatomyBounds[] = Array.from(boxes, ([id, box]) => { const center = box.getCenter(new Vector3()); return { id, position: [center.x, center.y, center.z], radius: box.getSize(new Vector3()).length() / 2 } })
    onAnchors(model.id, anchors)
    return () => onAnchors(model.id, [])
  }, [entries, model.id, onAnchors, scene])
  useEffect(() => {
    entries.forEach(({ mesh, id, materials }) => {
      const item = anatomyById.get(id)
      mesh.visible = !!item && isStructureVisible(item, state)
      materials.forEach((material) => {
        const outer = item?.layer === 'skin' || item?.layer === 'muscles' || item?.layer === 'skeleton'
        material.clippingPlanes = planes; material.transparent = state.xray; material.opacity = state.xray && id !== state.selectedId ? outer ? 0.18 : 0.92 : 1; material.depthWrite = !state.xray || !outer || id === state.selectedId
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
class ModelBoundary extends Component<{ id: string; onFailure: (id: string) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure(this.props.id) }
  render() { return this.state.failed ? null : this.props.children }
}
function ModelLoading({ id }: { id: string }) {
  const { progress } = useProgress()
  const label = anatomySystems.find((system) => system.id === id)?.label ?? id
  return <Html center className="anatomy-model-loading"><span role="status">Đang tải {label} · {Math.round(progress)}%</span></Html>
}
function Scene({ state, models, command, onSelect, onContextLost, onModelFailure }: AnatomyViewerProps) {
  const planes = useMemo(() => clippingPlanes(state.section), [state.section])
  const [modelAnchors, setModelAnchors] = useState<Record<string, AnatomyBounds[]>>({})
  const [onAnchors] = useState(() => (id: string, anchors: AnatomyBounds[]) => setModelAnchors((previous) => ({ ...previous, [id]: anchors })))
  const anchors = models.length ? Object.values(modelAnchors).flat() : anatomyStructures.flatMap((item) => item.demo ? [{ id: item.id, position: item.demo.position }] : [])
  const focusId = state.selectedId ?? state.isolatedId
  const visibleBoundsKey = Object.values(modelAnchors).flat().filter((anchor) => { const item = anatomyById.get(anchor.id); return item && isStructureVisible(item, state) }).map((anchor) => anchor.id).sort().join('|')
  const overview = useMemo(() => {
    // Localized systems would be almost invisible at the whole-body camera.
    // Fit their actual mesh bounds; keep the incumbent overview for other groups.
    if (!['endocrine', 'reproductive', 'urinary', 'lymphatic'].includes(state.system)) return undefined
    const visibleIds = new Set(visibleBoundsKey.split('|'))
    const visible = Object.values(modelAnchors).flat().filter((anchor) => visibleIds.has(anchor.id))
    if (!visible.length) return undefined
    const box = new Box3()
    for (const anchor of visible) {
      const center = new Vector3(...anchor.position), extent = new Vector3().setScalar(anchor.radius)
      box.expandByPoint(center.clone().sub(extent)); box.expandByPoint(center.add(extent))
    }
    const center = box.getCenter(new Vector3())
    const position: AnatomyBounds['position'] = [center.x, center.y, center.z]
    return { id: state.system, position, radius: box.getSize(new Vector3()).length() / 2 }
  }, [modelAnchors, state.system, visibleBoundsKey])
  const focus = focusId ? Object.values(modelAnchors).flat().find((anchor) => anchor.id === focusId) : overview
  const visibleAnchors = Array.from(new Map(anchors.filter((anchor) => { const item = anatomyById.get(anchor.id); return item && isStructureVisible(item, state) }).map((anchor) => [anchor.id, anchor])).values())
  const activeModels = models.filter((model) => model.structureIds.some((id) => { const item = anatomyById.get(id); return item && isStructureVisible(item, state) }))
  return <><ambientLight intensity={1.15} /><directionalLight position={[4, 5, 6]} intensity={2.2} /><directionalLight position={[-3, 1, -3]} intensity={1} color="#84c9e3" /><CameraRig command={command} focus={focus} /><ContextMonitor onLost={onContextLost} />
    {models.length ? activeModels.map((model) => <ModelBoundary key={model.id} id={model.id} onFailure={onModelFailure ?? (() => undefined)}><Suspense fallback={<ModelLoading id={model.id} />}><ModelScene model={model} state={state} planes={planes} onSelect={onSelect} onAnchors={onAnchors} /></Suspense></ModelBoundary>) : <DemoScene state={state} planes={planes} onSelect={onSelect} />}
    {state.labels && <AnatomyLabels anchors={visibleAnchors} selectedId={state.selectedId} planes={planes} onSelect={onSelect} />}
  </>
}
export default function AnatomyViewer(props: AnatomyViewerProps) {
  return <Canvas camera={{ position: [0, 0.1, 6.3], fov: 42, near: 0.05, far: 100 }} dpr={[1, 1.5]} frameloop="demand" gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} onCreated={({ gl }) => { gl.localClippingEnabled = true }} onPointerMissed={() => props.onSelect(null)} fallback={<p>Trình duyệt chưa hỗ trợ canvas. Hãy mở bằng trình duyệt hỗ trợ WebGL.</p>}><Scene {...props} /></Canvas>
}
