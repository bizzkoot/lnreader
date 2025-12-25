/**
 * Tests for RepositoryQueries - Repository CRUD operations
 *
 * Focus: Test all repository database operations
 * Coverage targets:
 * - getRepositoriesFromDb() - Fetch all repositories
 * - isRepoUrlDuplicated() - Check URL uniqueness
 * - createRepository() - Insert new repository
 * - deleteRepositoryById() - Delete repository
 * - updateRepository() - Update repository URL
 */

import { db } from '@database/db';
import * as RepositoryQueries from '../RepositoryQueries';
import type { Repository } from '@database/types';

// Mock the database module
jest.mock('@database/db', () => ({
  db: {
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ lastInsertRowId: 1, changes: 1 })),
  },
}));

describe('RepositoryQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getRepositoriesFromDb', () => {
    it('should return empty array when no repositories exist', () => {
      (db.getAllSync as jest.Mock).mockReturnValueOnce([]);

      const result = RepositoryQueries.getRepositoriesFromDb();

      expect(db.getAllSync).toHaveBeenCalledWith('SELECT * FROM Repository');
      expect(result).toEqual([]);
    });

    it('should return all repositories from database', () => {
      const mockRepos: Repository[] = [
        { id: 1, url: 'https://example.com/repo1' },
        { id: 2, url: 'https://example.com/repo2' },
      ];
      (db.getAllSync as jest.Mock).mockReturnValueOnce(mockRepos);

      const result = RepositoryQueries.getRepositoriesFromDb();

      expect(db.getAllSync).toHaveBeenCalledWith('SELECT * FROM Repository');
      expect(result).toEqual(mockRepos);
      expect(result).toHaveLength(2);
    });

    it('should handle database errors gracefully', () => {
      (db.getAllSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Database connection lost');
      });

      expect(() => RepositoryQueries.getRepositoriesFromDb()).toThrow(
        'Database connection lost',
      );
    });
  });

  describe('isRepoUrlDuplicated', () => {
    it('should return false when URL is not duplicated (count = 0)', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicated: 0,
      });

      const result = RepositoryQueries.isRepoUrlDuplicated(
        'https://example.com/new',
      );

      expect(db.getFirstSync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as isDuplicated FROM Repository WHERE url = ?',
        'https://example.com/new',
      );
      expect(result).toBe(false);
    });

    it('should return true when URL is duplicated (count > 0)', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicated: 1,
      });

      const result = RepositoryQueries.isRepoUrlDuplicated(
        'https://example.com/existing',
      );

      expect(db.getFirstSync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as isDuplicated FROM Repository WHERE url = ?',
        'https://example.com/existing',
      );
      expect(result).toBe(true);
    });

    it('should return true when multiple duplicates exist (count > 1)', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicated: 3,
      });

      const result = RepositoryQueries.isRepoUrlDuplicated(
        'https://example.com/duplicate',
      );

      expect(result).toBe(true);
    });

    it('should return false when query returns null (no match)', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce(null);

      const result = RepositoryQueries.isRepoUrlDuplicated(
        'https://example.com/test',
      );

      expect(result).toBe(false);
    });

    it('should handle URLs with special characters', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicated: 0,
      });

      const specialUrl = 'https://example.com/repo?param=value&other=123#hash';
      RepositoryQueries.isRepoUrlDuplicated(specialUrl);

      expect(db.getFirstSync).toHaveBeenCalledWith(
        'SELECT COUNT(*) as isDuplicated FROM Repository WHERE url = ?',
        specialUrl,
      );
    });

    it('should handle empty URL string', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicated: 0,
      });

      const result = RepositoryQueries.isRepoUrlDuplicated('');

      expect(result).toBe(false);
    });
  });

  describe('createRepository', () => {
    it('should insert new repository with URL', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 5,
        changes: 1,
      });

      const result = RepositoryQueries.createRepository(
        'https://example.com/new-repo',
      );

      expect(db.runSync).toHaveBeenCalledWith(
        'INSERT INTO Repository (url) VALUES (?)',
        'https://example.com/new-repo',
      );
      expect(result).toEqual({ lastInsertRowId: 5, changes: 1 });
    });

    it('should insert repository with numeric ID returned', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 42,
        changes: 1,
      });

      RepositoryQueries.createRepository('https://github.com/user/repo');

      expect(db.runSync).toHaveBeenCalled();
    });

    it('should handle duplicate URL error (database constraint)', () => {
      (db.runSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('UNIQUE constraint failed: Repository.url');
      });

      expect(() =>
        RepositoryQueries.createRepository('https://example.com/duplicate'),
      ).toThrow('UNIQUE constraint failed: Repository.url');
    });

    it('should handle repository URLs with trailing slashes', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 1,
        changes: 1,
      });

      const urlWithSlash = 'https://example.com/repo/';
      RepositoryQueries.createRepository(urlWithSlash);

      expect(db.runSync).toHaveBeenCalledWith(
        'INSERT INTO Repository (url) VALUES (?)',
        urlWithSlash,
      );
    });
  });

  describe('deleteRepositoryById', () => {
    it('should delete repository by ID', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        changes: 1,
        lastInsertRowId: 0,
      });

      const result = RepositoryQueries.deleteRepositoryById(5);

      expect(db.runSync).toHaveBeenCalledWith(
        'DELETE FROM Repository WHERE id = ?',
        5,
      );
      expect(result).toEqual({ changes: 1, lastInsertRowId: 0 });
    });

    it('should return changes: 0 when repository not found', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        changes: 0,
        lastInsertRowId: 0,
      });

      const result = RepositoryQueries.deleteRepositoryById(999);

      expect(db.runSync).toHaveBeenCalledWith(
        'DELETE FROM Repository WHERE id = ?',
        999,
      );
      expect(result.changes).toBe(0);
    });

    it('should handle foreign key constraint errors', () => {
      (db.runSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('FOREIGN KEY constraint failed');
      });

      expect(() => RepositoryQueries.deleteRepositoryById(1)).toThrow(
        'FOREIGN KEY constraint failed',
      );
    });

    it('should delete multiple repositories by ID in sequence', () => {
      (db.runSync as jest.Mock).mockReturnValue({
        changes: 1,
        lastInsertRowId: 0,
      });

      RepositoryQueries.deleteRepositoryById(1);
      RepositoryQueries.deleteRepositoryById(2);
      RepositoryQueries.deleteRepositoryById(3);

      expect(db.runSync).toHaveBeenCalledTimes(3);
    });
  });

  describe('updateRepository', () => {
    it('should update repository URL by ID', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        changes: 1,
        lastInsertRowId: 0,
      });

      const result = RepositoryQueries.updateRepository(
        5,
        'https://example.com/updated-url',
      );

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE Repository SET url = ? WHERE id = ?',
        'https://example.com/updated-url',
        5,
      );
      expect(result).toEqual({ changes: 1, lastInsertRowId: 0 });
    });

    it('should return changes: 0 when repository not found', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        changes: 0,
        lastInsertRowId: 0,
      });

      const result = RepositoryQueries.updateRepository(
        999,
        'https://example.com/new',
      );

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE Repository SET url = ? WHERE id = ?',
        'https://example.com/new',
        999,
      );
      expect(result.changes).toBe(0);
    });

    it('should handle updating to existing URL (duplicate)', () => {
      (db.runSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('UNIQUE constraint failed: Repository.url');
      });

      expect(() =>
        RepositoryQueries.updateRepository(1, 'https://example.com/duplicate'),
      ).toThrow('UNIQUE constraint failed: Repository.url');
    });

    it('should update repository URL from HTTP to HTTPS', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        changes: 1,
        lastInsertRowId: 0,
      });

      const httpsUrl = 'https://example.com/repo';
      RepositoryQueries.updateRepository(1, httpsUrl);

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE Repository SET url = ? WHERE id = ?',
        httpsUrl,
        1,
      );
    });

    it('should handle URL with query parameters and fragments', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({
        changes: 1,
        lastInsertRowId: 0,
      });

      const complexUrl = 'https://example.com/repo?branch=main&depth=1#readme';
      RepositoryQueries.updateRepository(10, complexUrl);

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE Repository SET url = ? WHERE id = ?',
        complexUrl,
        10,
      );
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle full CRUD workflow', () => {
      // Create
      (db.runSync as jest.Mock).mockReturnValue({
        lastInsertRowId: 1,
        changes: 1,
      });
      const createResult = RepositoryQueries.createRepository(
        'https://example.com/test',
      );
      expect(createResult.lastInsertRowId).toBe(1);

      // Read
      const mockRepos: Repository[] = [
        { id: 1, url: 'https://example.com/test' },
      ];
      (db.getAllSync as jest.Mock).mockReturnValueOnce(mockRepos);
      const repos = RepositoryQueries.getRepositoriesFromDb();
      expect(repos).toHaveLength(1);

      // Check duplicate
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicated: 1,
      });
      const isDuplicate = RepositoryQueries.isRepoUrlDuplicated(
        'https://example.com/test',
      );
      expect(isDuplicate).toBe(true);

      // Update
      (db.runSync as jest.Mock).mockReturnValue({
        changes: 1,
        lastInsertRowId: 0,
      });
      const updateResult = RepositoryQueries.updateRepository(
        1,
        'https://example.com/updated',
      );
      expect(updateResult.changes).toBe(1);

      // Delete
      const deleteResult = RepositoryQueries.deleteRepositoryById(1);
      expect(deleteResult.changes).toBe(1);
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);

      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicated: 0,
      });

      expect(() =>
        RepositoryQueries.isRepoUrlDuplicated(longUrl),
      ).not.toThrow();
    });

    it('should handle international domain names (IDN)', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        isDuplicated: 0,
      });

      const idnUrl = 'https://例え.jp/repository';
      expect(() => RepositoryQueries.isRepoUrlDuplicated(idnUrl)).not.toThrow();
    });
  });
});
