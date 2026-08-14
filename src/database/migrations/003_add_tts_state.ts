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
 * Migration 3: Add ttsState column to Chapter table
 * - Adds ttsState TEXT column
 */
export const migration003: Migration = {
  version: 3,
  description: 'Add ttsState column to Chapter table',
  migrate: db => {
    // Fresh/bootstrap databases already have the current Chapter schema.
    if (!tableExists(db, 'Chapter')) {
      return;
    }
    if (!columnExists(db, 'Chapter', 'ttsState')) {
      db.runSync(`
        ALTER TABLE Chapter
        ADD COLUMN ttsState TEXT
      `);
    }
  },
};
