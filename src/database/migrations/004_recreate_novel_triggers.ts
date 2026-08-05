import { SQLiteDatabase } from 'expo-sqlite';

import { Migration } from '../types/migration';
import { createCategoryTriggerQuery } from '../tables/CategoryTable';
import {
  createNovelTriggerQueryDelete,
  createNovelTriggerQueryInsert,
  createNovelTriggerQueryUpdate,
} from '../tables/NovelTable';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const migration004Log = createRateLimitedLogger('Migration004', {
  windowMs: 1500,
});

/**
 * Trigger bodies reference these columns; SQLite does NOT validate them at
 * CREATE TRIGGER time (the error surfaces only on first fire), so the
 * migration must verify them explicitly before installing the trigger DDL.
 */
const NOVEL_TRIGGER_COLUMNS = [
  'chaptersDownloaded',
  'chaptersUnread',
  'totalChapters',
  'lastReadAt',
  'lastUpdatedAt',
];

const CHAPTER_TRIGGER_COLUMNS = [
  'isDownloaded',
  'unread',
  'readTime',
  'updatedTime',
];

const tableColumnNames = (db: SQLiteDatabase, tableName: string): string[] => {
  try {
    const columns = db.getAllSync<{ name: string }>(
      `PRAGMA table_info(${tableName})`,
    );
    return columns.map(col => col.name);
  } catch {
    return [];
  }
};

const assertColumnsExist = (
  db: SQLiteDatabase,
  tableName: string,
  requiredColumns: string[],
): void => {
  const existing = new Set(tableColumnNames(db, tableName));
  const missing = requiredColumns.filter(col => !existing.has(col));
  if (missing.length > 0) {
    throw new Error(
      `Migration 4 aborted: ${tableName} is missing columns required by the ` +
        `novel/trigger DDL: ${missing.join(', ')}. Schema is incomplete — ` +
        'refusing to install triggers that would silently fail on first fire.',
    );
  }
};

/**
 * Migration 4: Recreate the julianday trigger bodies on ALL installs.
 *
 * Triggers are only created in createInitialSchema (db.ts) which runs when
 * user_version === 0, so existing v2/v3 installs keep stale pre-julianday
 * trigger bodies forever (CREATE TRIGGER IF NOT EXISTS is a no-op when the
 * trigger already exists). This migration drops and recreates them from the
 * same exported constants createInitialSchema uses (single source of truth),
 * and backfills lastUpdatedAt with the same julianday-consistent subquery the
 * triggers use so pre-existing rows sort correctly immediately.
 */
export const migration004: Migration = {
  version: 4,
  description:
    'Recreate julianday novel triggers + add_category on all installs',
  migrate: db => {
    // (a) Column guard — see assertColumnsExist. Must happen BEFORE any DDL.
    assertColumnsExist(db, 'Novel', NOVEL_TRIGGER_COLUMNS);
    assertColumnsExist(db, 'Chapter', CHAPTER_TRIGGER_COLUMNS);

    // (b) Drop stale trigger bodies so the CREATE below is not a no-op.
    db.runSync('DROP TRIGGER IF EXISTS update_novel_stats');
    db.runSync('DROP TRIGGER IF EXISTS update_novel_stats_on_update');
    db.runSync('DROP TRIGGER IF EXISTS update_novel_stats_on_delete');
    db.runSync('DROP TRIGGER IF EXISTS add_category');

    // (c) Recreate from the shared exported constants (single source of truth).
    db.runSync(createNovelTriggerQueryInsert);
    db.runSync(createNovelTriggerQueryUpdate);
    db.runSync(createNovelTriggerQueryDelete);
    db.runSync(createCategoryTriggerQuery);

    // (d) Backfill lastUpdatedAt using the same julianday-consistent subquery
    // the triggers use, so pre-existing rows (populated lexicographically by
    // migration 002) sort correctly immediately instead of waiting for the
    // next chapter write.
    db.runSync(`
      UPDATE Novel
      SET lastUpdatedAt = (
        SELECT updatedTime
        FROM Chapter
        WHERE Chapter.novelId = Novel.id AND updatedTime IS NOT NULL
        ORDER BY julianday(updatedTime) DESC
        LIMIT 1
      )
    `);

    migration004Log.info(
      'recreated-triggers',
      'Recreated novel + category triggers and backfilled lastUpdatedAt',
    );
  },
};
