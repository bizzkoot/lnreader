import { countBy } from 'lodash-es';
import { LibraryStats } from '../types';
import { getAllAsync, getFirstAsync } from '../utils/helpers';

interface NovelGenresRow {
  genres: string;
}

interface NovelStatusRow {
  status: string;
}

interface LibraryStatsRow {
  novelsCount: number;
  sourcesCount: number;
}

interface ChaptersCountRow {
  chaptersCount: number;
}

interface ChaptersReadRow {
  chaptersRead: number;
}

interface ChaptersUnreadRow {
  chaptersUnread: number;
}

interface ChaptersDownloadedRow {
  chaptersDownloaded: number;
}

const getLibraryStatsQuery = `
  SELECT COUNT(*) as novelsCount, COUNT(DISTINCT pluginId) as sourcesCount
  FROM Novel
  WHERE inLibrary = 1
  `;

const getChaptersReadCountQuery = `
  SELECT COUNT(*) as chaptersRead
  FROM Chapter
  JOIN Novel
  ON Chapter.novelId = Novel.id
  WHERE Chapter.unread = 0 AND Novel.inLibrary = 1
  `;

const getChaptersTotalCountQuery = `
  SELECT COUNT(*) as chaptersCount
  FROM Chapter
  JOIN Novel
  ON Chapter.novelId = Novel.id
  WHERE Novel.inLibrary = 1
  `;

const getChaptersUnreadCountQuery = `
  SELECT COUNT(*) as chaptersUnread
  FROM Chapter
  JOIN Novel
  ON Chapter.novelId = Novel.id
  WHERE Chapter.unread = 1 AND Novel.inLibrary = 1
  `;

const getChaptersDownloadedCountQuery = `
  SELECT COUNT(*) as chaptersDownloaded
  FROM Chapter
  JOIN Novel
  ON Chapter.novelId = Novel.id
  WHERE Chapter.isDownloaded = 1 AND Novel.inLibrary = 1
  `;

const getNovelGenresQuery = `
  SELECT genres
  FROM Novel
  WHERE Novel.inLibrary = 1
  `;

const getNovelStatusQuery = `
  SELECT status
  FROM Novel
  WHERE Novel.inLibrary = 1
  `;

export const getLibraryStatsFromDb = async (): Promise<LibraryStats> => {
  return (await getFirstAsync<LibraryStatsRow>([getLibraryStatsQuery])) ?? {};
};

export const getChaptersTotalCountFromDb = async (): Promise<LibraryStats> => {
  return (
    (await getFirstAsync<ChaptersCountRow>([getChaptersTotalCountQuery])) ?? {}
  );
};

export const getChaptersReadCountFromDb = async (): Promise<LibraryStats> => {
  return (
    (await getFirstAsync<ChaptersReadRow>([getChaptersReadCountQuery])) ?? {}
  );
};

export const getChaptersUnreadCountFromDb = async (): Promise<LibraryStats> => {
  return (
    (await getFirstAsync<ChaptersUnreadRow>([getChaptersUnreadCountQuery])) ??
    {}
  );
};

export const getChaptersDownloadedCountFromDb =
  async (): Promise<LibraryStats> => {
    return (
      (await getFirstAsync<ChaptersDownloadedRow>([
        getChaptersDownloadedCountQuery,
      ])) ?? {}
    );
  };

export const getNovelGenresFromDb = async (): Promise<LibraryStats> => {
  const genres: string[] = [];
  await getAllAsync<NovelGenresRow>([getNovelGenresQuery]).then(res => {
    res.forEach((item: NovelGenresRow) => {
      const novelGenres = item.genres?.split(/\s*,\s*/);

      if (novelGenres?.length) {
        genres.push(...novelGenres);
      }
    });
  });
  return { genres: countBy(genres) };
};

export const getNovelStatusFromDb = async (): Promise<LibraryStats> => {
  const status: string[] = [];
  await getAllAsync<NovelStatusRow>([getNovelStatusQuery]).then(res => {
    res.forEach((item: NovelStatusRow) => {
      const novelStatus = item.status?.split(/\s*,\s*/);

      if (novelStatus?.length) {
        status.push(...novelStatus);
      }
    });
  });
  return { status: countBy(status) };
};

// --- Reading time tracking (PRD 3.2) --- raw-SQL aggregates over ReadingSession ---

interface ReadingTimeRow {
  total: number | null;
}

export interface ReadingTimeStats {
  total: number;
}

const getTotalReadingTimeQuery = `SELECT COALESCE(SUM(duration), 0) as total FROM ReadingSession`;
const getReadingTimeForNovelQuery = `SELECT COALESCE(SUM(duration), 0) as total FROM ReadingSession WHERE novelId = ?`;
const getReadingTimeForChapterQuery = `SELECT COALESCE(SUM(duration), 0) as total FROM ReadingSession WHERE chapterId = ?`;
const getReadingTimeGroupedByNovelQuery = `SELECT novelId, COALESCE(SUM(duration), 0) as total FROM ReadingSession GROUP BY novelId`;
const getReadingTimeGroupedByChapterQuery = `SELECT chapterId, novelId, COALESCE(SUM(duration), 0) as total FROM ReadingSession GROUP BY chapterId`;

export const getTotalReadingTime = async (): Promise<ReadingTimeStats> => {
  const row = await getFirstAsync<ReadingTimeRow>([getTotalReadingTimeQuery]);
  return { total: row?.total ?? 0 };
};

export const getReadingTimeForNovel = async (
  novelId: number,
): Promise<ReadingTimeStats> => {
  const row = await getFirstAsync<ReadingTimeRow>([
    getReadingTimeForNovelQuery,
    [novelId],
  ]);
  return { total: row?.total ?? 0 };
};

export const getReadingTimeForChapter = async (
  chapterId: number,
): Promise<ReadingTimeStats> => {
  const row = await getFirstAsync<ReadingTimeRow>([
    getReadingTimeForChapterQuery,
    [chapterId],
  ]);
  return { total: row?.total ?? 0 };
};

export const getReadingTimeGroupedByNovel = async (): Promise<
  Array<{ novelId: number; total: number }>
> => {
  return (await getAllAsync<{ novelId: number; total: number }>([
    getReadingTimeGroupedByNovelQuery,
  ])) as Array<{ novelId: number; total: number }>;
};

export const getReadingTimeGroupedByChapter = async (): Promise<
  Array<{ chapterId: number; novelId: number; total: number }>
> => {
  return (await getAllAsync<{
    chapterId: number;
    novelId: number;
    total: number;
  }>([getReadingTimeGroupedByChapterQuery])) as Array<{
    chapterId: number;
    novelId: number;
    total: number;
  }>;
};

export const insertReadingSession = async (params: {
  novelId: number;
  chapterId: number;
  startTime: number;
  duration: number;
}): Promise<void> => {
  const { novelId, chapterId, startTime, duration } = params;
  if (!Number.isFinite(novelId) || !Number.isFinite(chapterId)) return;
  if (!Number.isFinite(duration) || duration < 1000) return;
  if (!Number.isFinite(startTime)) return;
  const { db } = await import('@database/db');
  await db.runAsync(
    'INSERT INTO ReadingSession (novelId, chapterId, startTime, duration) VALUES (?, ?, ?, ?)',
    novelId,
    chapterId,
    startTime,
    Math.round(duration),
  );
};
