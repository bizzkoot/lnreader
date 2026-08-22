import { db } from '@database/db';
import * as ChapterQueries from '../ChapterQueries';
import NativeFile from '@specs/NativeFile';
import { MMKVStorage } from '@utils/mmkv/mmkv';

jest.mock('@database/db', () => {
  const execAsync = jest.fn(() => Promise.resolve());
  const runAsync = jest.fn(() =>
    Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
  );
  return {
    db: {
      runAsync,
      execAsync,
      // Transaction statements are routed to the same mocks so call-count
      // assertions on db.execAsync / db.runAsync keep working.
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

const buildChapterRows = (ids: number[]) =>
  ids.map(id => ({
    id,
    novelId: 1,
    name: `Chapter ${id}`,
    position: id,
    unread: 1,
    bookmark: 0,
    isDownloaded: 1,
    page: '1',
  }));

describe('ChapterQueries select-all across lazy batches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPageChapterIds', () => {
    it('should query ids for the current page + filter without a batch limit', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);

      const ids = await ChapterQueries.getPageChapterIds(
        42,
        ' AND unread = 1',
        '2',
      );

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT id FROM Chapter WHERE novelId = ? AND page = ?  AND unread = 1 ORDER BY position ASC',
        42,
        '2',
      );
      expect(ids).toEqual([1, 2, 3]);
    });

    it('should default to page 1 and empty filter when omitted', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValue([]);

      await ChapterQueries.getPageChapterIds(42);

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT id FROM Chapter WHERE novelId = ? AND page = ?  ORDER BY position ASC',
        42,
        '1',
      );
    });
  });

  describe('getChaptersByIds', () => {
    it('should return rows in the requested id order', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValueOnce(
        buildChapterRows([1, 2, 3]),
      );

      const chapters = await ChapterQueries.getChaptersByIds([3, 1, 2]);

      expect(chapters.map(ch => ch.id)).toEqual([3, 1, 2]);
      expect(db.getAllAsync).toHaveBeenCalledTimes(1);
      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM Chapter WHERE id IN (3,1,2)',
      );
    });

    it('should chunk lookups beyond CHAPTER_ID_BATCH_SIZE and merge in order', async () => {
      const ids = Array.from({ length: 1200 }, (_, i) => i + 1);
      (db.getAllAsync as jest.Mock)
        .mockReturnValueOnce(buildChapterRows(ids.slice(0, 500)))
        .mockReturnValueOnce(buildChapterRows(ids.slice(500, 1000)))
        .mockReturnValueOnce(buildChapterRows(ids.slice(1000, 1200)));

      const chapters = await ChapterQueries.getChaptersByIds(ids);

      expect(db.getAllAsync).toHaveBeenCalledTimes(3);
      expect(db.getAllAsync).toHaveBeenNthCalledWith(
        1,
        `SELECT * FROM Chapter WHERE id IN (${ids.slice(0, 500).join(',')})`,
      );
      expect(db.getAllAsync).toHaveBeenNthCalledWith(
        3,
        `SELECT * FROM Chapter WHERE id IN (${ids.slice(1000, 1200).join(',')})`,
      );
      expect(chapters).toHaveLength(1200);
      expect(chapters[0].id).toBe(1);
      expect(chapters[1199].id).toBe(1200);
    });

    it('should skip ids with no matching row and return [] for empty input', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValueOnce(
        buildChapterRows([1, 3]),
      );

      const chapters = await ChapterQueries.getChaptersByIds([1, 2, 3]);

      expect(chapters.map(ch => ch.id)).toEqual([1, 3]);
      await expect(ChapterQueries.getChaptersByIds([])).resolves.toEqual([]);
      expect(db.getAllAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('chunked bulk mutations', () => {
    const manyIds = Array.from({ length: 1200 }, (_, i) => i + 1);
    const chunkSql = (ids: number[]) => ids.join(',');

    it('markChaptersRead should chunk the UPDATE by 500', async () => {
      await ChapterQueries.markChaptersRead(manyIds);

      expect(db.execAsync).toHaveBeenCalledTimes(3);
      expect(db.execAsync).toHaveBeenNthCalledWith(
        1,
        `UPDATE Chapter SET \`unread\` = 0 WHERE id IN (${chunkSql(manyIds.slice(0, 500))})`,
      );
      expect(db.execAsync).toHaveBeenNthCalledWith(
        3,
        `UPDATE Chapter SET \`unread\` = 0 WHERE id IN (${chunkSql(manyIds.slice(1000, 1200))})`,
      );
    });

    it('markChaptersUnread should chunk the UPDATE and clear MMKV progress for every id', async () => {
      await ChapterQueries.markChaptersUnread(manyIds);

      expect(db.execAsync).toHaveBeenCalledTimes(3);
      expect(db.execAsync).toHaveBeenNthCalledWith(
        1,
        `UPDATE Chapter SET \`unread\` = 1 WHERE id IN (${chunkSql(manyIds.slice(0, 500))})`,
      );
      expect(MMKVStorage.delete).toHaveBeenCalledTimes(1200);
      expect(MMKVStorage.delete).toHaveBeenCalledWith('chapter_progress_1200');
    });

    it('updateChapterProgressByIds should chunk and pass the progress value', async () => {
      await ChapterQueries.updateChapterProgressByIds(manyIds, 100);

      expect(db.runAsync).toHaveBeenCalledTimes(3);
      expect(db.runAsync).toHaveBeenNthCalledWith(
        1,
        `UPDATE Chapter SET progress = ? WHERE id in (${chunkSql(manyIds.slice(0, 500))})`,
        100,
      );
    });

    it('bookmarkChapters should chunk the toggle UPDATE', async () => {
      await ChapterQueries.bookmarkChapters(manyIds);

      expect(db.execAsync).toHaveBeenCalledTimes(3);
      expect(db.execAsync).toHaveBeenNthCalledWith(
        1,
        `UPDATE Chapter SET bookmark = (CASE WHEN bookmark = 0 THEN 1 ELSE 0 END) WHERE id IN (${chunkSql(manyIds.slice(0, 500))})`,
      );
    });

    it('bulk mutations should no-op on an empty id list', async () => {
      await ChapterQueries.markChaptersRead([]);
      await ChapterQueries.markChaptersUnread([]);
      await ChapterQueries.updateChapterProgressByIds([], 100);
      await ChapterQueries.bookmarkChapters([]);

      expect(db.execAsync).not.toHaveBeenCalled();
      expect(db.runAsync).not.toHaveBeenCalled();
    });
  });

  describe('deleteChapters (id-based)', () => {
    it('should delete downloaded files and clear the flag in 500-id chunks', async () => {
      const ids = Array.from({ length: 1200 }, (_, i) => i + 1);

      await ChapterQueries.deleteChapters('plugin', 7, ids);

      // one unlink per id (chunked Promise.all groups of 500)
      expect(NativeFile.unlink).toHaveBeenCalledTimes(1200);
      expect(NativeFile.unlink).toHaveBeenCalledWith(
        'file://novels/plugin/7/1200',
      );
      expect(db.execAsync).toHaveBeenCalledTimes(3);
      expect(db.execAsync).toHaveBeenNthCalledWith(
        1,
        `UPDATE Chapter SET isDownloaded = 0 WHERE id IN (${ids.slice(0, 500).join(',')})`,
      );
      expect(db.execAsync).toHaveBeenNthCalledWith(
        3,
        `UPDATE Chapter SET isDownloaded = 0 WHERE id IN (${ids.slice(1000, 1200).join(',')})`,
      );
    });

    it('should no-op when no ids are given', async () => {
      await ChapterQueries.deleteChapters('plugin', 7, []);

      expect(NativeFile.unlink).not.toHaveBeenCalled();
      expect(db.execAsync).not.toHaveBeenCalled();
    });
  });
});
