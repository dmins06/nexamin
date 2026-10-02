// Node's test runner; intentionally not a Vitest-discovered *.test file.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compressGlb, decodeViews, readGlb } from './anatomy-glb-codec.mjs'

function fixture() {
  const positions = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer)
  const indices = Buffer.from(new Uint32Array([0, 1, 2]).buffer)
  const gltf = { asset: { version: '2.0' }, buffers: [{ byteLength: 48 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 }, { buffer: 0, byteOffset: 36, byteLength: 12, target: 34963 }], accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5125, count: 3, type: 'SCALAR' }] }
  const json = Buffer.from(JSON.stringify(gltf)), length = (json.length + 3) & ~3
  const buffer = Buffer.alloc(28 + length + 48)
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8)
  buffer.writeUInt32LE(length, 12); buffer.writeUInt32LE(0x4e4f534a, 16)
  buffer.fill(32, 20, 20 + length); json.copy(buffer, 20)
  buffer.writeUInt32LE(48, 20 + length); buffer.writeUInt32LE(0x004e4942, 24 + length)
  positions.copy(buffer, 28 + length); indices.copy(buffer, 64 + length)
  return buffer
}
test('compression preserves every float and index byte with no external resource', async () => {
  const original = fixture(), result = await compressGlb(original), parsed = readGlb(result)
  assert.deepEqual(parsed.gltf.extensionsRequired, ['EXT_meshopt_compression'])
  assert.ok(parsed.gltf.buffers.every((buffer) => buffer.uri === undefined))
  const before = await decodeViews(readGlb(original)), after = await decodeViews(parsed)
  assert.deepEqual(after, before)
})
test('rejects corrupt lengths and unsafe decoder allocations before decoding', async () => {
  const broken = fixture(); broken.writeUInt32LE(0, 8)
  assert.throws(() => readGlb(broken))
  const parsed = readGlb(await compressGlb(fixture()))
  parsed.gltf.bufferViews[0].byteLength = 65 * 1024 * 1024
  await assert.rejects(decodeViews(parsed))
})
test('rejects external buffers, unknown compression modes and truncated streams', async () => {
  const parsed = readGlb(await compressGlb(fixture()))
  parsed.gltf.bufferViews[0].extensions.EXT_meshopt_compression.mode = 'UNKNOWN'
  await assert.rejects(decodeViews(parsed))
  parsed.gltf.bufferViews[0].extensions.EXT_meshopt_compression.mode = 'ATTRIBUTES'
  parsed.gltf.bufferViews[0].extensions.EXT_meshopt_compression.byteLength = parsed.bin.length + 1
  await assert.rejects(decodeViews(parsed))
})
