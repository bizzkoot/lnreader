import Database from 'better-sqlite3';
import { db } from '@database/db';
import * as ChapterQueries from '../ChapterQueries';
import {
  createNovelTableQuery,
  createNovelTriggerQueryUpdate,
} from '../../tables/NovelTable';
import { createChapterTableQuery } from '../../tables/ChapterTable';

jest.mock('@database/db', () => ({
  db: {
    runAsync: jest.fn(() =>
      Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
    ),
    execAsync: jest.fn(() => Promise.resolve()),
    withExclusiveTransactionAsync: jest.fn(),
    getAllAsync: jest.fn(() => Promise.resolve([])),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getFirstSync: jest.fn(() => null),
    getAllSync: jest.fn(() => []),
  },
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: 'file://novels',
}));

jest.mock('@specs/NativeFile', () => ({
  unlink: jest.fn(),
}));

describe('ChapterQueries clearUpdates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs inside a single exclusive transaction', async () => {
    const txExecAsync = jest.fn((_sql: string) => Promise.resolve());
    (db.withExclusiveTransactionAsync as jest.Mock).mockImplementation(
      callback =>
        callback({
          runAsync: jest.fn(() =>
            Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
          ),
          execAsync: txExecAsync,
        }),
    );

    await ChapterQueries.clearUpdates();

    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(txExecAsync.mock.calls.map(call => call[0])).toEqual([
      'DROP TRIGGER IF EXISTS update_novel_stats_on_update',
      'UPDATE Chapter SET updatedTime = NULL',
      'UPDATE Novel SET lastUpdatedAt = NULL',
      createNovelTriggerQueryUpdate,
    ]);
  });

  it('recreates the shared trigger constant (single source of truth)', async () => {
    const txExecAsync = jest.fn((_sql: string) => Promise.resolve());
    (db.withExclusiveTransactionAsync as jest.Mock).mockImplementation(
      callback =>
        callback({
          runAsync: jest.fn(() =>
            Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
          ),
          execAsync: txExecAsync,
        }),
    );

    await ChapterQueries.clearUpdates();

    // The final statement must be the exact exported trigger DDL used by
    // bootstrap (db.ts) and migration 004 — not a fork of it.
    expect(txExecAsync).toHaveBeenLastCalledWith(createNovelTriggerQueryUpdate);
    expect(createNovelTriggerQueryUpdate).toContain(
      'CREATE TRIGGER IF NOT EXISTS update_novel_stats_on_update',
    );
  });

  it('clears updatedTime/lastUpdatedAt and leaves the trigger functional (real SQLite)', async () => {
    const sqlite = new Database(':memory:');
    sqlite.exec(createNovelTableQuery);
    sqlite.exec(createChapterTableQuery);
    sqlite.exec(createNovelTriggerQueryUpdate);
    sqlite.exec(
      "INSERT INTO Novel (path, pluginId, name, inLibrary) VALUES ('p', 'pl', 'n', 1)",
    );
    sqlite.exec(
      "INSERT INTO Chapter (path, name, novelId, position, updatedTime) VALUES ('c1','C1',1,0,'2024-01-01')",
    );
    sqlite.exec(
      "INSERT INTO Chapter (path, name, novelId, position, updatedTime) VALUES ('c2','C2',1,1,'2024-01-02')",
    );

    const txExecAsync = (sql: string) => {
      sqlite.exec(sql);
      return Promise.resolve();
    };
    (db.withExclusiveTransactionAsync as jest.Mock).mockImplementation(
      callback =>
        callback({
          runAsync: jest.fn(() =>
            Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
          ),
          execAsync: txExecAsync,
        }),
    );

    await ChapterQueries.clearUpdates();

    // All chapter update timestamps are cleared.
    const chapterRows = sqlite
      .prepare('SELECT updatedTime FROM Chapter ORDER BY id')
      .all() as Array<{ updatedTime: string | null }>;
    expect(chapterRows.every(row => row.updatedTime === null)).toBe(true);

    // The bulk lastUpdatedAt reset ran for the novel.
    const novel = sqlite
      .prepare('SELECT lastUpdatedAt FROM Novel WHERE id = 1')
      .get() as { lastUpdatedAt: string | null };
    expect(novel.lastUpdatedAt).toBeNull();

    // The trigger survives and still reacts to chapter updates.
    const triggers = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'update_novel_stats_on_update'",
      )
      .all();
    expect(triggers).toHaveLength(1);

    sqlite.exec("UPDATE Chapter SET updatedTime = '2024-02-01' WHERE id = 1");
    const after = sqlite
      .prepare('SELECT lastUpdatedAt FROM Novel WHERE id = 1')
      .get() as { lastUpdatedAt: string | null };
    expect(after.lastUpdatedAt).toBe('2024-02-01');

    sqlite.close();
  });
});
