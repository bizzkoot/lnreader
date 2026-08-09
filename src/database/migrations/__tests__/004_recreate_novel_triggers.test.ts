import {
  createNovelTableQuery,
  createNovelTriggerQueryDelete,
  createNovelTriggerQueryInsert,
  createNovelTriggerQueryUpdate,
} from '../../tables/NovelTable';
import { createChapterTableQuery } from '../../tables/ChapterTable';
import {
  createCategoriesTableQuery,
  createCategoryTriggerQuery,
} from '../../tables/CategoryTable';
import { createNovelCategoryTableQuery } from '../../tables/NovelCategoryTable';
import { migration004 } from '../004_recreate_novel_triggers';
import { createExpoLikeDb, ExpoLikeDb } from '../../__tests__/testDbAdapter';

// migration004 imports CategoryTable -> getString, and db.ts imports showToast.
jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));
jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

/**
 * Pre-cf5b5923e lexicographic trigger bodies. These are the bodies existing
 * v2/v3 installs actually run (created in their original createInitialSchema,
 * never updated since CREATE TRIGGER IF NOT EXISTS is a no-op when the
 * trigger already exists).
 */
const OLD_INSERT_TRIGGER = `CREATE TRIGGER update_novel_stats
AFTER INSERT ON Chapter
BEGIN
    UPDATE Novel
    SET
        totalChapters = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id),
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = NEW.novelId;
END;
`;

const OLD_UPDATE_TRIGGER = `CREATE TRIGGER update_novel_stats_on_update
AFTER UPDATE OF isDownloaded, unread, readTime, updatedTime ON Chapter
BEGIN
    UPDATE Novel
    SET
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        lastReadAt = (SELECT MAX(readTime) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = NEW.novelId;
END;
`;

const OLD_DELETE_TRIGGER = `CREATE TRIGGER update_novel_stats_on_delete
AFTER DELETE ON Chapter
BEGIN
    UPDATE Novel
    SET
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        totalChapters = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastReadAt = (SELECT MAX(readTime) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = OLD.novelId;
END;
`;

/**
 * Seed a v2-era database exactly the way createInitialSchema did before the
 * julianday fix: full schema from the exported constants + OLD lexicographic
 * trigger bodies + user_version = 2.
 *
 * Note: createCategoryDefaultQuery is intentionally NOT used here — it
 * interpolates getString('categories.default') into SQL and the test mock
 * returns the raw key, producing invalid double-quoted identifiers.
 */
const seedV2Db = (adapter: ExpoLikeDb) => {
  adapter.execSync(createNovelTableQuery);
  adapter.execSync(createChapterTableQuery);
  adapter.execSync(createCategoriesTableQuery);
  adapter.execSync(createNovelCategoryTableQuery);
  adapter.execSync(
    "INSERT OR IGNORE INTO Category (id, name, sort) VALUES (1, 'Default', 1), (2, 'Local', 2)",
  );
  adapter.execSync(OLD_INSERT_TRIGGER);
  adapter.execSync(OLD_UPDATE_TRIGGER);
  adapter.execSync(OLD_DELETE_TRIGGER);
  adapter.execSync('PRAGMA user_version = 2');
};

/**
 * Run migration004 against the adapter, casting to the Migration interface's
 * SQLiteDatabase param (expo-sqlite type). The adapter structurally covers
 * every method migration004 uses (runSync/execSync/getAllSync/getFirstSync).
 */
const runMigration = (adapter: ExpoLikeDb) =>
  migration004.migrate(
    adapter as unknown as Parameters<typeof migration004.migrate>[0],
  );

const insertNovel = (adapter: ExpoLikeDb, id: number, name = `Novel${id}`) =>
  adapter.runSync(
    'INSERT INTO Novel (id, path, pluginId, name) VALUES (?, ?, ?, ?)',
    id,
    `/path/${id}`,
    'plugin-a',
    name,
  );

const insertChapter = (
  adapter: ExpoLikeDb,
  id: number,
  novelId: number,
  updatedTime: string | null,
  unread = 1,
) =>
  adapter.runSync(
    'INSERT INTO Chapter (id, novelId, path, name, updatedTime, unread) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    novelId,
    `/ch/${id}`,
    `Chapter ${id}`,
    updatedTime,
    unread,
  );

const triggerNames = (adapter: ExpoLikeDb): string[] =>
  adapter
    .getAllSync<{
      name: string;
    }>("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name")
    .map(r => r.name);

const triggerSql = (adapter: ExpoLikeDb, name: string): string =>
  adapter.getFirstSync<{ sql: string | null }>(
    "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?",
    name,
  )?.sql ?? '';

/**
 * SQLite normalizes stored trigger text (strips `IF NOT EXISTS`, drops the
 * trailing semicolon/newline), so compare against the exported constants
 * after the same normalization. This is the drift invariant: if someone edits
 * the trigger bodies in NovelTable.ts without adding a migration, this test
 * fails.
 */
const normalizeSql = (sql: string): string =>
  sql
    .replace(/IF NOT EXISTS /g, '')
    .replace(/;\s*$/, '')
    .trim();

describe('Migration 004: recreate julianday triggers on all installs', () => {
  describe('schema drift (a)', () => {
    it('recreates the 4 triggers from the exported constants (julianday bodies)', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);

      runMigration(adapter);

      const names = triggerNames(adapter);
      expect(names).toEqual([
        'add_category',
        'update_novel_stats',
        'update_novel_stats_on_delete',
        'update_novel_stats_on_update',
      ]);

      expect(normalizeSql(triggerSql(adapter, 'update_novel_stats'))).toBe(
        normalizeSql(createNovelTriggerQueryInsert),
      );
      expect(
        normalizeSql(triggerSql(adapter, 'update_novel_stats_on_update')),
      ).toBe(normalizeSql(createNovelTriggerQueryUpdate));
      expect(
        normalizeSql(triggerSql(adapter, 'update_novel_stats_on_delete')),
      ).toBe(normalizeSql(createNovelTriggerQueryDelete));
      expect(normalizeSql(triggerSql(adapter, 'add_category'))).toBe(
        normalizeSql(createCategoryTriggerQuery),
      );

      // And they are the julianday bodies, not the old lexicographic ones.
      expect(triggerSql(adapter, 'update_novel_stats')).toContain('julianday');
      expect(triggerSql(adapter, 'update_novel_stats_on_update')).toContain(
        'julianday',
      );
      expect(triggerSql(adapter, 'update_novel_stats_on_delete')).toContain(
        'julianday',
      );
      expect(triggerSql(adapter, 'update_novel_stats')).not.toContain(
        'MAX(updatedTime)',
      );
    });
  });

  describe('trigger fires (b)', () => {
    it('keeps Novel.lastUpdatedAt as the chronologically newest chapter', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);
      runMigration(adapter);

      insertNovel(adapter, 1);
      insertChapter(adapter, 1, 1, '2026-08-01 09:00:00');
      insertChapter(adapter, 2, 1, '2026-08-01 10:00:00');

      const novel = adapter.getFirstSync<{ lastUpdatedAt: string | null }>(
        'SELECT lastUpdatedAt FROM Novel WHERE id = 1',
      );
      expect(novel?.lastUpdatedAt).toBe('2026-08-01 10:00:00');
    });
  });

  describe('divergence example (c)', () => {
    it('picks 09:00:00 over lexicographically-greater non-padded 8:00:00', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);
      runMigration(adapter);

      insertNovel(adapter, 1);
      insertChapter(adapter, 1, 1, '2026-08-01 8:00:00');
      insertChapter(adapter, 2, 1, '2026-08-01 09:00:00');

      const novel = adapter.getFirstSync<{ lastUpdatedAt: string | null }>(
        'SELECT lastUpdatedAt FROM Novel WHERE id = 1',
      );
      // Lexicographic MAX would be '2026-08-01 8:00:00' (char '8' > '0').
      // julianday('2026-08-01 8:00:00') is NULL -> sorts last in DESC -> 09:00 wins.
      expect(novel?.lastUpdatedAt).toBe('2026-08-01 09:00:00');
    });
  });

  describe('backfill (d)', () => {
    it('corrects pre-existing lastUpdatedAt rows from lexicographic to julianday order', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);

      // Simulate the state migration 002's backfill left behind: a novel whose
      // lastUpdatedAt was computed with MAX(updatedTime) while the chapters
      // hold a non-padded hour. MAX picked '8:00:00' (lexicographically
      // greater) but julianday treats it as NULL.
      insertNovel(adapter, 1);
      insertChapter(adapter, 1, 1, '2026-08-01 8:00:00');
      insertChapter(adapter, 2, 1, '2026-08-01 09:00:00');
      const before = adapter.getFirstSync<{ lastUpdatedAt: string | null }>(
        'SELECT lastUpdatedAt FROM Novel WHERE id = 1',
      );
      expect(before?.lastUpdatedAt).toBe('2026-08-01 8:00:00');

      runMigration(adapter);

      const after = adapter.getFirstSync<{ lastUpdatedAt: string | null }>(
        'SELECT lastUpdatedAt FROM Novel WHERE id = 1',
      );
      expect(after?.lastUpdatedAt).toBe('2026-08-01 09:00:00');
    });

    it('keeps a single non-padded row value via LIMIT 1 (NULL julianday edge)', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);

      insertNovel(adapter, 1);
      insertChapter(adapter, 1, 1, '2026-08-01 8:00:00');

      runMigration(adapter);

      const after = adapter.getFirstSync<{ lastUpdatedAt: string | null }>(
        'SELECT lastUpdatedAt FROM Novel WHERE id = 1',
      );
      // ORDER BY julianday(...) DESC with a single row (NULL julianday) still
      // returns that row via LIMIT 1 — the value is preserved, not nulled.
      expect(after?.lastUpdatedAt).toBe('2026-08-01 8:00:00');
    });

    it('leaves novels without chapters at NULL', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);
      insertNovel(adapter, 1);

      runMigration(adapter);

      const after = adapter.getFirstSync<{ lastUpdatedAt: string | null }>(
        'SELECT lastUpdatedAt FROM Novel WHERE id = 1',
      );
      expect(after?.lastUpdatedAt).toBeNull();
    });
  });

  describe('column-list behavior (e)', () => {
    it('does NOT fire on progress-only updates', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);
      runMigration(adapter);

      insertNovel(adapter, 1);
      insertChapter(adapter, 1, 1, '2026-08-01 09:00:00', 1);

      adapter.runSync('UPDATE Chapter SET progress = 90 WHERE id = 1');

      const novel = adapter.getFirstSync<{
        lastUpdatedAt: string | null;
        chaptersUnread: number;
      }>('SELECT lastUpdatedAt, chaptersUnread FROM Novel WHERE id = 1');
      // lastUpdatedAt unchanged (still the insert-time value), unread not recounted.
      expect(novel?.lastUpdatedAt).toBe('2026-08-01 09:00:00');
      expect(novel?.chaptersUnread).toBe(1);
    });

    it('fires on unread/readTime/updatedTime/isDownloaded updates', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);
      runMigration(adapter);

      insertNovel(adapter, 1);
      insertChapter(adapter, 1, 1, '2026-08-01 09:00:00', 1);
      insertChapter(adapter, 2, 1, '2026-08-01 10:00:00', 1);

      adapter.runSync('UPDATE Chapter SET unread = 0 WHERE id = 1');

      const novel = adapter.getFirstSync<{ chaptersUnread: number }>(
        'SELECT chaptersUnread FROM Novel WHERE id = 1',
      );
      expect(novel?.chaptersUnread).toBe(1);
    });
  });

  describe('idempotency (f)', () => {
    it('runs cleanly a second time with no drift', () => {
      const { adapter } = createExpoLikeDb();
      seedV2Db(adapter);

      runMigration(adapter);
      expect(() => runMigration(adapter)).not.toThrow();

      expect(triggerNames(adapter)).toEqual([
        'add_category',
        'update_novel_stats',
        'update_novel_stats_on_delete',
        'update_novel_stats_on_update',
      ]);
      const version = adapter.getFirstSync<{ user_version: number }>(
        'PRAGMA user_version',
      );
      expect(version?.user_version).toBe(2); // migration itself never bumps version
    });
  });

  describe('column guard (g)', () => {
    it('throws when Novel is missing a column referenced by trigger bodies', () => {
      const { adapter } = createExpoLikeDb();
      // v2 schema WITHOUT lastUpdatedAt on Novel (simulates a corrupted/incomplete schema).
      adapter.execSync(createChapterTableQuery);
      adapter.execSync(createCategoriesTableQuery);
      adapter.execSync(createNovelCategoryTableQuery);
      adapter.execSync(
        "INSERT OR IGNORE INTO Category (id, name, sort) VALUES (1, 'Default', 1), (2, 'Local', 2)",
      );
      adapter.execSync(`
        CREATE TABLE Novel (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL,
          pluginId TEXT NOT NULL,
          name TEXT NOT NULL,
          inLibrary INTEGER DEFAULT 0,
          chaptersDownloaded INTEGER DEFAULT 0,
          chaptersUnread INTEGER DEFAULT 0,
          totalChapters INTEGER DEFAULT 0,
          lastReadAt TEXT
        )
      `);

      expect(() => runMigration(adapter)).toThrow(
        /Migration 4 aborted: Novel is missing columns required by the novel\/trigger DDL: lastUpdatedAt/,
      );

      // And nothing was partially applied.
      expect(triggerNames(adapter)).toEqual([]);
    });

    it('throws when Chapter is missing a column referenced by trigger bodies', () => {
      const { adapter } = createExpoLikeDb();
      adapter.execSync(createNovelTableQuery);
      adapter.execSync(createCategoriesTableQuery);
      adapter.execSync(createNovelCategoryTableQuery);
      adapter.execSync(
        "INSERT OR IGNORE INTO Category (id, name, sort) VALUES (1, 'Default', 1), (2, 'Local', 2)",
      );
      adapter.execSync(`
        CREATE TABLE Chapter (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          novelId INTEGER NOT NULL,
          path TEXT NOT NULL,
          name TEXT NOT NULL,
          unread INTEGER DEFAULT 1,
          isDownloaded INTEGER DEFAULT 0,
          readTime TEXT
        )
      `);

      expect(() => runMigration(adapter)).toThrow(
        /Migration 4 aborted: Chapter is missing columns required by the novel\/trigger DDL: updatedTime/,
      );
    });
  });
});
