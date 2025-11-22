import { SQLiteDatabase } from 'expo-sqlite';

import { Migration } from '../types/migration';

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
 * Migration 3: Add ttsState column to Chapter table
 * - Adds ttsState TEXT column
 */
export const migration003: Migration = {
    version: 3,
    description: 'Add ttsState column to Chapter table',
    migrate: db => {
        const addColumnSafely = (columnName: string, columnDefinition: string) => {
            if (!columnExists(db, 'Chapter', columnName)) {
                try {
                    db.runSync(`
            ALTER TABLE Chapter 
            ADD COLUMN ${columnName} ${columnDefinition}
          `);
                } catch (error) {
                    // Gracefully handle ALTER TABLE failures (e.g., table doesn't exist)
                    // Columns will be created when table is created in initial schema
                    if (__DEV__) {
                        // eslint-disable-next-line no-console
                        console.warn(
                            `Failed to add column ${columnName} to Chapter table:`,
                            error,
                        );
                    }
                }
            }
        };

        addColumnSafely('ttsState', 'TEXT');
    },
};
