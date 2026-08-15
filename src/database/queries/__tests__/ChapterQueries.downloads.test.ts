import { db } from '@database/db';
import * as ChapterQueries from '../ChapterQueries';
import NativeFile from '@specs/NativeFile';
import type { DownloadedChapter } from '../../types';
import Database from 'better-sqlite3';
import { createNovelTableQuery } from '../../tables/NovelTable';
import { createChapterTableQuery } from '../../tables/ChapterTable';

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

  describe('getDownloadedChapters', () => {
    it('selects Novel.inLibrary so consumers can tell in-library novels apart', async () => {
      await ChapterQueries.getDownloadedChapters();

      const sql = (db.getAllAsync as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('Novel.inLibrary as inLibrary');
    });

    it('returns the real inLibrary value from the Novel JOIN (real SQLite)', async () => {
      const sqlite = new Database(':memory:');
      sqlite.exec(createNovelTableQuery);
      sqlite.exec(createChapterTableQuery);
      sqlite.exec(
        "INSERT INTO Novel (path, pluginId, name, inLibrary) VALUES ('p1','pl1','n1',1)",
      );
      sqlite.exec(
        "INSERT INTO Novel (path, pluginId, name, inLibrary) VALUES ('p2','pl2','n2',0)",
      );
      sqlite.exec(
        "INSERT INTO Chapter (path, name, novelId, position, isDownloaded) VALUES ('c1','C1',1,0,1)",
      );
      sqlite.exec(
        "INSERT INTO Chapter (path, name, novelId, position, isDownloaded) VALUES ('c2','C2',2,0,1)",
      );

      (db.getAllAsync as jest.Mock).mockImplementation(async (sql: string) =>
        sqlite.prepare(sql).all(),
      );

      const rows = await ChapterQueries.getDownloadedChapters();
      expect(rows).toHaveLength(2);
      expect(rows[0].inLibrary).toBe(1);
      expect(rows[1].inLibrary).toBe(0);
      sqlite.close();
    });
  });

  describe('deleteDownloads', () => {
    it('should delete files and clear isDownloaded only for the given chapter ids', async () => {
      const chapters = [
        { id: 1, novelId: 10, pluginId: 'plugin-a' },
        { id: 2, novelId: 10, pluginId: 'plugin-a' },
      ] as DownloadedChapter[];

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
      ] as DownloadedChapter[];
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
