import { PluginItem } from '@plugins/types';

import {
  filterAvailablePlugins,
  filterInstalledPlugins,
  getLastUsedPluginId,
  reconcileInstalledPluginUpdates,
} from '../pluginSelectors';

const makePlugin = (overrides: Partial<PluginItem> = {}): PluginItem => ({
  id: 'plugin-id',
  name: 'Plugin Name',
  version: '1.0.0',
  site: 'https://example.com',
  lang: 'English',
  iconUrl: 'https://example.com/icon.png',
  url: 'https://example.com/plugin.js',
  ...overrides,
});

describe('getLastUsedPluginId', () => {
  it('returns string values as-is (canonical form)', () => {
    expect(getLastUsedPluginId('plugin-id')).toBe('plugin-id');
  });

  it('extracts the id from legacy object-shaped values', () => {
    expect(getLastUsedPluginId({ id: 'plugin-id' })).toBe('plugin-id');
    expect(getLastUsedPluginId({ id: 'other', name: 'x' })).toBe('other');
  });

  it('returns undefined for null, undefined, and malformed values', () => {
    expect(getLastUsedPluginId(undefined)).toBeUndefined();
    expect(getLastUsedPluginId(null)).toBeUndefined();
    expect(getLastUsedPluginId({})).toBeUndefined();
    expect(getLastUsedPluginId({ id: 42 })).toBeUndefined();
    expect(getLastUsedPluginId(42)).toBeUndefined();
  });
});

describe('filterInstalledPlugins', () => {
  it('keeps only plugins whose language is in the filter', () => {
    const plugins = [
      makePlugin({ id: 'a', lang: 'English' }),
      makePlugin({ id: 'b', lang: 'Spanish' }),
      makePlugin({ id: 'c', lang: 'English' }),
    ];
    expect(filterInstalledPlugins(plugins, ['English']).map(p => p.id)).toEqual(
      ['a', 'c'],
    );
  });

  it('returns empty when the filter is empty', () => {
    const plugins = [makePlugin()];
    expect(filterInstalledPlugins(plugins, [])).toEqual([]);
  });

  it('does not mutate the input', () => {
    const plugins = [makePlugin()];
    filterInstalledPlugins(plugins, ['English']);
    expect(plugins).toHaveLength(1);
  });
});

describe('filterAvailablePlugins', () => {
  const installed = [makePlugin({ id: 'installed-1' })];
  const available = [
    makePlugin({ id: 'zeta', name: 'Zeta Plugin', lang: 'English' }),
    makePlugin({ id: 'installed-1', name: 'Already Installed' }),
    makePlugin({ id: 'alpha', name: 'Alpha Plugin', lang: 'English' }),
    makePlugin({ id: 'french', name: 'French Plugin', lang: 'French' }),
  ];

  it('excludes installed plugins and non-enabled languages', () => {
    const result = filterAvailablePlugins(available, installed, ['English']);
    expect(result.map(p => p.id)).not.toContain('installed-1');
    expect(result.map(p => p.id)).not.toContain('french');
  });

  it('sorts remaining plugins by name (locale-aware)', () => {
    const result = filterAvailablePlugins(available, installed, ['English']);
    expect(result.map(p => p.id)).toEqual(['alpha', 'zeta']);
  });

  it('does not mutate the input arrays', () => {
    const originalIds = available.map(p => p.id);
    filterAvailablePlugins(available, installed, ['English']);
    expect(available.map(p => p.id)).toEqual(originalIds);
  });
});

describe('reconcileInstalledPluginUpdates', () => {
  it('marks hasUpdate and re-stamps iconUrl/url when a newer version is available', () => {
    const installed = [
      makePlugin({
        id: 'a',
        version: '1.0.0',
        iconUrl: 'https://old/icon.png',
        url: 'https://old/plugin.js',
      }),
    ];
    const available = [
      makePlugin({
        id: 'a',
        version: '1.1.0',
        iconUrl: 'https://new/icon.png',
        url: 'https://new/plugin.js',
      }),
    ];
    const [updated] = reconcileInstalledPluginUpdates(installed, available);
    expect(updated.hasUpdate).toBe(true);
    expect(updated.iconUrl).toBe('https://new/icon.png');
    expect(updated.url).toBe('https://new/plugin.js');
    expect(updated).not.toBe(installed[0]);
  });

  it('returns the same reference when no newer version exists', () => {
    const installed = [makePlugin({ id: 'a', version: '1.1.0' })];
    const available = [makePlugin({ id: 'a', version: '1.0.0' })];
    const [updated] = reconcileInstalledPluginUpdates(installed, available);
    expect(updated).toBe(installed[0]);
  });

  it('returns the same reference when the plugin is not in the available list', () => {
    const installed = [makePlugin({ id: 'a', hasUpdate: true })];
    const [updated] = reconcileInstalledPluginUpdates(installed, []);
    expect(updated).toBe(installed[0]);
  });

  it('clears hasUpdate when clearUnavailableUpdates is set and no newer version exists', () => {
    const installed = [
      makePlugin({ id: 'a', version: '1.1.0', hasUpdate: true }),
    ];
    const available = [makePlugin({ id: 'a', version: '1.0.0' })];
    const [updated] = reconcileInstalledPluginUpdates(
      installed,
      available,
      true,
    );
    expect(updated.hasUpdate).toBe(false);
    expect(updated).not.toBe(installed[0]);
  });

  it('clears hasUpdate for plugins removed from the available list when clearing', () => {
    const installed = [
      makePlugin({ id: 'a', hasUpdate: true }),
      makePlugin({ id: 'b', hasUpdate: true }),
    ];
    // 'a' still publishes a strictly newer version → badge kept;
    // 'b' is gone from the available list → badge cleared.
    const available = [makePlugin({ id: 'a', version: '2.0.0' })];
    const [updatedA, updatedB] = reconcileInstalledPluginUpdates(
      installed,
      available,
      true,
    );
    expect(updatedA.hasUpdate).toBe(true);
    expect(updatedB.hasUpdate).toBe(false);
  });

  it('clears hasUpdate even when the plugin is still available but no newer version exists', () => {
    const installed = [
      makePlugin({ id: 'a', version: '1.1.0', hasUpdate: true }),
    ];
    const available = [makePlugin({ id: 'a', version: '1.1.0' })];
    const [updated] = reconcileInstalledPluginUpdates(
      installed,
      available,
      true,
    );
    expect(updated.hasUpdate).toBe(false);
  });

  it('keeps hasUpdate when clearUnavailableUpdates is false', () => {
    const installed = [makePlugin({ id: 'a', hasUpdate: true })];
    const [updated] = reconcileInstalledPluginUpdates(installed, [], false);
    expect(updated.hasUpdate).toBe(true);
    expect(updated).toBe(installed[0]);
  });

  it('keeps hasUpdate true when a newer version is still available during clearing', () => {
    const installed = [
      makePlugin({ id: 'a', version: '1.0.0', hasUpdate: true }),
    ];
    const available = [makePlugin({ id: 'a', version: '1.2.0' })];
    const [updated] = reconcileInstalledPluginUpdates(
      installed,
      available,
      true,
    );
    expect(updated.hasUpdate).toBe(true);
  });

  it('preserves array order and length', () => {
    const installed = [makePlugin({ id: 'a' }), makePlugin({ id: 'b' })];
    const available = [makePlugin({ id: 'a', version: '2.0.0' })];
    const result = reconcileInstalledPluginUpdates(installed, available, true);
    expect(result.map(p => p.id)).toEqual(['a', 'b']);
    expect(result).toHaveLength(2);
  });
});
