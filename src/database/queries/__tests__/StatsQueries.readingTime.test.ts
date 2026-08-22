import * as StatsQueries from '../StatsQueries';

jest.mock('@database/utils/helpers', () => ({
  getAllAsync: jest.fn(() => Promise.resolve([])),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
}));

const { getAllAsync, getFirstAsync } = require('@database/utils/helpers');

describe('StatsQueries — reading time aggregates', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getTotalReadingTime', () => {
    it('returns 0 when no sessions', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce(null);
      const res = await StatsQueries.getTotalReadingTime();
      expect(res).toEqual({ total: 0 });
    });

    it('returns sum when present', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({ total: 12345 });
      const res = await StatsQueries.getTotalReadingTime();
      expect(res.total).toBe(12345);
    });

    it('queries ReadingSession with SUM(duration)', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({ total: 0 });
      await StatsQueries.getTotalReadingTime();
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('ReadingSession')]),
      );
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('SUM(duration)')]),
      );
    });
  });

  describe('getReadingTimeForNovel', () => {
    it('returns 0 for unknown novel', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({ total: null });
      const res = await StatsQueries.getReadingTimeForNovel(99);
      expect(res).toEqual({ total: 0 });
    });

    it('binds novelId param', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({ total: 5000 });
      await StatsQueries.getReadingTimeForNovel(7);
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('WHERE novelId = ?'),
          [7],
        ]),
      );
    });
  });

  describe('getReadingTimeForChapter', () => {
    it('binds chapterId param', async () => {
      (getFirstAsync as jest.Mock).mockResolvedValueOnce({ total: 1000 });
      await StatsQueries.getReadingTimeForChapter(42);
      expect(getFirstAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('WHERE chapterId = ?'),
          [42],
        ]),
      );
    });
  });

  describe('getReadingTimeGroupedByNovel', () => {
    it('uses GROUP BY novelId', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([]);
      await StatsQueries.getReadingTimeGroupedByNovel();
      expect(getAllAsync).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('GROUP BY novelId')]),
      );
    });

    it('returns rows', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([
        { novelId: 1, total: 1000 },
        { novelId: 2, total: 2000 },
      ]);
      const res = await StatsQueries.getReadingTimeGroupedByNovel();
      expect(res).toHaveLength(2);
      expect(res[0].total).toBe(1000);
    });
  });

  describe('getReadingTimeGroupedByChapter', () => {
    it('uses GROUP BY chapterId', async () => {
      (getAllAsync as jest.Mock).mockResolvedValueOnce([]);
      await StatsQueries.getReadingTimeGroupedByChapter();
      expect(getAllAsync).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('GROUP BY chapterId')]),
      );
    });
  });

  describe('insertReadingSession', () => {
    it('rejects short durations < 1000ms without throwing', async () => {
      await expect(
        StatsQueries.insertReadingSession({
          novelId: 1,
          chapterId: 1,
          startTime: Date.now(),
          duration: 500,
        }),
      ).resolves.toBeUndefined();
    });

    it('rejects NaN ids without throwing', async () => {
      await expect(
        StatsQueries.insertReadingSession({
          novelId: NaN,
          chapterId: 1,
          startTime: Date.now(),
          duration: 5000,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
