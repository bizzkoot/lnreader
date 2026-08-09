import { db } from '@database/db';
import * as ChapterQueries from '../ChapterQueries';

jest.mock('@database/db', () => ({
  db: {
    runAsync: jest.fn(() =>
      Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
    ),
    execAsync: jest.fn(() => Promise.resolve()),
    withExclusiveTransactionAsync: jest.fn(callback =>
      callback({
        runAsync: jest.fn(() =>
          Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
        ),
      }),
    ),
    getAllAsync: jest.fn(() => Promise.resolve([])),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getFirstSync: jest.fn(() => null),
    getAllSync: jest.fn(() => []),
  },
}));

describe('ChapterQueries getNovelChaptersByNumber', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers a real chapterNumber match when the source uses dense numbering', async () => {
    const row = { id: 7, chapterNumber: 12, position: 11 };
    (db.getAllAsync as jest.Mock).mockResolvedValueOnce([row]);

    const res = await ChapterQueries.getNovelChaptersByNumber(42, 12);

    // Exactly one query: the chapterNumber path wins, position is never used.
    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM Chapter WHERE novelId = ? AND chapterNumber = ? ORDER BY position ASC',
      42,
      12,
    );
    expect(res).toEqual([row]);
  });

  it('falls back to the position heuristic when chapterNumber is NULL in the DB', async () => {
    // Source leaves chapterNumber NULL: first query comes back empty, so the
    // position heuristic is used as the fallback.
    (db.getAllAsync as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 9, position: 4 }]);

    const res = await ChapterQueries.getNovelChaptersByNumber(42, 5);

    expect(db.getAllAsync).toHaveBeenNthCalledWith(
      2,
      'SELECT * FROM Chapter WHERE novelId = ? AND position = ?',
      42,
      4, // chapterNumber - 1
    );
    expect(res).toEqual([{ id: 9, position: 4 }]);
  });

  it('returns [] when neither the chapterNumber nor the position query matches', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    const res = await ChapterQueries.getNovelChaptersByNumber(42, 99);

    expect(res).toEqual([]);
    expect(db.getAllAsync).toHaveBeenCalledTimes(2);
  });

  it('skips the chapterNumber query entirely for invalid/non-positive input', async () => {
    (db.getAllAsync as jest.Mock).mockResolvedValue([]);

    await ChapterQueries.getNovelChaptersByNumber(42, 0);

    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
    expect(db.getAllAsync).toHaveBeenCalledWith(
      'SELECT * FROM Chapter WHERE novelId = ? AND position = ?',
      42,
      -1,
    );
  });
});
