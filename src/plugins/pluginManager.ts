import { reverse, uniqBy } from 'lodash-es';
import { newer } from '@utils/compareVersion';

// packages for plugins
import {
  store,
  Storage,
  LocalStorage,
  SessionStorage,
} from './helpers/storage';
import { load } from 'cheerio';
import dayjs from 'dayjs';
import { NovelStatus, Plugin, PluginItem } from './types';
import { FilterTypes } from './types/filterTypes';
import { isUrlAbsolute } from './helpers/isAbsoluteUrl';
import { downloadFile, fetchApi, fetchProto, fetchText } from './helpers/fetch';
import { defaultCover } from './helpers/constants';
import { encode, decode } from 'urlencode';
import { Parser } from 'htmlparser2';
import { getEnabledRepositoriesFromDb } from '@database/queries/RepositoryQueries';
import { showToast } from '@utils/showToast';
import { PLUGIN_STORAGE } from '@utils/Storages';
import NativeFile from '@specs/NativeFile';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { withPluginMutationLock } from './mutationQueue';

const packages: Record<string, any> = {
  'htmlparser2': { Parser },
  'cheerio': { load },
  'dayjs': dayjs,
  'urlencode': { encode, decode },
  '@libs/novelStatus': { NovelStatus },
  '@libs/fetch': { fetchApi, fetchText, fetchProto },
  '@libs/isAbsoluteUrl': { isUrlAbsolute },
  '@libs/filterInputs': { FilterTypes },
  '@libs/defaultCover': { defaultCover },
};

const initPlugin = (pluginId: string, rawCode: string) => {
  try {
    const _require = (packageName: string) => {
      if (packageName === '@libs/storage') {
        return {
          storage: new Storage(pluginId),
          localStorage: new LocalStorage(pluginId),
          sessionStorage: new SessionStorage(pluginId),
        };
      }
      return packages[packageName];
    };
    /* eslint no-new-func: "off", curly: "error" */
    const plugin: Plugin = Function(
      'require',
      'module',
      `const exports = module.exports = {}; 
      ${rawCode}; 
      return exports.default`,
    )(_require, {});

    if (!plugin.imageRequestInit) {
      plugin.imageRequestInit = {
        headers: { 'User-Agent': getUserAgent() },
      };
    } else {
      if (!plugin.imageRequestInit.headers) {
        plugin.imageRequestInit.headers = {};
      }

      const hasUserAgent = Object.keys(plugin.imageRequestInit.headers).some(
        header => header.toLowerCase() === 'user-agent',
      );

      if (!hasUserAgent) {
        plugin.imageRequestInit.headers['User-Agent'] = getUserAgent();
      }
    }

    return plugin;
  } catch {
    return undefined;
  }
};

const plugins: Record<string, Plugin | undefined> = {};

const installPluginUnlocked = async (
  _plugin: PluginItem,
): Promise<Plugin | undefined> => {
  const rawCode = await fetch(_plugin.url, {
    headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' },
  }).then(res => res.text());
  const plugin = initPlugin(_plugin.id, rawCode);
  if (!plugin) {
    return undefined;
  }
  let currentPlugin = plugins[plugin.id];
  if (!currentPlugin || newer(plugin.version, currentPlugin.version)) {
    plugins[plugin.id] = plugin;
    currentPlugin = plugin;

    // save plugin code;
    const pluginDir = `${PLUGIN_STORAGE}/${plugin.id}`;
    NativeFile.mkdir(pluginDir);
    const pluginPath = pluginDir + '/index.js';
    const customJSPath = pluginDir + '/custom.js';
    const customCSSPath = pluginDir + '/custom.css';
    if (_plugin.customJS) {
      await downloadFile(_plugin.customJS, customJSPath);
    } else if (NativeFile.exists(customJSPath)) {
      NativeFile.unlink(customJSPath);
    }
    if (_plugin.customCSS) {
      await downloadFile(_plugin.customCSS, customCSSPath);
    } else if (NativeFile.exists(customCSSPath)) {
      NativeFile.unlink(customCSSPath);
    }
    NativeFile.writeFile(pluginPath, rawCode);
  }
  return currentPlugin;
};

const uninstallPluginUnlocked = async (_plugin: PluginItem) => {
  plugins[_plugin.id] = undefined;
  store.getAllKeys().forEach(key => {
    if (key.startsWith(_plugin.id)) {
      store.delete(key);
    }
  });
  const pluginFilePath = `${PLUGIN_STORAGE}/${_plugin.id}/index.js`;
  if (NativeFile.exists(pluginFilePath)) {
    NativeFile.unlink(pluginFilePath);
  }
};

const updatePluginUnlocked = async (plugin: PluginItem) => {
  return installPluginUnlocked(plugin);
};

const installPlugin = (plugin: PluginItem) =>
  withPluginMutationLock(() => installPluginUnlocked(plugin));

const uninstallPlugin = (plugin: PluginItem) =>
  withPluginMutationLock(() => uninstallPluginUnlocked(plugin));

const updatePlugin = (plugin: PluginItem) =>
  withPluginMutationLock(() => updatePluginUnlocked(plugin));

export interface FetchPluginsResult {
  plugins: PluginItem[];
  /** False when one or more enabled repositories could not be fetched or parsed. */
  complete: boolean;
}

const isPluginItem = (value: unknown): value is PluginItem => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const plugin = value as Partial<PluginItem>;
  return (
    typeof plugin.id === 'string' &&
    typeof plugin.name === 'string' &&
    typeof plugin.site === 'string' &&
    typeof plugin.lang === 'string' &&
    typeof plugin.version === 'string' &&
    typeof plugin.url === 'string' &&
    typeof plugin.iconUrl === 'string'
  );
};

const fetchPlugins = async (): Promise<FetchPluginsResult> => {
  const allPlugins: PluginItem[] = [];
  const allRepositories = getEnabledRepositoriesFromDb();

  const repoPluginsRes = await Promise.allSettled(
    allRepositories.map(async ({ url }) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Repository request failed (${response.status})`);
      }
      const manifest: unknown = await response.json();
      if (!Array.isArray(manifest)) {
        throw new Error('Repository manifest must be an array');
      }
      const manifestPlugins = manifest.filter(isPluginItem);
      if (manifestPlugins.length !== manifest.length) {
        throw new Error('Repository manifest contains invalid plugin entries');
      }
      return manifestPlugins;
    }),
  );

  let complete = true;
  repoPluginsRes.forEach(repoPlugins => {
    if (repoPlugins.status === 'fulfilled') {
      allPlugins.push(...repoPlugins.value);
    } else {
      complete = false;
      showToast(String(repoPlugins.reason));
    }
  });

  return { plugins: uniqBy(reverse(allPlugins), 'id'), complete };
};

const getPlugin = (pluginId: string) => {
  if (pluginId === LOCAL_PLUGIN_ID) {
    return undefined;
  }

  if (!plugins[pluginId]) {
    const filePath = `${PLUGIN_STORAGE}/${pluginId}/index.js`;
    try {
      const code = NativeFile.readFile(filePath);
      const plugin = initPlugin(pluginId, code);
      plugins[pluginId] = plugin;
    } catch {
      // file doesnt exist
      return undefined;
    }
  }
  return plugins[pluginId];
};

const LOCAL_PLUGIN_ID = 'local';

export {
  getPlugin,
  installPlugin,
  uninstallPlugin,
  updatePlugin,
  withPluginMutationLock,
  installPluginUnlocked,
  uninstallPluginUnlocked,
  updatePluginUnlocked,
  fetchPlugins,
  LOCAL_PLUGIN_ID,
};
