import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { boundWasmMemory } from '../code/runner/wasmMemory'
import { executeLocalSQL, sampleSQL } from './sqlEngine'
interface Request {
  sql: string
  snapshot: Uint8Array | null
}
// The only fetched resource is a bundled, trusted WASM runtime. User SQL is data.
self.onmessage = async ({ data }: MessageEvent<Request>) => {
  let db:
    | InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>
    | undefined
  try {
    const response = await fetch(wasmUrl, { credentials: 'omit' })
    if (!response.ok) throw Error('Không tải được SQLite; kiểm tra kết nối.')
    const wasmBinary = boundWasmMemory(
      new Uint8Array(await response.arrayBuffer()),
      4096,
    )
    const SQL = await initSqlJs({ wasmBinary })
    db = new SQL.Database(data.snapshot ?? undefined)
    if (!data.snapshot) db.run(sampleSQL)
    self.postMessage({ phase: 'ready' })
    // No JS callbacks are registered as SQL functions; no server URL/credentials.
    const result = executeLocalSQL(db, data.sql)
    self.postMessage({ ok: true, result })
  } catch (error) {
    self.postMessage({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'SQLite không chạy được. Khôi phục dữ liệu mẫu hoặc sửa SQL.',
    })
  } finally {
    db?.close()
  }
}
