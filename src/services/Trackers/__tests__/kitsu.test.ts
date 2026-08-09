/**
 * Kitsu tracker unit tests
 *
 * Tests the Kitsu tracker's search, library entry and score conversion
 * logic by mocking the global fetch API.
 */

import { authenticateWithCredentials, kitsuTracker } from '../kitsu';

const BASE_URL = 'https://kitsu.app/api/edge/';
const LOGIN_URL = 'https://kitsu.app/api/oauth/token';
const ALGOLIA_KEY_URL = 'https://kitsu.app/api/edge/algolia-keys/media/';

const originalFetch = global.fetch;
let mockFetch: jest.Mock;

const jsonResponse = (status: number, body: any) => ({
  status,
  json: jest.fn().mockResolvedValue(body),
});

const auth = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: new Date(),
  meta: {
    userId: 'user-1',
    refreshToken: 'test-refresh-token',
    createdAt: 1,
  },
};

const getFetchCall = (predicate: (url: string, options: any) => boolean) =>
  mockFetch.mock.calls.find(
    ([url, options]: any[]) =>
      typeof url === 'string' && predicate(url, options || {}),
  );

describe('kitsuTracker', () => {
  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('handleSearch', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url: string) => {
        if (url === ALGOLIA_KEY_URL) {
          return Promise.resolve(
            jsonResponse(200, { media: { key: 'algolia-test-key' } }),
          );
        }
        return Promise.resolve(jsonResponse(200, { hits: [] }));
      });
    });

    it('should return only items with subtype "novel" mapped to SearchResult', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === ALGOLIA_KEY_URL) {
          return Promise.resolve(
            jsonResponse(200, { media: { key: 'algolia-test-key' } }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, {
            hits: [
              {
                id: 1,
                canonicalTitle: 'Novel One',
                chapterCount: 12,
                subtype: 'novel',
                posterImage: { original: 'https://example.com/one.png' },
                synopsis: 'A novel',
              },
              {
                id: 2,
                canonicalTitle: 'Manga Only',
                chapterCount: 3,
                subtype: 'manga',
                posterImage: { original: 'https://example.com/two.png' },
                synopsis: 'Not a novel',
              },
              {
                id: 3,
                canonicalTitle: 'Novel Two',
                chapterCount: null,
                subtype: 'novel',
                posterImage: null,
                synopsis: null,
              },
            ],
          }),
        );
      });

      const result = await kitsuTracker.handleSearch('test', auth);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        title: 'Novel One',
        coverImage: 'https://example.com/one.png',
        totalChapters: 12,
      });
      expect(result[1]).toEqual({
        id: 3,
        title: 'Novel Two',
        coverImage: '',
        totalChapters: undefined,
      });
      expect(result[1].coverImage).toBe('');
      expect(result[1].totalChapters).toBeUndefined();
    });

    it('should return an empty array when Algolia returns a non-200 status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === ALGOLIA_KEY_URL) {
          return Promise.resolve(
            jsonResponse(200, { media: { key: 'algolia-test-key' } }),
          );
        }
        return Promise.resolve(jsonResponse(500, { error: 'boom' }));
      });

      const result = await kitsuTracker.handleSearch('test', auth);

      expect(result).toEqual([]);
    });

    it('should return an empty array when the Algolia key fetch fails', async () => {
      mockFetch.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }));

      const result = await kitsuTracker.handleSearch('test', auth);

      expect(result).toEqual([]);
    });
  });

  describe('getUserListEntry', () => {
    it('should map an existing library entry to normalized status, progress and score', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(200, {
          data: [
            {
              id: 'lib-1',
              attributes: {
                status: 'current',
                progress: 10,
                ratingTwenty: 16,
                startedAt: null,
                finishedAt: null,
              },
            },
          ],
        }),
      );

      const result = await kitsuTracker.getUserListEntry(42, auth);

      expect(result).toEqual({ status: 'CURRENT', progress: 10, score: 8 });
    });

    it('should map on_hold to PAUSED and planned to PLANNING', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(200, {
          data: [
            {
              id: 'lib-2',
              attributes: {
                status: 'on_hold',
                progress: 3,
                ratingTwenty: null,
                startedAt: null,
                finishedAt: null,
              },
            },
          ],
        }),
      );

      const result = await kitsuTracker.getUserListEntry(42, auth);

      expect(result.status).toBe('PAUSED');
      expect(result.score).toBe(0);
    });

    it('should return default values when no entry exists', async () => {
      mockFetch.mockResolvedValue(jsonResponse(200, { data: [] }));

      const result = await kitsuTracker.getUserListEntry(42, auth);

      expect(result).toEqual({ status: 'CURRENT', progress: 0, score: 0 });
    });
  });

  describe('updateUserListEntry', () => {
    it('should PATCH an existing library entry with score*2 as ratingTwenty and mapped status', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('library-entries?filter[manga_id]=')) {
          return Promise.resolve(
            jsonResponse(200, {
              data: [
                {
                  id: 'lib-1',
                  attributes: {
                    status: 'current',
                    progress: 10,
                    ratingTwenty: 10,
                    startedAt: null,
                    finishedAt: null,
                  },
                },
              ],
            }),
          );
        }
        return Promise.resolve(jsonResponse(200, { data: { id: 'lib-1' } }));
      });

      const result = await kitsuTracker.updateUserListEntry(
        42,
        { status: 'COMPLETED', progress: 20, score: 8 },
        auth,
      );

      expect(result).toEqual({ status: 'COMPLETED', progress: 20, score: 8 });

      const patchCall = getFetchCall(url => url.includes('library-entries/'));
      expect(patchCall).toBeDefined();
      const [patchUrl, patchOptions] = patchCall!;
      expect(patchUrl).toBe(`${BASE_URL}library-entries/lib-1`);
      expect(patchOptions.method).toBe('PATCH');
      const patchBody = JSON.parse(patchOptions.body);
      expect(patchBody.data.attributes).toEqual({
        status: 'completed',
        progress: 20,
        ratingTwenty: 16,
      });
    });

    it('should POST to create a new library entry when none exists', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('library-entries?filter[manga_id]=')) {
          return Promise.resolve(jsonResponse(200, { data: [] }));
        }
        if (url === `${BASE_URL}library-entries`) {
          return Promise.resolve(
            jsonResponse(201, { data: { id: 'new-lib-1' } }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, { data: { id: 'new-lib-1' } }),
        );
      });

      const result = await kitsuTracker.updateUserListEntry(
        42,
        { status: 'PLANNING', progress: 0, score: 0 },
        auth,
      );

      expect(result).toEqual({ status: 'PLANNING', progress: 0, score: 0 });

      const postCall = getFetchCall(
        (url, options) =>
          url === `${BASE_URL}library-entries` && options.method === 'POST',
      );
      expect(postCall).toBeDefined();
      const postBody = JSON.parse(postCall![1].body);
      expect(postBody.data.attributes).toEqual({
        status: 'planned',
        progress: 0,
      });
      expect(postBody.data.relationships.media.data).toEqual({
        id: '42',
        type: 'manga',
      });
    });

    it('should PATCH the newly created entry with score when score is provided', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('library-entries?filter[manga_id]=')) {
          return Promise.resolve(jsonResponse(200, { data: [] }));
        }
        if (url === `${BASE_URL}library-entries`) {
          return Promise.resolve(
            jsonResponse(201, { data: { id: 'new-lib-1' } }),
          );
        }
        return Promise.resolve(
          jsonResponse(200, { data: { id: 'new-lib-1' } }),
        );
      });

      await kitsuTracker.updateUserListEntry(
        42,
        { status: 'CURRENT', progress: 5, score: 4 },
        auth,
      );

      const patchCall = getFetchCall(
        url => url === `${BASE_URL}library-entries/new-lib-1`,
      );
      expect(patchCall).toBeDefined();
      const patchBody = JSON.parse(patchCall![1].body);
      expect(patchBody.data.attributes.ratingTwenty).toBe(8);
    });

    it('should throw when the library update fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('library-entries?filter[manga_id]=')) {
          return Promise.resolve(
            jsonResponse(200, {
              data: [
                {
                  id: 'lib-1',
                  attributes: {
                    status: 'current',
                    progress: 10,
                    ratingTwenty: 10,
                    startedAt: null,
                    finishedAt: null,
                  },
                },
              ],
            }),
          );
        }
        return Promise.resolve(jsonResponse(500, { error: 'boom' }));
      });

      await expect(
        kitsuTracker.updateUserListEntry(
          42,
          { status: 'COMPLETED', progress: 20, score: 8 },
          auth,
        ),
      ).rejects.toThrow('Failed to update Kitsu entry');
    });
  });

  describe('authenticateWithCredentials', () => {
    it('should exchange credentials for a token and fetch the current user id', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url === LOGIN_URL) {
          return Promise.resolve(
            jsonResponse(200, {
              access_token: 'access-1',
              token_type: 'Bearer',
              created_at: 1000,
              expires_in: 3600,
              refresh_token: 'refresh-1',
            }),
          );
        }
        if (url.includes('users?filter[self]=true')) {
          return Promise.resolve(
            jsonResponse(200, { data: [{ id: 'user-1' }] }),
          );
        }
        return Promise.resolve(jsonResponse(404, {}));
      });

      const result = await authenticateWithCredentials(
        'test@example.com',
        'password',
      );

      expect(result.accessToken).toBe('access-1');
      expect(result.refreshToken).toBe('refresh-1');
      expect(result.meta?.userId).toBe('user-1');
    });

    it('should throw with the error description on invalid credentials', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(400, {
          error_description: 'Invalid username or password',
        }),
      );

      await expect(authenticateWithCredentials('bad', 'bad')).rejects.toThrow(
        'Invalid username or password',
      );
    });
  });

  describe('revalidate', () => {
    it('should refresh the session using the stored refresh token', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(200, {
          access_token: 'access-2',
          token_type: 'Bearer',
          created_at: 2000,
          expires_in: 3600,
          refresh_token: 'refresh-2',
        }),
      );

      const result = await kitsuTracker.revalidate!(auth);

      expect(result.accessToken).toBe('access-2');
      expect(result.refreshToken).toBe('refresh-2');
      expect(result.meta?.userId).toBe('user-1');
      expect(result.meta?.refreshToken).toBe('refresh-2');

      const loginCall = getFetchCall((url, options) => url === LOGIN_URL);
      expect(loginCall![1].body).toContain('grant_type=refresh_token');
    });

    it('should throw when no refresh token is available', async () => {
      await expect(
        kitsuTracker.revalidate!({
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          expiresAt: new Date(),
          meta: undefined,
        }),
      ).rejects.toThrow('No refresh token available');
    });
  });
});
