// Rebuild the small, named GLBs from the official BodyParts3D 4.0 archives.
// See docs/anatomy-assets.md for source URLs, attribution, and license history.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Scene, Uint32BufferAttribute } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { MeshoptSimplifier } from 'meshoptimizer'
import { compressGlb } from './anatomy-glb-codec.mjs'

const sourceDir = '.cache/anatomy-source'
const outputDir = 'public/models/anatomy'
const trees = {
  partof: { zip: join(sourceDir, 'partof_BP3D_4.0_obj_99.zip'), names: join(sourceDir, 'partof_parts_list_e.txt'), parts: join(sourceDir, 'partof_element_parts.txt') },
  isa: { zip: join(sourceDir, 'isa_BP3D_4.0_obj_99.zip'), names: join(sourceDir, 'isa_parts_list_e.txt'), parts: join(sourceDir, 'isa_element_parts.txt') },
}
const entries = [
  { id: 'aorta', group: 'circulatory', fma: ['partof:FMA3734'] },
  { id: 'superior-vena-cava', group: 'circulatory', fma: ['partof:FMA4720'] },
  { id: 'inferior-vena-cava', group: 'circulatory', fma: ['partof:FMA10951'] },
  { id: 'pulmonary-artery', group: 'circulatory', fma: ['partof:FMA50872', 'partof:FMA50873'] },
  { id: 'pulmonary-vein', group: 'circulatory', fma: ['partof:FMA49911', 'partof:FMA49913', 'partof:FMA49914', 'partof:FMA49916'] },
  { id: 'carotid-artery', group: 'circulatory', fma: ['partof:FMA3941', 'partof:FMA4058'] },
  { id: 'radial-artery', group: 'circulatory', fma: ['partof:FMA22733', 'partof:FMA22734'] },
  { id: 'femoral-artery', group: 'circulatory', fma: ['partof:FMA70249', 'partof:FMA70250'] },
  { id: 'coronary-arteries', group: 'circulatory', fma: ['partof:FMA3802', 'partof:FMA3855'] },
  { id: 'coronary-veins', group: 'circulatory', fma: ['partof:FMA4707', 'partof:FMA4713'] },
  { id: 'heart', group: 'circulatory', fma: ['partof:FMA7088'] },
  { id: 'skull', group: 'skeletal', fma: ['partof:FMA46565'] },
  { id: 'spine', group: 'skeletal', fma: ['partof:FMA13478'] },
  { id: 'femur', group: 'skeletal', fma: ['partof:FMA24474', 'partof:FMA24475'] },
  { id: 'rib-cage', group: 'skeletal', fma: ['partof:FMA7480'] },
  { id: 'pelvis', group: 'skeletal', fma: ['partof:FMA9578'] },
  { id: 'humerus', group: 'skeletal', fma: ['partof:FMA23130', 'partof:FMA23131'] },
  { id: 'forearm-bones', group: 'skeletal', fma: ['partof:FMA23464', 'partof:FMA23465', 'partof:FMA23467', 'partof:FMA23468'] },
  { id: 'lower-leg-bones', group: 'skeletal', fma: ['partof:FMA24477', 'partof:FMA24478', 'partof:FMA24480', 'partof:FMA24481'] },
  { id: 'biceps', group: 'muscular', fma: ['isa:FMA37684', 'isa:FMA37685', 'isa:FMA37686', 'isa:FMA37687'] },
  { id: 'deltoid', group: 'muscular', fma: ['isa:FMA34680', 'isa:FMA34681', 'isa:FMA34682', 'isa:FMA34683', 'isa:FMA34684', 'isa:FMA34685'] },
  { id: 'pectoralis-major', group: 'muscular', fma: ['isa:FMA34690', 'isa:FMA34691', 'isa:FMA79979', 'isa:FMA79980', 'isa:FMA45874', 'isa:FMA45875'] },
  { id: 'quadriceps', group: 'muscular', fma: ['isa:FMA38928', 'isa:FMA38929', 'isa:FMA38930', 'isa:FMA38931', 'isa:FMA38932', 'isa:FMA38933'] },
  { id: 'lungs', group: 'respiratory', fma: ['partof:FMA7309', 'partof:FMA7310'] },
  { id: 'liver', group: 'digestive', fma: ['partof:FMA7197'] },
  { id: 'stomach', group: 'digestive', fma: ['partof:FMA7148'] },
  { id: 'small-intestine', group: 'digestive', fma: ['partof:FMA7200'] },
  { id: 'large-intestine', group: 'digestive', fma: ['partof:FMA7201'] },
  { id: 'brain', group: 'nervous', fma: ['partof:FMA50801'] },
  { id: 'spinal-cord', group: 'nervous', fma: ['partof:FMA7647'] },
  { id: 'kidneys', group: 'urinary', fma: ['partof:FMA7204', 'partof:FMA7205'] },
  { id: 'bladder', group: 'urinary', fma: ['partof:FMA15900'] },
  { id: 'spleen', group: 'lymphatic', fma: ['isa:FMA7196'] },
  { id: 'skin', group: 'integumentary', fma: ['partof:FMA7163'] },
]
const expansion = JSON.parse(readFileSync('src/features/anatomy/anatomyExpansion.json', 'utf8'))
// Claim specifically selectable concepts before the broad residual skeleton.
// Other additions also precede their parent meshes to avoid hidden duplicates.
entries.unshift(...expansion.map(({ id, group, fma }) => ({ id, group, fma })))
const colors = { skeletal: '#e6dfca', muscular: '#bc6259', circulatory: '#d17367', respiratory: '#c7879b', digestive: '#c99464', nervous: '#e4c773', urinary: '#ab83b1', lymphatic: '#aa8a61', integumentary: '#c89477', endocrine: '#c99d64', reproductive: '#b887a6' }
const simplification = { skull: 0.6, spine: 0.6, 'rib-cage': 0.5, 'other-bones': 0.65, liver: 0.6, 'large-intestine': 0.7, skin: 0.55 }
const metadata = Object.fromEntries(Object.entries(trees).map(([tree, config]) => {
  const names = new Map(readFileSync(config.names, 'utf8').trim().split(/\r?\n/).slice(1).map((line) => { const [id, , name] = line.split('\t'); return [id, name] }))
  const parts = new Map()
  for (const line of readFileSync(config.parts, 'utf8').trim().split(/\r?\n/).slice(1)) {
    const [id, , fileId] = line.split('\t')
    if (!parts.has(id)) parts.set(id, [])
    parts.get(id).push(fileId)
  }
  return [tree, { names, parts }]
}))
// Complete distal skeleton from the publisher's English FMA table. These are
// explicit, inspectable source concepts, not guessed OBJ filenames or shapes.
function matchingPartOf(regex) {
  return Array.from(metadata.partof.names, ([id, name]) => ({ id, name }))
    .filter(({ id, name }) => regex.test(name) && metadata.partof.parts.has(id))
    .map(({ id }) => `partof:${id}`)
}
const handSources = matchingPartOf(/(?:phalanx of .* (?:finger|thumb)|metacarpal bone|skeleton of .* hand proper|(?:right|left) (?:scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate))/i)
const footSources = matchingPartOf(/(?:phalanx of .* toe|metatarsal bone|(?:right|left) (?:talus|calcaneus|cuboid bone|.*cuneiform bone)|navicular bone of .* foot)/i)
if (handSources.length < 50 || footSources.length < 50) throw new Error('Incomplete hand/foot source concepts')
entries.splice(entries.findIndex((entry) => entry.id === 'biceps'), 0,
  { id: 'hand-bones', group: 'skeletal', fma: handSources },
  { id: 'foot-bones', group: 'skeletal', fma: footSources })
const seen = new Set()
const selected = entries.map((entry) => {
  const files = []
  for (const source of entry.fma) {
    const [tree, id] = source.split(':')
    const data = metadata[tree]
    if (!data?.names.has(id) || !data.parts.has(id)) throw new Error(`Missing source concept ${source} for ${entry.id}`)
    for (const fileId of data.parts.get(id)) {
      const key = `${tree}:${fileId}`
      if (seen.has(key)) continue
      seen.add(key)
      files.push({ tree, fileId, concept: id, sourceName: data.names.get(id) })
    }
  }
  if (!files.length) throw new Error(`No unique source mesh for ${entry.id}`)
  return { ...entry, files }
})

if (process.argv.includes('--inspect')) {
  for (const entry of selected) console.log(`${entry.group}\t${entry.id}\t${entry.files.length} source meshes\t${entry.fma.join(', ')}`)
  process.exit(0)
}

// GLTFExporter uses FileReader for its final Blob even when there are no images.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((buffer) => { this.result = buffer; this.onloadend?.() }) }
}
function sourceObj({ tree, fileId }) {
  const archive = trees[tree]
  const name = `${tree}_BP3D_4.0_obj_99/${fileId}.obj`
  const content = execFileSync('unzip', ['-p', archive.zip, name], { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 })
  if (!content.includes(`# File ID : ${fileId}`) || !content.includes('# Concept ID : FMA')) throw new Error(`Source metadata mismatch: ${name}`)
  return content
}
function simplifyPart(positionValues, normalValues, indexValues, ratio) {
  const inputPositions = new Float32Array(positionValues)
  const inputNormals = new Float32Array(normalValues)
  const inputIndices = new Uint32Array(indexValues)
  const target = Math.floor(inputIndices.length * ratio / 3) * 3
  const [reduced] = MeshoptSimplifier.simplify(inputIndices, inputPositions, 3, target, 0.005, ['LockBorder'])
  const [remap, unique] = MeshoptSimplifier.compactMesh(reduced)
  const positions = new Float32Array(unique * 3), normals = new Float32Array(unique * 3)
  for (let old = 0; old < remap.length; old++) {
    const mapped = remap[old]
    if (mapped === 0xffffffff) continue
    positions.set(inputPositions.subarray(old * 3, old * 3 + 3), mapped * 3)
    normals.set(inputNormals.subarray(old * 3, old * 3 + 3), mapped * 3)
  }
  // compactMesh rewrites `reduced` in place. Applying the old-to-new remap a
  // second time would turn valid indices into 0xffffffff for sparse meshes.
  return { positions, normals, indices: reduced }
}
function geometry(files, id) {
  const positions = [], normals = [], indices = [], sourceIds = []
  let originalTriangles = 0, sourceBytes = 0
  for (const file of files) {
    const vertexStart = positions.length / 3, indexStart = indices.length
    const text = sourceObj(file)
    sourceBytes += Buffer.byteLength(text)
    const points = [], sourceNormals = [], vertexMap = new Map()
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      if (!line || line.startsWith('#')) continue
      const [kind, ...values] = line.trim().split(/\s+/)
      if (kind === 'v') points.push(values.map(Number))
      else if (kind === 'vn') sourceNormals.push(values.map(Number))
      else if (kind === 'f') {
        const face = values.map((token) => {
          const [pointId, , normalId] = token.split('/')
          const key = `${pointId}/${normalId}`
          const existing = vertexMap.get(key)
          if (existing !== undefined) return existing
          const point = points[Number(pointId) - 1], normal = sourceNormals[Number(normalId) - 1]
          if (!point || !normal || !point.every(Number.isFinite) || !normal.every(Number.isFinite)) throw new Error(`Invalid face in ${file.fileId}`)
          const index = positions.length / 3
          positions.push(point[0] / 500, (point[2] - 900) / 500, -point[1] / 500)
          normals.push(normal[0], normal[2], -normal[1])
          vertexMap.set(key, index)
          return index
        })
        for (let i = 1; i < face.length - 1; i++) indices.push(face[0], face[i], face[i + 1])
      } else if (!['vt', 'g', 'o', 's', 'usemtl'].includes(kind)) throw new Error(`Unexpected OBJ instruction ${kind} in ${file.fileId}`)
    }
    const partTriangles = (indices.length - indexStart) / 3
    if (!vertexMap.size || !partTriangles) throw new Error(`Empty mesh ${file.fileId}`)
    originalTriangles += partTriangles
    if (simplification[id] && partTriangles > 1000) {
      const part = simplifyPart(positions.slice(vertexStart * 3), normals.slice(vertexStart * 3), indices.slice(indexStart).map((index) => index - vertexStart), simplification[id])
      positions.length = vertexStart * 3; normals.length = vertexStart * 3; indices.length = indexStart
      for (const value of part.positions) positions.push(value)
      for (const value of part.normals) normals.push(value)
      for (const index of part.indices) indices.push(index + vertexStart)
    }
    sourceIds.push(file.fileId)
  }
  const finalPositions = new Float32Array(positions), finalNormals = new Float32Array(normals), finalIndices = new Uint32Array(indices)
  if (finalIndices.some((index) => index >= finalPositions.length / 3)) throw new Error(`Out-of-range vertex index in ${id}`)
  if (simplification[id]) console.log(`${id}: part-preserving simplification ${originalTriangles} → ${finalIndices.length / 3} triangles`)
  const result = new BufferGeometry()
  result.setAttribute('position', new Float32BufferAttribute(finalPositions, 3))
  result.setAttribute('normal', new Float32BufferAttribute(finalNormals, 3))
  result.setIndex(new Uint32BufferAttribute(finalIndices, 1))
  result.computeBoundingBox()
  return { result, sourceIds, vertices: finalPositions.length / 3, triangles: finalIndices.length / 3, originalTriangles, sourceBytes }
}
mkdirSync(outputDir, { recursive: true })
await MeshoptSimplifier.ready
const models = [], report = []
for (const group of [...new Set(selected.map((entry) => entry.group))]) {
  const scene = new Scene()
  let vertices = 0, triangles = 0, originalTriangles = 0, sourceBytes = 0
  const ids = []
  for (const entry of selected.filter((item) => item.group === group)) {
    const { result, sourceIds, vertices: count, triangles: faces, originalTriangles: originalFaces, sourceBytes: sourceSize } = geometry(entry.files, entry.id)
    const mesh = new Mesh(result, new MeshStandardMaterial({ color: colors[group], roughness: 0.82, metalness: 0, side: 2 }))
    mesh.name = entry.id
    mesh.userData = { anatomyId: entry.id, sourceIds, sourceConcepts: entry.fma }
    scene.add(mesh)
    vertices += count; triangles += faces; originalTriangles += originalFaces; sourceBytes += sourceSize; ids.push(entry.id)
    console.log(`${group}/${entry.id}: ${sourceIds.length} OBJ parts, ${count} vertices, ${faces} triangles`)
  }
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true })
  const compressed = await compressGlb(Buffer.from(glb))
  const filename = `${group}.glb`
  writeFileSync(join(outputDir, filename), compressed)
  models.push({ id: group, url: `/models/anatomy/${filename}`, license: 'CC BY 4.0', attribution: 'BodyParts3D, © The Database Center for Life Science', scale: 1, position: [0, 0, 0], structureIds: ids })
  report.push({ group, filename, bytes: compressed.byteLength, uncompressedBytes: glb.byteLength, sourceBytes, vertices, triangles, originalTriangles, structureIds: ids })
}
writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify({ version: 1, models }, null, 2) + '\n')
writeFileSync(join(sourceDir, 'build-report.json'), JSON.stringify(report, null, 2) + '\n')
