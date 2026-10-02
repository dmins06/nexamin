import { useEffect, useRef, useState, useMemo } from 'react'
import { LabIntro } from '../shared/LabIntro'
import { LabExplain } from '../shared/LabExplain'
import { useLabSettings } from '../shared/useLabSettings'
import { sqlTemplates, joinRows, type SQLRun, type SQLTable } from './sqlEngine'
import {
  loadSQLSnapshot,
  saveSQLSnapshot,
  clearSQLSnapshot,
} from './sqlStorage'
const defaults = { lesson: 'sql', sql: sqlTemplates.join, join: 'left' }
function DataTable({ table }: { table: SQLTable }) {
  return (
    <>
      <div className="it-table-scroll" tabIndex={0} aria-label="Kết quả SQL">
        <table className="it-data-table">
          <thead>
            <tr>
              {table.columns.map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j}>{v === null ? 'NULL' : String(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!table.rows.length && <p>Không có dòng kết quả.</p>}
      {table.truncated && (
        <p>Chỉ hiển thị 200 dòng đầu; dùng LIMIT để thu hẹp.</p>
      )}
    </>
  )
}
export function DatabaseLab() {
  const { settings: s, change } = useLabSettings('sql-editor', defaults),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [result, setResult] = useState<SQLRun | null>(null),
    [initialSnapshot] = useState(loadSQLSnapshot),
    snapshot = useRef(initialSnapshot),
    lesson = ['sql', 'join', 'schema'].find((id) => id === s.lesson) ?? 'sql',
    task = useRef<{
      worker: Worker
      timer: ReturnType<typeof setTimeout>
    } | null>(null)
  useEffect(
    () => () => {
      if (task.current) {
        task.current.worker.onmessage = null
        task.current.worker.onerror = null
        task.current.worker.terminate()
        clearTimeout(task.current.timer)
        task.current = null
      }
    },
    [],
  )
  const stop = () => {
    if (task.current) {
      task.current.worker.onmessage = null
      task.current.worker.onerror = null
      task.current.worker.terminate()
      clearTimeout(task.current.timer)
      task.current = null
    }
    setBusy(false)
    setNotice('Đã dừng. Database đã lưu trước đó không thay đổi.')
  }
  const run = () => {
    if (task.current) return
    const sql = s.sql ?? ''
    if (!sql.trim() || new TextEncoder().encode(sql).length > 32768) {
      setError('Nhập SQL, tối đa 32 KiB.')
      return
    }
    setError('')
    setNotice('Đang mở SQLite…')
    setResult(null)
    setBusy(true)
    try {
      const worker = new Worker(new URL('./sql.worker.ts', import.meta.url), {
        type: 'module',
      })
      const finish = (message: string) => {
        if (task.current?.worker !== worker) return
        worker.onmessage = null
        worker.onerror = null
        worker.terminate()
        if (task.current) clearTimeout(task.current.timer)
        task.current = null
        setBusy(false)
        if (message) setError(message)
      }
      task.current = {
        worker,
        timer: setTimeout(
          () =>
            finish(
              'Không tải được SQLite trong 20 giây. Thử lại; dữ liệu đã lưu vẫn giữ nguyên.',
            ),
          20000,
        ),
      }
      worker.onerror = () =>
        finish('SQLite bị lỗi. Sửa SQL hoặc khôi phục dữ liệu mẫu.')
      worker.onmessage = ({
        data,
      }: MessageEvent<
        | { phase: 'ready' }
        | { ok: false; error: string }
        | { ok: true; result: SQLRun }
      >) => {
        if (task.current?.worker !== worker) return
        if ('phase' in data) {
          if (task.current) {
            clearTimeout(task.current.timer)
            task.current.timer = setTimeout(
              () =>
                finish(
                  'SQL quá 3 giây. Worker đã hủy; database đã lưu không thay đổi.',
                ),
              3000,
            )
          }
          setNotice('Đang chạy SQL…')
          return
        }
        if (!data.ok) {
          finish(data.error.slice(0, 600))
          setNotice('Không lưu thay đổi của lần chạy lỗi.')
          return
        }
        snapshot.current = data.result.snapshot
        setResult(data.result)
        setNotice(
          saveSQLSnapshot(data.result.snapshot)
            ? 'Đã lưu database thực hành trên thiết bị.'
            : 'Chạy xong nhưng không lưu được trên thiết bị (quota/private mode). Giữ bản trong tab này.',
        )
        finish('')
      }
      worker.postMessage({ sql, snapshot: snapshot.current })
    } catch {
      if (task.current) {
        task.current.worker.onmessage = null
        task.current.worker.onerror = null
        task.current.worker.terminate()
        clearTimeout(task.current.timer)
        task.current = null
      }
      setBusy(false)
      setError('Không khởi tạo được Worker. Thử trình duyệt hiện đại.')
      setNotice('')
    }
  }
  const kind =
      ['inner', 'left', 'right', 'full'].find((k) => k === s.join) ?? 'left',
    join = useMemo(
      () =>
        joinRows(
          [1, 2, 3],
          [1, 2, 2, 4],
          kind === 'inner'
            ? 'inner'
            : kind === 'right'
              ? 'right'
              : kind === 'full'
                ? 'full'
                : 'left',
        ),
      [kind],
    )
  return (
    <>
      <LabIntro
        title="Database Lab"
        description="Viết SQL với SQLite thật; thử JOIN, xem query plan và khám phá quan hệ dữ liệu."
        notice="Database chỉ nằm trong Worker và adapter trên thiết bị, không nối DB Nexamin. SQL tối đa 32 KiB, 3 giây chạy, WASM memory 256 MiB, snapshot 512 KiB. Không nhập dữ liệu nhạy cảm."
      />
      <div className="it-controls" aria-label="Bài học Database">
        {[
          ['sql', 'SQL Playground'],
          ['join', 'JOIN Visualizer'],
          ['schema', 'ERD & Index'],
        ].map(([id, title]) => (
          <button
            key={id}
            className="it-button"
            aria-pressed={lesson === id}
            onClick={() => change('lesson', id ?? 'sql')}
          >
            {title}
          </button>
        ))}
      </div>
      {lesson !== 'join' && (
        <>
          <div className="it-sim-grid">
            <section className="it-panel">
              <h2>Câu SQL</h2>
              <label>
                Ví dụ
                <select
                  disabled={busy}
                  value=""
                  onChange={(e) => {
                    const template = Object.entries(sqlTemplates).find(
                      ([id]) => id === e.target.value,
                    )?.[1]
                    if (template) change('sql', template)
                  }}
                >
                  <option value="">Chọn để đưa vào editor</option>
                  {Object.keys(sqlTemplates).map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                SQL editor
                <textarea
                  rows={9}
                  spellCheck={false}
                  value={s.sql}
                  disabled={busy}
                  maxLength={32768}
                  onChange={(e) => change('sql', e.target.value)}
                />
              </label>
              <div className="it-controls">
                <button
                  className="it-button primary"
                  disabled={busy}
                  onClick={run}
                >
                  Chạy SQL
                </button>
                <button className="it-button" disabled={!busy} onClick={stop}>
                  Dừng SQL
                </button>
                <button
                  className="it-button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !window.confirm(
                        'Xóa database thực hành trên thiết bị và trở về dữ liệu mẫu? Không ảnh hưởng Nexamin.',
                      )
                    )
                      return
                    clearSQLSnapshot()
                    snapshot.current = null
                    setResult(null)
                    setError('')
                    setNotice(
                      'Đã khôi phục. Lần Chạy SQL tiếp theo sẽ tạo dữ liệu mẫu.',
                    )
                  }}
                >
                  Khôi phục dữ liệu mẫu
                </button>
              </div>
              <p>
                Dữ liệu mẫu: students (An, Bình, Chi), courses (SQL, OS),
                enrollments. Có thể
                CREATE/INSERT/SELECT/UPDATE/DELETE/JOIN/GROUP BY. Mỗi lần chạy
                dùng bản sao; chỉ lưu khi toàn bộ batch thành công.
              </p>
              {error && (
                <p className="it-error" role="alert">
                  {error}
                </p>
              )}
              <p role="status">{notice || 'Sẵn sàng chạy trên thiết bị.'}</p>
            </section>
            <section className="it-panel">
              <h2>Kết quả truy vấn</h2>
              {result ? (
                <>
                  <p>
                    {result.changed} thay đổi dòng ·{' '}
                    {result.elapsedMs.toFixed(1)} ms · {result.snapshot.length}{' '}
                    bytes
                  </p>
                  {result.tables.map((table, i) => (
                    <div key={i}>
                      <h3>Result {i + 1}</h3>
                      <DataTable table={table} />
                    </div>
                  ))}
                  {!result.tables.length && (
                    <p>Lệnh đã thực thi, không trả bảng kết quả.</p>
                  )}
                </>
              ) : (
                <p>
                  Chạy SQL để xem kết quả thật. Đây không phải bảng giả lập câu
                  trả lời.
                </p>
              )}
            </section>
          </div>
          {lesson === 'schema' && (
            <section className="it-panel">
              <h2>Schema / ERD từ database thực hành</h2>
              {result?.schema.length ? (
                result.schema.map((table) => (
                  <div key={table.name}>
                    <h3>{table.name}</h3>
                    <pre>{table.sql}</pre>
                  </div>
                ))
              ) : (
                <p>Chạy SQL để đọc schema thật từ sqlite_master.</p>
              )}
              <p>
                Schema mẫu: students 1:N enrollments N:1 courses; students N:M
                courses qua bảng enrollments. Thay đổi CREATE TABLE rồi chạy để
                kiểm tra schema mới. Đây là sơ đồ quan hệ văn bản từ DDL, chưa
                có ERD kéo-thả.
              </p>
              <h3>Sequential Scan và Index</h3>
              <p>
                Chọn ví dụ index để so sánh EXPLAIN QUERY PLAN trước/sau CREATE
                INDEX. Planner SQLite thực tự chọn SCAN/SEARCH; không giả vờ mọi
                index luôn nhanh hơn. B-Tree tương tác còn là hướng mở rộng.
              </p>
            </section>
          )}
        </>
      )}
      {lesson === 'join' && (
        <section className="it-panel">
          <h2>Ghép hàng theo khóa</h2>
          <label>
            Kiểu JOIN
            <select
              value={kind}
              onChange={(e) => change('join', e.target.value)}
            >
              {['inner', 'left', 'right', 'full'].map((v) => (
                <option key={v} value={v}>
                  {v.toUpperCase()} JOIN
                </option>
              ))}
            </select>
          </label>
          <p>
            Minh họa riêng, không sửa database: khóa bảng trái [1,2,3], phải
            [1,2,2,4]. Mỗi cặp khóa bằng nhau tạo một hàng; không ghép chỉ một
            lần khi phía phải có khóa trùng.
          </p>
          <DataTable
            table={{
              columns: ['Hàng trái / khóa', 'Hàng phải / khóa', 'Ghép khớp'],
              rows: join.map((pair) => [
                pair.left === null
                  ? null
                  : `L${pair.left + 1} / ${[1, 2, 3][pair.left]}`,
                pair.right === null
                  ? null
                  : `R${pair.right + 1} / ${[1, 2, 2, 4][pair.right]}`,
                pair.match ? 'Có' : 'NULL mở rộng',
              ]),
              truncated: false,
            }}
          />
          <p>
            INNER chỉ giữ cặp khớp; LEFT/RIGHT giữ phía tương ứng bằng NULL;
            FULL giữ cả hai phía. Thử SQL thật ở Playground để kiểm tra.
          </p>
        </section>
      )}
      <LabExplain
        title="Database Lab"
        context={`${s.sql ?? ''}\n${JSON.stringify(result?.tables ?? join).slice(0, 3500)}`}
      />
    </>
  )
}
