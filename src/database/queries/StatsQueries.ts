import { countBy } from 'lodash-es';
import { LibraryStats } from '../types';
import { getAllAsync, getFirstAsync } from '../utils/helpers';

// ponytail: single helper for comma-separated fields; filter Boolean removes empty entries
// (previously duplicated in getNovelGenresFromDb, getNovelStatusFromDb, and StatsScreen.tsx)
export const splitCsvField = (value: string | null | undefined): string[] => {
  if (!value) return [];
  return value.split(/\s*,\s*/).filter(Boolean);
};

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
      genres.push(...splitCsvField(item.genres));
    });
  });
  return { genres: countBy(genres) };
};

export const getNovelStatusFromDb = async (): Promise<LibraryStats> => {
  const status: string[] = [];
  await getAllAsync<NovelStatusRow>([getNovelStatusQuery]).then(res => {
    res.forEach((item: NovelStatusRow) => {
      status.push(...splitCsvField(item.status));
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

// --- 3.3 additions (raw-SQL, no Drizzle) ---

export interface AggregateStats extends LibraryStats {
  totalReadingTime?: number;
}

interface AggregateRow {
  novelsCount: number;
  sourcesCount: number;
  chaptersCount: number;
  chaptersUnread: number;
  chaptersDownloaded: number;
  totalReadingTime: number | null;
}

const getAggregateStatsQuery = `
  SELECT
    COUNT(*) as novelsCount,
    COUNT(DISTINCT pluginId) as sourcesCount,
    COALESCE(SUM(totalChapters), 0) as chaptersCount,
    COALESCE(SUM(chaptersUnread), 0) as chaptersUnread,
    COALESCE(SUM(chaptersDownloaded), 0) as chaptersDownloaded,
    COALESCE((SELECT SUM(duration) FROM ReadingSession JOIN Novel n2 ON ReadingSession.novelId = n2.id WHERE n2.inLibrary = 1), 0) as totalReadingTime
  FROM Novel
  WHERE inLibrary = 1
`;

export const getAggregateStatsFromDb = async (): Promise<AggregateStats> => {
  const row = await getFirstAsync<AggregateRow>([getAggregateStatsQuery]);
  if (!row) return {};
  const chaptersCount = row.chaptersCount ?? 0;
  const chaptersUnread = row.chaptersUnread ?? 0;
  return {
    novelsCount: row.novelsCount ?? 0,
    sourcesCount: row.sourcesCount ?? 0,
    chaptersCount,
    chaptersUnread,
    chaptersDownloaded: row.chaptersDownloaded ?? 0,
    chaptersRead: Math.max(0, chaptersCount - chaptersUnread),
    totalReadingTime: row.totalReadingTime ?? 0,
  };
};

export interface NovelWithGenresRow {
  id: number;
  pluginId: string;
  name: string;
  cover?: string;
  genres?: string | null;
  status?: string | null;
  totalChapters: number;
  chaptersUnread: number;
  chaptersDownloaded: number;
}

const getNovelsWithGenresQueryFull = `
  SELECT id, pluginId, name, cover, genres, status, totalChapters, chaptersUnread, chaptersDownloaded
  FROM Novel
  WHERE inLibrary = 1
`;

export const getNovelsWithGenresFromDb = async (): Promise<
  NovelWithGenresRow[]
> => {
  const rows = await getAllAsync<NovelWithGenresRow>([
    getNovelsWithGenresQueryFull,
  ]);
  return rows ?? [];
};

export interface TopNovelTimeRow {
  id: number;
  pluginId: string;
  name: string;
  cover?: string | null;
  timeSpent: number;
}

const getTopNovelsByReadingTimeQuery = `
  SELECT Novel.id as id, Novel.pluginId as pluginId, Novel.name as name, Novel.cover as cover,
         COALESCE(SUM(ReadingSession.duration), 0) as timeSpent
  FROM Novel
  JOIN ReadingSession ON Novel.id = ReadingSession.novelId
  WHERE Novel.inLibrary = 1
  GROUP BY Novel.id
  HAVING timeSpent > 0
  ORDER BY timeSpent DESC
  LIMIT ?
`;

export const getTopNovelsByReadingTimeFromDb = async (
  limit = 10,
): Promise<TopNovelTimeRow[]> => {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.min(50, Math.floor(limit)))
    : 10;
  const rows = await getAllAsync<TopNovelTimeRow>([
    getTopNovelsByReadingTimeQuery,
    [safeLimit],
  ]);
  return (rows ?? []) as TopNovelTimeRow[];
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
