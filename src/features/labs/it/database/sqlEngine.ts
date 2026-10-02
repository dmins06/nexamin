import type { Database } from 'sql.js'
export interface SQLTable {
  columns: string[]
  rows: (string | number | null)[][]
  truncated: boolean
}
export interface SQLRun {
  tables: SQLTable[]
  changed: number
  elapsedMs: number
  schema: { name: string; sql: string }[]
  snapshot: Uint8Array
}
export const sampleSQL = `CREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE courses (id INTEGER PRIMARY KEY, title TEXT NOT NULL);
CREATE TABLE enrollments (student_id INTEGER REFERENCES students(id), course_id INTEGER REFERENCES courses(id), score REAL, PRIMARY KEY(student_id,course_id));
INSERT INTO students VALUES (1,'An'),(2,'Bình'),(3,'Chi');
INSERT INTO courses VALUES (10,'SQL'),(20,'OS');
INSERT INTO enrollments VALUES (1,10,8),(2,10,7),(2,20,9);`
export const sqlTemplates = {
  select: 'SELECT * FROM students;',
  join: 'SELECT s.name, c.title, e.score\nFROM students s JOIN enrollments e ON s.id=e.student_id\nJOIN courses c ON c.id=e.course_id\nORDER BY s.id,c.id;',
  left: 'SELECT s.name, e.course_id\nFROM students s LEFT JOIN enrollments e ON s.id=e.student_id;',
  aggregate:
    'SELECT course_id, COUNT(*) AS learners, AVG(score) AS average\nFROM enrollments GROUP BY course_id ORDER BY course_id;',
  index:
    'EXPLAIN QUERY PLAN SELECT * FROM enrollments WHERE course_id=10;\nCREATE INDEX IF NOT EXISTS idx_course ON enrollments(course_id);\nEXPLAIN QUERY PLAN SELECT * FROM enrollments WHERE course_id=10;',
  create:
    "CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY, body TEXT);\nINSERT INTO notes(body) VALUES('Ví dụ trên thiết bị');\nSELECT * FROM notes;",
}
export function executeLocalSQL(db: Database, sql: string): SQLRun {
  if (!sql.trim() || new TextEncoder().encode(sql).length > 32768)
    throw Error('SQL cần 1–32 KiB.')
  const started = performance.now(),
    tables: SQLTable[] = [],
    updates: { count: number } = { count: 0 }
  db.run(
    'PRAGMA hard_heap_limit=67108864; PRAGMA max_page_count=128; PRAGMA foreign_keys=ON;',
  )
  db.updateHook(() => updates.count++)
  let statements = 0,
    outputBytes = 0
  try {
    for (const statement of db.iterateStatements(sql)) {
      if (++statements > 20) throw Error('Tối đa 20 câu SQL mỗi lần chạy.')
      // Each run owns a disposable copy. Export would silently roll back an
      // unfinished transaction, so transaction control is not a teaching API.
      const command = statement
        .getSQL()
        .replace(
          /^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*([A-Za-z]+)[\s\S]*$/,
          '$1',
        )
        .toUpperCase()
      if (
        ['BEGIN', 'SAVEPOINT', 'COMMIT', 'END', 'ROLLBACK', 'RELEASE'].includes(
          command,
        )
      )
        throw Error(
          'Không dùng transaction thủ công. Mỗi batch chỉ lưu khi tất cả câu SQL thành công.',
        )
      const columns = statement.getColumnNames()
      if (columns.length > 32) throw Error('Tối đa 32 cột.')
      const rows: (string | number | null)[][] = []
      let truncated = false
      while (statement.step()) {
        if (rows.length >= 200) {
          truncated = true
          break
        }
        const row = statement
          .get()
          .map((value) =>
            value instanceof Uint8Array
              ? `BLOB (${value.length} bytes)`
              : value,
          )
        outputBytes += new TextEncoder().encode(JSON.stringify(row)).length
        if (outputBytes > 65536)
          throw Error('Output vượt 64 KiB; dùng LIMIT hoặc chọn ít cột hơn.')
        rows.push(row)
      }
      if (columns.length) tables.push({ columns, rows, truncated })
    }
    const schema =
      db
        .exec(
          "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 32",
        )[0]
        ?.values.map((row) => ({
          name: String(row[0]),
          sql: String(row[1]),
        })) ?? []
    const snapshot = db.export()
    if (snapshot.length > 524288)
      throw Error(
        'Database thực hành vượt 512 KiB. Giảm dữ liệu hoặc khôi phục mẫu.',
      )
    return {
      tables,
      changed: updates.count,
      elapsedMs: performance.now() - started,
      schema,
      snapshot,
    }
  } finally {
    db.updateHook(null)
  }
}
export interface JoinPair {
  left: number | null
  right: number | null
  match: boolean
}
export function joinRows(
  left: readonly number[],
  right: readonly number[],
  kind: 'inner' | 'left' | 'right' | 'full',
): JoinPair[] {
  const result: JoinPair[] = [],
    matched = new Set<number>()
  for (const [i, id] of left.entries()) {
    let found = false
    for (const [j, key] of right.entries())
      if (id === key) {
        result.push({ left: i, right: j, match: true })
        matched.add(j)
        found = true
      }
    if (!found && (kind === 'left' || kind === 'full'))
      result.push({ left: i, right: null, match: false })
  }
  if (kind === 'right' || kind === 'full')
    for (const [j] of right.entries())
      if (!matched.has(j)) result.push({ left: null, right: j, match: false })
  return result
}
