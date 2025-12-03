import { ChapterInfo, NovelInfo } from '@database/types';
import { db } from '@database/db';
import ServiceManager from '@services/ServiceManager';

// eslint-disable-next-line no-console
const logDebug = __DEV__ ? console.log : () => {};

export interface AutoDownloadConfig {
  /** Whether auto-download is enabled */
  enabled: boolean;
  /** Number of remaining downloaded chapters before triggering download */
  remainingThreshold: number;
  /** Number of chapters to download when triggered */
  downloadAmount: number;
}

/**
 * Get the count of downloaded chapters ahead of the current position
 */
export const getRemainingDownloadedChapters = async (
  novelId: number,
  currentPosition: number,
  currentPage: string,
): Promise<number> => {
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM Chapter 
     WHERE novelId = ? 
     AND isDownloaded = 1 
     AND (
       (page = ? AND position > ?) 
       OR page > ?
     )`,
    novelId,
    currentPage,
    currentPosition,
    currentPage,
  );
  return result?.count ?? 0;
};

/**
 * Get the next undownloaded chapters
 */
export const getNextUndownloadedChapters = async (
  novelId: number,
  currentPosition: number,
  currentPage: string,
  limit: number,
): Promise<ChapterInfo[]> => {
  const chapters = await db.getAllAsync<ChapterInfo>(
    `SELECT * FROM Chapter 
     WHERE novelId = ? 
     AND isDownloaded = 0 
     AND (
       (page = ? AND position > ?) 
       OR page > ?
     )
     ORDER BY page ASC, position ASC
     LIMIT ?`,
    novelId,
    currentPage,
    currentPosition,
    currentPage,
    limit,
  );
  return chapters;
};

/**
 * Check if auto-download should be triggered and queue downloads
 */
export const checkAndTriggerAutoDownload = async (
  novel: NovelInfo,
  currentChapter: ChapterInfo,
  config: AutoDownloadConfig,
): Promise<boolean> => {
  if (!config.enabled || config.remainingThreshold <= 0) {
    return false;
  }

  const remainingCount = await getRemainingDownloadedChapters(
    novel.id,
    currentChapter.position ?? 0,
    currentChapter.page ?? '1',
  );

  logDebug(
    `AutoDownload: ${remainingCount} downloaded chapters remaining (threshold: ${config.remainingThreshold})`,
  );

  if (remainingCount <= config.remainingThreshold) {
    const chaptersToDownload = await getNextUndownloadedChapters(
      novel.id,
      currentChapter.position ?? 0,
      currentChapter.page ?? '1',
      config.downloadAmount,
    );

    if (chaptersToDownload.length > 0) {
      logDebug(
        `AutoDownload: Queueing ${chaptersToDownload.length} chapters for download`,
      );

      // Queue downloads through ServiceManager
      ServiceManager.manager.addTask(
        chaptersToDownload.map(chapter => ({
          name: 'DOWNLOAD_CHAPTER',
          data: {
            chapterId: chapter.id,
            novelName: novel.name,
            chapterName: chapter.name,
          },
        })),
      );

      return true;
    }
  }

  return false;
};

/**
 * Hook-friendly auto-download checker for use in components
 */
export const createAutoDownloadChecker = (
  novel: NovelInfo,
  getConfig: () => AutoDownloadConfig,
) => {
  let lastCheckedChapterId: number | null = null;
  let isChecking = false;

  return async (currentChapter: ChapterInfo) => {
    // Prevent duplicate checks for the same chapter
    if (
      lastCheckedChapterId === currentChapter.id ||
      isChecking ||
      novel.isLocal
    ) {
      return false;
    }

    isChecking = true;
    lastCheckedChapterId = currentChapter.id;

    try {
      const config = getConfig();
      return await checkAndTriggerAutoDownload(novel, currentChapter, config);
    } finally {
      isChecking = false;
    }
  };
};

export default {
  getRemainingDownloadedChapters,
  getNextUndownloadedChapters,
  checkAndTriggerAutoDownload,
  createAutoDownloadChecker,
};
