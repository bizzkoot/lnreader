import { db } from '@database/db';
import * as ChapterQueries from '../ChapterQueries';
import NativeFile from '@specs/NativeFile';

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

describe('ChapterQueries download deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteDownloads', () => {
    it('should delete files and clear isDownloaded only for the given chapter ids', async () => {
      const chapters = [
        { id: 1, novelId: 10, pluginId: 'plugin-a' },
        { id: 2, novelId: 10, pluginId: 'plugin-a' },
      ];

      await ChapterQueries.deleteDownloads(chapters);

      // Each chapter's folder is removed: NOVEL_STORAGE/pluginId/novelId/chapterId
      expect(NativeFile.unlink).toHaveBeenCalledWith(
        'file://novels/plugin-a/10/1',
      );
      expect(NativeFile.unlink).toHaveBeenCalledWith(
        'file://novels/plugin-a/10/2',
      );
      expect(NativeFile.unlink).toHaveBeenCalledTimes(2);

      // The flag reset must be scoped to the given ids, never global
      expect(db.execAsync).toHaveBeenCalledWith(
        'UPDATE Chapter SET isDownloaded = 0 WHERE id IN (1,2)',
      );
    });

    it('should not touch the database when no chapters are passed', async () => {
      await ChapterQueries.deleteDownloads([]);

      expect(NativeFile.unlink).not.toHaveBeenCalled();
      expect(db.execAsync).not.toHaveBeenCalled();
    });
  });

  describe('deleteReadChaptersFromDb', () => {
    it('should delete files using the chapter id as the folder segment', async () => {
      const readDownloadedChapters = [
        { id: 5, novelId: 10, pluginId: 'plugin-a' },
        { id: 6, novelId: 11, pluginId: 'plugin-b' },
      ];
      (db.getAllAsync as jest.Mock).mockResolvedValueOnce(
        readDownloadedChapters,
      );

      await ChapterQueries.deleteReadChaptersFromDb();

      // Folder must use chapter.id as the last segment, NOT novelId twice
      expect(NativeFile.unlink).toHaveBeenCalledWith(
        'file://novels/plugin-a/10/5',
      );
      expect(NativeFile.unlink).toHaveBeenCalledWith(
        'file://novels/plugin-b/11/6',
      );
      expect(NativeFile.unlink).toHaveBeenCalledTimes(2);

      // execAsync is awaited and scoped to the read chapters
      expect(db.execAsync).toHaveBeenCalledWith(
        'UPDATE Chapter SET isDownloaded = 0 WHERE id IN (5,6)',
      );
    });

    it('should no-op safely when there are no read downloaded chapters', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValueOnce([]);

      await ChapterQueries.deleteReadChaptersFromDb();

      expect(NativeFile.unlink).not.toHaveBeenCalled();
      expect(db.execAsync).not.toHaveBeenCalled();
    });
  });
});
