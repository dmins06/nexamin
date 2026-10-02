// Lossless, local-only EXT_meshopt_compression for our generated static atlas.
import assert from 'node:assert/strict'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const LIMIT = 64 * 1024 * 1024
const EXT = 'EXT_meshopt_compression'
export function readGlb(buffer) {
  assert.ok(buffer.length >= 28 && buffer.length <= LIMIT, 'GLB size outside atlas budget')
  assert.equal(buffer.readUInt32LE(0), 0x46546c67)
  assert.equal(buffer.readUInt32LE(4), 2)
  assert.equal(buffer.readUInt32LE(8), buffer.length)
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a)
  const end = 20 + buffer.readUInt32LE(12)
  assert.ok(end % 4 === 0 && end + 8 <= buffer.length)
  assert.equal(buffer.readUInt32LE(end + 4), 0x004e4942)
  assert.equal(end + 8 + buffer.readUInt32LE(end), buffer.length)
  const gltf = JSON.parse(buffer.toString('utf8', 20, end))
  assert.ok(gltf.buffers.every((item) => !item.uri), 'External buffers are forbidden')
  return { gltf, bin: buffer.subarray(end + 8) }
}
function packGlb(gltf, bin) {
  const json = Buffer.from(JSON.stringify(gltf))
  const jsonLength = (json.length + 3) & ~3
  const binLength = (bin.length + 3) & ~3
  const buffer = Buffer.alloc(28 + jsonLength + binLength)
  buffer.writeUInt32LE(0x46546c67, 0); buffer.writeUInt32LE(2, 4); buffer.writeUInt32LE(buffer.length, 8)
  buffer.writeUInt32LE(jsonLength, 12); buffer.writeUInt32LE(0x4e4f534a, 16)
  buffer.fill(0x20, 20, 20 + jsonLength); json.copy(buffer, 20)
  buffer.writeUInt32LE(binLength, 20 + jsonLength); buffer.writeUInt32LE(0x004e4942, 24 + jsonLength)
  bin.copy(buffer, 28 + jsonLength)
  return buffer
}
export async function decodeViews({ gltf, bin }) {
  await MeshoptDecoder.ready
  let total = 0
  return gltf.bufferViews.map((view) => {
    const ext = view.extensions?.[EXT]
    const length = view.byteLength
    assert.ok(Number.isSafeInteger(length) && length > 0 && length <= LIMIT)
    total += length; assert.ok(total <= LIMIT, 'Decoded model exceeds atlas memory budget')
    if (!ext) {
      assert.equal(view.buffer, 0)
      const offset = view.byteOffset ?? 0
      assert.ok(Number.isSafeInteger(offset) && offset >= 0 && offset + length <= bin.length)
      return bin.subarray(offset, offset + length)
    }
    assert.equal(view.buffer, 1); assert.equal(ext.buffer, 0); assert.equal(ext.filter, 'NONE')
    assert.ok(['ATTRIBUTES', 'INDICES'].includes(ext.mode))
    assert.ok(Number.isSafeInteger(ext.count) && ext.count > 0)
    assert.ok(Number.isSafeInteger(ext.byteStride) && ext.byteStride > 0 && ext.byteStride <= 256)
    assert.equal(ext.count * ext.byteStride, length)
    assert.ok(Number.isSafeInteger(ext.byteOffset) && ext.byteOffset >= 0)
    assert.ok(Number.isSafeInteger(ext.byteLength) && ext.byteLength > 0 && ext.byteOffset + ext.byteLength <= bin.length)
    const decoded = new Uint8Array(length)
    MeshoptDecoder.decodeGltfBuffer(decoded, ext.count, ext.byteStride, bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength), ext.mode, ext.filter)
    return Buffer.from(decoded)
  })
}
export async function compressGlb(input) {
  await MeshoptEncoder.ready
  const parsed = readGlb(input), { gltf } = parsed
  assert.equal(gltf.buffers.length, 1)
  assert.equal(gltf.extensionsRequired?.length ?? 0, 0)
  const originals = await decodeViews(parsed), chunks = []
  let offset = 0
  for (const [i, view] of gltf.bufferViews.entries()) {
    const accessors = gltf.accessors.filter((accessor) => accessor.bufferView === i)
    assert.ok(accessors.length > 0 && accessors.every((accessor) => !accessor.sparse))
    const first = accessors[0]
    const indices = first.type === 'SCALAR'
    assert.ok(accessors.every((accessor) => accessor.type === first.type && accessor.componentType === first.componentType))
    assert.equal(first.componentType, indices ? 5125 : 5126)
    const stride = indices ? 4 : 12, mode = indices ? 'INDICES' : 'ATTRIBUTES'
    assert.equal(view.byteLength % stride, 0)
    const encoded = MeshoptEncoder.encodeGltfBuffer(originals[i], view.byteLength / stride, stride, mode)
    view.buffer = 1
    view.extensions = { [EXT]: { buffer: 0, byteOffset: offset, byteLength: encoded.length, byteStride: stride, count: view.byteLength / stride, mode, filter: 'NONE' } }
    const padded = Buffer.alloc((encoded.length + 3) & ~3); padded.set(encoded)
    chunks.push(padded); offset += padded.length
  }
  // Required-extension placeholder per Khronos: it has no URI/data and must not
  // be buffer zero. The browser's bundled decoder fills each parent view.
  gltf.buffers = [{ byteLength: offset }, { byteLength: parsed.bin.length, extensions: { [EXT]: { fallback: true } } }]
  gltf.extensionsUsed = [EXT]; gltf.extensionsRequired = [EXT]
  const output = packGlb(gltf, Buffer.concat(chunks))
  const decoded = await decodeViews(readGlb(output))
  for (const [i, original] of originals.entries()) assert.ok(original.equals(decoded[i]), `Lossless round-trip failed for view ${i}`)
  return output
}
