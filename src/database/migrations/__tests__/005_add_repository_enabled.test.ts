import { createRepositoryTableQuery } from '../../tables/RepositoryTable';
import { migration005 } from '../005_add_repository_enabled';
import { createExpoLikeDb, ExpoLikeDb } from '../../__tests__/testDbAdapter';

/**
 * Seed a pre-005 database: Repository table WITHOUT the enabled column,
 * exactly as createInitialSchema created it before this migration.
 */
const seedPre005Db = (adapter: ExpoLikeDb) => {
  adapter.execSync(`
    CREATE TABLE IF NOT EXISTS Repository (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      UNIQUE(url)
    );
  `);
  adapter.runSync(
    'INSERT INTO Repository (url) VALUES (?)',
    'https://example.com/repo1',
  );
  adapter.runSync(
    'INSERT INTO Repository (url) VALUES (?)',
    'https://example.com/repo2',
  );
  adapter.execSync('PRAGMA user_version = 4');
};

const runMigration = (adapter: ExpoLikeDb) =>
  migration005.migrate(
    adapter as unknown as Parameters<typeof migration005.migrate>[0],
  );

const columnsOf = (adapter: ExpoLikeDb, table: string): string[] =>
  adapter
    .getAllSync<{ name: string }>(`PRAGMA table_info(${table})`)
    .map(col => col.name);

describe('migration005 (add Repository.enabled)', () => {
  it('adds the enabled column to an existing Repository table', () => {
    const { adapter: db } = createExpoLikeDb();
    seedPre005Db(db);

    runMigration(db);

    expect(columnsOf(db, 'Repository')).toContain('enabled');
  });

  it('defaults existing repositories to enabled', () => {
    const { adapter: db } = createExpoLikeDb();
    seedPre005Db(db);

    runMigration(db);

    const rows = db.getAllSync<{ url: string; enabled: number }>(
      'SELECT url, enabled FROM Repository ORDER BY id',
    );
    expect(rows).toEqual([
      { url: 'https://example.com/repo1', enabled: 1 },
      { url: 'https://example.com/repo2', enabled: 1 },
    ]);
  });

  it('is idempotent (columnExists guard skips when column is already present)', () => {
    const { adapter: db } = createExpoLikeDb();
    seedPre005Db(db);

    runMigration(db);
    expect(() => runMigration(db)).not.toThrow();
  });

  it('converges with the fresh-install schema', () => {
    // Fresh installs create the table via createRepositoryTableQuery which
    // already includes the column; the migration must be a no-op there.
    const { adapter: db } = createExpoLikeDb();
    db.execSync(createRepositoryTableQuery);
    db.runSync(
      'INSERT INTO Repository (url) VALUES (?)',
      'https://example.com/repo3',
    );

    expect(() => runMigration(db)).not.toThrow();
    const row = db.getFirstSync<{ enabled: number }>(
      'SELECT enabled FROM Repository WHERE url = ?',
      'https://example.com/repo3',
    );
    expect(row?.enabled).toBe(1);
  });

  it('keeps manually disabled repositories disabled', () => {
    const { adapter: db } = createExpoLikeDb();
    seedPre005Db(db);

    runMigration(db);
    db.runSync('UPDATE Repository SET enabled = 0 WHERE id = 2');

    const row = db.getFirstSync<{ enabled: number }>(
      'SELECT enabled FROM Repository WHERE id = 2',
    );
    expect(row?.enabled).toBe(0);
  });
});
