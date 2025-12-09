import { db } from '@database/db';
import * as ChapterQueries from '../ChapterQueries';

// Mock the database module
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

describe('ChapterQueries TTS Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateChapterTTSState', () => {
    it('should update ttsState for a given chapter', async () => {
      const chapterId = 123;
      const ttsState = JSON.stringify({ paragraphIndex: 5 });

      await ChapterQueries.updateChapterTTSState(chapterId, ttsState);

      expect(db.runAsync).toHaveBeenCalledWith(
        'UPDATE Chapter SET ttsState = ? WHERE id = ?',
        ttsState,
        chapterId,
      );
    });
  });

  describe('markChaptersBeforePositionRead', () => {
    it('should mark chapters before a position as read (100% progress)', async () => {
      const novelId = 1;
      const position = 10;

      await ChapterQueries.markChaptersBeforePositionRead(novelId, position);

      expect(db.runAsync).toHaveBeenCalledWith(
        'UPDATE Chapter SET `unread` = 0, `progress` = 100 WHERE novelId = ? AND position < ?',
        novelId,
        position,
      );
    });
  });

  describe('resetFutureChaptersProgress', () => {
    it('should reset single next chapter when mode is reset-next', async () => {
      const novelId = 1;
      const currentChapterId = 100;
      const currentPosition = 5;

      // Mock getChapter to return current chapter info
      (db.getFirstAsync as jest.Mock).mockResolvedValueOnce({
        id: currentChapterId,
        position: currentPosition,
      });

      // Mock getting the ID to reset
      (db.getAllAsync as jest.Mock).mockResolvedValueOnce([{ id: 101 }]);

      await ChapterQueries.resetFutureChaptersProgress(
        novelId,
        currentChapterId,
        'reset-next',
      );

      // Verify fetching chapters to reset
      expect(db.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id FROM Chapter WHERE novelId = ?'),
        novelId,
        currentPosition,
        1,
      );

      // Verify reset execution
      expect(db.execAsync).toHaveBeenCalledWith(
        'UPDATE Chapter SET progress = 0, unread = 1, ttsState = NULL WHERE id IN (101)',
      );
    });

    it('should reset all future chapters when mode is reset-all', async () => {
      const novelId = 1;
      const currentChapterId = 100;
      const currentPosition = 5;

      (db.getFirstAsync as jest.Mock).mockResolvedValueOnce({
        id: currentChapterId,
        position: currentPosition,
      });

      await ChapterQueries.resetFutureChaptersProgress(
        novelId,
        currentChapterId,
        'reset-all',
      );

      expect(db.runAsync).toHaveBeenCalledWith(
        'UPDATE Chapter SET progress = 0, unread = 1, ttsState = NULL WHERE novelId = ? AND position > ?',
        novelId,
        currentPosition,
      );
    });

    it('should do nothing if current chapter not found', async () => {
      (db.getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

      await ChapterQueries.resetFutureChaptersProgress(1, 100, 'reset-next');

      expect(db.runAsync).not.toHaveBeenCalled();
      expect(db.execAsync).not.toHaveBeenCalled();
    });
  });

  describe('updateChapterProgressByIds', () => {
    it('should update progress for multiple chapters', async () => {
      const chapterIds = [1, 2, 3];
      const progress = 100;

      await ChapterQueries.updateChapterProgressByIds(chapterIds, progress);

      expect(db.runAsync).toHaveBeenCalledWith(
        `UPDATE Chapter SET progress = ? WHERE id in (1,2,3)`,
        progress,
      );
    });
  });
});
