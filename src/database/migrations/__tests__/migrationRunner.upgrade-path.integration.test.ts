import { MigrationRunner } from '../../utils/migrationRunner';
import { migrations } from '../index';
import { createExpoLikeDb, ExpoLikeDb } from '../../__tests__/testDbAdapter';
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
import { createRepositoryTableQuery } from '../../tables/RepositoryTable';

// migrations import CategoryTable -> getString (heavy translations module).
jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));
jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

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

/** Full current schema exactly as createInitialSchema (db.ts) builds it. */
const seedCurrentSchema = (adapter: ExpoLikeDb) => {
  adapter.execSync(createNovelTableQuery);
  adapter.execSync(createChapterTableQuery);
  adapter.execSync(createCategoriesTableQuery);
  adapter.execSync(
    "INSERT OR IGNORE INTO Category (id, name, sort) VALUES (1, 'Default', 1), (2, 'Local', 2)",
  );
  adapter.execSync(createNovelCategoryTableQuery);
  adapter.execSync(createRepositoryTableQuery);
  adapter.execSync(createCategoryTriggerQuery);
  adapter.execSync(createNovelTriggerQueryInsert);
  adapter.execSync(createNovelTriggerQueryUpdate);
  adapter.execSync(createNovelTriggerQueryDelete);
};

/** v2-era: current schema but OLD lexicographic trigger bodies. */
const seedV2WithOldTriggers = (adapter: ExpoLikeDb) => {
  seedCurrentSchema(adapter);
  adapter.execSync('DROP TRIGGER update_novel_stats');
  adapter.execSync('DROP TRIGGER update_novel_stats_on_update');
  adapter.execSync('DROP TRIGGER update_novel_stats_on_delete');
  adapter.execSync(OLD_INSERT_TRIGGER);
  adapter.execSync(OLD_UPDATE_TRIGGER);
  adapter.execSync(OLD_DELETE_TRIGGER);
};

/** v1-era: bare tables WITHOUT the migration-002 counter columns or triggers. */
const seedV1Schema = (adapter: ExpoLikeDb) => {
  adapter.execSync(`
    CREATE TABLE Novel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      pluginId TEXT NOT NULL,
      name TEXT NOT NULL,
      cover TEXT,
      summary TEXT,
      author TEXT,
      artist TEXT,
      status TEXT DEFAULT 'Unknown',
      genres TEXT,
      inLibrary INTEGER DEFAULT 0,
      isLocal INTEGER DEFAULT 0,
      totalPages INTEGER DEFAULT 0,
      UNIQUE(path, pluginId)
    );
  `);
  adapter.execSync(`
    CREATE TABLE Chapter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novelId INTEGER NOT NULL,
      path TEXT NOT NULL,
      name TEXT NOT NULL,
      releaseTime TEXT,
      bookmark INTEGER DEFAULT 0,
      unread INTEGER DEFAULT 1,
      readTime TEXT,
      isDownloaded INTEGER DEFAULT 0,
      updatedTime TEXT,
      chapterNumber REAL NULL,
      page TEXT DEFAULT '1',
      position INTEGER DEFAULT 0,
      progress INTEGER,
      UNIQUE(path, novelId),
      FOREIGN KEY (novelId) REFERENCES Novel(id) ON DELETE CASCADE
    );
  `);
  adapter.execSync(createCategoriesTableQuery);
  adapter.execSync(
    "INSERT OR IGNORE INTO Category (id, name, sort) VALUES (1, 'Default', 1), (2, 'Local', 2)",
  );
  adapter.execSync(createNovelCategoryTableQuery);
  adapter.execSync(createRepositoryTableQuery);
};

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

const normalizeSql = (sql: string): string =>
  sql
    .replace(/IF NOT EXISTS /g, '')
    .replace(/;\s*$/, '')
    .trim();

const runRunner = (adapter: ExpoLikeDb) => {
  new MigrationRunner(migrations).runMigrations(
    adapter as unknown as Parameters<
      typeof MigrationRunner.prototype.runMigrations
    >[0],
  );
};

describe('MigrationRunner upgrade paths → migration004', () => {
  it('fresh install: createInitialSchema-equivalent (v0→2) → runner → version 5, julianday triggers', () => {
    const { adapter } = createExpoLikeDb();
    seedCurrentSchema(adapter);
    adapter.execSync('PRAGMA user_version = 2');

    runRunner(adapter);

    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 5,
    });
    expect(triggerNames(adapter)).toEqual([
      'add_category',
      'update_novel_stats',
      'update_novel_stats_on_delete',
      'update_novel_stats_on_update',
    ]);
    expect(normalizeSql(triggerSql(adapter, 'update_novel_stats'))).toBe(
      normalizeSql(createNovelTriggerQueryInsert),
    );
  });

  it('v1-era upgrade: bare tables without counters/triggers → runner adds 002/003/004/005 → version 5', () => {
    const { adapter } = createExpoLikeDb();
    seedV1Schema(adapter);
    adapter.execSync('PRAGMA user_version = 1');

    // Seed a chapter so 002's backfill and 004's backfill have data.
    adapter.runSync(
      "INSERT INTO Novel (id, path, pluginId, name) VALUES (1, '/p', 'pl', 'N')",
    );
    adapter.runSync(
      "INSERT INTO Chapter (id, novelId, path, name, updatedTime) VALUES (1, 1, '/c', 'C', '2026-08-01 09:00:00')",
    );

    runRunner(adapter);

    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 5,
    });

    // 002 added the counter columns.
    const novelCols = adapter
      .getAllSync<{ name: string }>('PRAGMA table_info(Novel)')
      .map(c => c.name);
    for (const col of [
      'chaptersDownloaded',
      'chaptersUnread',
      'totalChapters',
      'lastReadAt',
      'lastUpdatedAt',
    ]) {
      expect(novelCols).toContain(col);
    }

    // 004 installed julianday triggers.
    expect(normalizeSql(triggerSql(adapter, 'update_novel_stats'))).toBe(
      normalizeSql(createNovelTriggerQueryInsert),
    );
    expect(triggerSql(adapter, 'update_novel_stats')).toContain('julianday');
    expect(triggerNames(adapter)).toContain('add_category');
  });

  it('v2 upgrade: old lexicographic triggers → julianday bodies + backfill corrected + 005', () => {
    const { adapter } = createExpoLikeDb();
    seedV2WithOldTriggers(adapter);
    adapter.execSync('PRAGMA user_version = 2');

    // Simulate existing data with a non-padded hour: old MAX() picked 8:00:00.
    adapter.runSync(
      "INSERT INTO Novel (id, path, pluginId, name) VALUES (1, '/p', 'pl', 'N')",
    );
    adapter.runSync(
      "INSERT INTO Chapter (id, novelId, path, name, updatedTime) VALUES (1, 1, '/c1', 'C1', '2026-08-01 8:00:00')",
    );
    adapter.runSync(
      "INSERT INTO Chapter (id, novelId, path, name, updatedTime) VALUES (2, 1, '/c2', 'C2', '2026-08-01 09:00:00')",
    );

    runRunner(adapter);

    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 5,
    });
    expect(normalizeSql(triggerSql(adapter, 'update_novel_stats'))).toBe(
      normalizeSql(createNovelTriggerQueryInsert),
    );
    expect(triggerSql(adapter, 'update_novel_stats')).toContain('julianday');

    const novel = adapter.getFirstSync<{ lastUpdatedAt: string | null }>(
      'SELECT lastUpdatedAt FROM Novel WHERE id = 1',
    );
    expect(novel?.lastUpdatedAt).toBe('2026-08-01 09:00:00');
  });

  it('v3 upgrade (ttsState already present): runner applies 004 + 005 → version 5', () => {
    const { adapter } = createExpoLikeDb();
    seedV2WithOldTriggers(adapter);
    adapter.execSync('PRAGMA user_version = 3');

    runRunner(adapter);

    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 5,
    });
    expect(triggerNames(adapter)).toHaveLength(4);
    expect(triggerSql(adapter, 'update_novel_stats')).toContain('julianday');
  });

  it('empty DB with user_version=0: 002/003 skip gracefully, 004 guard throws (never reached in prod)', () => {
    const { adapter } = createExpoLikeDb();
    adapter.execSync('PRAGMA user_version = 0');

    expect(() => runRunner(adapter)).toThrow(
      /Migration 4 aborted: Novel is missing columns/,
    );

    // Version stays 3 — 002 and 003 completed (each bumps the version), and
    // the runner stops at the failing 004 (its transaction rolls back).
    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 3,
    });
    expect(triggerNames(adapter)).toEqual([]);
  });

  it('large novel set: julianday-consistent lastUpdatedAt for every novel after upgrade', () => {
    const { adapter } = createExpoLikeDb();
    seedV2WithOldTriggers(adapter);
    adapter.execSync('PRAGMA user_version = 2');

    // 10 novels, ~500 chapters each, mixed padded/non-padded timestamps.
    const tsFor = (day: number, hour: number, padded: boolean) => {
      const hh = padded ? String(hour).padStart(2, '0') : String(hour);
      return `2026-08-${String(day).padStart(2, '0')} ${hh}:00:00`;
    };
    const chapterId = { next: 1 };
    for (let novelId = 1; novelId <= 10; novelId++) {
      adapter.runSync(
        'INSERT INTO Novel (id, path, pluginId, name) VALUES (?, ?, ?, ?)',
        novelId,
        `/p/${novelId}`,
        'pl',
        `Novel ${novelId}`,
      );
      for (let c = 0; c < 500; c++) {
        const day = (c % 9) + 1;
        const hour = 8 + (c % 12); // 8..19
        adapter.runSync(
          'INSERT INTO Chapter (id, novelId, path, name, updatedTime) VALUES (?, ?, ?, ?, ?)',
          chapterId.next++,
          novelId,
          `/c/${chapterId.next}`,
          `Ch ${chapterId.next}`,
          tsFor(day, hour, c % 2 === 0),
        );
      }
    }

    runRunner(adapter);

    // Every novel's lastUpdatedAt equals the julianday-max updatedTime of its chapters.
    const novels = adapter.getAllSync<{
      id: number;
      lastUpdatedAt: string | null;
    }>('SELECT id, lastUpdatedAt FROM Novel ORDER BY id');
    expect(novels).toHaveLength(10);
    for (const novel of novels) {
      const expected = adapter.getFirstSync<{ v: string | null }>(
        `SELECT updatedTime AS v FROM Chapter WHERE novelId = ? AND updatedTime IS NOT NULL ORDER BY julianday(updatedTime) DESC LIMIT 1`,
        novel.id,
      );
      expect(novel.lastUpdatedAt).toBe(expected?.v ?? null);
    }
    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 5,
    });
  });
});
