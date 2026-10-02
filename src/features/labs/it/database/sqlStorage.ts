const key = 'nexamin.it.database.snapshot.v1'
export function loadSQLSnapshot(): Uint8Array | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (
      !v ||
      typeof v !== 'object' ||
      !('version' in v) ||
      v.version !== 1 ||
      !('bytes' in v) ||
      typeof v.bytes !== 'string' ||
      v.bytes.length > 700000
    )
      return null
    const raw = atob(v.bytes)
    if (raw.length > 524288 || !raw.startsWith('SQLite format 3\0')) return null
    return Uint8Array.from(raw, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}
export function saveSQLSnapshot(bytes: Uint8Array): boolean {
  try {
    if (bytes.length > 524288) return false
    let raw = ''
    for (let i = 0; i < bytes.length; i += 8192)
      raw += String.fromCharCode(...bytes.subarray(i, i + 8192))
    localStorage.setItem(key, JSON.stringify({ version: 1, bytes: btoa(raw) }))
    return true
  } catch {
    return false
  }
}
export function clearSQLSnapshot() {
  try {
    localStorage.removeItem(key)
  } catch {
    /* Still reset the in-memory snapshot. */
  }
}
