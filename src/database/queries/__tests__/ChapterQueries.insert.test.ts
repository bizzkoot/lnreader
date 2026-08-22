import { db } from '@database/db';
import * as ChapterQueries from '../ChapterQueries';
import { ChapterItem } from '@plugins/types';

jest.mock('@database/db', () => {
  const runAsync = jest.fn(() =>
    Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
  );
  const execAsync = jest.fn(() => Promise.resolve());
  return {
    db: {
      runAsync,
      execAsync,
      withExclusiveTransactionAsync: jest.fn(callback =>
        callback({ runAsync, execAsync }),
      ),
      getAllAsync: jest.fn(() => Promise.resolve([])),
      getFirstAsync: jest.fn(() => Promise.resolve(null)),
      getFirstSync: jest.fn(() => null),
      getAllSync: jest.fn(() => []),
    },
  };
});

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

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  },
}));

const makeChapters = (): ChapterItem[] => [
  {
    name: 'Chapter 1',
    path: '/sources/book/1',
    releaseTime: '2026-01-01T00:00:00Z',
    page: '1',
    chapterNumber: 1,
  },
  {
    name: 'Chapter 2',
    path: '/sources/book/2',
    releaseTime: undefined,
    page: '1',
    chapterNumber: undefined,
  },
];

const INSERT_SQL = `
          INSERT INTO Chapter (path, name, releaseTime, novelId, chapterNumber, page, position)
          SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT id FROM Chapter WHERE path = ? AND novelId = ?);
        `;

const UPDATE_SQL = `
            UPDATE Chapter SET
              page = ?, position = ?, name = ?, releaseTime = ?, chapterNumber = ?
            WHERE path = ? AND novelId = ? AND (page IS NOT ? OR position IS NOT ? OR name IS NOT ? OR releaseTime IS NOT ? OR chapterNumber IS NOT ?);
          `;

describe('ChapterQueries insertChapters upsert', () => {
  const dbRunAsync = db.runAsync as jest.Mock;
  const dbTx = db.withExclusiveTransactionAsync as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs the UPDATE branch when the INSERT matches an existing row (changes === 0)', async () => {
    // First INSERT reports 0 changes → the row already exists → guarded UPDATE.
    dbRunAsync.mockResolvedValue({ lastInsertRowId: -1, changes: 0 });

    await ChapterQueries.insertChapters(42, makeChapters());

    expect(dbRunAsync).toHaveBeenCalledTimes(4); // 2 INSERTs + 2 UPDATEs
    // Per chapter: INSERT (changes 0) then the null-safe UPDATE.
    expect(dbRunAsync).toHaveBeenNthCalledWith(
      2,
      UPDATE_SQL,
      '1',
      0,
      'Chapter 1',
      '2026-01-01T00:00:00Z',
      1,
      '/sources/book/1',
      42,
      '1',
      0,
      'Chapter 1',
      '2026-01-01T00:00:00Z',
      1,
    );
    // Nullable values bind as null and compare with IS NOT.
    expect(dbRunAsync).toHaveBeenNthCalledWith(
      4,
      UPDATE_SQL,
      '1',
      1,
      'Chapter 2',
      '',
      null,
      '/sources/book/2',
      42,
      '1',
      1,
      'Chapter 2',
      '',
      null,
    );
  });

  it('skips the UPDATE branch when the INSERT succeeded (changes > 0)', async () => {
    dbRunAsync.mockResolvedValue({ lastInsertRowId: 1, changes: 1 });

    await ChapterQueries.insertChapters(42, makeChapters());

    expect(dbRunAsync).toHaveBeenCalledTimes(2); // INSERTs only
    expect(dbRunAsync).toHaveBeenNthCalledWith(
      1,
      INSERT_SQL,
      '/sources/book/1',
      'Chapter 1',
      '2026-01-01T00:00:00Z',
      42,
      1,
      '1',
      0,
      '/sources/book/1',
      42,
    );
  });

  it('no-ops when no chapters are supplied', async () => {
    await ChapterQueries.insertChapters(42, []);
    await ChapterQueries.insertChapters(42, undefined);

    expect(dbTx).not.toHaveBeenCalled();
  });
});
