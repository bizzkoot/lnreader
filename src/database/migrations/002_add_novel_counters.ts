import { SQLiteDatabase } from 'expo-sqlite';

import { Migration } from '../types/migration';

const tableExists = (db: SQLiteDatabase, tableName: string): boolean => {
  return (
    db.getAllSync<{ name: string }>(`PRAGMA table_info(${tableName})`).length >
    0
  );
};

const columnExists = (
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
): boolean => {
  const columns = db.getAllSync<{ name: string }>(
    `PRAGMA table_info(${tableName})`,
  );
  return columns.some(col => col.name === columnName);
};

/**
 * Migration 2: Add counter columns to Novel table
 * - Adds chaptersDownloaded, chaptersUnread, totalChapters columns
 * - Adds lastReadAt, lastUpdatedAt timestamp columns
 * - Populates columns with existing data
 */
export const migration002: Migration = {
  version: 2,
  description: 'Add counter columns and triggers to Novel table',
  migrate: db => {
    // A truly empty database is initialized with the current schema before
    // migrations run. Keep the migration a no-op for that test/bootstrap case;
    // never treat a failure on an existing table as a successful migration.
    if (!tableExists(db, 'Novel')) {
      return;
    }

    const addColumn = (columnName: string, columnDefinition: string) => {
      if (!columnExists(db, 'Novel', columnName)) {
        db.runSync(`
          ALTER TABLE Novel
          ADD COLUMN ${columnName} ${columnDefinition}
        `);
      }
    };

    addColumn('chaptersDownloaded', 'INTEGER DEFAULT 0');
    addColumn('chaptersUnread', 'INTEGER DEFAULT 0');
    addColumn('totalChapters', 'INTEGER DEFAULT 0');
    addColumn('lastReadAt', 'TEXT');
    addColumn('lastUpdatedAt', 'TEXT');

    const allColumnsExist =
      columnExists(db, 'Novel', 'chaptersDownloaded') &&
      columnExists(db, 'Novel', 'chaptersUnread') &&
      columnExists(db, 'Novel', 'totalChapters') &&
      columnExists(db, 'Novel', 'lastReadAt') &&
      columnExists(db, 'Novel', 'lastUpdatedAt');

    if (!allColumnsExist) {
      throw new Error('Migration 2 failed to create Novel counter columns');
    }

    db.runSync(`
          UPDATE Novel
          SET chaptersDownloaded = (
            SELECT COUNT(*)
            FROM Chapter
            WHERE Chapter.novelId = Novel.id 
              AND Chapter.isDownloaded = 1
          )
    `);

    db.runSync(`
          UPDATE Novel
          SET chaptersUnread = (
            SELECT COUNT(*)
            FROM Chapter
            WHERE Chapter.novelId = Novel.id 
              AND Chapter.unread = 1
          )
    `);

    db.runSync(`
          UPDATE Novel
          SET totalChapters = (
            SELECT COUNT(*)
            FROM Chapter
            WHERE Chapter.novelId = Novel.id
          )
    `);

    db.runSync(`
          UPDATE Novel
          SET lastReadAt = (
            SELECT MAX(readTime)
            FROM Chapter
            WHERE Chapter.novelId = Novel.id
          )
    `);

    db.runSync(`
          UPDATE Novel
          SET lastUpdatedAt = (
            SELECT MAX(updatedTime)
            FROM Chapter
            WHERE Chapter.novelId = Novel.id
          )
    `);
  },
};
