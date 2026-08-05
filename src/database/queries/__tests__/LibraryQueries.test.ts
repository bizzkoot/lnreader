import { db } from '@database/db';
import * as LibraryQueries from '../LibraryQueries';

jest.mock('@database/db', () => ({
  db: {
    getAllSync: jest.fn(() => []),
  },
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));

describe('LibraryQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getLibraryNovelsFromDb sortOrder rewrite', () => {
    it("rewrites 'lastUpdatedAt DESC' to julianday order in the emitted SQL", () => {
      LibraryQueries.getLibraryNovelsFromDb('lastUpdatedAt DESC');

      const sql = (db.getAllSync as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY julianday(lastUpdatedAt) DESC');
    });

    it("rewrites 'lastUpdatedAt ASC' to julianday order in the emitted SQL", () => {
      LibraryQueries.getLibraryNovelsFromDb('lastUpdatedAt ASC');

      const sql = (db.getAllSync as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY julianday(lastUpdatedAt) ASC');
    });

    it('leaves non-date sort orders untouched', () => {
      LibraryQueries.getLibraryNovelsFromDb('name ASC');

      const sql = (db.getAllSync as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('ORDER BY name ASC');
      expect(sql).not.toContain('julianday');
    });

    it('emits no ORDER BY when sortOrder is undefined', () => {
      LibraryQueries.getLibraryNovelsFromDb(undefined);

      const sql = (db.getAllSync as jest.Mock).mock.calls[0][0] as string;
      expect(sql).not.toContain('ORDER BY');
    });

    it('applies the search-text LIKE clause with a bound parameter', () => {
      LibraryQueries.getLibraryNovelsFromDb(
        'lastUpdatedAt DESC',
        undefined,
        'foo',
      );

      const params = (db.getAllSync as jest.Mock).mock.calls[0][1] as string[];
      const sql = (db.getAllSync as jest.Mock).mock.calls[0][0] as string;
      expect(sql).toContain('AND name LIKE ?');
      expect(sql).toContain('ORDER BY julianday(lastUpdatedAt) DESC');
      expect(params).toEqual(['foo']);
    });
  });
});
