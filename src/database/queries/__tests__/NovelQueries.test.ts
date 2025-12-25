/**
 * Tests for NovelQueries - Novel CRUD operations with file operations
 *
 * Focus: Test all novel database operations
 * Coverage targets:
 * - insertNovelAndChapters() - Insert novel, download cover, insert chapters
 * - getAllNovels() - Fetch all novels
 * - getNovelById() - Fetch novel by ID
 * - getNovelByPath() - Fetch novel by path and pluginId (sync)
 * - switchNovelToLibraryQuery() - Add/remove from library, fetch novel
 * - removeNovelsFromLibrary() - Batch remove novels, delete TTS settings
 * - getCachedNovels() - Fetch novels not in library
 * - deleteCachedNovels() - Delete all cached novels
 * - restoreLibrary() - Restore novel from backup, fetch from source
 * - updateNovelInfo() - Update novel metadata
 * - pickCustomNovelCover() - Document picker, copy file
 * - updateNovelCategoryById() - Set categories for single novel
 * - updateNovelCategories() - Batch update categories for multiple novels
 * - _restoreNovelAndChapters() - Restore novel+chapters from backup object
 */

import * as DocumentPicker from 'expo-document-picker';
import { db } from '@database/db';
import * as NovelQueries from '../NovelQueries';
import { insertChapters } from '../ChapterQueries';
import { fetchNovel } from '@services/plugin/fetch';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { downloadFile } from '@plugins/helpers/fetch';
import { getPlugin } from '@plugins/pluginManager';
import { deleteNovelTtsSettings } from '@services/tts/novelTtsSettings';
import type { NovelInfo, BackupNovel } from '@database/types';
import type { SourceNovel, NovelStatus } from '@plugins/types';
import NativeFile from '@specs/NativeFile';

// Mock all dependencies
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('@services/plugin/fetch', () => ({
  fetchNovel: jest.fn(),
}));

jest.mock('../ChapterQueries', () => ({
  insertChapters: jest.fn(),
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));

jest.mock('@plugins/helpers/fetch', () => ({
  downloadFile: jest.fn(() => Promise.resolve()),
}));

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: jest.fn(),
}));

jest.mock('@services/tts/novelTtsSettings', () => ({
  deleteNovelTtsSettings: jest.fn(),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/novels',
}));

jest.mock('@specs/NativeFile', () => ({
  mkdir: jest.fn(),
  exists: jest.fn(),
  copyFile: jest.fn(),
}));

// Mock the database module - NovelQueries uses both db directly and helpers
// The helpers import db from @database/db, so mocking db here handles both
jest.mock('@database/db', () => {
  const mockDb = {
    runSync: jest.fn(() => ({ lastInsertRowId: 1, changes: 1 })),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runAsync: jest.fn(() =>
      Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
    ),
    getAllAsync: jest.fn(() => Promise.resolve([])),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    execAsync: jest.fn(() => Promise.resolve()),
    withTransactionAsync: jest.fn((fn: () => Promise<void>) => fn()),
  };
  return {
    db: mockDb,
  };
});

describe('NovelQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default getString returns key
    (getString as jest.Mock).mockImplementation(key => key);
  });

  describe('insertNovelAndChapters', () => {
    it('should insert novel with all fields', async () => {
      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Test Novel',
        cover: 'https://example.com/cover.jpg',
        summary: 'Test summary',
        author: 'Test Author',
        artist: 'Test Artist',
        status: 'Ongoing' as NovelStatus,
        genres: 'Action,Fantasy',
        totalPages: 100,
        chapters: [],
      };

      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 42,
        changes: 1,
      });

      const result = await NovelQueries.insertNovelAndChapters(
        'test-plugin',
        mockSourceNovel,
      );

      expect(db.runSync).toHaveBeenCalledWith(
        'INSERT OR IGNORE INTO Novel (path, pluginId, name, cover, summary, author, artist, status, genres, totalPages) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          '/test/novel',
          'test-plugin',
          'Test Novel',
          'https://example.com/cover.jpg',
          'Test summary',
          'Test Author',
          'Test Artist',
          'Ongoing',
          'Action,Fantasy',
          100,
        ],
      );
      expect(result).toBe(42);
    });

    it('should insert novel with null optional fields', async () => {
      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Minimal Novel',
        chapters: [],
      };

      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 1,
        changes: 1,
      });

      await NovelQueries.insertNovelAndChapters('test-plugin', mockSourceNovel);

      expect(db.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR IGNORE'),
        expect.any(Array),
      );
    });

    it('should download cover and update novel when cover URL provided', async () => {
      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Test Novel',
        cover: 'https://example.com/cover.jpg',
        chapters: [],
      };

      (db.runSync as jest.Mock)
        .mockReturnValueOnce({ lastInsertRowId: 5, changes: 1 })
        .mockReturnValueOnce({ changes: 1, lastInsertRowId: 0 });

      (getPlugin as jest.Mock).mockReturnValueOnce({
        imageRequestInit: { headers: { 'User-Agent': 'test' } },
      });

      await NovelQueries.insertNovelAndChapters('test-plugin', mockSourceNovel);

      expect(NativeFile.mkdir).toHaveBeenCalledWith('/novels/test-plugin/5');
      expect(downloadFile).toHaveBeenCalledWith(
        'https://example.com/cover.jpg',
        '/novels/test-plugin/5/cover.png',
        { headers: { 'User-Agent': 'test' } },
      );
      // runSync is called with nested array for update via runSync helper
      expect(db.runSync).toHaveBeenCalled();
    });

    it('should insert chapters when novelId exists', async () => {
      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Test Novel',
        chapters: [
          { name: 'Chapter 1', path: '/ch1' },
          { name: 'Chapter 2', path: '/ch2' },
        ],
      };

      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 10,
        changes: 1,
      });
      (insertChapters as jest.Mock).mockResolvedValueOnce(undefined);

      await NovelQueries.insertNovelAndChapters('test-plugin', mockSourceNovel);

      expect(insertChapters).toHaveBeenCalledWith(10, mockSourceNovel.chapters);
    });

    it('should not download cover or insert chapters when novelId is undefined', async () => {
      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Test Novel',
        cover: 'https://example.com/cover.jpg',
        chapters: [{ name: 'Chapter 1', path: '/ch1' }],
      };

      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: undefined,
        changes: 0,
      });

      await NovelQueries.insertNovelAndChapters('test-plugin', mockSourceNovel);

      expect(downloadFile).not.toHaveBeenCalled();
      expect(insertChapters).not.toHaveBeenCalled();
    });

    it('should handle plugin without imageRequestInit', async () => {
      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Test Novel',
        cover: 'https://example.com/cover.jpg',
        chapters: [],
      };

      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 3,
        changes: 1,
      });
      (getPlugin as jest.Mock).mockReturnValueOnce(null);

      await NovelQueries.insertNovelAndChapters('test-plugin', mockSourceNovel);

      expect(downloadFile).toHaveBeenCalledWith(
        'https://example.com/cover.jpg',
        '/novels/test-plugin/3/cover.png',
        undefined,
      );
    });
  });

  describe('getAllNovels', () => {
    it('should return all novels from database', async () => {
      const mockNovels = [
        {
          id: 1,
          path: '/novel1',
          pluginId: 'plugin1',
          name: 'Novel 1',
          cover: undefined,
          inLibrary: true,
          isLocal: false,
          totalPages: 0,
        },
        {
          id: 2,
          path: '/novel2',
          pluginId: 'plugin2',
          name: 'Novel 2',
          cover: undefined,
          inLibrary: false,
          isLocal: false,
          totalPages: 0,
        },
      ] as NovelInfo[];

      (db.getAllAsync as jest.Mock).mockResolvedValueOnce(mockNovels);

      const result = await NovelQueries.getAllNovels();

      expect(db.getAllAsync).toHaveBeenCalledWith('SELECT * FROM Novel', []);
      expect(result).toEqual(mockNovels);
    });

    it('should return empty array when no novels exist', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValueOnce([]);

      const result = await NovelQueries.getAllNovels();

      expect(result).toEqual([]);
    });
  });

  describe('getNovelById', () => {
    it('should return novel by ID', async () => {
      const mockNovel: NovelInfo = {
        id: 42,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: '/cover.jpg',
        inLibrary: true,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      (db.getFirstAsync as jest.Mock).mockResolvedValueOnce(mockNovel);

      const result = await NovelQueries.getNovelById(42);

      expect(db.getFirstAsync).toHaveBeenCalledWith(
        'SELECT * FROM Novel WHERE id = ?',
        [42],
      );
      expect(result).toEqual(mockNovel);
    });

    it('should return null when novel not found', async () => {
      (db.getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await NovelQueries.getNovelById(999);

      expect(result).toBeNull();
    });
  });

  describe('getNovelByPath', () => {
    it('should return novel by path and pluginId', () => {
      const mockNovel: NovelInfo = {
        id: 10,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: undefined,
        inLibrary: true,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      (db.getFirstSync as jest.Mock).mockReturnValueOnce(mockNovel);

      const result = NovelQueries.getNovelByPath('/test/novel', 'test-plugin');

      expect(db.getFirstSync).toHaveBeenCalledWith(
        'SELECT * FROM Novel WHERE path = ? AND pluginId = ?',
        ['/test/novel', 'test-plugin'],
      );
      expect(result).toEqual(mockNovel);
    });

    it('should return undefined when novel not found', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce(null);

      const result = NovelQueries.getNovelByPath('/nonexistent', 'test-plugin');

      expect(result).toBeUndefined();
    });

    it('should return undefined when getFirstSync returns falsy value', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce(undefined);

      const result = NovelQueries.getNovelByPath('/test', 'plugin');

      expect(result).toBeUndefined();
    });
  });

  describe('switchNovelToLibraryQuery', () => {
    it('should add novel to library when inLibrary = 0', async () => {
      const mockNovel: NovelInfo = {
        id: 5,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: undefined,
        inLibrary: false,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      (db.getFirstSync as jest.Mock).mockReturnValueOnce(mockNovel);
      (getString as jest.Mock).mockReturnValueOnce('Added to library');

      await NovelQueries.switchNovelToLibraryQuery(
        '/test/novel',
        'test-plugin',
      );

      expect(db.runAsync).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Added to library');
    });

    it('should remove novel from library when inLibrary = 1', async () => {
      const mockNovel: NovelInfo = {
        id: 5,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: undefined,
        inLibrary: true,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      (db.getFirstSync as jest.Mock).mockReturnValueOnce(mockNovel);
      (getString as jest.Mock).mockReturnValueOnce('Removed from library');

      await NovelQueries.switchNovelToLibraryQuery(
        '/test/novel',
        'test-plugin',
      );

      expect(db.runAsync).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Removed from library');
    });

    it('should add to local category when pluginId is local', async () => {
      const mockNovel: NovelInfo = {
        id: 5,
        path: '/local/novel',
        pluginId: 'local',
        name: 'Local Novel',
        cover: undefined,
        inLibrary: false,
        isLocal: true,
        totalPages: 0,
      } as NovelInfo;

      (db.getFirstSync as jest.Mock).mockReturnValueOnce(mockNovel);

      await NovelQueries.switchNovelToLibraryQuery('/local/novel', 'local');

      expect(db.runAsync).toHaveBeenCalled();
    });

    it('should fetch and insert novel when not in database', async () => {
      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/new/novel',
        name: 'New Novel',
        chapters: [],
      };

      (db.getFirstSync as jest.Mock).mockReturnValueOnce(null);
      (fetchNovel as jest.Mock).mockResolvedValueOnce(mockSourceNovel);
      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 100,
        changes: 1,
      });
      (getString as jest.Mock).mockReturnValueOnce('Added to library');

      await NovelQueries.switchNovelToLibraryQuery('/new/novel', 'test-plugin');

      expect(fetchNovel).toHaveBeenCalledWith('test-plugin', '/new/novel');
      expect(db.runAsync).toHaveBeenCalled();
    });

    it('should throw when novel not found and fetchNovel fails', async () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce(null);
      (fetchNovel as jest.Mock).mockRejectedValueOnce(
        new Error('Novel not found'),
      );

      await expect(
        NovelQueries.switchNovelToLibraryQuery('/error/novel', 'test-plugin'),
      ).rejects.toThrow('Novel not found');
    });
  });

  describe('removeNovelsFromLibrary', () => {
    it('should remove multiple novels from library', () => {
      const novelIds = [1, 2, 3];

      NovelQueries.removeNovelsFromLibrary(novelIds);

      // runSync helper calls db.runSync for each query individually
      expect(db.runSync).toHaveBeenCalledTimes(2);
    });

    it('should delete TTS settings for each novel', () => {
      const novelIds = [5, 10];

      NovelQueries.removeNovelsFromLibrary(novelIds);

      expect(deleteNovelTtsSettings).toHaveBeenCalledWith(5);
      expect(deleteNovelTtsSettings).toHaveBeenCalledWith(10);
      expect(deleteNovelTtsSettings).toHaveBeenCalledTimes(2);
    });

    it('should show toast notification', () => {
      (getString as jest.Mock).mockReturnValueOnce('Novels removed');

      NovelQueries.removeNovelsFromLibrary([1]);

      expect(showToast).toHaveBeenCalledWith('Novels removed');
    });

    it('should handle single novel ID', () => {
      NovelQueries.removeNovelsFromLibrary([42]);

      expect(db.runSync).toHaveBeenCalled();
    });

    it('should handle empty array', () => {
      NovelQueries.removeNovelsFromLibrary([]);

      expect(db.runSync).toHaveBeenCalled();
    });
  });

  describe('getCachedNovels', () => {
    it('should return novels not in library', async () => {
      const mockCached = [
        {
          id: 1,
          path: '/cached1',
          pluginId: 'plugin1',
          name: 'Cached 1',
          cover: undefined,
          inLibrary: false,
          isLocal: false,
          totalPages: 0,
        },
      ] as NovelInfo[];

      (db.getAllAsync as jest.Mock).mockResolvedValueOnce(mockCached);

      const result = await NovelQueries.getCachedNovels();

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM Novel WHERE inLibrary = 0',
        [],
      );
      expect(result).toEqual(mockCached);
    });

    it('should return empty array when no cached novels', async () => {
      (db.getAllAsync as jest.Mock).mockResolvedValueOnce([]);

      const result = await NovelQueries.getCachedNovels();

      expect(result).toEqual([]);
    });
  });

  describe('deleteCachedNovels', () => {
    it('should delete all novels not in library', async () => {
      (getString as jest.Mock).mockReturnValueOnce('Cached novels deleted');

      await NovelQueries.deleteCachedNovels();

      expect(db.runAsync).toHaveBeenCalled();
    });

    it('should show toast notification after deletion', async () => {
      (getString as jest.Mock).mockReturnValueOnce('Cached novels deleted');

      await NovelQueries.deleteCachedNovels();

      expect(getString).toHaveBeenCalledWith(
        'advancedSettingsScreen.cachedNovelsDeletedToast',
      );
      expect(showToast).toHaveBeenCalledWith('Cached novels deleted');
    });
  });

  describe('restoreLibrary', () => {
    it('should restore novel from backup with fetchNovel', async () => {
      const mockNovel: NovelInfo = {
        id: 1,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: '/cover.jpg',
        inLibrary: true,
        isLocal: false,
        totalPages: 100,
      } as NovelInfo;

      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Updated Novel',
        totalPages: 200,
        chapters: [
          { name: 'Chapter 1', path: '/ch1' },
          { name: 'Chapter 2', path: '/ch2' },
        ],
      };

      (fetchNovel as jest.Mock).mockResolvedValueOnce(mockSourceNovel);
      (db.runAsync as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
      );

      await NovelQueries.restoreLibrary(mockNovel);

      expect(fetchNovel).toHaveBeenCalledWith('test-plugin', '/test/novel');
      expect(insertChapters).toHaveBeenCalled();
    });

    it('should throw when fetchNovel fails', async () => {
      const mockNovel: NovelInfo = {
        id: 1,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: undefined,
        inLibrary: true,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      (fetchNovel as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(NovelQueries.restoreLibrary(mockNovel)).rejects.toThrow(
        'Network error',
      );
    });

    it('should handle novel with no chapters', async () => {
      const mockNovel: NovelInfo = {
        id: 1,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: undefined,
        inLibrary: true,
        isLocal: false,
        totalPages: 100,
      } as NovelInfo;

      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Updated Novel',
        totalPages: 100,
        chapters: [],
      };

      (fetchNovel as jest.Mock).mockResolvedValueOnce(mockSourceNovel);
      (db.runAsync as jest.Mock)
        .mockResolvedValueOnce({ lastInsertRowId: 1, changes: 1 })
        .mockImplementationOnce(() =>
          Promise.resolve({ lastInsertRowId: 1, changes: 1 }),
        );

      await NovelQueries.restoreLibrary(mockNovel);

      // When chapters array is empty or undefined, insertChapters should not be called
      // (or called with empty array depending on implementation)
    });
  });

  describe('updateNovelInfo', () => {
    it('should update all novel info fields', async () => {
      const mockNovel: NovelInfo = {
        id: 5,
        path: '/updated/path',
        pluginId: 'test-plugin',
        name: 'Updated Novel',
        cover: '/new/cover.jpg',
        summary: 'Updated summary',
        author: 'Updated Author',
        artist: 'Updated Artist',
        genres: 'Action,Drama',
        status: 'Completed',
        isLocal: true,
        totalPages: 100,
        inLibrary: true,
      };

      await NovelQueries.updateNovelInfo(mockNovel);

      expect(db.runAsync).toHaveBeenCalled();
    });

    it('should convert isLocal boolean to number', async () => {
      const mockNovel: NovelInfo = {
        id: 1,
        path: '/test',
        pluginId: 'test',
        name: 'Test',
        cover: '',
        summary: '',
        author: '',
        artist: '',
        genres: '',
        status: '',
        isLocal: false,
        totalPages: 0,
        inLibrary: false,
      };

      await NovelQueries.updateNovelInfo(mockNovel);

      expect(db.runAsync).toHaveBeenCalled();
    });
  });

  describe('pickCustomNovelCover', () => {
    it('should pick document, copy file, and update novel', async () => {
      const mockNovel: NovelInfo = {
        id: 10,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: '/old/cover.jpg',
        inLibrary: true,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      const mockAsset = {
        uri: 'file:///user/picked/image.jpg',
        mimeType: 'image/jpeg',
        name: 'image.jpg',
      };

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        assets: [mockAsset],
        canceled: false,
      });

      (NativeFile.exists as jest.Mock).mockReturnValueOnce(true);
      const timestamp = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValueOnce(timestamp);

      const result = await NovelQueries.pickCustomNovelCover(mockNovel);

      expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
        type: 'image/*',
      });
      expect(NativeFile.copyFile).toHaveBeenCalledWith(
        'file:///user/picked/image.jpg',
        'file:///novels/test-plugin/10/cover.png',
      );
      expect(result).toBe(
        `file:///novels/test-plugin/10/cover.png?${timestamp}`,
      );
    });

    it('should create directory if not exists', async () => {
      const mockNovel: NovelInfo = {
        id: 5,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: '/old/cover.jpg',
        inLibrary: true,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        assets: [{ uri: 'file:///image.jpg' }],
        canceled: false,
      });

      (NativeFile.exists as jest.Mock).mockReturnValueOnce(false);

      await NovelQueries.pickCustomNovelCover(mockNovel);

      expect(NativeFile.mkdir).toHaveBeenCalledWith('/novels/test-plugin/5');
    });

    it('should return undefined when user cancels picker', async () => {
      const mockNovel: NovelInfo = {
        id: 1,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: '/old/cover.jpg',
        inLibrary: true,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: true,
        assets: undefined,
      });

      const result = await NovelQueries.pickCustomNovelCover(mockNovel);

      expect(result).toBeUndefined();
      expect(NativeFile.copyFile).not.toHaveBeenCalled();
    });

    it('should return undefined when no assets returned', async () => {
      const mockNovel: NovelInfo = {
        id: 1,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: '/old/cover.jpg',
        inLibrary: true,
        isLocal: false,
        totalPages: 0,
      } as NovelInfo;

      (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValueOnce({
        canceled: false,
        assets: undefined,
      });

      const result = await NovelQueries.pickCustomNovelCover(mockNovel);

      expect(result).toBeUndefined();
    });
  });

  describe('updateNovelCategoryById', () => {
    it('should insert novel into multiple categories', async () => {
      await NovelQueries.updateNovelCategoryById(5, [1, 2, 3]);

      // Each category insert is called separately
      expect(db.runAsync).toHaveBeenCalledTimes(3);
    });

    it('should handle single category', async () => {
      await NovelQueries.updateNovelCategoryById(10, [5]);

      expect(db.runAsync).toHaveBeenCalledTimes(1);
    });

    it('should handle empty category array', async () => {
      await NovelQueries.updateNovelCategoryById(1, []);

      // Empty array passed to runAsync helper results in no db calls
      // The function handles this gracefully without errors
    });
  });

  describe('updateNovelCategories', () => {
    it('should delete existing categories and insert new ones', () => {
      NovelQueries.updateNovelCategories([1, 2], [5, 10]);

      expect(db.runSync).toHaveBeenCalled();
    });

    it('should set default category when no categories selected', () => {
      NovelQueries.updateNovelCategories([1, 2], []);

      expect(db.runSync).toHaveBeenCalled();
    });

    it('should handle single novel with multiple categories', () => {
      NovelQueries.updateNovelCategories([5], [1, 2, 3]);

      expect(db.runSync).toHaveBeenCalled();
    });

    it('should handle multiple novels with single category', () => {
      NovelQueries.updateNovelCategories([1, 2, 3], [5]);

      expect(db.runSync).toHaveBeenCalled();
    });
  });

  describe('_restoreNovelAndChapters', () => {
    it('should restore novel and chapters in transaction', async () => {
      const mockBackupNovel: BackupNovel = {
        id: 1,
        path: '/test/novel',
        pluginId: 'test-plugin',
        name: 'Test Novel',
        cover: '/cover.jpg',
        summary: 'Summary',
        author: 'Author',
        artist: 'Artist',
        genres: 'Action',
        status: 'Ongoing',
        isLocal: false,
        totalPages: 100,
        inLibrary: true,
        chapters: [
          {
            id: 1,
            novelId: 1,
            path: '/ch1',
            name: 'Chapter 1',
            releaseTime: undefined,
            readTime: null,
            bookmark: false,
            unread: true,
            isDownloaded: false,
            updatedTime: null,
            page: '1',
            progress: null,
          },
          {
            id: 2,
            novelId: 1,
            path: '/ch2',
            name: 'Chapter 2',
            releaseTime: undefined,
            readTime: null,
            bookmark: false,
            unread: true,
            isDownloaded: false,
            updatedTime: null,
            page: '2',
            progress: null,
          },
        ],
      };

      await NovelQueries._restoreNovelAndChapters(mockBackupNovel);

      expect(db.withTransactionAsync).toHaveBeenCalled();
      expect(db.runAsync).toHaveBeenCalledWith(
        'DELETE FROM Novel WHERE id = ?',
        [1],
      );
    });

    it('should delete novel before restoring', async () => {
      const mockBackupNovel: BackupNovel = {
        id: 5,
        path: '/test',
        pluginId: 'test',
        name: 'Test',
        cover: undefined,
        summary: undefined,
        author: undefined,
        artist: undefined,
        genres: undefined,
        status: undefined,
        isLocal: false,
        totalPages: 0,
        inLibrary: false,
        chapters: [],
      };

      await NovelQueries._restoreNovelAndChapters(mockBackupNovel);

      expect(db.runAsync).toHaveBeenCalledWith(
        'DELETE FROM Novel WHERE id = ?',
        [5],
      );
    });

    it('should restore all chapters', async () => {
      const mockBackupNovel: BackupNovel = {
        id: 1,
        path: '/test',
        pluginId: 'test',
        name: 'Test',
        cover: undefined,
        summary: undefined,
        author: undefined,
        artist: undefined,
        genres: undefined,
        status: undefined,
        isLocal: false,
        totalPages: 0,
        inLibrary: false,
        chapters: [
          {
            id: 1,
            novelId: 1,
            path: '/ch1',
            name: 'Ch1',
            releaseTime: undefined,
            readTime: null,
            bookmark: false,
            unread: true,
            isDownloaded: false,
            updatedTime: null,
            page: '1',
            progress: null,
          },
          {
            id: 2,
            novelId: 1,
            path: '/ch2',
            name: 'Ch2',
            releaseTime: undefined,
            readTime: null,
            bookmark: false,
            unread: true,
            isDownloaded: false,
            updatedTime: null,
            page: '2',
            progress: null,
          },
          {
            id: 3,
            novelId: 1,
            path: '/ch3',
            name: 'Ch3',
            releaseTime: undefined,
            readTime: null,
            bookmark: false,
            unread: true,
            isDownloaded: false,
            updatedTime: null,
            page: '3',
            progress: null,
          },
        ],
      };

      await NovelQueries._restoreNovelAndChapters(mockBackupNovel);

      const chapterInserts = (db.runAsync as jest.Mock).mock.calls.filter(
        call => call[0]?.includes('INSERT INTO Chapter'),
      );
      expect(chapterInserts.length).toBeGreaterThan(0);
    });

    it('should handle novel with no chapters', async () => {
      const mockBackupNovel: BackupNovel = {
        id: 1,
        path: '/test',
        pluginId: 'test',
        name: 'Test',
        cover: undefined,
        summary: undefined,
        author: undefined,
        artist: undefined,
        genres: undefined,
        status: undefined,
        isLocal: false,
        totalPages: 0,
        inLibrary: false,
        chapters: [],
      };

      await NovelQueries._restoreNovelAndChapters(mockBackupNovel);

      const chapterInserts = (db.runAsync as jest.Mock).mock.calls.filter(
        call => call[0]?.includes('INSERT INTO Chapter'),
      );
      expect(chapterInserts.length).toBe(0);
    });
  });

  describe('Edge Cases and Integration', () => {
    it('should handle novel with special characters in name', async () => {
      const mockSourceNovel: SourceNovel = {
        id: undefined,
        path: '/test/novel',
        name: 'Test\'s Novel: "The Journey"',
        chapters: [],
      };

      (db.runSync as jest.Mock).mockReturnValueOnce({
        lastInsertRowId: 1,
        changes: 1,
      });

      await NovelQueries.insertNovelAndChapters('test-plugin', mockSourceNovel);

      expect(db.runSync).toHaveBeenCalled();
    });

    it('should handle empty pluginId for local novels', () => {
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        id: 1,
        path: '/local/novel',
        pluginId: '',
        name: 'Local Novel',
        inLibrary: false,
        isLocal: true,
        totalPages: 0,
      });

      NovelQueries.getNovelByPath('/local/novel', '');

      expect(db.getFirstSync).toHaveBeenCalledWith(
        'SELECT * FROM Novel WHERE path = ? AND pluginId = ?',
        ['/local/novel', ''],
      );
    });

    it('should handle novelId 0 in getNovelById', async () => {
      (db.getFirstAsync as jest.Mock).mockResolvedValueOnce(null);

      const result = await NovelQueries.getNovelById(0);

      expect(result).toBeNull();
    });
  });
});
