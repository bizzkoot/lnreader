/**
 * Backup Pruning Logic Tests
 *
 * Tests the backup file filtering, sorting, and pruning logic
 * to prevent regressions in the backup cleanup functionality.
 */

// The pruning logic helper - extracted for testing
// This mirrors the logic in src/services/backup/local/index.ts
interface BackupEntry {
  uri: string;
  fileName: string;
  sortKey: string;
}

/**
 * Filters and sorts backup files matching a specific prefix.
 * This is the core logic extracted from createBackup for testability.
 */
export function filterAndSortBackups(
  directoryUris: string[],
  prefix: string,
): BackupEntry[] {
  const backupRegex = new RegExp(
    `^${prefix}(\\d{4}-\\d{2}-\\d{2}t\\d{2}-\\d{2}-\\d{2})\\.zip$`,
    'i',
  );

  return directoryUris
    .filter(uri => {
      // SAF URIs are URL-encoded, decode to get actual filename
      const decodedUri = decodeURIComponent(uri);
      const name = decodedUri.split('/').pop() || '';
      return backupRegex.test(name);
    })
    .map(uri => {
      const decodedUri = decodeURIComponent(uri);
      const name = decodedUri.split('/').pop() || '';
      const match = name.match(backupRegex);
      const sortKey = match?.[1] || '';
      return { uri, fileName: name, sortKey };
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

/**
 * Determines which backups should be deleted based on the max limit.
 */
export function getBackupsToDelete(
  backups: BackupEntry[],
  maxBackups: number,
): BackupEntry[] {
  const overflow = backups.length - maxBackups;
  if (overflow > 0) {
    return backups.slice(0, overflow);
  }
  return [];
}

describe('Backup Pruning Logic', () => {
  describe('filterAndSortBackups', () => {
    it('should filter auto backups correctly', () => {
      const directoryUris = [
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_auto_backup_2025-12-23t10-00-00.zip',
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_manual_backup_2025-12-23t09-00-00.zip',
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_auto_backup_2025-12-22t10-00-00.zip',
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Fsome_other_file.txt',
      ];

      const result = filterAndSortBackups(
        directoryUris,
        'lnreader_auto_backup_',
      );

      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe(
        'lnreader_auto_backup_2025-12-22t10-00-00.zip',
      );
      expect(result[1].fileName).toBe(
        'lnreader_auto_backup_2025-12-23t10-00-00.zip',
      );
    });

    it('should filter manual backups correctly', () => {
      const directoryUris = [
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_auto_backup_2025-12-23t10-00-00.zip',
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_manual_backup_2025-12-23t09-00-00.zip',
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_manual_backup_2025-12-22t08-00-00.zip',
      ];

      const result = filterAndSortBackups(
        directoryUris,
        'lnreader_manual_backup_',
      );

      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe(
        'lnreader_manual_backup_2025-12-22t08-00-00.zip',
      );
      expect(result[1].fileName).toBe(
        'lnreader_manual_backup_2025-12-23t09-00-00.zip',
      );
    });

    it('should ignore legacy backup format', () => {
      const directoryUris = [
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_backup_2025-12-23t10-00-00.zip',
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_auto_backup_2025-12-23t09-00-00.zip',
      ];

      const result = filterAndSortBackups(
        directoryUris,
        'lnreader_auto_backup_',
      );

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe(
        'lnreader_auto_backup_2025-12-23t09-00-00.zip',
      );
    });

    it('should handle URL-encoded URIs correctly (regression test)', () => {
      // This is the key regression test for the SAF URL encoding issue
      // Real SAF URIs have encoded components: %3A for : and %2F for /
      const directoryUris = [
        'content://com.android.externalstorage.documents/tree/primary%3ABackup/document/primary%3ABackup%2Flnreader_manual_backup_2025-12-23t19-00-00.zip',
      ];

      const result = filterAndSortBackups(
        directoryUris,
        'lnreader_manual_backup_',
      );

      expect(result).toHaveLength(1);
      expect(result[0].fileName).toBe(
        'lnreader_manual_backup_2025-12-23t19-00-00.zip',
      );
    });

    it('should sort backups by timestamp (oldest first)', () => {
      const directoryUris = [
        'content://example/lnreader_auto_backup_2025-12-25t10-00-00.zip',
        'content://example/lnreader_auto_backup_2025-12-20t10-00-00.zip',
        'content://example/lnreader_auto_backup_2025-12-23t10-00-00.zip',
      ];

      const result = filterAndSortBackups(
        directoryUris,
        'lnreader_auto_backup_',
      );

      expect(result).toHaveLength(3);
      expect(result[0].sortKey).toBe('2025-12-20t10-00-00');
      expect(result[1].sortKey).toBe('2025-12-23t10-00-00');
      expect(result[2].sortKey).toBe('2025-12-25t10-00-00');
    });

    it('should return empty array when no matching files', () => {
      const directoryUris = [
        'content://example/random_file.zip',
        'content://example/lnreader_manual_backup_2025-12-23t10-00-00.zip',
      ];

      const result = filterAndSortBackups(
        directoryUris,
        'lnreader_auto_backup_',
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('getBackupsToDelete', () => {
    const createBackups = (count: number): BackupEntry[] => {
      return Array.from({ length: count }, (_, i) => ({
        uri: `content://example/backup_${i}.zip`,
        fileName: `backup_${i}.zip`,
        sortKey: `2025-12-${String(i + 1).padStart(2, '0')}t10-00-00`,
      }));
    };

    it('should return oldest backups when exceeding limit', () => {
      const backups = createBackups(5);
      const toDelete = getBackupsToDelete(backups, 2);

      expect(toDelete).toHaveLength(3);
      expect(toDelete[0].sortKey).toBe('2025-12-01t10-00-00');
      expect(toDelete[1].sortKey).toBe('2025-12-02t10-00-00');
      expect(toDelete[2].sortKey).toBe('2025-12-03t10-00-00');
    });

    it('should return empty array when at or under limit', () => {
      const backups = createBackups(2);
      const toDelete = getBackupsToDelete(backups, 2);

      expect(toDelete).toHaveLength(0);
    });

    it('should return empty array when under limit', () => {
      const backups = createBackups(1);
      const toDelete = getBackupsToDelete(backups, 5);

      expect(toDelete).toHaveLength(0);
    });

    it('should handle exactly one overflow correctly', () => {
      const backups = createBackups(3);
      const toDelete = getBackupsToDelete(backups, 2);

      expect(toDelete).toHaveLength(1);
      expect(toDelete[0].sortKey).toBe('2025-12-01t10-00-00');
    });

    it('should delete correct number to reach exact limit', () => {
      const backups = createBackups(10);
      const toDelete = getBackupsToDelete(backups, 3);

      expect(toDelete).toHaveLength(7);
      // After deletion, 3 newest should remain
    });
  });

  describe('Integration: Auto vs Manual Independence', () => {
    it('should not interfere with each other when filtering', () => {
      const directoryUris = [
        'content://example/lnreader_auto_backup_2025-12-01t10-00-00.zip',
        'content://example/lnreader_auto_backup_2025-12-02t10-00-00.zip',
        'content://example/lnreader_auto_backup_2025-12-03t10-00-00.zip',
        'content://example/lnreader_manual_backup_2025-12-01t09-00-00.zip',
        'content://example/lnreader_manual_backup_2025-12-02t09-00-00.zip',
      ];

      const autoBackups = filterAndSortBackups(
        directoryUris,
        'lnreader_auto_backup_',
      );
      const manualBackups = filterAndSortBackups(
        directoryUris,
        'lnreader_manual_backup_',
      );

      expect(autoBackups).toHaveLength(3);
      expect(manualBackups).toHaveLength(2);

      // With limit of 2, auto should delete 1, manual should delete 0
      const autoToDelete = getBackupsToDelete(autoBackups, 2);
      const manualToDelete = getBackupsToDelete(manualBackups, 2);

      expect(autoToDelete).toHaveLength(1);
      expect(manualToDelete).toHaveLength(0);
    });
  });
});
