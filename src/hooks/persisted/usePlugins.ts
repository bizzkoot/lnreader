import { getLocales } from 'expo-localization';
import { languagesMapping } from '@utils/constants/languages';
import { useMMKVObject } from 'react-native-mmkv';
import { PluginItem } from '@plugins/types';
import {
  fetchPlugins,
  installPluginUnlocked as _install,
  uninstallPluginUnlocked as _uninstall,
  updatePluginUnlocked as _update,
  withPluginMutationLock,
} from '@plugins/pluginManager';
import { MMKVStorage, getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { useCallback, useRef } from 'react';
import { getString } from '@strings/translations';
import { withWriteLock } from './writeQueue';
import {
  filterAvailablePlugins,
  filterInstalledPlugins,
  reconcileInstalledPluginUpdates,
} from './pluginSelectors';

export const AVAILABLE_PLUGINS = 'AVAILABLE_PLUGINS';
export const INSTALLED_PLUGINS = 'INSTALL_PLUGINS';
export const LANGUAGES_FILTER = 'LANGUAGES_FILTER';
export const LAST_USED_PLUGIN = 'LAST_USED_PLUGIN';
export const PINNED_PLUGINS = 'PINNED_PLUGINS';
export const FILTERED_AVAILABLE_PLUGINS = 'FILTERED_AVAILABLE_PLUGINS';
export const FILTERED_INSTALLED_PLUGINS = 'FILTERED_INSTALLED_PLUGINS';

interface RefreshPluginsOptions {
  /** Clear hasUpdate badges for plugins whose newer version is no longer
   * published by an enabled repository (pass true when disabling a repo). */
  clearUnavailableUpdates?: boolean;
}

export default function usePlugins() {
  const defaultLang =
    languagesMapping[getLocales()[0]?.languageCode ?? 'en'] ?? 'English';

  const [lastUsedPlugin, setLastUsedPlugin] =
    useMMKVObject<PluginItem>(LAST_USED_PLUGIN);
  const [pinnedPlugins = [], setPinnedPlugins] =
    useMMKVObject<string[]>(PINNED_PLUGINS);
  const [languagesFilter = [defaultLang], setLanguagesFilter] =
    useMMKVObject<string[]>(LANGUAGES_FILTER);
  const [filteredAvailablePlugins = [], setFilteredAvailablePlugins] =
    useMMKVObject<PluginItem[]>(FILTERED_AVAILABLE_PLUGINS);
  const [filteredInstalledPlugins = [], setFilteredInstalledPlugins] =
    useMMKVObject<PluginItem[]>(FILTERED_INSTALLED_PLUGINS);
  const refreshRequestIdRef = useRef(0);
  /**
   * @param filter
   * We cant use the languagesFilter directly because it is updated only after component's lifecycle end.
   * And toggleLanguagFilter triggers filterPlugins before lifecycle end.
   */
  const filterPlugins = useCallback(
    (filter: string[]) => {
      const installedPlugins =
        getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
      const availablePlugins =
        getMMKVObject<PluginItem[]>(AVAILABLE_PLUGINS) || [];
      setFilteredInstalledPlugins(
        filterInstalledPlugins(installedPlugins, filter),
      );
      setFilteredAvailablePlugins(
        filterAvailablePlugins(availablePlugins, installedPlugins, filter),
      );
    },
    [setFilteredAvailablePlugins, setFilteredInstalledPlugins],
  );

  const refreshPlugins = useCallback(
    async ({ clearUnavailableUpdates = false }: RefreshPluginsOptions = {}) => {
      const requestId = ++refreshRequestIdRef.current;
      const fetched = await fetchPlugins();
      await withWriteLock(async () => {
        // Re-read while holding the write lock. An install/update cannot write
        // between this read and the reconciliation below.
        const installedPlugins =
          getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
        if (requestId !== refreshRequestIdRef.current) {
          return;
        }
        const updatedInstalledPlugins = reconcileInstalledPluginUpdates(
          installedPlugins,
          fetched.plugins,
          clearUnavailableUpdates && fetched.complete,
        );

        if (
          updatedInstalledPlugins.some(
            (plugin, index) => plugin !== installedPlugins[index],
          )
        ) {
          setMMKVObject(INSTALLED_PLUGINS, updatedInstalledPlugins);
          const lastUsedIndex = installedPlugins.findIndex(
            plugin => plugin.id === lastUsedPlugin?.id,
          );
          if (
            lastUsedIndex !== -1 &&
            updatedInstalledPlugins[lastUsedIndex] !==
              installedPlugins[lastUsedIndex]
          ) {
            setLastUsedPlugin(updatedInstalledPlugins[lastUsedIndex]);
          }
        }
        setMMKVObject(AVAILABLE_PLUGINS, fetched.plugins);
        filterPlugins(
          getMMKVObject<string[]>(LANGUAGES_FILTER) || languagesFilter,
        );
      });
    },
    [filterPlugins, languagesFilter, lastUsedPlugin?.id, setLastUsedPlugin],
  );

  const toggleLanguageFilter = (lang: string) => {
    const newFilter = languagesFilter.includes(lang)
      ? languagesFilter.filter(l => l !== lang)
      : [lang, ...languagesFilter];
    setLanguagesFilter(newFilter);
    filterPlugins(newFilter);
  };

  /**
   * Variable scope naming
   * plugin: parameter
   * _plg: value returned by pluginManager functions
   * plg: parameter in JS class method callback (.map, .reducer, ...)
   */

  const installPlugin = (plugin: PluginItem) => {
    return withPluginMutationLock(() =>
      _install(plugin).then(_plg =>
        withWriteLock(() => {
          if (_plg) {
            const installedPlugins =
              getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
            const actualPlugin: PluginItem = {
              ...plugin,
              version: _plg.version,
              hasSettings: !!_plg.pluginSettings,
            };
            if (!installedPlugins.some(plg => plg.id === plugin.id)) {
              setMMKVObject(INSTALLED_PLUGINS, [
                ...installedPlugins,
                actualPlugin,
              ]);
            }
            filterPlugins(
              getMMKVObject<string[]>(LANGUAGES_FILTER) || languagesFilter,
            );
          } else {
            throw new Error(
              getString('browseScreen.installFailed', { name: plugin.name }),
            );
          }
        }),
      ),
    );
  };

  const uninstallPlugin = (plugin: PluginItem) => {
    return withPluginMutationLock(() =>
      _uninstall(plugin).then(() =>
        withWriteLock(() => {
          if (lastUsedPlugin?.id === plugin.id) {
            MMKVStorage.delete(LAST_USED_PLUGIN);
          }
          if (pinnedPlugins.includes(plugin.id)) {
            setPinnedPlugins(pinnedPlugins.filter(id => id !== plugin.id));
          }
          const installedPlugins =
            getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
          setMMKVObject(
            INSTALLED_PLUGINS,
            installedPlugins.filter(plg => plg.id !== plugin.id),
          );
          filterPlugins(
            getMMKVObject<string[]>(LANGUAGES_FILTER) || languagesFilter,
          );
        }),
      ),
    );
  };

  const updatePlugin = (plugin: PluginItem) => {
    return withPluginMutationLock(() =>
      _update(plugin).then(_plg =>
        withWriteLock(() => {
          if (plugin.version === _plg?.version && !__DEV__) {
            throw new Error('No update found!');
          }
          if (_plg) {
            const installedPlugins =
              getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS) || [];
            setMMKVObject<PluginItem[]>(
              INSTALLED_PLUGINS,
              installedPlugins.map(plg => {
                if (plugin.id !== plg.id) {
                  return plg;
                }
                const newPlugin: PluginItem = {
                  ...plugin,
                  site: _plg.site,
                  name: _plg.name,
                  version: _plg.version,
                  hasUpdate: false,
                  hasSettings: !!_plg.pluginSettings,
                };
                if (newPlugin.id === lastUsedPlugin?.id) {
                  setLastUsedPlugin(newPlugin);
                }
                return newPlugin;
              }),
            );
            filterPlugins(
              getMMKVObject<string[]>(LANGUAGES_FILTER) || languagesFilter,
            );
            return _plg.version;
          }
          throw Error(getString('browseScreen.updateFailed'));
        }),
      ),
    );
  };

  const togglePinPlugin = useCallback(
    (pluginId: string) => {
      if (pinnedPlugins.includes(pluginId)) {
        setPinnedPlugins(pinnedPlugins.filter(id => id !== pluginId));
      } else {
        setPinnedPlugins([...pinnedPlugins, pluginId]);
      }
    },
    [pinnedPlugins, setPinnedPlugins],
  );

  const isPinned = useCallback(
    (pluginId: string) => pinnedPlugins.includes(pluginId),
    [pinnedPlugins],
  );

  return {
    filteredAvailablePlugins,
    filteredInstalledPlugins,
    lastUsedPlugin,
    pinnedPlugins,
    languagesFilter,
    setLastUsedPlugin,
    refreshPlugins,
    toggleLanguageFilter,
    installPlugin,
    uninstallPlugin,
    updatePlugin,
    togglePinPlugin,
    isPinned,
  };
}
