import { Migration } from '../types/migration';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const migration006Log = createRateLimitedLogger('Migration006', {
  windowMs: 1500,
});

/**
 * Migration 6: Reading time tracking — ReadingSession table
 * - Stores per-chapter reading sessions with startTime (epoch ms) + duration (ms)
 * - FK to Novel/Chapter with CASCADE so deletes clean up sessions
 * - Indexes on novelId + chapterId for StatsQueries aggregates
 */
export const migration006: Migration = {
  version: 6,
  description: 'Add ReadingSession table for manual reading time tracking',
  migrate: db => {
    try {
      db.runSync(`
        CREATE TABLE IF NOT EXISTS ReadingSession (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          novelId INTEGER NOT NULL,
          chapterId INTEGER NOT NULL,
          startTime INTEGER NOT NULL,
          duration INTEGER NOT NULL CHECK (duration >= 0),
          FOREIGN KEY (novelId) REFERENCES Novel(id) ON DELETE CASCADE,
          FOREIGN KEY (chapterId) REFERENCES Chapter(id) ON DELETE CASCADE
        )
      `);
      db.runSync(
        'CREATE INDEX IF NOT EXISTS idx_reading_session_novel ON ReadingSession(novelId)',
      );
      db.runSync(
        'CREATE INDEX IF NOT EXISTS idx_reading_session_chapter ON ReadingSession(chapterId)',
      );
      db.runSync(
        'CREATE INDEX IF NOT EXISTS idx_reading_session_startTime ON ReadingSession(startTime)',
      );
    } catch (error) {
      migration006Log.error(
        'create-failed',
        'Failed to create ReadingSession table/indexes',
        error,
      );
      throw error;
    }
  },
};
