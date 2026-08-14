import { act, renderHook } from '@testing-library/react-native';

import { PluginItem } from '@plugins/types';
import { fetchPlugins } from '@plugins/pluginManager';
import usePlugins, {
  INSTALLED_PLUGINS,
  AVAILABLE_PLUGINS,
  LAST_USED_PLUGIN,
} from '../usePlugins';

// Module-level mock state (prefixed with `mock` so the jest.mock factory may
// reference it).
const mockMmkvState: Record<string, string> = {};
const mockMmkvSetCalls: Array<[string, string]> = [];
const mockHookValues: Record<string, unknown> = {};
const mockHookSetters: Record<string, (value: unknown) => void> = {};

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn((key: string, value: string) => {
      mockMmkvSetCalls.push([key, value]);
      mockMmkvState[key] = value;
    }),
    getString: jest.fn((key: string) => mockMmkvState[key]),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    delete: jest.fn((key: string) => {
      delete mockMmkvState[key];
    }),
    getAllKeys: jest.fn(),
    clearAll: jest.fn(),
    addOnValueChangedListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  useMMKVObject: jest.fn((key: string) => {
    const setter = (value: unknown) => {
      mockHookValues[key] = value;
    };
    mockHookSetters[key] = setter;
    return [mockHookValues[key], setter];
  }),
}));

jest.mock('@plugins/pluginManager', () => ({
  fetchPlugins: jest.fn(),
  installPlugin: jest.fn(),
  uninstallPlugin: jest.fn(),
  updatePlugin: jest.fn(),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

const mockFetchPlugins = fetchPlugins as jest.MockedFunction<
  typeof fetchPlugins
>;

const makePlugin = (overrides: Partial<PluginItem>): PluginItem => ({
  id: 'test.source',
  name: 'Test Source',
  site: 'https://example.com',
  lang: 'English',
  version: '1.0.0',
  url: 'https://example.com/test.js',
  iconUrl: 'https://example.com/icon.png',
  ...overrides,
});

const writesTo = (key: string) => mockMmkvSetCalls.filter(([k]) => k === key);

describe('usePlugins.refreshPlugins wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockMmkvState).forEach(k => delete mockMmkvState[k]);
    mockMmkvSetCalls.length = 0;
    Object.keys(mockHookValues).forEach(k => delete mockHookValues[k]);
    Object.keys(mockHookSetters).forEach(k => delete mockHookSetters[k]);
  });

  it('skips writing INSTALLED_PLUGINS when nothing changed', async () => {
    mockMmkvState[INSTALLED_PLUGINS] = JSON.stringify([
      makePlugin({ id: 'p1', version: '1.0.0' }),
    ]);
    mockFetchPlugins.mockResolvedValue([
      makePlugin({ id: 'p1', version: '1.0.0' }),
    ]);

    const { result } = renderHook(() => usePlugins());

    await act(async () => {
      await result.current.refreshPlugins();
    });

    expect(writesTo(INSTALLED_PLUGINS)).toHaveLength(0);
    // Available list is always refreshed.
    expect(writesTo(AVAILABLE_PLUGINS)).toHaveLength(1);
  });

  it('writes INSTALLED_PLUGINS with hasUpdate when a newer version exists', async () => {
    mockMmkvState[INSTALLED_PLUGINS] = JSON.stringify([
      makePlugin({ id: 'p1', version: '1.0.0' }),
    ]);
    mockFetchPlugins.mockResolvedValue([
      makePlugin({ id: 'p1', version: '1.0.1', iconUrl: 'new-icon.png' }),
    ]);

    const { result } = renderHook(() => usePlugins());

    await act(async () => {
      await result.current.refreshPlugins();
    });

    const writes = writesTo(INSTALLED_PLUGINS);
    expect(writes).toHaveLength(1);
    const updated = JSON.parse(writes[0][1]) as PluginItem[];
    expect(updated[0]).toMatchObject({
      id: 'p1',
      version: '1.0.0',
      hasUpdate: true,
      iconUrl: 'new-icon.png',
    });
  });

  it('re-stamps the object-form last-used plugin when its entry changes', async () => {
    const installed = makePlugin({ id: 'p1', version: '1.0.0' });
    mockMmkvState[INSTALLED_PLUGINS] = JSON.stringify([installed]);
    mockHookValues[LAST_USED_PLUGIN] = installed;
    mockFetchPlugins.mockResolvedValue([
      makePlugin({ id: 'p1', version: '1.0.1', iconUrl: 'new-icon.png' }),
    ]);

    const { result } = renderHook(() => usePlugins());

    await act(async () => {
      await result.current.refreshPlugins();
    });

    expect(mockHookValues[LAST_USED_PLUGIN]).toMatchObject({
      id: 'p1',
      hasUpdate: true,
      iconUrl: 'new-icon.png',
    });
  });

  it('clears hasUpdate badges with clearUnavailableUpdates=true', async () => {
    mockMmkvState[INSTALLED_PLUGINS] = JSON.stringify([
      makePlugin({ id: 'p1', version: '1.0.0', hasUpdate: true }),
    ]);
    // The repo was disabled: the plugin no longer appears in the fetched list.
    mockFetchPlugins.mockResolvedValue([]);

    const { result } = renderHook(() => usePlugins());

    await act(async () => {
      await result.current.refreshPlugins({ clearUnavailableUpdates: true });
    });

    const writes = writesTo(INSTALLED_PLUGINS);
    expect(writes).toHaveLength(1);
    const updated = JSON.parse(writes[0][1]) as PluginItem[];
    expect(updated[0]).toMatchObject({ id: 'p1', hasUpdate: false });
  });

  it('keeps hasUpdate badges when clearUnavailableUpdates defaults to false', async () => {
    mockMmkvState[INSTALLED_PLUGINS] = JSON.stringify([
      makePlugin({ id: 'p1', version: '1.0.0', hasUpdate: true }),
    ]);
    mockFetchPlugins.mockResolvedValue([]);

    const { result } = renderHook(() => usePlugins());

    await act(async () => {
      await result.current.refreshPlugins();
    });

    expect(writesTo(INSTALLED_PLUGINS)).toHaveLength(0);
    expect(
      (JSON.parse(mockMmkvState[INSTALLED_PLUGINS]) as PluginItem[])[0]
        .hasUpdate,
    ).toBe(true);
  });
});
