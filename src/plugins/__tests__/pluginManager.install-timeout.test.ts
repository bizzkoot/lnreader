import { PluginItem } from '../types';
import { installPluginUnlocked } from '../pluginManager';

jest.mock('../helpers/fetch', () => ({
  downloadFile: jest.fn(),
  fetchApi: jest.fn(),
  fetchProto: jest.fn(),
  fetchText: jest.fn(),
}));

jest.mock('@database/queries/RepositoryQueries', () => ({
  getEnabledRepositoriesFromDb: jest.fn(() => []),
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@utils/Storages', () => ({
  PLUGIN_STORAGE: 'file://plugins',
}));

jest.mock('@hooks/persisted/useUserAgent', () => ({
  getUserAgent: jest.fn(() => 'test-agent'),
}));

const makePlugin = (overrides: Partial<PluginItem> = {}): PluginItem => ({
  id: 'test.source',
  name: 'Test Source',
  site: 'https://example.com',
  lang: 'English',
  version: '1.0.0',
  url: 'https://example.com/plugin.js',
  iconUrl: 'https://example.com/icon.png',
  ...overrides,
});

describe('installPluginUnlocked fetch timeout', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('aborts a hung plugin-script fetch instead of pinning the queue forever', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const installPromise = installPluginUnlocked(makePlugin());
    const assertion = expect(installPromise).rejects.toThrow('Aborted');
    jest.advanceTimersByTime(30000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.signal).toBeDefined();
  });

  it('clears the timeout and proceeds when the fetch resolves quickly', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('not a valid plugin'),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const installPromise = installPluginUnlocked(makePlugin());
    const assertion = expect(installPromise).resolves.toBeUndefined();
    jest.advanceTimersByTime(30000);
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
