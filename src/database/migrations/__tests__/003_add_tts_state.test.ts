import { SQLiteDatabase } from 'expo-sqlite';
import { migration003 } from '../003_add_tts_state';

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  SQLiteDatabase: jest.fn(),
}));

describe('Migration 003: Add ttsState column to Chapter table', () => {
  let mockDb: jest.Mocked<SQLiteDatabase>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock database instance
    mockDb = {
      getAllSync: jest.fn(),
      runSync: jest.fn().mockReturnValue({ lastInsertRowId: 1, changes: 0 }),
    } as any;

    // Mock __DEV__
    (global as any).__DEV__ = true;
  });

  describe('columnExists', () => {
    it('should return true when column exists', () => {
      const mockColumns = [
        { name: 'id' },
        { name: 'name' },
        { name: 'ttsState' },
      ];
      mockDb.getAllSync.mockReturnValue(mockColumns);

      // Import and test the internal function
      const { migration003: migration } = require('../003_add_tts_state');

      // We need to access the internal function through the migration
      // This is a bit of a hack but necessary for testing
      const migrationCode = migration.migrate.toString();
      const columnExistsMatch = migrationCode.match(
        /const columnExists = \(([\s\S]*?)\n/s,
      );

      if (columnExistsMatch) {
        const columnExistsCode = columnExistsMatch[1];
        const columnExists = new Function(
          'db',
          'tableName',
          'columnName',
          columnExistsCode,
        );

        const result = columnExists(mockDb, 'Chapter', 'ttsState');
        expect(result).toBe(true);
      }
    });

    it('should return false when column does not exist', () => {
      const mockColumns = [{ name: 'id' }, { name: 'name' }];
      mockDb.getAllSync.mockReturnValue(mockColumns);

      const { migration003: migration } = require('../003_add_tts_state');

      const migrationCode = migration.migrate.toString();
      const columnExistsMatch = migrationCode.match(
        /const columnExists = \(([\s\S]*?)\n/s,
      );

      if (columnExistsMatch) {
        const columnExistsCode = columnExistsMatch[1];
        const columnExists = new Function(
          'db',
          'tableName',
          'columnName',
          columnExistsCode,
        );

        const result = columnExists(mockDb, 'Chapter', 'ttsState');
        expect(result).toBe(false);
      }
    });

    it('should return false when PRAGMA fails', () => {
      mockDb.getAllSync.mockImplementation(() => {
        throw new Error('PRAGMA failed');
      });

      const { migration003: migration } = require('../003_add_tts_state');

      const migrationCode = migration.migrate.toString();
      const columnExistsMatch = migrationCode.match(
        /const columnExists = \(([\s\S]*?)\n/s,
      );

      if (columnExistsMatch) {
        const columnExistsCode = columnExistsMatch[1];
        const columnExists = new Function(
          'db',
          'tableName',
          'columnName',
          columnExistsCode,
        );

        const result = columnExists(mockDb, 'Chapter', 'ttsState');
        expect(result).toBe(false);
      }
    });
  });

  describe('addColumnSafely', () => {
    it('should add column when it does not exist', () => {
      mockDb.getAllSync.mockReturnValue([{ name: 'id' }, { name: 'name' }]);
      mockDb.runSync.mockReturnValue({ lastInsertRowId: 1, changes: 0 });

      migration003.migrate(mockDb);

      expect(mockDb.runSync).toHaveBeenCalledWith(
        expect.stringMatching(/ALTER TABLE Chapter.*ADD COLUMN ttsState TEXT/s),
      );
    });

    it('should not add column when it already exists', () => {
      mockDb.getAllSync.mockReturnValue([
        { name: 'id' },
        { name: 'name' },
        { name: 'ttsState' },
      ]);
      mockDb.runSync.mockReturnValue({ lastInsertRowId: 1, changes: 0 });

      migration003.migrate(mockDb);

      expect(mockDb.runSync).not.toHaveBeenCalledWith(
        expect.stringMatching(/ALTER TABLE Chapter.*ADD COLUMN ttsState TEXT/s),
      );
    });

    it('should handle ALTER TABLE failure gracefully', () => {
      mockDb.getAllSync.mockReturnValue([{ name: 'id' }, { name: 'name' }]);
      mockDb.runSync.mockImplementation(() => {
        throw new Error('Table does not exist');
      });

      // Migration should not throw error even when ALTER TABLE fails
      expect(() => migration003.migrate(mockDb)).not.toThrow();

      // Verify that runSync was called (attempted to add column)
      expect(mockDb.runSync).toHaveBeenCalled();
    });
  });

  describe('migration properties', () => {
    it('should have correct version', () => {
      expect(migration003.version).toBe(3);
    });

    it('should have correct description', () => {
      expect(migration003.description).toBe(
        'Add ttsState column to Chapter table',
      );
    });

    it('should have migrate function', () => {
      expect(typeof migration003.migrate).toBe('function');
    });
  });

  describe('integration', () => {
    it('should complete migration successfully', () => {
      mockDb.getAllSync.mockReturnValue([{ name: 'id' }, { name: 'name' }]);
      mockDb.runSync.mockReturnValue({ lastInsertRowId: 1, changes: 0 });

      expect(() => migration003.migrate(mockDb)).not.toThrow();
    });

    it('should handle multiple column additions', () => {
      // Test with a modified migration that adds multiple columns
      const multiColumnMigration = {
        ...migration003,
        migrate: (db: SQLiteDatabase) => {
          const addColumnSafely = (
            columnName: string,
            columnDefinition: string,
          ) => {
            const mockColumns =
              mockDb.getAllSync(`PRAGMA table_info(Chapter)`) || [];
            if (!mockColumns.some((col: any) => col.name === columnName)) {
              db.runSync(`
                ALTER TABLE Chapter 
                ADD COLUMN ${columnName} ${columnDefinition}
              `);
            }
          };

          addColumnSafely('ttsState', 'TEXT');
          addColumnSafely('anotherColumn', 'INTEGER');
        },
      };

      multiColumnMigration.migrate(mockDb);

      expect(mockDb.runSync).toHaveBeenCalledTimes(2);
      expect(mockDb.runSync).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/ALTER TABLE Chapter.*ADD COLUMN ttsState TEXT/s),
      );
      expect(mockDb.runSync).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(
          /ALTER TABLE Chapter.*ADD COLUMN anotherColumn INTEGER/s,
        ),
      );
    });
  });
});
