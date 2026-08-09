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

describe('ChapterQueries getNovelDownloadedChapters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('range branch', () => {
    it('should use LIMIT/OFFSET with global ordinal over the flat (page, position) order', async () => {
      await ChapterQueries.getNovelDownloadedChapters(42, 3, 5);

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 ORDER BY CAST(page AS INTEGER) ASC, position ASC LIMIT ? OFFSET ?',
        42,
        3, // endPosition - startPosition + 1 = 5 - 3 + 1
        2, // startPosition - 1
      );
    });

    it('should map a single-chapter range to LIMIT 1 OFFSET 0', async () => {
      await ChapterQueries.getNovelDownloadedChapters(7, 1, 1);

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 ORDER BY CAST(page AS INTEGER) ASC, position ASC LIMIT ? OFFSET ?',
        7,
        1,
        0,
      );
    });

    it('should produce a negative limit when the range overruns backwards (safe, clamped by SQL)', async () => {
      // start > end is guarded upstream in the modal; still verify the math is
      // passed through consistently rather than silently mis-windowed.
      await ChapterQueries.getNovelDownloadedChapters(7, 5, 3);

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 ORDER BY CAST(page AS INTEGER) ASC, position ASC LIMIT ? OFFSET ?',
        7,
        -1,
        4,
      );
    });

    it('should keep the isDownloaded = 1 filter and page-then-position ordering', async () => {
      await ChapterQueries.getNovelDownloadedChapters(42, 1, 10);

      const sql = (db.getAllAsync as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('WHERE novelId = ? AND isDownloaded = 1');
      expect(sql).toContain('ORDER BY CAST(page AS INTEGER) ASC, position ASC');
      expect(sql).not.toContain('position >=');
      expect(sql).not.toContain('position <=');
    });
  });

  describe('no-range branch', () => {
    it('should fetch all downloaded chapters for the novel without LIMIT/OFFSET', async () => {
      await ChapterQueries.getNovelDownloadedChapters(42);

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 ORDER BY CAST(page AS INTEGER) ASC, position ASC',
        42,
      );
    });

    it('should ignore a partial range (only startPosition set)', async () => {
      await ChapterQueries.getNovelDownloadedChapters(42, 2);

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 ORDER BY CAST(page AS INTEGER) ASC, position ASC',
        42,
      );
    });
  });
});
