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

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));
jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

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

const runRunner = (adapter: ExpoLikeDb) => {
  new MigrationRunner(migrations).runMigrations(
    adapter as unknown as Parameters<
      typeof MigrationRunner.prototype.runMigrations
    >[0],
  );
};

const insertNovel = (adapter: ExpoLikeDb, id: number) => {
  adapter.runSync(
    'INSERT INTO Novel (id, path, pluginId, name) VALUES (?, ?, ?, ?)',
    id,
    `/p${id}`,
    'pl',
    `N${id}`,
  );
};

const insertChapter = (adapter: ExpoLikeDb, id: number, novelId: number) => {
  adapter.runSync(
    'INSERT INTO Chapter (id, novelId, path, name) VALUES (?, ?, ?, ?)',
    id,
    novelId,
    `/c${id}`,
    `C${id}`,
  );
};

describe('Migration 006 — ReadingSession', () => {
  it('fresh install (v2) → runner creates ReadingSession with FK + indexes → version 7', () => {
    const { adapter } = createExpoLikeDb();
    seedCurrentSchema(adapter);
    adapter.execSync('PRAGMA user_version = 2');

    runRunner(adapter);

    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 7,
    });

    const tables = adapter.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ReadingSession'",
    );
    expect(tables).toHaveLength(1);

    const cols = adapter
      .getAllSync<{ name: string }>('PRAGMA table_info(ReadingSession)')
      .map(c => c.name);
    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'novelId',
        'chapterId',
        'startTime',
        'duration',
      ]),
    );

    const idx = adapter
      .getAllSync<{
        name: string;
      }>(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ReadingSession' ORDER BY name",
      )
      .map(r => r.name);
    expect(idx).toEqual(
      expect.arrayContaining([
        'idx_reading_session_novel',
        'idx_reading_session_chapter',
        'idx_reading_session_startTime',
      ]),
    );

    // Check FK pragma
    const fk = adapter.getAllSync<{ table: string; from: string; to: string }>(
      'PRAGMA foreign_key_list(ReadingSession)',
    );
    expect(fk).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ table: 'Novel', from: 'novelId', to: 'id' }),
        expect.objectContaining({
          table: 'Chapter',
          from: 'chapterId',
          to: 'id',
        }),
      ]),
    );
  });

  it('idempotent: re-running migration 006 does not throw and preserves data', () => {
    const { adapter } = createExpoLikeDb();
    seedCurrentSchema(adapter);
    adapter.execSync('PRAGMA user_version = 2');
    runRunner(adapter);

    // Insert a session
    insertNovel(adapter, 1);
    insertChapter(adapter, 1, 1);
    adapter.execSync('PRAGMA foreign_keys = ON');
    adapter.runSync(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      1,
      1,
      1000,
      5000,
    );

    // Simulate re-run from version 5 (manually set back)
    adapter.execSync('PRAGMA user_version = 5');
    expect(() => runRunner(adapter)).not.toThrow();

    expect(adapter.getFirstSync('PRAGMA user_version')).toEqual({
      user_version: 7,
    });
    expect(adapter.getAllSync('SELECT * FROM ReadingSession')).toHaveLength(1);
  });

  it('FK cascade: deleting Novel cascades ReadingSession, deleting Chapter cascades', () => {
    const { adapter } = createExpoLikeDb();
    seedCurrentSchema(adapter);
    adapter.execSync('PRAGMA user_version = 2');
    runRunner(adapter);
    adapter.execSync('PRAGMA foreign_keys = ON');

    insertNovel(adapter, 1);
    insertChapter(adapter, 10, 1);
    adapter.runSync(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      1,
      10,
      1000,
      2000,
    );
    adapter.runSync(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      1,
      10,
      3000,
      4000,
    );
    expect(adapter.getAllSync('SELECT * FROM ReadingSession')).toHaveLength(2);

    // Delete chapter → cascade
    adapter.runSync('DELETE FROM Chapter WHERE id = ?', 10);
    expect(adapter.getAllSync('SELECT * FROM ReadingSession')).toHaveLength(0);

    // Recreate for novel cascade
    insertChapter(adapter, 11, 1);
    adapter.runSync(
      'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
      1,
      11,
      5000,
      6000,
    );
    adapter.runSync('DELETE FROM Novel WHERE id = ?', 1);
    expect(adapter.getAllSync('SELECT * FROM ReadingSession')).toHaveLength(0);
  });

  it('CHECK constraint rejects negative duration', () => {
    const { adapter } = createExpoLikeDb();
    seedCurrentSchema(adapter);
    adapter.execSync('PRAGMA user_version = 2');
    runRunner(adapter);
    adapter.execSync('PRAGMA foreign_keys = ON');
    insertNovel(adapter, 1);
    insertChapter(adapter, 1, 1);
    expect(() =>
      adapter.runSync(
        'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
        1,
        1,
        1000,
        -5,
      ),
    ).toThrow();
  });
});
