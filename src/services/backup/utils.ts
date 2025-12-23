import { SELF_HOST_BACKUP } from '@hooks/persisted/useSelfHost';
import { OLD_TRACKED_NOVEL_PREFIX } from '@hooks/persisted/migrations/trackerMigration';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import { LOCAL_BACKUP_FOLDER_URI } from '@hooks/persisted/useLocalBackupFolder';
import { version } from '../../../package.json';
import {
  _restoreNovelAndChapters,
  getAllNovels,
} from '@database/queries/NovelQueries';
import { getNovelChapters } from '@database/queries/ChapterQueries';
import {
  _restoreCategory,
  getAllNovelCategories,
  getCategoriesFromDb,
} from '@database/queries/CategoryQueries';
import {
  getRepositoriesFromDb,
  createRepository,
  isRepoUrlDuplicated,
} from '@database/queries/RepositoryQueries';
import { BackupCategory, BackupNovel, Repository } from '@database/types';
import { BackupEntryName } from './types';
import { ROOT_STORAGE } from '@utils/Storages';
import ServiceManager from '@services/ServiceManager';
import NativeFile from '@specs/NativeFile';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { APP_SETTINGS, AppSettings } from '@hooks/persisted/useSettings';

const APP_STORAGE_URI = 'file://' + ROOT_STORAGE;

export const CACHE_DIR_PATH =
  NativeFile.getConstants().ExternalCachesDirectoryPath + '/BackupData';

const backupMMKVData = () => {
  const excludeKeys = [
    ServiceManager.manager.STORE_KEY,
    OLD_TRACKED_NOVEL_PREFIX,
    SELF_HOST_BACKUP,
    LAST_UPDATE_TIME,
    'LAST_AUTO_BACKUP_TIME', // Device-specific, should not be restored
    LOCAL_BACKUP_FOLDER_URI, // Device-specific folder URIs
  ];
  const keys = MMKVStorage.getAllKeys().filter(
    key => !excludeKeys.includes(key),
  );
  const data = {} as any;
  for (const key of keys) {
    let value: number | string | boolean | undefined =
      MMKVStorage.getString(key);
    if (!value) {
      value = MMKVStorage.getBoolean(key);
    }
    if (key && value) {
      data[key] = value;
    }
  }
  return data;
};

const restoreMMKVData = (data: any) => {
  for (const key in data) {
    MMKVStorage.set(key, data[key]);
  }
};

export const prepareBackupData = async (cacheDirPath: string) => {
  const appSettings =
    getMMKVObject<AppSettings>(APP_SETTINGS) || ({} as AppSettings);
  const include = appSettings.backupIncludeOptions || {
    settings: true,
    novelsAndChapters: true,
    categories: true,
    repositories: true,
    downloads: true,
  };

  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;
  if (NativeFile.exists(novelDirPath)) {
    NativeFile.unlink(novelDirPath);
  }

  NativeFile.mkdir(novelDirPath); // this also creates cacheDirPath

  // version
  try {
    NativeFile.writeFile(
      cacheDirPath + '/' + BackupEntryName.VERSION,
      JSON.stringify({ version: version }),
    );
  } catch (error: any) {
    showToast(
      getString('backupScreen.versionFileWriteFailed', {
        error: error?.message || String(error),
      }),
    );
    throw error;
  }

  // novels
  if (include.novelsAndChapters) {
    await getAllNovels().then(async novels => {
      for (const novel of novels) {
        try {
          const chapters = await getNovelChapters(novel.id);
          NativeFile.writeFile(
            novelDirPath + '/' + novel.id + '.json',
            JSON.stringify({
              chapters: chapters,
              ...novel,
              cover: novel.cover?.replace(APP_STORAGE_URI, ''),
            }),
          );
        } catch (error: any) {
          showToast(
            getString('backupScreen.novelBackupFailed', {
              novelName: novel.name,
              error: error?.message,
            }),
          );
        }
      }
    });
  }

  // categories
  if (include.categories) {
    try {
      const categories = getCategoriesFromDb();
      const novelCategories = getAllNovelCategories();
      NativeFile.writeFile(
        cacheDirPath + '/' + BackupEntryName.CATEGORY,
        JSON.stringify(
          categories.map(category => {
            return {
              ...category,
              novelIds: novelCategories
                .filter(nc => nc.categoryId === category.id)
                .map(nc => nc.novelId),
            };
          }),
        ),
      );
    } catch (error: any) {
      showToast(
        getString('backupScreen.categoryFileWriteFailed', {
          error: error?.message || String(error),
        }),
      );
    }
  }

  // settings
  if (include.settings) {
    try {
      NativeFile.writeFile(
        cacheDirPath + '/' + BackupEntryName.SETTING,
        JSON.stringify(backupMMKVData()),
      );
    } catch (error: any) {
      showToast(
        getString('backupScreen.settingsFileWriteFailed', {
          error: error?.message || String(error),
        }),
      );
    }
  }

  // repositories
  if (include.repositories) {
    try {
      const repositories = getRepositoriesFromDb();
      NativeFile.writeFile(
        cacheDirPath + '/' + BackupEntryName.REPOSITORY,
        JSON.stringify(repositories),
      );
    } catch (error: any) {
      showToast(
        getString('backupScreen.repositoryFileWriteFailed', {
          error: error?.message || String(error),
        }),
      );
    }
  }
};

export const restoreData = async (cacheDirPath: string) => {
  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;

  // version
  // nothing to do

  // novels
  let novelCount = 0;
  let failedCount = 0;

  if (!NativeFile.exists(novelDirPath)) {
    // Backups may omit novels based on user selection
  } else {
    showToast(getString('backupScreen.restoringNovels'));
    try {
      const items = NativeFile.readDir(novelDirPath);
      for (const item of items) {
        if (!item.isDirectory) {
          try {
            const fileContent = NativeFile.readFile(item.path);
            const backupNovel = JSON.parse(fileContent) as BackupNovel;

            if (!backupNovel.cover?.startsWith('http')) {
              backupNovel.cover = APP_STORAGE_URI + backupNovel.cover;
            }

            await _restoreNovelAndChapters(backupNovel);
            novelCount++;
          } catch (error: any) {
            failedCount++;
            const novelName =
              item.path.split('/').pop()?.replace('.json', '') || 'Unknown';
            showToast(
              getString('backupScreen.novelRestoreFailed', {
                novelName: novelName,
                error: error?.message || String(error),
              }),
            );
          }
        }
      }
    } catch (error: any) {
      showToast(
        getString('backupScreen.novelDirectoryReadFailed', {
          error: error?.message || String(error),
        }),
      );
    }
  }
  if (failedCount > 0) {
    showToast(
      getString('backupScreen.novelsRestoredWithErrors', {
        count: novelCount,
        failedCount: failedCount,
      }),
    );
  } else {
    showToast(getString('backupScreen.novelsRestored', { count: novelCount }));
  }

  // categories
  const categoryFilePath = cacheDirPath + '/' + BackupEntryName.CATEGORY;
  let categoryCount = 0;
  let failedCategoryCount = 0;

  if (!NativeFile.exists(categoryFilePath)) {
    // Backups may omit categories based on user selection
  } else {
    showToast(getString('backupScreen.restoringCategories'));
    try {
      const fileContent = NativeFile.readFile(categoryFilePath);
      const categories: BackupCategory[] = JSON.parse(fileContent);

      for (const category of categories) {
        try {
          _restoreCategory(category);
          categoryCount++;
        } catch (error: any) {
          failedCategoryCount++;
          showToast(
            getString('backupScreen.categoryRestoreFailed', {
              categoryName: category.name || category.id.toString(),
              error: error?.message || String(error),
            }),
          );
        }
      }
    } catch (error: any) {
      showToast(
        getString('backupScreen.categoryFileReadFailed', {
          error: error?.message || String(error),
        }),
      );
    }
  }
  if (failedCategoryCount > 0) {
    showToast(
      getString('backupScreen.categoriesRestoredWithErrors', {
        count: categoryCount,
        failedCount: failedCategoryCount,
      }),
    );
  } else {
    showToast(
      getString('backupScreen.categoriesRestored', {
        count: categoryCount,
      }),
    );
  }

  // settings
  const settingsFilePath = cacheDirPath + '/' + BackupEntryName.SETTING;

  if (!NativeFile.exists(settingsFilePath)) {
    // Backups may omit settings based on user selection
  } else {
    showToast(getString('backupScreen.restoringSettings'));
    try {
      const fileContent = NativeFile.readFile(settingsFilePath);
      const settingsData = JSON.parse(fileContent);
      restoreMMKVData(settingsData);
      showToast(getString('backupScreen.settingsRestored'));
    } catch (error: any) {
      showToast(
        getString('backupScreen.settingsRestoreFailed', {
          error: error?.message || String(error),
        }),
      );
    }
  }

  // repositories
  const repositoryFilePath = cacheDirPath + '/' + BackupEntryName.REPOSITORY;
  let repositoryCount = 0;
  let failedRepositoryCount = 0;

  if (!NativeFile.exists(repositoryFilePath)) {
    // Backwards compatibility: old backups don't have Repository.json
    // Backups may also omit repositories based on user selection
  } else {
    showToast(getString('backupScreen.restoringRepositories'));
    try {
      const fileContent = NativeFile.readFile(repositoryFilePath);
      const repositories: Repository[] = JSON.parse(fileContent);

      for (const repository of repositories) {
        try {
          // Check if repository URL already exists to avoid duplicates
          if (!isRepoUrlDuplicated(repository.url)) {
            createRepository(repository.url);
            repositoryCount++;
          }
        } catch (error: any) {
          failedRepositoryCount++;
          showToast(
            getString('backupScreen.repositoryRestoreFailed', {
              url: repository.url,
              error: error?.message || String(error),
            }),
          );
        }
      }

      if (failedRepositoryCount > 0) {
        showToast(
          getString('backupScreen.repositoriesRestoredWithErrors', {
            count: repositoryCount,
            failedCount: failedRepositoryCount,
          }),
        );
      } else if (repositoryCount > 0) {
        showToast(
          getString('backupScreen.repositoriesRestored', {
            count: repositoryCount,
          }),
        );
      }
    } catch (error: any) {
      showToast(
        getString('backupScreen.repositoryFileReadFailed', {
          error: error?.message || String(error),
        }),
      );
    }
  }
};
