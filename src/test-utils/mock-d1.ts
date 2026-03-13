import Database from 'better-sqlite3';

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS entries_collection_slug_idx
  ON entries(collection_id, slug);
`;

/**
 * Creates an in-memory SQLite database wrapped to match the D1Database
 * interface, suitable for testing with drizzle-orm/d1.
 */
export function createMockD1(): D1Database {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(MIGRATION_SQL);

  return {
    prepare(sql: string) {
      return createStatement(sqlite, sql);
    },
    batch(statements: D1PreparedStatement[]) {
      return Promise.resolve(
        statements.map((s) => (s as unknown as { _run: () => D1Response })._run())
      );
    },
    exec(rawSql: string) {
      sqlite.exec(rawSql);
      return Promise.resolve({ count: 0, duration: 0 } as D1ExecResult);
    },
    dump() {
      return Promise.resolve(new ArrayBuffer(0));
    },
  } as D1Database;
}

function createStatement(
  sqlite: Database.Database,
  sql: string
): D1PreparedStatement {
  let params: unknown[] = [];

  const stmt: D1PreparedStatement = {
    bind(...args: unknown[]) {
      params = args;
      return stmt;
    },
    first(col?: string) {
      const s = sqlite.prepare(sql);
      const row = s.get(...params) as Record<string, unknown> | undefined;
      if (!row) return Promise.resolve(null);
      if (col) return Promise.resolve((row as Record<string, unknown>)[col]);
      return Promise.resolve(row);
    },
    all() {
      const s = sqlite.prepare(sql);
      const results = s.all(...params);
      return Promise.resolve({
        results,
        success: true,
        meta: { duration: 0 },
      } as D1Result<unknown>);
    },
    run() {
      const s = sqlite.prepare(sql);
      const info = s.run(...params);
      return Promise.resolve({
        results: [],
        success: true,
        meta: {
          duration: 0,
          changes: info.changes,
          last_row_id: Number(info.lastInsertRowid),
          changed_db: info.changes > 0,
          size_after: 0,
          rows_read: 0,
          rows_written: info.changes,
        },
      } as D1Response);
    },
    raw() {
      const s = sqlite.prepare(sql);
      const results = s.all(...params) as Record<string, unknown>[];
      return Promise.resolve(
        results.map((row) => Object.values(row))
      ) as Promise<unknown[][]>;
    },
    _run() {
      const s = sqlite.prepare(sql);
      const info = s.run(...params);
      return {
        results: [],
        success: true,
        meta: {
          duration: 0,
          changes: info.changes,
          last_row_id: Number(info.lastInsertRowid),
          changed_db: info.changes > 0,
          size_after: 0,
          rows_read: 0,
          rows_written: info.changes,
        },
      } as D1Response;
    },
  } as D1PreparedStatement & { _run: () => D1Response };

  return stmt;
}
