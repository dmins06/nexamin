import { beforeAll, describe, it, expect } from 'vitest'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { executeLocalSQL, sampleSQL, sqlTemplates, joinRows } from './sqlEngine'
import {
  saveSQLSnapshot,
  loadSQLSnapshot,
  clearSQLSnapshot,
} from './sqlStorage'
let SQL: SqlJsStatic
beforeAll(async () => {
  SQL = await initSqlJs()
})
describe('real disposable SQLite', () => {
  it('runs CRUD, JOIN, aggregation and exposes actual schema', () => {
    const db = new SQL.Database()
    try {
      db.run(sampleSQL)
      const r = executeLocalSQL(db, sqlTemplates.join)
      expect(r.tables[0]?.rows).toEqual([
        ['An', 'SQL', 8],
        ['Bình', 'SQL', 7],
        ['Bình', 'OS', 9],
      ])
      expect(r.schema).toHaveLength(3)
      expect(
        executeLocalSQL(
          db,
          'CREATE TABLE t(id INTEGER);INSERT INTO t VALUES(1);UPDATE t SET id=2;SELECT * FROM t;',
        ).tables[0]?.rows,
      ).toEqual([[2]])
      expect(
        executeLocalSQL(db, 'DELETE FROM t;SELECT COUNT(*) FROM t').tables[0]
          ?.rows,
      ).toEqual([[0]])
    } finally {
      db.close()
    }
  })
  it('returns actual SQLite SCAN/SEARCH plans with index', () => {
    const db = new SQL.Database()
    try {
      db.run(sampleSQL)
      const r = executeLocalSQL(db, sqlTemplates.index)
      expect(JSON.stringify(r.tables[0]?.rows)).toContain('SCAN')
      expect(JSON.stringify(r.tables[1]?.rows)).toContain('idx_course')
    } finally {
      db.close()
    }
  })
  it('rejects unfinished/manual transactions instead of reporting unsaved writes', () => {
    const db = new SQL.Database()
    try {
      db.run(sampleSQL)
      expect(() =>
        executeLocalSQL(
          db,
          "-- comment\n/* demo */ BEGIN;INSERT INTO students VALUES(4,'Demo')",
        ),
      ).toThrow('transaction')
      expect(
        executeLocalSQL(db, "SELECT 'BEGIN' AS label").tables[0]?.rows,
      ).toEqual([['BEGIN']])
    } finally {
      db.close()
    }
  })
  it('caps rows/statements/output and reports syntax/foreign-key errors', () => {
    const db = new SQL.Database()
    try {
      db.run(sampleSQL)
      expect(
        executeLocalSQL(
          db,
          'WITH RECURSIVE n(x) AS(VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<300) SELECT x FROM n',
        ).tables[0]?.rows,
      ).toHaveLength(200)
      expect(() => executeLocalSQL(db, 'SELECT 1;'.repeat(21))).toThrow('20')
      expect(() =>
        executeLocalSQL(db, "SELECT printf('%100000s','x')"),
      ).toThrow('64 KiB')
      expect(() => executeLocalSQL(db, 'SELECT invalid FROM nope')).toThrow()
      expect(() =>
        executeLocalSQL(db, 'INSERT INTO enrollments VALUES(99,10,7)'),
      ).toThrow()
    } finally {
      db.close()
    }
  })
  it('versioned snapshot survives reload and reset/corruption recovers safely', () => {
    localStorage.clear()
    const db = new SQL.Database()
    try {
      db.run(sampleSQL)
      expect(saveSQLSnapshot(db.export())).toBe(true)
      const snapshot = loadSQLSnapshot()
      expect(snapshot).not.toBeNull()
      const restored = new SQL.Database(snapshot ?? undefined)
      try {
        expect(
          restored.exec('SELECT COUNT(*) FROM students')[0]?.values,
        ).toEqual([[3]])
      } finally {
        restored.close()
      }
      clearSQLSnapshot()
      expect(loadSQLSnapshot()).toBeNull()
      localStorage.setItem(
        'nexamin.it.database.snapshot.v1',
        '{"version":9,"bytes":"bad"}',
      )
      expect(loadSQLSnapshot()).toBeNull()
    } finally {
      db.close()
    }
  })
  it('preserves duplicate matches and extends unmatched rows for JOIN types', () => {
    expect(joinRows([1, 2, 3], [1, 2, 2, 4], 'inner')).toHaveLength(3)
    expect(joinRows([1, 2, 3], [1, 2, 2, 4], 'full')).toHaveLength(5)
    expect(joinRows([3], [4], 'left')[0]).toEqual({
      left: 0,
      right: null,
      match: false,
    })
  })
})
