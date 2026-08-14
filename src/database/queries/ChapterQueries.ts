import { showToast } from '@utils/showToast';
import {
  ChapterInfo,
  DownloadedChapter,
  UpdateOverview,
  Update,
} from '../types';
import { ChapterItem } from '@plugins/types';

import { getString } from '@strings/translations';
import { NOVEL_STORAGE } from '@utils/Storages';
import { db } from '@database/db';
import NativeFile from '@specs/NativeFile';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { createNovelTriggerQueryUpdate } from '@database/tables/NovelTable';

const CHAPTER_ID_BATCH_SIZE = 500;
const chunkChapterIds = (chapterIds: number[]) =>
  Array.from(
    { length: Math.ceil(chapterIds.length / CHAPTER_ID_BATCH_SIZE) },
    (_, index) =>
      chapterIds.slice(
        index * CHAPTER_ID_BATCH_SIZE,
        (index + 1) * CHAPTER_ID_BATCH_SIZE,
      ),
  );

// #region Mutations

export const insertChapters = async (
  novelId: number,
  chapters?: ChapterItem[],
) => {
  if (!chapters?.length) {
    return;
  }

  await db.withExclusiveTransactionAsync(async tx => {
    for (let index = 0; index < chapters.length; index++) {
      const chapter = chapters[index];
      const chapterName = chapter.name ?? 'Chapter ' + (index + 1);
      const chapterPage = chapter.page || '1';

      const result = await tx.runAsync(
        `
          INSERT INTO Chapter (path, name, releaseTime, novelId, chapterNumber, page, position)
          SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT id FROM Chapter WHERE path = ? AND novelId = ?);
        `,
        chapter.path,
        chapterName,
        chapter.releaseTime || '',
        novelId,
        chapter.chapterNumber ?? null,
        chapterPage,
        index,
        chapter.path,
        novelId,
      );

      if (result.changes === 0) {
        await tx.runAsync(
          `
            UPDATE Chapter SET
              page = ?, position = ?, name = ?, releaseTime = ?, chapterNumber = ?
            WHERE path = ? AND novelId = ? AND (page IS NOT ? OR position IS NOT ? OR name IS NOT ? OR releaseTime IS NOT ? OR chapterNumber IS NOT ?);
          `,
          chapterPage,
          index,
          chapterName,
          chapter.releaseTime || '',
          chapter.chapterNumber ?? null,
          chapter.path,
          novelId,
          chapterPage,
          index,
          chapterName,
          chapter.releaseTime || '',
          chapter.chapterNumber ?? null,
        );
      }
    }
  });
};

export const markChapterRead = (chapterId: number) =>
  db.runAsync('UPDATE Chapter SET `unread` = 0 WHERE id = ?', chapterId);

export const markChaptersRead = async (chapterIds: number[]) => {
  if (!chapterIds.length) {
    return;
  }
  await db.withExclusiveTransactionAsync(async tx => {
    for (const ids of chunkChapterIds(chapterIds)) {
      await tx.execAsync(
        `UPDATE Chapter SET \`unread\` = 0 WHERE id IN (${ids.join(',')})`,
      );
    }
  });
};

export const markChapterUnread = (chapterId: number) => {
  // Clear MMKV saved progress when marking unread
  MMKVStorage.delete(`chapter_progress_${chapterId}`);
  return db.runAsync('UPDATE Chapter SET `unread` = 1 WHERE id = ?', chapterId);
};

export const markChaptersUnread = async (chapterIds: number[]) => {
  if (!chapterIds.length) {
    return;
  }
  // Clear MMKV saved progress for all chapters being marked unread
  chapterIds.forEach(id => {
    MMKVStorage.delete(`chapter_progress_${id}`);
  });
  await db.withExclusiveTransactionAsync(async tx => {
    for (const ids of chunkChapterIds(chapterIds)) {
      await tx.execAsync(
        `UPDATE Chapter SET \`unread\` = 1 WHERE id IN (${ids.join(',')})`,
      );
    }
  });
};

export const markAllChaptersRead = (novelId: number) =>
  db.runAsync('UPDATE Chapter SET `unread` = 0 WHERE novelId = ?', novelId);

export const markAllChaptersUnread = async (novelId: number) => {
  // Get all chapter IDs for this novel
  const chapters = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM Chapter WHERE novelId = ?',
    novelId,
  );

  // Clear MMKV saved progress for all chapters
  chapters.forEach(chapter => {
    MMKVStorage.delete(`chapter_progress_${chapter.id}`);
  });

  return db.runAsync(
    'UPDATE Chapter SET `unread` = 1 WHERE novelId = ?',
    novelId,
  );
};

const deleteDownloadedFiles = async (
  pluginId: string,
  novelId: number,
  chapterId: number,
) => {
  try {
    const chapterFolder = `${NOVEL_STORAGE}/${pluginId}/${novelId}/${chapterId}`;
    NativeFile.unlink(chapterFolder);
  } catch {
    throw new Error(getString('novelScreen.deleteChapterError'));
  }
};

// delete downloaded chapter
export const deleteChapter = async (
  pluginId: string,
  novelId: number,
  chapterId: number,
) => {
  await deleteDownloadedFiles(pluginId, novelId, chapterId);
  await db.runAsync(
    'UPDATE Chapter SET isDownloaded = 0 WHERE id = ?',
    chapterId,
  );
};

export const deleteChapters = async (
  pluginId: string,
  novelId: number,
  chapterIds?: number[],
) => {
  if (!chapterIds?.length) {
    return;
  }
  // Remove downloaded files first (independent of the DB transaction).
  for (const ids of chunkChapterIds(chapterIds)) {
    await Promise.all(
      ids.map(chapterId => deleteDownloadedFiles(pluginId, novelId, chapterId)),
    );
  }
  // Apply all flag updates atomically so a mid-batch failure cannot leave a
  // partially-marked chapter set.
  await db.withExclusiveTransactionAsync(async tx => {
    for (const ids of chunkChapterIds(chapterIds)) {
      await tx.execAsync(
        `UPDATE Chapter SET isDownloaded = 0 WHERE id IN (${ids.join(',')})`,
      );
    }
  });
};

export const deleteDownloads = async (chapters: DownloadedChapter[]) => {
  if (!chapters?.length) {
    return;
  }
  await Promise.all(
    chapters.map(chapter =>
      deleteDownloadedFiles(chapter.pluginId, chapter.novelId, chapter.id),
    ),
  );
  const chapterIdsString = chapters.map(chapter => chapter.id).toString();
  await db.execAsync(
    `UPDATE Chapter SET isDownloaded = 0 WHERE id IN (${chapterIdsString})`,
  );
};

export const deleteReadChaptersFromDb = async () => {
  const chapters = await getReadDownloadedChapters();
  await Promise.all(
    chapters.map(chapter =>
      deleteDownloadedFiles(chapter.pluginId, chapter.novelId, chapter.id),
    ),
  );
  const chapterIdsString = chapters.map(chapter => chapter.id).toString();
  if (chapterIdsString) {
    await db.execAsync(
      `UPDATE Chapter SET isDownloaded = 0 WHERE id IN (${chapterIdsString})`,
    );
  }
  showToast(getString('novelScreen.readChaptersDeleted'));
};

export const updateChapterProgress = (chapterId: number, progress: number) =>
  db.runAsync(
    'UPDATE Chapter SET progress = ? WHERE id = ?',
    progress,
    chapterId,
  );

export const updateChapterTTSState = (chapterId: number, ttsState: string) =>
  db.runAsync(
    'UPDATE Chapter SET ttsState = ? WHERE id = ?',
    ttsState,
    chapterId,
  );

export const updateChapterProgressByIds = async (
  chapterIds: number[],
  progress: number,
) => {
  if (!chapterIds.length) {
    return;
  }
  await db.withExclusiveTransactionAsync(async tx => {
    for (const ids of chunkChapterIds(chapterIds)) {
      await tx.runAsync(
        `UPDATE Chapter SET progress = ? WHERE id in (${ids.join(',')})`,
        progress,
      );
    }
  });
};

export const bookmarkChapter = (chapterId: number) =>
  db.runAsync(
    'UPDATE Chapter SET bookmark = (CASE WHEN bookmark = 0 THEN 1 ELSE 0 END) WHERE id = ?',
    chapterId,
  );

export const bookmarkChapters = async (chapterIds: number[]) => {
  if (!chapterIds.length) {
    return;
  }
  await db.withExclusiveTransactionAsync(async tx => {
    for (const ids of chunkChapterIds(chapterIds)) {
      await tx.execAsync(
        `UPDATE Chapter SET bookmark = (CASE WHEN bookmark = 0 THEN 1 ELSE 0 END) WHERE id IN (${ids.join(',')})`,
      );
    }
  });
};

export const markPreviuschaptersRead = (chapterId: number, novelId: number) =>
  db.runAsync(
    'UPDATE Chapter SET `unread` = 0 WHERE id <= ? AND novelId = ?',
    chapterId,
    novelId,
  );

export const markPreviousChaptersUnread = async (
  chapterId: number,
  novelId: number,
) => {
  // Get all chapter IDs that will be marked unread
  const chapters = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM Chapter WHERE id <= ? AND novelId = ?',
    chapterId,
    novelId,
  );

  // Clear MMKV saved progress for all affected chapters
  chapters.forEach(chapter => {
    MMKVStorage.delete(`chapter_progress_${chapter.id}`);
  });

  return db.runAsync(
    'UPDATE Chapter SET `unread` = 1 WHERE id <= ? AND novelId = ?',
    chapterId,
    novelId,
  );
};

export const markChaptersBeforePositionRead = (
  novelId: number,
  position: number,
) =>
  db.runAsync(
    'UPDATE Chapter SET `unread` = 0, `progress` = 100 WHERE novelId = ? AND position < ?',
    novelId,
    position,
  );

export const clearUpdates = async (): Promise<void> => {
  await db.withExclusiveTransactionAsync(async tx => {
    // The chapter update trigger recalculates novel aggregates once per row.
    // Bypass it for this database-wide operation and update the one affected
    // aggregate in bulk instead.
    await tx.execAsync('DROP TRIGGER IF EXISTS update_novel_stats_on_update');
    await tx.execAsync('UPDATE Chapter SET updatedTime = NULL');
    await tx.execAsync('UPDATE Novel SET lastUpdatedAt = NULL');
    await tx.execAsync(createNovelTriggerQueryUpdate);
  });
};

export const resetFutureChaptersProgress = async (
  novelId: number,
  currentChapterId: number,
  resetMode:
    | 'reset-next'
    | 'reset-until-5'
    | 'reset-until-10'
    | 'reset-all'
    | 'none',
) => {
  if (resetMode === 'none') {
    return;
  }

  const currentChapter = await getChapter(currentChapterId);
  if (!currentChapter || currentChapter.position === undefined) {
    return;
  }

  const { position } = currentChapter;
  let query =
    'UPDATE Chapter SET progress = 0, unread = 1, ttsState = NULL WHERE novelId = ? AND position > ?';
  const args: (string | number)[] = [novelId, position];

  if (resetMode === 'reset-next') {
    query += ' ORDER BY position ASC LIMIT 1';
  } else if (resetMode === 'reset-until-5') {
    query += ' ORDER BY position ASC LIMIT 5';
  } else if (resetMode === 'reset-until-10') {
    query += ' ORDER BY position ASC LIMIT 10';
  } else if (resetMode === 'reset-all') {
    // No limit needed
  }

  // SQLite UPDATE with ORDER BY/LIMIT validation
  // Note: Standard SQLite supports ORDER BY/LIMIT in UPDATE if enabled at compile time.
  // React Native Quick SQLite usually supports this. If not, we might need nested query.
  // Safer approach for broad compatibility:

  if (resetMode === 'reset-all') {
    await db.runAsync(query, ...args);
    return;
  }

  // For limited updates, we fetch IDs first to be safe and robust
  let limit = 0;
  if (resetMode === 'reset-next') limit = 1;
  else if (resetMode === 'reset-until-5') limit = 5;
  else if (resetMode === 'reset-until-10') limit = 10;

  const chaptersToReset = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM Chapter WHERE novelId = ? AND position > ? ORDER BY position ASC LIMIT ?`,
    novelId,
    position,
    limit,
  );

  if (chaptersToReset.length > 0) {
    const ids = chaptersToReset.map(c => c.id).join(',');
    await db.execAsync(
      `UPDATE Chapter SET progress = 0, unread = 1, ttsState = NULL WHERE id IN (${ids})`,
    );
  }
};

export const getRecentReadingChapters = (novelId: number, limit: number = 4) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND progress > 0 AND progress < 100 AND unread = 1 ORDER BY updatedTime DESC LIMIT ?',
    novelId,
    limit,
  );

// #endregion
// #region Selectors

export const getCustomPages = (novelId: number) =>
  db.getAllSync<{ page: string }>(
    'SELECT DISTINCT page from Chapter WHERE novelId = ? ORDER BY CAST(page AS INTEGER) ASC',
    novelId,
  );

export const getNovelChapters = (novelId: number) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ?',
    novelId,
  );

export const getUnreadNovelChapters = (novelId: number) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND unread = 1',
    novelId,
  );

export const getAllUndownloadedChapters = (novelId: number) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 0',
    novelId,
  );

export const getAllUndownloadedAndUnreadChapters = (novelId: number) =>
  db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 0 AND unread = 1',
    novelId,
  );

export const getChapter = (chapterId: number) =>
  db.getFirstAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE id = ?',
    chapterId,
  );

const getPageChaptersQuery = (
  sort = 'ORDER BY position ASC',
  filter = '',
  limit?: number,
  offset?: number,
) =>
  `
    SELECT * FROM Chapter 
    WHERE novelId = ? AND page = ? 
    ${filter} ${sort} 
    ${limit ? `LIMIT ${limit}` : ''} 
    ${offset ? `OFFSET ${offset}` : ''}`;

export const getPageChapters = (
  novelId: number,
  sort?: string,
  filter?: string,
  page?: string,
  offset?: number,
  limit?: number,
) => {
  return db.getAllAsync<ChapterInfo>(
    getPageChaptersQuery(sort, filter, limit, offset),
    novelId,
    page || '1',
  );
};

export const getPageChapterIds = async (
  novelId: number,
  filter?: string,
  page?: string,
): Promise<number[]> => {
  const rows = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM Chapter WHERE novelId = ? AND page = ? ${filter || ''} ORDER BY position ASC`,
    novelId,
    page || '1',
  );
  return (rows ?? []).map(row => row.id);
};

export const getChaptersByIds = async (
  chapterIds: number[],
): Promise<ChapterInfo[]> => {
  if (!chapterIds.length) {
    return [];
  }
  const chapters = await Promise.all(
    chunkChapterIds(chapterIds).map(ids =>
      db.getAllAsync<ChapterInfo>(
        `SELECT * FROM Chapter WHERE id IN (${ids.join(',')})`,
      ),
    ),
  );
  const chaptersById = new Map(
    chapters.flat().map(chapter => [chapter.id, chapter]),
  );
  return chapterIds.flatMap(chapterId => {
    const chapter = chaptersById.get(chapterId);
    return chapter ? [chapter] : [];
  });
};

export const getChapterCount = (novelId: number, page: string = '1') =>
  db.getFirstSync<{ 'COUNT(*)': number }>(
    'SELECT COUNT(*) FROM Chapter WHERE novelId = ? AND page = ?',
    novelId,
    page,
  )?.['COUNT(*)'] ?? 0;

export const getFirstUnreadChapter = (
  novelId: number,
  filter?: string,
  page?: string,
) =>
  db.getFirstAsync<ChapterInfo>(
    `SELECT * FROM Chapter WHERE novelId = ? AND page = ? AND unread = 1 ${filter || ''} ORDER BY position ASC LIMIT 1`,
    novelId,
    page || '1',
  );

export const getPageChaptersBatched = (
  novelId: number,
  sort?: string,
  filter?: string,
  page?: string,
  batch: number = 0,
) => {
  return db.getAllSync<ChapterInfo>(
    getPageChaptersQuery(sort, filter, 300, 300 * batch),
    novelId,
    page || '1',
  );
};

export const getNovelChaptersByNumber = async (
  novelId: number,
  chapterNumber: number,
) => {
  // Prefer a real chapterNumber match: sources with dense 1..N numbering set
  // it, and it stays correct across gaps/renumbering. Sources that leave
  // chapterNumber NULL fall back to the historical position heuristic
  // (position === chapterNumber - 1 in dense numbering).
  if (Number.isFinite(chapterNumber) && chapterNumber > 0) {
    const byNumber = await db.getAllAsync<ChapterInfo>(
      'SELECT * FROM Chapter WHERE novelId = ? AND chapterNumber = ? ORDER BY position ASC',
      novelId,
      chapterNumber,
    );
    if (byNumber.length > 0) {
      return byNumber;
    }
  }
  return db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND position = ?',
    novelId,
    chapterNumber - 1,
  );
};

export const getNovelChaptersByName = (novelId: number, searchText: string) => {
  return db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND name LIKE ?',
    novelId,
    `%${searchText}%`,
  );
};

export const getPrevChapter = (
  novelId: number,
  chapterPosition: number,
  page: string,
) =>
  db.getFirstAsync<ChapterInfo>(
    `SELECT * FROM Chapter
      WHERE novelId = ?
      AND (
        (position < ? AND page = ?)
        OR CAST(page AS INTEGER) < CAST(? AS INTEGER)
      )
      ORDER BY CAST(page AS INTEGER) DESC, position DESC`,
    novelId,
    chapterPosition,
    page,
    page,
  );

export const getNextChapter = (
  novelId: number,
  chapterPosition: number,
  page: string,
) =>
  db.getFirstAsync<ChapterInfo>(
    `SELECT * FROM Chapter
      WHERE novelId = ?
      AND (
        (page = ? AND position > ?)
        OR CAST(page AS INTEGER) > CAST(? AS INTEGER)
      )
      ORDER BY CAST(page AS INTEGER) ASC, position ASC
      LIMIT 1`,
    novelId,
    page,
    chapterPosition,
    page,
  );

const getReadDownloadedChapters = () =>
  db.getAllAsync<DownloadedChapter>(`
        SELECT Chapter.id, Chapter.novelId, pluginId 
        FROM Chapter
        JOIN Novel
        ON Novel.id = Chapter.novelId AND unread = 0 AND isDownloaded = 1`);

export const getDownloadedChapters = () =>
  db.getAllAsync<DownloadedChapter>(`
    SELECT
      Chapter.*,
      Novel.pluginId, Novel.name as novelName, Novel.cover as novelCover, Novel.path as novelPath
    FROM Chapter
    JOIN Novel
    ON Chapter.novelId = Novel.id
    WHERE Chapter.isDownloaded = 1
  `);

export const getNovelDownloadedChapters = (
  novelId: number,
  startPosition?: number,
  endPosition?: number,
) => {
  if (
    (startPosition !== undefined || endPosition !== undefined) &&
    (startPosition === undefined ||
      endPosition === undefined ||
      !Number.isInteger(startPosition) ||
      !Number.isInteger(endPosition) ||
      startPosition < 1 ||
      endPosition < startPosition)
  ) {
    return Promise.resolve([] as ChapterInfo[]);
  }

  if (startPosition !== undefined && endPosition !== undefined) {
    // Range positions are global ordinals over the flat (page, position)-ordered
    // downloaded list. position alone is per-page (it resets in insertChapters),
    // so a position-window query would match every page for multi-page novels.
    return db.getAllAsync<ChapterInfo>(
      'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 ORDER BY CAST(page AS INTEGER) ASC, position ASC LIMIT ? OFFSET ?',
      novelId,
      endPosition - startPosition + 1,
      startPosition - 1,
    );
  }

  return db.getAllAsync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE novelId = ? AND isDownloaded = 1 ORDER BY CAST(page AS INTEGER) ASC, position ASC',
    novelId,
  );
};

export const getUpdatedOverviewFromDb = () =>
  db.getAllAsync<UpdateOverview>(`SELECT
  Novel.id AS novelId,
  Novel.name AS novelName,
  Novel.cover AS novelCover,
  Novel.path AS novelPath,
  Novel.inLibrary AS inLibrary,
  DATE(Chapter.updatedTime) AS updateDate,
  COUNT(*) AS updatesPerDay
FROM
  Chapter
JOIN
  Novel
ON
  Chapter.novelId = Novel.id
WHERE
  Chapter.updatedTime IS NOT NULL
GROUP BY
  Novel.id,
  DATE(Chapter.updatedTime)
ORDER BY
  updateDate DESC,
  novelId;
`);

export const getDetailedUpdatesFromDb = async (
  novelId: number,
  onlyDownloadableChapters?: boolean,
) => {
  const result = db.getAllAsync<Update>(
    `
SELECT
  Chapter.*,
  pluginId, Novel.id as novelId, Novel.name as novelName, Novel.path as novelPath, cover as novelCover
FROM
  Chapter
JOIN
  Novel
  ON Chapter.novelId = Novel.id
WHERE novelId = ?  ${
      onlyDownloadableChapters
        ? 'AND Chapter.isDownloaded = 1 '
        : 'AND updatedTime IS NOT NULL'
    }
ORDER BY updatedTime DESC; 
`,
    novelId,
  );

  return await result;
};

export const isChapterDownloaded = (chapterId: number) =>
  !!db.getFirstSync<ChapterInfo>(
    'SELECT * FROM Chapter WHERE id = ? AND isDownloaded = 1',
    chapterId,
  );
