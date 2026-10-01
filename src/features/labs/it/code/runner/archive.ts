import { gunzipSync } from 'fflate'
// Build-verified runtime archives only; no student supplied archive is accepted.
export function unpackRuntime(archive: Uint8Array): Record<string, Uint8Array> {
  const bytes = gunzipSync(archive),
    files: Record<string, Uint8Array> = {},
    decoder = new TextDecoder()
  const field = (off: number, n: number) =>
    decoder
      .decode(bytes.subarray(off, off + n))
      .replace(/\0.*$/s, '')
      .trim()
  for (let off = 0; off + 512 <= bytes.length; ) {
    const name = field(off, 100),
      size = parseInt(field(off + 124, 12) || '0', 8),
      kind = field(off + 156, 1)
    if (!name) break
    if (
      !Number.isFinite(size) ||
      size < 0 ||
      off + 512 + size > bytes.length ||
      name.split('/').includes('..') ||
      name.startsWith('/')
    )
      throw Error('Runtime archive không hợp lệ.')
    if (kind === '0' || kind === '')
      files[`/${name}`] = bytes.slice(off + 512, off + 512 + size)
    off += 512 + Math.ceil(size / 512) * 512
  }
  return files
}
