import { renderHook, act, waitFor } from '@testing-library/react-native';
import { pickApkAsset } from '../githubReleaseUtils';
import { useGithubUpdateChecker } from '../useGithubUpdateChecker';
import { MMKVStorage } from '@utils/mmkv/mmkv';

const LAST_UPDATE_CHECK_KEY = 'LAST_UPDATE_CHECK';
const IGNORED_UPDATE_VERSION_KEY = 'IGNORED_UPDATE_VERSION';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// In-memory MMKV backed mock (same pattern as useTTSController.mediaNav.test).
const mockMMKVStorage: Record<string, any> = {};

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    set: jest.fn((key: string, value: any) => {
      mockMMKVStorage[key] = value;
    }),
    getNumber: jest.fn((key: string) => {
      const value = mockMMKVStorage[key];
      return typeof value === 'number' ? value : undefined;
    }),
    getString: jest.fn((key: string) => mockMMKVStorage[key] ?? undefined),
    delete: jest.fn((key: string) => {
      delete mockMMKVStorage[key];
    }),
    clearAll: jest.fn(() => {
      Object.keys(mockMMKVStorage).forEach(key => delete mockMMKVStorage[key]);
    }),
    addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

describe('pickApkAsset', () => {
  test('selects first .apk asset when present', () => {
    const assets = [
      {
        name: 'release-notes.txt',
        browser_download_url: 'https://example.com/text',
      },
      {
        name: 'LNReader-arm64.apk',
        browser_download_url: 'https://example.com/arm64.apk',
      },
    ];

    expect(pickApkAsset(assets)).toBe('https://example.com/arm64.apk');
  });

  test('prefers arm64/universal when multiple apk candidates exist', () => {
    const assets = [
      {
        name: 'LNReader-x86.apk',
        browser_download_url: 'https://example.com/x86.apk',
      },
      {
        name: 'LNReader-arm64.apk',
        browser_download_url: 'https://example.com/arm64.apk',
      },
      {
        name: 'LNReader-universal.apk',
        browser_download_url: 'https://example.com/universal.apk',
      },
    ];

    expect(pickApkAsset(assets)).toBe('https://example.com/arm64.apk');
  });

  test('falls back to first asset when no apk is present but content_type indicates android', () => {
    const assets = [
      {
        name: 'binary.pkg',
        content_type: 'application/vnd.android.package-archive',
        browser_download_url: 'https://example.com/pkg',
      },
      { name: 'other.bin', browser_download_url: 'https://example.com/other' },
    ];

    expect(pickApkAsset(assets)).toBe('https://example.com/pkg');
  });

  test('returns undefined when no assets', () => {
    expect(pickApkAsset(undefined)).toBeUndefined();
    expect(pickApkAsset([])).toBeUndefined();
  });
});

describe('useGithubUpdateChecker', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    Object.keys(mockMMKVStorage).forEach(key => delete mockMMKVStorage[key]);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    delete (global as any).fetch;
    jest.clearAllMocks();
  });

  const mockReleaseResponse = (tagName: string) => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: tagName, body: 'release', assets: [] }),
    });
  };

  it('first launch (no prior check timestamp) proceeds with the check', async () => {
    mockReleaseResponse('v2.1.5');

    const { result } = renderHook(() => useGithubUpdateChecker());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.current.latestRelease?.tag_name).toBe('v2.1.5'),
    );

    expect(result.current.isNewVersion).toBe(true);
    expect(MMKVStorage.set).toHaveBeenCalledWith(
      LAST_UPDATE_CHECK_KEY,
      expect.any(Number),
    );
  });

  it('skips the check when checked recently (within 24h)', async () => {
    mockMMKVStorage[LAST_UPDATE_CHECK_KEY] = Date.now();

    const { result } = renderHook(() => useGithubUpdateChecker());

    await waitFor(() => expect(result.current.latestRelease).toBeUndefined());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isNewVersion).toBe(false);
  });

  it('checks again when the last check is older than 24h', async () => {
    mockMMKVStorage[LAST_UPDATE_CHECK_KEY] = Date.now() - 2 * ONE_DAY_MS;
    mockReleaseResponse('v2.1.4');

    renderHook(() => useGithubUpdateChecker());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('ignoreVersion persists the ignored tag and suppresses that version', async () => {
    mockReleaseResponse('v2.1.5');

    const { result } = renderHook(() => useGithubUpdateChecker());

    await waitFor(() => expect(result.current.isNewVersion).toBe(true));

    act(() => {
      result.current.ignoreVersion('v2.1.5');
    });

    expect(MMKVStorage.set).toHaveBeenCalledWith(
      IGNORED_UPDATE_VERSION_KEY,
      'v2.1.5',
    );
    expect(result.current.isNewVersion).toBe(false);
  });

  it('a previously ignored older version does not suppress a newer release', async () => {
    mockMMKVStorage[IGNORED_UPDATE_VERSION_KEY] = 'v2.1.0';
    mockReleaseResponse('v2.1.5');

    const { result } = renderHook(() => useGithubUpdateChecker());

    await waitFor(() => expect(result.current.isNewVersion).toBe(true));
  });

  it('same version release is not flagged as new', async () => {
    mockReleaseResponse('v2.1.3');

    const { result } = renderHook(() => useGithubUpdateChecker());

    await waitFor(() =>
      expect(result.current.latestRelease?.tag_name).toBe('v2.1.3'),
    );
    expect(result.current.isNewVersion).toBe(false);
  });
});
