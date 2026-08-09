import Database from 'better-sqlite3';

/**
 * Minimal expo-sqlite-shaped surface used by migrations and the
 * MigrationRunner, backed by better-sqlite3 so tests run against a REAL
 * SQLite engine (the jest moduleNameMapper replaces expo-sqlite with a
 * jest.fn stub that has no engine).
 *
 * Why better-sqlite3 and not node:sqlite: CI pins Node 20 (verified in
 * .github/workflows) and node:sqlite is Node 22+. better-sqlite3 ships
 * prebuilds for the LTS lines.
 */
export interface ExpoLikeDb {
  execSync: (sql: string) => void;
  runSync: (
    sql: string,
    ...params: unknown[]
  ) => { lastInsertRowId: number; changes: number };
  getFirstSync: <T = Record<string, unknown>>(
    sql: string,
    ...params: unknown[]
  ) => T | null;
  getAllSync: <T = Record<string, unknown>>(
    sql: string,
    ...params: unknown[]
  ) => T[];
  withTransactionSync: (fn: () => void) => void;
}

export const createExpoLikeDb = (path = ':memory:') => {
  const db = new Database(path);

  const adapter: ExpoLikeDb = {
    execSync: sql => db.exec(sql),
    runSync: (sql, ...params) => {
      const result = db.prepare(sql).run(...params);
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },
    getFirstSync: (sql, ...params) => {
      // better-sqlite3 returns undefined when no row matches; expo-sqlite returns null.
      return (db.prepare(sql).get(...params) ?? null) as never;
    },
    getAllSync: (sql, ...params) => db.prepare(sql).all(...params) as never,
    withTransactionSync: fn => db.transaction(fn)(),
  };

  return { adapter, db };
};

describe('testDbAdapter (smoke)', () => {
  it('executes DDL, DML, and PRAGMA reads through the adapter', () => {
    const { adapter } = createExpoLikeDb();
    adapter.execSync('PRAGMA user_version = 4');
    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 4,
    });

    adapter.execSync('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');
    adapter.runSync('INSERT INTO t (v) VALUES (?)', 'hello');
    expect(adapter.getAllSync('SELECT * FROM t')).toEqual([
      { id: 1, v: 'hello' },
    ]);
  });

  it('wraps callbacks in a real transaction (rollback on throw)', () => {
    const { adapter } = createExpoLikeDb();
    adapter.execSync('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)');

    expect(() =>
      adapter.withTransactionSync(() => {
        adapter.runSync("INSERT INTO t (v) VALUES ('a')");
        throw new Error('boom');
      }),
    ).toThrow('boom');

    expect(adapter.getAllSync('SELECT * FROM t')).toEqual([]);
  });
});
