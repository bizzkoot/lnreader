import { Migration } from '../types/migration';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const migration007Log = createRateLimitedLogger('Migration007', {
  windowMs: 1500,
});

/**
 * Migration 7: Dedicated index for WHERE inLibrary = 1 queries
 * - NovelIndex is composite (pluginId, path, id, inLibrary) and cannot be used
 *   for SQLite index seek on bare `WHERE inLibrary = 1` (leftmost-prefix rule).
 * - StatsQueries aggregates scan Novel filtered only by inLibrary; this index
 *   enables index seek instead of full table scan.
 */
export const migration007: Migration = {
  version: 7,
  description: 'Add index on Novel(inLibrary) for library stats queries',
  migrate: db => {
    try {
      db.runSync(
        'CREATE INDEX IF NOT EXISTS idx_novel_inLibrary ON Novel(inLibrary)',
      );
    } catch (error) {
      migration007Log.error(
        'create-failed',
        'Failed to create idx_novel_inLibrary index',
        error,
      );
      throw error;
    }
  },
};
