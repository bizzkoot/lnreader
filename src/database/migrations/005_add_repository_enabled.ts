import { SQLiteDatabase } from 'expo-sqlite';

import { Migration } from '../types/migration';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const migration005Log = createRateLimitedLogger('Migration005', {
  windowMs: 1500,
});

const columnExists = (
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
): boolean => {
  try {
    const columns = db.getAllSync<{ name: string }>(
      `PRAGMA table_info(${tableName})`,
    );
    return columns.some(col => col.name === columnName);
  } catch {
    return false;
  }
};

/**
 * Migration 5: Add enabled column to Repository table
 * - Adds enabled INTEGER NOT NULL DEFAULT 1 (disabled repositories are
 *   skipped during plugin discovery/update checks, upstream #1628)
 */
export const migration005: Migration = {
  version: 5,
  description: 'Add enabled column to Repository table',
  migrate: db => {
    if (!columnExists(db, 'Repository', 'enabled')) {
      try {
        db.runSync(`
          ALTER TABLE Repository
          ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1
        `);
      } catch (error) {
        migration005Log.error(
          'alter-failed',
          'Failed to add enabled column to Repository',
          error,
        );
        throw error;
      }
    }
  },
};
