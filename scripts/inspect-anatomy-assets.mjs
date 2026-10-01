// Validate every shipped anatomy GLB without a GPU or third-party parser.
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const base = 'public/models/anatomy'
const manifest = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf8'))
assert.equal(manifest.version, 1)
assert.ok(manifest.models.length > 0, 'Production must ship real models')
const globalIds = new Set()
const report = []
for (const model of manifest.models) {
  assert.match(model.url, /^\/models\/anatomy\/[a-z-]+\.glb$/)
  const filename = basename(model.url)
  const buffer = readFileSync(join(base, filename))
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, `${filename}: GLB magic`)
  assert.equal(buffer.readUInt32LE(4), 2, `${filename}: glTF version`)
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${filename}: total length`)
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${filename}: JSON chunk`)
  const jsonLength = buffer.readUInt32LE(12)
  const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength))
  assert.equal(gltf.asset.version, '2.0')
  assert.equal(gltf.images?.length ?? 0, 0, `${filename}: no unexpected images`)
  assert.equal(gltf.animations?.length ?? 0, 0, `${filename}: no animations`)
  assert.equal(gltf.cameras?.length ?? 0, 0, `${filename}: no cameras`)
  assert.equal(gltf.extensionsRequired?.length ?? 0, 0, `${filename}: no remote decoder required`)
  assert.equal(gltf.buffers.length, 1, `${filename}: embedded binary only`)
  assert.equal(gltf.buffers[0].uri, undefined, `${filename}: no external buffers`)
  const names = []
  let vertices = 0, triangles = 0
  for (const node of gltf.nodes) {
    if (node.mesh === undefined) continue
    assert.ok(model.structureIds.includes(node.name), `${filename}: unlisted structure ${node.name}`)
    assert.equal(node.extras?.anatomyId, node.name, `${filename}: stable anatomyId`)
    assert.ok(Array.isArray(node.extras?.sourceIds) && node.extras.sourceIds.length, `${filename}: source lineage`)
    assert.ok(Array.isArray(node.extras?.sourceConcepts) && node.extras.sourceConcepts.length, `${filename}: FMA lineage`)
    names.push(node.name)
    for (const primitive of gltf.meshes[node.mesh].primitives) {
      assert.equal(primitive.mode ?? 4, 4, `${filename}: triangles`)
      const position = gltf.accessors[primitive.attributes.POSITION]
      const index = gltf.accessors[primitive.indices]
      assert.equal(position.type, 'VEC3')
      assert.equal(index.type, 'SCALAR')
      assert.ok(index.count % 3 === 0)
      assert.ok(index.min[0] >= 0 && index.max[0] < position.count, `${filename}/${node.name}: index within vertex range`)
      assert.ok(position.min.every(Number.isFinite) && position.max.every(Number.isFinite), `${filename}/${node.name}: finite bounds`)
      vertices += position.count
      triangles += index.count / 3
    }
  }
  assert.deepEqual(names.sort(), [...model.structureIds].sort(), `${filename}: manifest mesh names`)
  for (const id of names) { assert.ok(!globalIds.has(id), `Duplicate anatomy ID ${id}`); globalIds.add(id) }
  report.push({ file: filename, bytes: statSync(join(base, filename)).size, structures: names.length, vertices, triangles })
}
console.table(report)
console.log(`Validated ${report.length} self-contained GLBs and ${globalIds.size} individually selectable structures.`)
