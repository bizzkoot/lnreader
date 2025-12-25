/**
 * Tests for CategoryQueries - Category management operations
 *
 * Focus: Test all category database operations
 * Coverage targets:
 * - getCategoriesFromDb() - Fetch all categories with novel IDs
 * - getCategoriesWithCount() - Fetch categories with novel counts
 * - createCategory() - Insert new category
 * - deleteCategoryById() - Delete category with constraints
 * - updateCategory() - Update category name
 * - isCategoryNameDuplicate() - Check name uniqueness
 * - updateCategoryOrderInDb() - Batch update sort order
 * - getAllNovelCategories() - Fetch all novel-category mappings
 * - _restoreCategory() - Restore category from backup
 */

import { db } from '@database/db';
import * as CategoryQueries from '../CategoryQueries';
import type { Category } from '@database/types';

// Mock the database module
jest.mock('@database/db', () => ({
  db: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ lastInsertRowId: 1, changes: 1 })),
    execSync: jest.fn(() => ({})),
    withTransactionSync: jest.fn(callback => callback()),
  },
}));

// Mock utility functions
jest.mock('@database/utils/helpers', () => ({
  getAllSync: jest.fn(() => []),
  runSync: jest.fn(() => ({})),
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));

const { getAllSync, runSync } = require('@database/utils/helpers');
const { showToast } = require('@utils/showToast');
const { getString } = require('@strings/translations');

describe('CategoryQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCategoriesFromDb', () => {
    it('should return empty array when no categories exist', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      const result = CategoryQueries.getCategoriesFromDb();

      expect(result).toEqual([]);
    });

    it('should return categories with concatenated novel IDs', () => {
      const mockCategories = [
        { id: 1, name: 'Reading', sort: 1, novelIds: '1,2,3' },
        { id: 2, name: 'Completed', sort: 2, novelIds: '4,5' },
      ];
      (getAllSync as jest.Mock).mockReturnValueOnce(mockCategories);

      const result = CategoryQueries.getCategoriesFromDb();

      expect(result).toEqual(mockCategories);
      expect(result).toHaveLength(2);
    });

    it('should LEFT JOIN with NovelCategory table', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesFromDb();

      expect(getAllSync).toHaveBeenCalledWith([
        expect.stringContaining('LEFT JOIN NovelCategory'),
      ]);
    });

    it('should GROUP BY Category id, name, sort', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesFromDb();

      expect(getAllSync).toHaveBeenCalledWith([
        expect.stringContaining(
          'GROUP BY Category.id, Category.name, Category.sort',
        ),
      ]);
    });

    it('should use GROUP_CONCAT for novel IDs', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesFromDb();

      expect(getAllSync).toHaveBeenCalledWith([
        expect.stringContaining('GROUP_CONCAT(NovelCategory.novelId'),
      ]);
    });

    it('should ORDER BY sort column', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesFromDb();

      expect(getAllSync).toHaveBeenCalledWith([
        expect.stringContaining('ORDER BY Category.sort'),
      ]);
    });
  });

  describe('getCategoriesWithCount', () => {
    it('should return categories with novel counts', () => {
      const mockCategories = [
        { id: 1, name: 'Reading', sort: 1, novelsCount: 5 },
        { id: 3, name: 'Favorites', sort: 3, novelsCount: 2 },
      ];
      (getAllSync as jest.Mock).mockReturnValueOnce(mockCategories);

      const result = CategoryQueries.getCategoriesWithCount([1, 2, 3, 4, 5]);

      expect(result).toEqual(mockCategories);
    });

    it('should filter by provided novel IDs', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesWithCount([1, 2, 3]);

      expect(getAllSync).toHaveBeenCalledWith([
        expect.stringContaining('WHERE novelId in (1,2,3)'),
      ]);
    });

    it('should exclude category id = 2 (default uncategorized)', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesWithCount([1]);

      expect(getAllSync).toHaveBeenCalledWith([
        expect.stringContaining('WHERE Category.id != 2'),
      ]);
    });

    it('should handle empty novelIds array', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesWithCount([]);

      expect(getAllSync).toHaveBeenCalledWith([
        expect.stringContaining('WHERE novelId in ()'),
      ]);
    });

    it('should LEFT JOIN with novels count subquery', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesWithCount([10, 20]);

      // Query is passed as single-element array with the full constructed query
      expect(getAllSync).toHaveBeenCalledTimes(1);
      const actualQuery = (getAllSync as jest.Mock).mock.calls[0][0][0];
      expect(actualQuery).toContain('FROM Category LEFT JOIN');
      expect(actualQuery).toContain(
        'SELECT categoryId, COUNT(novelId) as novelsCount',
      );
    });

    it('should ORDER BY sort', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getCategoriesWithCount([1]);

      expect(getAllSync).toHaveBeenCalledWith([
        expect.stringContaining('ORDER BY sort'),
      ]);
    });
  });

  describe('createCategory', () => {
    it('should insert new category with name', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries.createCategory('New Category');

      expect(runSync).toHaveBeenCalledWith([
        ['INSERT INTO Category (name) VALUES (?)', ['New Category']],
      ]);
    });

    it('should handle category name with special characters', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries.createCategory('Sci-Fi & Fantasy');

      expect(runSync).toHaveBeenCalledWith([
        ['INSERT INTO Category (name) VALUES (?)', ['Sci-Fi & Fantasy']],
      ]);
    });

    it('should handle empty category name', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries.createCategory('');

      expect(runSync).toHaveBeenCalledWith([
        ['INSERT INTO Category (name) VALUES (?)', ['']],
      ]);
    });

    it('should handle very long category names', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      const longName = 'A'.repeat(200);
      CategoryQueries.createCategory(longName);

      expect(runSync).toHaveBeenCalledWith([
        ['INSERT INTO Category (name) VALUES (?)', [longName]],
      ]);
    });
  });

  describe('deleteCategoryById', () => {
    it('should show toast for default category (sort = 1)', () => {
      (getString as jest.Mock).mockReturnValueOnce(
        'Cannot delete default category',
      );

      const defaultCategory: Category = { id: 1, name: 'Default', sort: 1 };
      CategoryQueries.deleteCategoryById(defaultCategory);

      expect(getString).toHaveBeenCalledWith('categories.cantDeleteDefault');
      expect(showToast).toHaveBeenCalledWith('Cannot delete default category');
      expect(runSync).not.toHaveBeenCalled();
    });

    it('should show toast for uncategorized category (id = 2)', () => {
      (getString as jest.Mock).mockReturnValueOnce('Cannot delete');

      const uncategorizedCategory: Category = {
        id: 2,
        name: 'Uncategorized',
        sort: 999,
      };
      CategoryQueries.deleteCategoryById(uncategorizedCategory);

      expect(getString).toHaveBeenCalledWith('categories.cantDeleteDefault');
      expect(showToast).toHaveBeenCalled();
      expect(runSync).not.toHaveBeenCalled();
    });

    it('should delete custom category', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      const customCategory: Category = { id: 5, name: 'Custom', sort: 3 };
      CategoryQueries.deleteCategoryById(customCategory);

      expect(runSync).toHaveBeenCalledWith([
        [expect.stringContaining('UPDATE NovelCategory SET categoryId'), [5]],
        ['DELETE FROM Category WHERE id = ?', [5]],
      ]);
    });

    it('should move novels with only this category to default before deletion', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      const category: Category = { id: 10, name: 'Test', sort: 5 };
      CategoryQueries.deleteCategoryById(category);

      expect(runSync).toHaveBeenCalledWith([
        [
          expect.stringContaining(
            'UPDATE NovelCategory SET categoryId = (SELECT id FROM Category WHERE sort = 1)',
          ),
          [10],
        ],
        ['DELETE FROM Category WHERE id = ?', [10]],
      ]);
    });

    it('should only move novels that have this as their only category', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      const category: Category = { id: 3, name: 'Test', sort: 2 };
      CategoryQueries.deleteCategoryById(category);

      expect(runSync).toHaveBeenCalledWith([
        [expect.stringContaining('HAVING COUNT(categoryId) = 1'), [3]],
        expect.anything(),
      ]);
    });
  });

  describe('updateCategory', () => {
    it('should update category name by ID', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries.updateCategory(5, 'Updated Name');

      expect(runSync).toHaveBeenCalledWith([
        ['UPDATE Category SET name = ? WHERE id = ?', ['Updated Name', 5]],
      ]);
    });

    it('should handle name change to empty string', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries.updateCategory(1, '');

      expect(runSync).toHaveBeenCalledWith([
        ['UPDATE Category SET name = ? WHERE id = ?', ['', 1]],
      ]);
    });

    it('should handle special characters in name', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries.updateCategory(2, 'Action/Adventure');

      expect(runSync).toHaveBeenCalledWith([
        ['UPDATE Category SET name = ? WHERE id = ?', ['Action/Adventure', 2]],
      ]);
    });
  });

  describe('isCategoryNameDuplicate', () => {
    it('should return false when name is unique', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicate: 0,
      });

      const result = CategoryQueries.isCategoryNameDuplicate('New Category');

      expect(result).toBe(false);
      expect(db.getFirstSync).toHaveBeenCalledWith(
        expect.stringContaining(
          'SELECT COUNT(*) as isDuplicate FROM Category WHERE name = ?',
        ),
        ['New Category'],
      );
    });

    it('should return true when name is duplicate', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicate: 1,
      });

      const result = CategoryQueries.isCategoryNameDuplicate('Reading');

      expect(result).toBe(true);
    });

    it('should return true when multiple duplicates exist', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicate: 3,
      });

      const result = CategoryQueries.isCategoryNameDuplicate('Favorites');

      expect(result).toBe(true);
    });

    it('should be case-sensitive', () => {
      (db.getFirstSync as jest.Mock)
        .mockReturnValueOnce({ isDuplicate: 0 })
        .mockReturnValueOnce({ isDuplicate: 1 });

      CategoryQueries.isCategoryNameDuplicate('reading');
      CategoryQueries.isCategoryNameDuplicate('Reading');

      expect(db.getFirstSync).toHaveBeenCalledTimes(2);
    });

    it('should handle empty string name check', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicate: 0,
      });

      const result = CategoryQueries.isCategoryNameDuplicate('');

      expect(result).toBe(false);
    });

    it('should throw when result is not an object', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce(null);

      expect(() => CategoryQueries.isCategoryNameDuplicate('Test')).toThrow(
        'isCategoryNameDuplicate return type does not match.',
      );
    });

    it('should throw when result does not have isDuplicate property', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({});

      expect(() => CategoryQueries.isCategoryNameDuplicate('Test')).toThrow(
        'isCategoryNameDuplicate return type does not match.',
      );
    });
  });

  describe('updateCategoryOrderInDb', () => {
    it('should update sort order for all categories', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      const categories: Category[] = [
        { id: 1, name: 'A', sort: 1 },
        { id: 2, name: 'B', sort: 2 },
        { id: 3, name: 'C', sort: 3 },
      ];
      CategoryQueries.updateCategoryOrderInDb(categories);

      expect(runSync).toHaveBeenCalledWith([
        ['UPDATE Category SET sort = ? WHERE id = ?', [1, 1]],
        ['UPDATE Category SET sort = ? WHERE id = ?', [2, 2]],
        ['UPDATE Category SET sort = ? WHERE id = ?', [3, 3]],
      ]);
    });

    it('should return early if first category is id = 2 (local category)', () => {
      const categories: Category[] = [
        { id: 2, name: 'Local', sort: 0 },
        { id: 1, name: 'A', sort: 1 },
      ];
      CategoryQueries.updateCategoryOrderInDb(categories);

      expect(runSync).not.toHaveBeenCalled();
    });

    it('should handle empty categories array', () => {
      CategoryQueries.updateCategoryOrderInDb([]);

      // Empty array maps to empty array, so runSync is called with []
      // The condition only returns early if first category is id=2
      expect(runSync).toHaveBeenCalledWith([]);
    });

    it('should update sort order for custom categories only', () => {
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      const categories: Category[] = [
        { id: 5, name: 'Custom 1', sort: 10 },
        { id: 6, name: 'Custom 2', sort: 20 },
      ];
      CategoryQueries.updateCategoryOrderInDb(categories);

      expect(runSync).toHaveBeenCalledWith([
        ['UPDATE Category SET sort = ? WHERE id = ?', [10, 5]],
        ['UPDATE Category SET sort = ? WHERE id = ?', [20, 6]],
      ]);
    });
  });

  describe('getAllNovelCategories', () => {
    it('should return all novel-category mappings', () => {
      const mockMappings = [
        { categoryId: 1, novelId: 10 },
        { categoryId: 1, novelId: 20 },
        { categoryId: 2, novelId: 10 },
      ];
      (getAllSync as jest.Mock).mockReturnValueOnce(mockMappings);

      const result = CategoryQueries.getAllNovelCategories();

      expect(result).toEqual(mockMappings);
      expect(result).toHaveLength(3);
    });

    it('should return empty array when no mappings exist', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      const result = CategoryQueries.getAllNovelCategories();

      expect(result).toEqual([]);
    });

    it('should SELECT all columns from NovelCategory table', () => {
      (getAllSync as jest.Mock).mockReturnValueOnce([]);

      CategoryQueries.getAllNovelCategories();

      expect(getAllSync).toHaveBeenCalledWith(['SELECT * FROM NovelCategory']);
    });
  });

  describe('_restoreCategory', () => {
    it('should restore category with novel mappings', () => {
      const backupCategory = {
        id: 5,
        name: 'Restored',
        sort: 3,
        novelIds: [10, 20, 30],
      };
      (db.withTransactionSync as jest.Mock).mockImplementationOnce(callback => {
        callback();
      });

      CategoryQueries._restoreCategory(backupCategory);

      expect(db.withTransactionSync).toHaveBeenCalled();
      expect(db.execSync).toHaveBeenCalledWith('PRAGMA foreign_keys = OFF');
      expect(db.execSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    });

    it('should delete existing category with same id or sort', () => {
      const backupCategory = {
        id: 5,
        name: 'Test',
        sort: 3,
        novelIds: [1, 2],
      };
      (db.withTransactionSync as jest.Mock).mockImplementationOnce(callback => {
        callback();
      });
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries._restoreCategory(backupCategory);

      // Should include delete, insert category, and insert novel mappings
      expect(runSync).toHaveBeenCalledWith([
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
        expect.any(Array),
      ]);
    });

    it('should insert category with OR IGNORE', () => {
      const backupCategory = {
        id: 10,
        name: 'Backup',
        sort: 5,
        novelIds: [100],
      };
      (db.withTransactionSync as jest.Mock).mockImplementationOnce(callback => {
        callback();
      });
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries._restoreCategory(backupCategory);

      expect(runSync).toHaveBeenCalledWith([
        expect.anything(),
        [
          'INSERT OR IGNORE INTO Category (id, name, sort) VALUES (?, ?, ?)',
          [10, 'Backup', 5],
        ],
        expect.anything(),
      ]);
    });

    it('should insert novel mappings with OR IGNORE', () => {
      const backupCategory = {
        id: 1,
        name: 'Test',
        sort: 1,
        novelIds: [5, 10, 15],
      };
      (db.withTransactionSync as jest.Mock).mockImplementationOnce(callback => {
        callback();
      });
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries._restoreCategory(backupCategory);

      expect(runSync).toHaveBeenCalledWith([
        expect.anything(),
        expect.anything(),
        [
          'INSERT OR IGNORE INTO NovelCategory (categoryId, novelId) VALUES (?, ?)',
          [1, 5],
        ],
        [
          'INSERT OR IGNORE INTO NovelCategory (categoryId, novelId) VALUES (?, ?)',
          [1, 10],
        ],
        [
          'INSERT OR IGNORE INTO NovelCategory (categoryId, novelId) VALUES (?, ?)',
          [1, 15],
        ],
      ]);
    });

    it('should handle category with no novel IDs', () => {
      const backupCategory = {
        id: 5,
        name: 'Empty',
        sort: 10,
        novelIds: [],
      };
      (db.withTransactionSync as jest.Mock).mockImplementationOnce(callback => {
        callback();
      });
      (runSync as jest.Mock).mockReturnValueOnce(undefined);

      CategoryQueries._restoreCategory(backupCategory);

      // Should only have delete and insert category queries, no novel mappings
      expect(runSync).toHaveBeenCalledWith([
        expect.anything(),
        expect.anything(),
      ]);
    });

    it('should re-enable foreign keys after transaction', () => {
      const backupCategory = {
        id: 1,
        name: 'Test',
        sort: 1,
        novelIds: [1],
      };
      (db.withTransactionSync as jest.Mock).mockImplementationOnce(callback => {
        callback();
      });

      CategoryQueries._restoreCategory(backupCategory);

      const calls = (db.execSync as jest.Mock).mock.calls;
      expect(calls[0]).toContain('PRAGMA foreign_keys = OFF');
      expect(calls[calls.length - 1]).toContain('PRAGMA foreign_keys = ON');
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle full category management workflow', () => {
      // Create
      (runSync as jest.Mock).mockReturnValueOnce(undefined);
      CategoryQueries.createCategory('New Category');
      expect(runSync).toHaveBeenCalledWith([
        ['INSERT INTO Category (name) VALUES (?)', ['New Category']],
      ]);

      // Check duplicate
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicate: 0,
      });
      const isDup = CategoryQueries.isCategoryNameDuplicate('New Category');
      expect(isDup).toBe(false);

      // Update
      (runSync as jest.Mock).mockReturnValueOnce(undefined);
      CategoryQueries.updateCategory(1, 'Updated');
      expect(runSync).toHaveBeenCalledWith([
        ['UPDATE Category SET name = ? WHERE id = ?', ['Updated', 1]],
      ]);

      // Update order
      (runSync as jest.Mock).mockReturnValueOnce(undefined);
      const categories: Category[] = [
        { id: 1, name: 'A', sort: 1 },
        { id: 3, name: 'C', sort: 3 },
      ];
      CategoryQueries.updateCategoryOrderInDb(categories);
      expect(runSync).toHaveBeenCalled();

      // Get all
      (getAllSync as jest.Mock).mockReturnValueOnce([
        { categoryId: 1, novelId: 10 },
        { categoryId: 2, novelId: 20 },
      ]);
      const mappings = CategoryQueries.getAllNovelCategories();
      expect(mappings).toHaveLength(2);
    });
  });
});
