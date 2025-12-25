/**
 * Tests for StatsQueries - Library statistics aggregation queries
 *
 * Focus: Test all stats aggregation operations
 * Coverage targets:
 * - getLibraryStatsFromDb() - Novel and source counts
 * - getChaptersTotalCountFromDb() - Total chapters in library
 * - getChaptersReadCountFromDb() - Read chapters count
 * - getChaptersUnreadCountFromDb() - Unread chapters count
 * - getChaptersDownloadedCountFromDb() - Downloaded chapters count
 * - getNovelGenresFromDb() - Genre aggregation with countBy
 * - getNovelStatusFromDb() - Status aggregation with countBy
 */

import * as StatsQueries from '../StatsQueries';

// Mock the database helper functions
jest.mock('@database/utils/helpers', () => ({
  getAllAsync: jest.fn(() => Promise.resolve([])),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
}));

const { getAllAsync, getFirstAsync } = require('@database/utils/helpers');

describe('StatsQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLibraryStatsFromDb', () => {
    it('should return empty object when no novels in library', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await StatsQueries.getLibraryStatsFromDb();

      expect(result).toEqual({});
      expect(getFirstAsync).toHaveBeenCalledTimes(1);
    });

    it('should return novels count and sources count', async () => {
      const mockStats = { novelsCount: 42, sourcesCount: 5 };
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(mockStats);

      const result = await StatsQueries.getLibraryStatsFromDb();

      expect(result).toEqual(mockStats);
      expect(result.novelsCount).toBe(42);
      expect(result.sourcesCount).toBe(5);
    });

    it('should count only novels with inLibrary = 1', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        novelsCount: 10,
        sourcesCount: 3,
      });

      await StatsQueries.getLibraryStatsFromDb();

      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('WHERE inLibrary = 1'),
        ]),
      );
    });

    it('should count distinct pluginIds as sources', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        novelsCount: 100,
        sourcesCount: 8,
      });

      const result = await StatsQueries.getLibraryStatsFromDb();

      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('COUNT(DISTINCT pluginId)'),
        ]),
      );
      expect(result.sourcesCount).toBe(8);
    });

    it('should handle database errors gracefully', async () => {
      (getFirstAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      await expect(StatsQueries.getLibraryStatsFromDb()).rejects.toThrow(
        'Database connection lost',
      );
    });
  });

  describe('getChaptersTotalCountFromDb', () => {
    it('should return empty object when no chapters found', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await StatsQueries.getChaptersTotalCountFromDb();

      expect(result).toEqual({});
    });

    it('should return total chapters count for library novels', async () => {
      const mockCount = { chaptersCount: 1234 };
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(mockCount);

      const result = await StatsQueries.getChaptersTotalCountFromDb();

      expect(result).toEqual(mockCount);
      expect(result.chaptersCount).toBe(1234);
    });

    it('should only count chapters from novels in library', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        chaptersCount: 500,
      });

      await StatsQueries.getChaptersTotalCountFromDb();

      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('WHERE Novel.inLibrary = 1'),
        ]),
      );
    });

    it('should join Chapter and Novel tables', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        chaptersCount: 100,
      });

      await StatsQueries.getChaptersTotalCountFromDb();

      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('JOIN Novel'),
          expect.stringContaining('ON Chapter.novelId = Novel.id'),
        ]),
      );
    });
  });

  describe('getChaptersReadCountFromDb', () => {
    it('should return empty object when no read chapters found', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await StatsQueries.getChaptersReadCountFromDb();

      expect(result).toEqual({});
    });

    it('should return count of read chapters (unread = 0)', async () => {
      const mockCount = { chaptersRead: 450 };
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(mockCount);

      const result = await StatsQueries.getChaptersReadCountFromDb();

      expect(result).toEqual(mockCount);
      expect(result.chaptersRead).toBe(450);
    });

    it('should only count read chapters from library novels', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        chaptersRead: 200,
      });

      await StatsQueries.getChaptersReadCountFromDb();

      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('WHERE Chapter.unread = 0'),
          expect.stringContaining('AND Novel.inLibrary = 1'),
        ]),
      );
    });
  });

  describe('getChaptersUnreadCountFromDb', () => {
    it('should return empty object when no unread chapters found', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await StatsQueries.getChaptersUnreadCountFromDb();

      expect(result).toEqual({});
    });

    it('should return count of unread chapters (unread = 1)', async () => {
      const mockCount = { chaptersUnread: 784 };
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(mockCount);

      const result = await StatsQueries.getChaptersUnreadCountFromDb();

      expect(result).toEqual(mockCount);
      expect(result.chaptersUnread).toBe(784);
    });

    it('should only count unread chapters from library novels', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        chaptersUnread: 300,
      });

      await StatsQueries.getChaptersUnreadCountFromDb();

      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('WHERE Chapter.unread = 1'),
          expect.stringContaining('AND Novel.inLibrary = 1'),
        ]),
      );
    });
  });

  describe('getChaptersDownloadedCountFromDb', () => {
    it('should return empty object when no downloaded chapters found', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await StatsQueries.getChaptersDownloadedCountFromDb();

      expect(result).toEqual({});
    });

    it('should return count of downloaded chapters (isDownloaded = 1)', async () => {
      const mockCount = { chaptersDownloaded: 567 };
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(mockCount);

      const result = await StatsQueries.getChaptersDownloadedCountFromDb();

      expect(result).toEqual(mockCount);
      expect(result.chaptersDownloaded).toBe(567);
    });

    it('should only count downloaded chapters from library novels', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        chaptersDownloaded: 150,
      });

      await StatsQueries.getChaptersDownloadedCountFromDb();

      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('WHERE Chapter.isDownloaded = 1'),
          expect.stringContaining('AND Novel.inLibrary = 1'),
        ]),
      );
    });
  });

  describe('getNovelGenresFromDb', () => {
    it('should return empty genres object when no novels in library', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([]);

      const result = await StatsQueries.getNovelGenresFromDb();

      expect(result).toEqual({ genres: {} });
    });

    it('should aggregate genres using countBy', async () => {
      const mockGenres = [
        { genres: 'Action, Fantasy, Adventure' },
        { genres: 'Action, Drama' },
        { genres: 'Fantasy, Romance' },
      ];
      (getAllAsync as jest.Mock).mockResolvedValueOnce(mockGenres);

      const result = await StatsQueries.getNovelGenresFromDb();

      expect(result.genres).toEqual({
        Action: 2,
        Fantasy: 2,
        Adventure: 1,
        Drama: 1,
        Romance: 1,
      });
    });

    it('should handle empty genres string', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { genres: '' },
        { genres: 'Action' },
      ]);

      const result = await StatsQueries.getNovelGenresFromDb();

      // countBy includes empty string in counts
      expect(result.genres).toEqual({ '': 1, Action: 1 });
    });

    it('should handle null genres', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { genres: null },
        { genres: 'Fantasy' },
      ]);

      const result = await StatsQueries.getNovelGenresFromDb();

      expect(result.genres).toEqual({ Fantasy: 1 });
    });

    it('should handle genres with extra whitespace', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { genres: 'Action,   Fantasy,Drama' },
      ]);

      const result = await StatsQueries.getNovelGenresFromDb();

      expect(result.genres).toEqual({
        Action: 1,
        Fantasy: 1,
        Drama: 1,
      });
    });

    it('should handle genres with different separators (comma, space)', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { genres: 'Action, Fantasy Adventure' },
      ]);

      const result = await StatsQueries.getNovelGenresFromDb();

      // Split by comma + space
      expect(result.genres).toEqual({
        Action: 1,
        'Fantasy Adventure': 1,
      });
    });
  });

  describe('getNovelStatusFromDb', () => {
    it('should return empty status object when no novels in library', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([]);

      const result = await StatsQueries.getNovelStatusFromDb();

      expect(result).toEqual({ status: {} });
    });

    it('should aggregate status using countBy', async () => {
      const mockStatus = [
        { status: 'Ongoing, Completed' },
        { status: 'Ongoing' },
        { status: 'Completed, Hiatus' },
      ];
      (getAllAsync as jest.Mock).mockResolvedValueOnce(mockStatus);

      const result = await StatsQueries.getNovelStatusFromDb();

      expect(result.status).toEqual({
        Ongoing: 2,
        Completed: 2,
        Hiatus: 1,
      });
    });

    it('should handle empty status string', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { status: '' },
        { status: 'Ongoing' },
      ]);

      const result = await StatsQueries.getNovelStatusFromDb();

      // countBy includes empty string in counts
      expect(result.status).toEqual({ '': 1, Ongoing: 1 });
    });

    it('should handle null status', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { status: null },
        { status: 'Completed' },
      ]);

      const result = await StatsQueries.getNovelStatusFromDb();

      expect(result.status).toEqual({ Completed: 1 });
    });

    it('should handle status with extra whitespace', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { status: 'Ongoing,   Completed,Hiatus' },
      ]);

      const result = await StatsQueries.getNovelStatusFromDb();

      expect(result.status).toEqual({
        Ongoing: 1,
        Completed: 1,
        Hiatus: 1,
      });
    });

    it('should handle numeric status values', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { status: '1, 2' },
        { status: '1' },
      ]);

      const result = await StatsQueries.getNovelStatusFromDb();

      expect(result.status).toEqual({ '1': 2, '2': 1 });
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle all stats functions returning empty results', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValue(null);
      (getAllAsync as jest.Mock).mockResolvedValue([]);

      const results = await Promise.all([
        StatsQueries.getLibraryStatsFromDb(),
        StatsQueries.getChaptersTotalCountFromDb(),
        StatsQueries.getChaptersReadCountFromDb(),
        StatsQueries.getChaptersUnreadCountFromDb(),
        StatsQueries.getChaptersDownloadedCountFromDb(),
        StatsQueries.getNovelGenresFromDb(),
        StatsQueries.getNovelStatusFromDb(),
      ]);

      // getLibraryStatsFromDb, getChapters*CountFromDb return empty objects
      // getNovel*FromDb return objects with 'genres'/'status' key (with empty count)
      expect(Object.keys(results[0])).toHaveLength(0); // libStats
      expect(Object.keys(results[1])).toHaveLength(0); // totalChapters
      expect(Object.keys(results[2])).toHaveLength(0); // readChapters
      expect(Object.keys(results[3])).toHaveLength(0); // unreadChapters
      expect(Object.keys(results[4])).toHaveLength(0); // downloadedChapters
      expect(Object.keys(results[5])).toContain('genres'); // genres (has empty count)
      expect(Object.keys(results[6])).toContain('status'); // status (has empty count)
    });

    it('should provide complete library stats when data exists', async () => {
      (getFirstAsync as jest.Mock)
        .mockResolvedValueOnce({ novelsCount: 100, sourcesCount: 5 })
        .mockResolvedValueOnce({ chaptersCount: 5000 })
        .mockResolvedValueOnce({ chaptersRead: 3500 })
        .mockResolvedValueOnce({ chaptersUnread: 1500 })
        .mockResolvedValueOnce({ chaptersDownloaded: 2000 });

      (getAllAsync as jest.Mock)
        .mockResolvedValueOnce([
          { genres: 'Action, Fantasy' },
          { genres: 'Action, Romance' },
        ])
        .mockResolvedValueOnce([{ status: 'Ongoing, Completed' }]);

      const [
        libStats,
        totalChapters,
        readChapters,
        unreadChapters,
        dlChapters,
        genres,
        status,
      ] = await Promise.all([
        StatsQueries.getLibraryStatsFromDb(),
        StatsQueries.getChaptersTotalCountFromDb(),
        StatsQueries.getChaptersReadCountFromDb(),
        StatsQueries.getChaptersUnreadCountFromDb(),
        StatsQueries.getChaptersDownloadedCountFromDb(),
        StatsQueries.getNovelGenresFromDb(),
        StatsQueries.getNovelStatusFromDb(),
      ]);

      expect(libStats.novelsCount).toBe(100);
      expect(libStats.sourcesCount).toBe(5);
      expect(totalChapters.chaptersCount).toBe(5000);
      expect(readChapters.chaptersRead).toBe(3500);
      expect(unreadChapters.chaptersUnread).toBe(1500);
      expect(dlChapters.chaptersDownloaded).toBe(2000);
      expect(genres.genres).toEqual({ Action: 2, Fantasy: 1, Romance: 1 });
      expect(status.status).toEqual({ Ongoing: 1, Completed: 1 });
    });

    it('should handle database connection errors across all functions', async () => {
      (getFirstAsync as jest.Mock).mockRejectedValue(
        new Error('Connection lost'),
      );
      (getAllAsync as jest.Mock).mockRejectedValue(
        new Error('Connection lost'),
      );

      await expect(StatsQueries.getLibraryStatsFromDb()).rejects.toThrow();
      await expect(
        StatsQueries.getChaptersTotalCountFromDb(),
      ).rejects.toThrow();
      await expect(StatsQueries.getChaptersReadCountFromDb()).rejects.toThrow();
      await expect(
        StatsQueries.getChaptersUnreadCountFromDb(),
      ).rejects.toThrow();
      await expect(
        StatsQueries.getChaptersDownloadedCountFromDb(),
      ).rejects.toThrow();
      await expect(StatsQueries.getNovelGenresFromDb()).rejects.toThrow();
      await expect(StatsQueries.getNovelStatusFromDb()).rejects.toThrow();
    });
  });
});
