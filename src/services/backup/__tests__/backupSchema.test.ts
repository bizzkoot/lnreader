/**
 * @jest-environment node
 */

import {
  detectBackupVersion,
  migrateBackup,
  validateAndRestoreMMKVEntries,
  BACKUP_SCHEMA_VERSION,
  BackupV2,
} from '../utils';
import { MMKVStorage } from '@utils/mmkv/mmkv';

// Mock MMKV
jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    set: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    getAllKeys: jest.fn(() => []),
  },
  getMMKVObject: jest.fn(),
}));

// Mock other dependencies
jest.mock('@database/queries/NovelQueries');
jest.mock('@database/queries/ChapterQueries');
jest.mock('@database/queries/CategoryQueries');
jest.mock('@database/queries/RepositoryQueries');
jest.mock('@utils/showToast');
jest.mock('@strings/translations');
jest.mock('@specs/NativeFile');

describe('Backup Schema Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectBackupVersion', () => {
    it('should detect v2 backup with manifest', () => {
      const v2Backup: BackupV2 = {
        manifest: {
          backupVersion: 2,
          appVersion: '2.0.13',
          platform: 'android',
          createdAt: '2025-12-23T10:00:00Z',
        },
        sections: {},
      };

      expect(detectBackupVersion(v2Backup)).toBe(2);
    });

    it('should detect v1 legacy backup without manifest', () => {
      const v1Backup = {
        someKey: 'someValue',
        anotherKey: 123,
      };

      expect(detectBackupVersion(v1Backup)).toBe(1);
    });

    it('should handle null/undefined', () => {
      expect(detectBackupVersion(null)).toBe(1);
      expect(detectBackupVersion(undefined)).toBe(1);
    });

    it('should handle invalid backup data', () => {
      expect(detectBackupVersion({})).toBe(1);
      expect(detectBackupVersion('invalid')).toBe(1);
      expect(detectBackupVersion(123)).toBe(1);
    });
  });

  describe('migrateBackup', () => {
    it('should not migrate v2 backup', () => {
      const v2Backup: BackupV2 = {
        manifest: {
          backupVersion: 2,
          appVersion: '2.0.13',
          platform: 'android',
          createdAt: '2025-12-23T10:00:00Z',
        },
        sections: {
          mmkv: {
            entries: {
              'theme': { t: 's', v: 'dark' },
            },
          },
        },
      };

      const migrated = migrateBackup(v2Backup, 2);
      expect(migrated).toBe(v2Backup);
    });

    it('should migrate v1 to v2 structure', () => {
      const v1Backup = {
        someKey: 'someValue',
      };

      const migrated = migrateBackup(v1Backup, 1);

      expect(migrated.manifest).toBeDefined();
      expect(migrated.manifest.backupVersion).toBe(BACKUP_SCHEMA_VERSION);
      expect(migrated.sections).toBeDefined();
    });
  });

  describe('validateAndRestoreMMKVEntries', () => {
    beforeEach(() => {
      (MMKVStorage.set as jest.Mock).mockClear();
    });

    it('should restore valid string entries', () => {
      const entries = {
        'theme': { t: 's', v: 'dark' },
        'language': { t: 's', v: 'en' },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(2);
      expect(MMKVStorage.set).toHaveBeenCalledWith('theme', 'dark');
      expect(MMKVStorage.set).toHaveBeenCalledWith('language', 'en');
    });

    it('should restore valid number entries', () => {
      const entries = {
        'fontSize': { t: 'n', v: 16 },
        'lineHeight': { t: 'n', v: 1.5 },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(2);
      expect(MMKVStorage.set).toHaveBeenCalledWith('fontSize', 16);
      expect(MMKVStorage.set).toHaveBeenCalledWith('lineHeight', 1.5);
    });

    it('should restore valid boolean entries', () => {
      const entries = {
        'darkMode': { t: 'b', v: true },
        'autoBackup': { t: 'b', v: false },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(2);
      expect(MMKVStorage.set).toHaveBeenCalledWith('darkMode', true);
      expect(MMKVStorage.set).toHaveBeenCalledWith('autoBackup', false);
    });

    it('should restore valid object entries as JSON string', () => {
      const entries = {
        'settings': { t: 'o', v: { theme: 'dark', fontSize: 16 } },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(1);
      expect(MMKVStorage.set).toHaveBeenCalledWith(
        'settings',
        JSON.stringify({ theme: 'dark', fontSize: 16 }),
      );
    });

    it('should skip excluded keys (LAST_AUTO_BACKUP_TIME)', () => {
      const entries = {
        'LAST_AUTO_BACKUP_TIME': { t: 'n', v: 1703332800000 },
        'theme': { t: 's', v: 'dark' },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(1);
      expect(MMKVStorage.set).not.toHaveBeenCalledWith(
        'LAST_AUTO_BACKUP_TIME',
        expect.anything(),
      );
      expect(MMKVStorage.set).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should skip excluded keys (LOCAL_BACKUP_FOLDER_URI)', () => {
      const entries = {
        'LOCAL_BACKUP_FOLDER_URI': { t: 's', v: 'content://some-uri' },
        'language': { t: 's', v: 'en' },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(1);
      expect(MMKVStorage.set).not.toHaveBeenCalledWith(
        'LOCAL_BACKUP_FOLDER_URI',
        expect.anything(),
      );
      expect(MMKVStorage.set).toHaveBeenCalledWith('language', 'en');
    });

    it('should skip invalid entries (wrong type)', () => {
      const entries = {
        'fontSize': { t: 'n', v: 'not-a-number' }, // Wrong type
        'theme': { t: 's', v: 'dark' },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(1);
      expect(MMKVStorage.set).not.toHaveBeenCalledWith(
        'fontSize',
        expect.anything(),
      );
      expect(MMKVStorage.set).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should skip entries with missing properties', () => {
      const entries = {
        'invalidEntry': { v: 'dark' }, // Missing 't'
        'theme': { t: 's', v: 'dark' },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(1);
      expect(MMKVStorage.set).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should skip entries with unknown type', () => {
      const entries = {
        'unknown': { t: 'x', v: 'value' }, // Unknown type
        'theme': { t: 's', v: 'dark' },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      expect(count).toBe(1);
      expect(MMKVStorage.set).toHaveBeenCalledWith('theme', 'dark');
    });

    it('should handle empty entries object', () => {
      const count = validateAndRestoreMMKVEntries({});

      expect(count).toBe(0);
      expect(MMKVStorage.set).not.toHaveBeenCalled();
    });

    it('should handle restore errors gracefully', () => {
      (MMKVStorage.set as jest.Mock).mockImplementation((key: string) => {
        if (key === 'errorKey') {
          throw new Error('Mock MMKV error');
        }
      });

      const entries = {
        'errorKey': { t: 's', v: 'value' },
        'theme': { t: 's', v: 'dark' },
      };

      const count = validateAndRestoreMMKVEntries(entries as any);

      // Should continue after error and restore the valid entry
      expect(count).toBe(1);
      expect(MMKVStorage.set).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  describe('Regression: Excluded Keys Never Applied', () => {
    it('should never restore LAST_AUTO_BACKUP_TIME even if present in backup', () => {
      const entries = {
        'LAST_AUTO_BACKUP_TIME': { t: 'n', v: Date.now() },
        'theme': { t: 's', v: 'dark' },
      };

      validateAndRestoreMMKVEntries(entries as any);

      const setCallsArgs = (MMKVStorage.set as jest.Mock).mock.calls.map(
        call => call[0],
      );
      expect(setCallsArgs).not.toContain('LAST_AUTO_BACKUP_TIME');
    });

    it('should never restore LOCAL_BACKUP_FOLDER_URI even if present in backup', () => {
      const entries = {
        'LOCAL_BACKUP_FOLDER_URI': { t: 's', v: 'content://example' },
        'language': { t: 's', v: 'en' },
      };

      validateAndRestoreMMKVEntries(entries as any);

      const setCallsArgs = (MMKVStorage.set as jest.Mock).mock.calls.map(
        call => call[0],
      );
      expect(setCallsArgs).not.toContain('LOCAL_BACKUP_FOLDER_URI');
    });

    it('should exclude all device-specific keys', () => {
      const deviceSpecificKeys = [
        'LAST_AUTO_BACKUP_TIME',
        'LOCAL_BACKUP_FOLDER_URI',
      ];

      const entries: any = {};
      deviceSpecificKeys.forEach(key => {
        entries[key] = { t: 's', v: 'test-value' };
      });
      entries['validKey'] = { t: 's', v: 'valid-value' };

      const count = validateAndRestoreMMKVEntries(entries);

      expect(count).toBe(1);
      const setCallsArgs = (MMKVStorage.set as jest.Mock).mock.calls.map(
        call => call[0],
      );
      deviceSpecificKeys.forEach(key => {
        expect(setCallsArgs).not.toContain(key);
      });
      expect(setCallsArgs).toContain('validKey');
    });
  });
});
