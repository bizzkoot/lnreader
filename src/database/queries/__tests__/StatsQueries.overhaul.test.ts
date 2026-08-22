import * as StatsQueries from '../StatsQueries';

jest.mock('@database/utils/helpers', () => ({
  getAllAsync: jest.fn(() => Promise.resolve([])),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
}));

const { getAllAsync, getFirstAsync } = require('@database/utils/helpers');

describe('StatsQueries — 3.3 overhaul', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getAggregateStatsFromDb', () => {
    it('returns empty when no data', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(null);
      const res = await StatsQueries.getAggregateStatsFromDb();
      expect(res).toEqual({});
    });

    it('computes chaptersRead as chaptersCount - chaptersUnread', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        novelsCount: 5,
        sourcesCount: 2,
        chaptersCount: 100,
        chaptersUnread: 30,
        chaptersDownloaded: 20,
        totalReadingTime: 600000,
      });
      const res = await StatsQueries.getAggregateStatsFromDb();
      expect(res.chaptersRead).toBe(70);
      expect(res.totalReadingTime).toBe(600000);
    });

    it('clamps chaptersRead to 0', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        novelsCount: 1,
        sourcesCount: 1,
        chaptersCount: 5,
        chaptersUnread: 10,
        chaptersDownloaded: 0,
        totalReadingTime: 0,
      });
      const res = await StatsQueries.getAggregateStatsFromDb();
      expect(res.chaptersRead).toBe(0);
    });

    it('queries Novel with denormalized columns and ReadingSession subquery', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({
        novelsCount: 0,
        sourcesCount: 0,
        chaptersCount: 0,
        chaptersUnread: 0,
        chaptersDownloaded: 0,
        totalReadingTime: 0,
      });
      await StatsQueries.getAggregateStatsFromDb();
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('SUM(totalChapters)')]),
      );
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('ReadingSession')]),
      );
    });
  });

  describe('getNovelsWithGenresFromDb', () => {
    it('returns empty array when no novels', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([]);
      const res = await StatsQueries.getNovelsWithGenresFromDb();
      expect(res).toEqual([]);
    });

    it('returns rows with expected fields', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          pluginId: 'p1',
          name: 'A',
          genres: 'Action, Fantasy',
          status: 'Ongoing',
          totalChapters: 10,
          chaptersUnread: 2,
          chaptersDownloaded: 5,
        },
      ]);
      const res = await StatsQueries.getNovelsWithGenresFromDb();
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe('A');
    });

    it('queries Novel WHERE inLibrary=1', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([]);
      await StatsQueries.getNovelsWithGenresFromDb();
      expect(getAllAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('WHERE inLibrary = 1'),
        ]),
      );
    });
  });

  describe('getTopNovelsByReadingTimeFromDb', () => {
    it('returns ordered rows', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { id: 2, pluginId: 'p1', name: 'B', cover: null, timeSpent: 5000 },
        { id: 1, pluginId: 'p1', name: 'A', cover: null, timeSpent: 1000 },
      ]);
      const res = await StatsQueries.getTopNovelsByReadingTimeFromDb(2);
      expect(res).toHaveLength(2);
      expect(res[0].timeSpent).toBe(5000);
    });

    it('uses HAVING timeSpent > 0 and ORDER BY DESC LIMIT ?', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([]);
      await StatsQueries.getTopNovelsByReadingTimeFromDb(5);
      expect(getAllAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('HAVING timeSpent > 0'),
          expect.stringContaining('ORDER BY timeSpent DESC'),
        ]),
      );
      const args = (getAllAsync as jest.Mock).mock.calls[0][0];
      expect(args[1]).toEqual([5]);
    });

    it('clamps limit to 1..50', async () => {
      (getAllAsync as jest.Mock).mockResolvedValue([]);
      await StatsQueries.getTopNovelsByReadingTimeFromDb(100);
      expect((getAllAsync as jest.Mock).mock.calls[0][0][1]).toEqual([50]);
      jest.clearAllMocks();
      (getAllAsync as jest.Mock).mockResolvedValue([]);
      await StatsQueries.getTopNovelsByReadingTimeFromDb(0);
      expect((getAllAsync as jest.Mock).mock.calls[0][0][1]).toEqual([1]);
    });

    it('joins ReadingSession on Novel.id', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([]);
      await StatsQueries.getTopNovelsByReadingTimeFromDb();
      expect(getAllAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('JOIN ReadingSession'),
        ]),
      );
    });
  });
});
