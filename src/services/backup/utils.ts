import { SELF_HOST_BACKUP } from '@hooks/persisted/useSelfHost';
import { OLD_TRACKED_NOVEL_PREFIX } from '@hooks/persisted/migrations/trackerMigration';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
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
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const backupLog = createRateLimitedLogger('Backup', { windowMs: 1500 });

// ============================================================================
// Backup Schema Version Control
// ============================================================================

/**
 * Current backup schema version.
 * - v1: Legacy format (flat structure, no manifest)
 * - v2: New format with manifest + typed sections
 */
export const BACKUP_SCHEMA_VERSION = 2;

/**
 * MMKV entry type identifiers
 * - 's': string
 * - 'n': number
 * - 'b': boolean
 * - 'o': object (JSON)
 */
type MMKVEntryType = 's' | 'n' | 'b' | 'o';

/**
 * Typed MMKV entry for v2 backups
 */
interface MMKVEntry {
  t: MMKVEntryType; // type
  v: string | number | boolean | object; // value
}

/**
 * Type guard to validate MMKV entries at runtime
 * Ensures the entry structure and type consistency
 */
const isValidMMKVEntry = (entry: unknown): entry is MMKVEntry => {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  const e = entry as Partial<MMKVEntry>;

  // Check required properties exist
  if (typeof e.t !== 'string' || e.v === undefined) {
    return false;
  }

  // Validate type matches value
  switch (e.t) {
    case 's':
      return typeof e.v === 'string';
    case 'n':
      return typeof e.v === 'number';
    case 'b':
      return typeof e.v === 'boolean';
    case 'o':
      return typeof e.v === 'object' && e.v !== null;
    default:
      return false; // Unknown type
  }
};

/**
 * Backup manifest for v2+ format
 */
export interface BackupManifest {
  backupVersion: number;
  appVersion: string;
  platform: 'android' | 'ios' | 'unknown';
  createdAt: string; // ISO 8601
}

/**
 * Backup sections for v2+ format
 */
export interface BackupSections {
  mmkv?: {
    entries: Record<string, MMKVEntry>;
  };
  database?: {
    novels?: BackupNovel[];
    categories?: BackupCategory[];
    repositories?: Repository[];
  };
  // Future sections can be added here
}

/**
 * Complete v2 backup structure
 */
export interface BackupV2 {
  manifest: BackupManifest;
  sections: BackupSections;
}

/**
 * Legacy v1 backup structure (for backward compatibility)
 */
export interface BackupV1 {
  // Legacy format has no manifest, just direct data
  [key: string]: any;
}

const APP_STORAGE_URI = 'file://' + ROOT_STORAGE;

export const CACHE_DIR_PATH =
  NativeFile.getConstants().ExternalCachesDirectoryPath + '/BackupData';

// ============================================================================
// Device-Specific Keys (NEVER restore these)
// ============================================================================

/**
 * Device-specific key patterns that should NEVER be restored from backup
 * These use regex patterns to match device-specific keys
 */
const DEVICE_KEY_PATTERNS = [
  /^LAST_AUTO_BACKUP_TIME$/, // Exact match
  /^LOCAL_BACKUP_FOLDER_URI$/, // Exact match
  /^deviceId$/, // Device ID
  /^installationId$/, // Installation ID
  // Pattern for future device-specific keys with common prefixes
  /^device_/, // Any key starting with 'device_'
  /^installation_/, // Any key starting with 'installation_'
];

/**
 * Gets list of keys that should NEVER be restored from backup
 * These are device-specific and can cause unintended behavior
 * Uses pattern matching for extensibility
 * Lazy-loaded to avoid module initialization issues
 */
const getExcludedMMKVKeys = (): readonly string[] => [
  ServiceManager.manager.STORE_KEY,
  OLD_TRACKED_NOVEL_PREFIX,
  SELF_HOST_BACKUP,
  LAST_UPDATE_TIME,
];

/**
 * Checks if a key is device-specific and should be excluded from backup restore
 * Uses pattern matching to identify device-specific keys
 */
const isDeviceSpecificKey = (key: string): boolean => {
  return DEVICE_KEY_PATTERNS.some(pattern => pattern.test(key));
};

// ============================================================================
// Version Detection & Migration
// ============================================================================

/**
 * Detects backup version from parsed backup data
 */
export const detectBackupVersion = (parsed: unknown): number => {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'manifest' in parsed &&
    parsed.manifest &&
    typeof parsed.manifest === 'object' &&
    'backupVersion' in parsed.manifest
  ) {
    return (parsed.manifest as BackupManifest).backupVersion;
  }
  return 1; // Legacy format
};

/**
 * Migrates backup from older version to current version
 * @param data - Parsed backup data
 * @param fromVersion - Source backup version
 * @returns Migrated backup in v2 format
 */
export const migrateBackup = (
  data: BackupV1 | BackupV2,
  fromVersion: number,
): BackupV2 => {
  if (fromVersion === BACKUP_SCHEMA_VERSION) {
    return data as BackupV2;
  }

  if (fromVersion === 1) {
    // Migrate v1 (legacy) to v2
    // Legacy data doesn't have structured format, so we create empty v2 structure
    const manifest: BackupManifest = {
      backupVersion: BACKUP_SCHEMA_VERSION,
      appVersion: version,
      platform: 'unknown', // Can't determine from v1 data
      createdAt: new Date().toISOString(),
    };

    // v1 doesn't have typed MMKV, so we treat all as strings
    // Real type will be determined during restore
    const sections: BackupSections = {
      database: {
        // v1 stores these in separate files, not in the main JSON
        // So we don't have them here - they're handled separately
      },
    };

    return {
      manifest,
      sections,
    };
  }

  // Future: Add v2 -> v3 migration path here

  // If unknown version, return as-is and let validation catch issues
  return data as BackupV2;
};

// ============================================================================
// MMKV Backup & Restore with Type Safety
// ============================================================================

/**
 * Backs up MMKV data with type information for v2 format
 */
export const backupMMKVDataTyped = (): Record<string, MMKVEntry> => {
  const keys = MMKVStorage.getAllKeys().filter(
    key => !getExcludedMMKVKeys().includes(key as any),
  );

  const entries: Record<string, MMKVEntry> = {};

  for (const key of keys) {
    // Try each type in order
    const stringValue = MMKVStorage.getString(key);
    if (stringValue !== undefined) {
      // Check if it's a JSON object
      try {
        const parsed = JSON.parse(stringValue);
        if (typeof parsed === 'object' && parsed !== null) {
          entries[key] = { t: 'o', v: parsed };
        } else {
          entries[key] = { t: 's', v: stringValue };
        }
      } catch {
        entries[key] = { t: 's', v: stringValue };
      }
      continue;
    }

    const numberValue = MMKVStorage.getNumber(key);
    if (numberValue !== undefined) {
      entries[key] = { t: 'n', v: numberValue };
      continue;
    }

    const boolValue = MMKVStorage.getBoolean(key);
    if (boolValue !== undefined) {
      entries[key] = { t: 'b', v: boolValue };
      continue;
    }
  }

  return entries;
};

/**
 * Validates and restores MMKV entries with type checking
 * @param entries - MMKV entries from backup
 * @returns Number of successfully restored entries
 */
export const validateAndRestoreMMKVEntries = (
  entries: Record<string, MMKVEntry>,
): number => {
  let restoredCount = 0;
  const excludedKeys = getExcludedMMKVKeys();

  for (const [key, entry] of Object.entries(entries)) {
    // Skip excluded keys (both hard-coded list and device-specific patterns)
    if (excludedKeys.includes(key as any) || isDeviceSpecificKey(key)) {
      continue;
    }

    // Validate entry structure using type guard
    if (!isValidMMKVEntry(entry)) {
      backupLog.warn('invalid-entry', `Skipping invalid entry: ${key}`, entry);
      continue;
    }

    try {
      switch (entry.t) {
        case 's':
          if (typeof entry.v === 'string') {
            MMKVStorage.set(key, entry.v);
            restoredCount++;
          }
          break;

        case 'n':
          if (typeof entry.v === 'number') {
            MMKVStorage.set(key, entry.v);
            restoredCount++;
          }
          break;

        case 'b':
          if (typeof entry.v === 'boolean') {
            MMKVStorage.set(key, entry.v);
            restoredCount++;
          }
          break;

        case 'o':
          if (typeof entry.v === 'object' && entry.v !== null) {
            MMKVStorage.set(key, JSON.stringify(entry.v));
            restoredCount++;
          }
          break;

        default:
          // Unknown type - skip (shouldn't happen due to type guard)
          backupLog.warn(
            'unknown-type',
            `Skipping entry with unknown type: ${key} (${entry.t})`,
          );
          break;
      }
    } catch (err) {
      // Failed to restore this entry - continue with others
      backupLog.error('restore-failed', `Failed to restore entry: ${key}`, err);
    }
  }

  return restoredCount;
};

// ============================================================================
// Legacy Backup Functions (v1 - for backward compatibility)
// ============================================================================

/**
 * Legacy MMKV backup (v1 format)
 * @deprecated Use backupMMKVDataTyped for v2 backups
 */
const backupMMKVData = () => {
  const keys = MMKVStorage.getAllKeys().filter(
    key => !getExcludedMMKVKeys().includes(key as any),
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

/**
 * Legacy MMKV restore (v1 format)
 * @deprecated Restore now uses validateAndRestoreMMKVEntries
 */
const restoreMMKVData = (data: any) => {
  const excludedKeys = getExcludedMMKVKeys();
  for (const key in data) {
    // Skip excluded keys even in legacy restore
    if (excludedKeys.includes(key as any)) {
      continue;
    }
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

  // Create v2 backup manifest
  const manifest: BackupManifest = {
    backupVersion: BACKUP_SCHEMA_VERSION,
    appVersion: version,
    platform: 'android', // TODO: detect iOS if needed
    createdAt: new Date().toISOString(),
  };

  // Create v2 backup sections
  const sections: BackupSections = {
    database: {},
  };

  // version (legacy compatibility - still write version.json)
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
      // Create v2 typed MMKV backup
      const mmkvEntries = backupMMKVDataTyped();
      sections.mmkv = { entries: mmkvEntries };

      // Also write legacy format for backward compatibility
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

  // Write v2 manifest file
  try {
    NativeFile.writeFile(
      cacheDirPath + '/manifest.json',
      JSON.stringify(manifest, null, 2),
    );
  } catch (error: any) {
    showToast(
      getString('backupScreen.manifestFileWriteFailed', {
        error: error?.message || String(error),
      }),
    );
    throw error;
  }

  // Write v2 sections file (contains typed MMKV data)
  try {
    NativeFile.writeFile(
      cacheDirPath + '/sections.json',
      JSON.stringify(sections, null, 2),
    );
  } catch (error: any) {
    showToast(
      getString('backupScreen.sectionsFileWriteFailed', {
        error: error?.message || String(error),
      }),
    );
    throw error;
  }
};

export const restoreData = async (cacheDirPath: string) => {
  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;

  // Detect backup version and load manifest/sections if v2
  let backupVersion = 1;
  let sections: BackupSections | null = null;

  const manifestPath = cacheDirPath + '/manifest.json';
  const sectionsPath = cacheDirPath + '/sections.json';

  if (NativeFile.exists(manifestPath) && NativeFile.exists(sectionsPath)) {
    try {
      const manifestContent = NativeFile.readFile(manifestPath);
      const manifest = JSON.parse(manifestContent) as BackupManifest;
      backupVersion = manifest.backupVersion || 2;

      const sectionsContent = NativeFile.readFile(sectionsPath);
      sections = JSON.parse(sectionsContent) as BackupSections;
    } catch (error) {
      // If manifest/sections parsing fails, fall back to v1 legacy restore
      backupVersion = 1;
      sections = null;
    }
  }

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
      // Check if we have v2 typed MMKV data in sections
      if (backupVersion >= 2 && sections?.mmkv?.entries) {
        const restoredCount = validateAndRestoreMMKVEntries(
          sections.mmkv.entries,
        );
        showToast(
          getString('backupScreen.settingsRestored') +
            ` (${restoredCount} entries)`,
        );
      } else {
        // Fall back to legacy v1 restore
        const fileContent = NativeFile.readFile(settingsFilePath);
        const settingsData = JSON.parse(fileContent);
        restoreMMKVData(settingsData);
        showToast(getString('backupScreen.settingsRestored'));
      }
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
