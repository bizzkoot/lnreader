import {
  getLibraryWithCategory,
  getLibraryNovelsFromDb,
} from '../../database/queries/LibraryQueries';

import { showToast } from '../../utils/showToast';
import { UpdateNovelOptions, updateNovel } from './LibraryUpdateQueries';
import { LibraryNovelInfo } from '@database/types';
import { sleep } from '@utils/sleep';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import dayjs from 'dayjs';
import { APP_SETTINGS, AppSettings } from '@hooks/persisted/useSettings';
import { BackgroundTaskMetadata } from '@services/ServiceManager';

const UPDATE_SOURCE_CONCURRENCY = 3;

const groupNovelsByPlugin = (
  novels: LibraryNovelInfo[],
): LibraryNovelInfo[][] => {
  const groupedNovels = new Map<string, LibraryNovelInfo[]>();
  for (const novel of novels) {
    const pluginNovels = groupedNovels.get(novel.pluginId);
    if (pluginNovels) pluginNovels.push(novel);
    else groupedNovels.set(novel.pluginId, [novel]);
  }
  return [...groupedNovels.values()];
};

const updateLibrary = async (
  {
    categoryId,
  }: {
    categoryId?: number;
  },
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0,
  }));

  const { downloadNewChapters, refreshNovelMetadata, onlyUpdateOngoingNovels } =
    getMMKVObject<AppSettings>(APP_SETTINGS) || {};
  const options: UpdateNovelOptions = {
    downloadNewChapters: downloadNewChapters || false,
    refreshNovelMetadata: refreshNovelMetadata || false,
  };

  let libraryNovels: LibraryNovelInfo[] = [];
  if (categoryId) {
    libraryNovels = getLibraryWithCategory(
      categoryId,
      onlyUpdateOngoingNovels,
      true,
    );
  } else {
    libraryNovels = getLibraryNovelsFromDb(
      '',
      onlyUpdateOngoingNovels ? "status = 'Ongoing'" : '',
      '',
      false,
      true,
    ) as LibraryNovelInfo[];
  }

  // Only a full-library update advances the scheduler's global timestamp.
  // Category updates must not postpone scheduled updates for the rest of the library.
  if (!categoryId) {
    MMKVStorage.set(LAST_UPDATE_TIME, dayjs().format('YYYY-MM-DD HH:mm:ss'));
  }

  if (libraryNovels.length > 0) {
    const sourceQueues = groupNovelsByPlugin(libraryNovels);
    const activeNovels = new Map<string, string>();
    let completedNovels = 0;
    let nextSourceQueue = 0;

    const publishProgress = () => {
      setMeta(meta => ({
        ...meta,
        progressText: [...activeNovels.values()].join('\n') || undefined,
        progress: completedNovels / libraryNovels.length,
      }));
    };

    const updateSourceQueue = async (sourceQueue: LibraryNovelInfo[]) => {
      for (const novel of sourceQueue) {
        activeNovels.set(novel.pluginId, novel.name);
        publishProgress();
        try {
          await updateNovel(novel.pluginId, novel.path, novel.id, options);
          await sleep(1000);
        } catch (error: any) {
          showToast(novel.name + ': ' + error.message);
        } finally {
          completedNovels += 1;
          activeNovels.delete(novel.pluginId);
          publishProgress();
        }
      }
    };

    const updateNextSource = async () => {
      while (nextSourceQueue < sourceQueues.length) {
        const sourceQueue = sourceQueues[nextSourceQueue++];
        await updateSourceQueue(sourceQueue);
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(UPDATE_SOURCE_CONCURRENCY, sourceQueues.length) },
        updateNextSource,
      ),
    );
  } else {
    showToast("There's no novel to be updated");
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    progressText: undefined,
    isRunning: false,
  }));
};

export { updateLibrary };
