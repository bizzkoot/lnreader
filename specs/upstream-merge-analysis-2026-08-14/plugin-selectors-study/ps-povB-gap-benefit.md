# POV: FORK GAP & BENEFIT ANALYSIS — pluginSelectors.ts port (upstream 909504a72)

All fork facts verified via read-only inspection of the working tree (branch `merge/upstream-sync-2026-08-14`). No modifications made.

---

## (a) Selector-by-selector mapping table

| Upstream selector (909504a72) | Fork equivalent (current) | Gap severity | User-visible impact |
|---|---|---|---|
| `getLastUsedPluginId(storedValue)` — normalizes legacy string/object `LAST_USED_PLUGIN` to an id | **None.** `useMMKVObject<PluginItem>(LAST_USED_PLUGIN)` raw (usePlugins.ts:29-30); only delete/object-write paths exist in current fork code | **MED** (conditional on legacy MMKV data from older builds) | Legacy bare-string value → `JSON.parse` throws in react-native-mmkv v3.3.3 `useMMKVObject` (verified `node_modules/react-native-mmkv/src/hooks.ts`: `JSON.parse(json)` has **no try/catch**) → render crash in any `usePlugins` consumer (InstalledTab, BottomNavigator). JSON-stringified-string value → silent degradation: `lastUsedPlugin.id` undefined → "Last Used" section never renders (InstalledTab.tsx:186) and lastUsed sync in refreshPlugins (usePlugins.ts:81) dead |
| `filterInstalledPlugins(installed, languagesFilter)` | Inline in `filterPlugins` (usePlugins.ts:48-50): `installedPlugins.filter(plg => filter.includes(plg.lang))` | **NONE** — exact predicate parity | none |
| `filterAvailablePlugins(available, installed, languagesFilter)` | Inline in `filterPlugins` (usePlugins.ts:51-62): not-installed + lang filter + `orderBy('name')` (lodash) | **LOW** | Sorting nuance: lodash `orderBy` uses code-unit compare; upstream uses `localeCompare` (locale-aware). Non-ASCII plugin names (e.g. Chinese/Japanese repos) may order differently between fork/upstream |
| `reconcileInstalledPluginUpdates(installed, available, clearUnavailableUpdates=false)` — pure, immutable, **can clear hasUpdate**, skips INSTALLED_PLUGINS write when nothing changed | Inline + **mutating** in `refreshPlugins` (usePlugins.ts:74-88): side effects inside `.filter()` predicate, `hasUpdate` set true only, **never cleared**, always writes INSTALLED_PLUGINS (line 89) | **HIGH** | Stale "update available" badges + tab-bar badge count persist indefinitely after repo disable (see §b); unconditional MMKV write + `filterPlugins` re-writes on every refresh |
| — (`RefreshPluginsOptions { clearUnavailableUpdates? }` plumbing into `toggleRepository`) | `SettingsRepositoryScreen.tsx:70-77` calls `refreshPlugins()` with **no options** | **HIGH** | Direct cause of the perpetual stale-badge bug (disable repo → badge stays, update signal contradicts user intent) |
| — (removal of legacy `FILTERED_*` persisted keys; filtering moved to render-time selectors) | Fork still persists `FILTERED_AVAILABLE_PLUGINS`/`FILTERED_INSTALLED_PLUGINS` (usePlugins.ts:22-23, 36-38) and rewrites them on every refresh/install/uninstall/update/lang-toggle via `filterPlugins` | **LOW** (design debt; no visible bug) | Extra MMKV writes + reactive re-render churn in InstalledTab/AvailableTab/BottomNavigator on every refresh (incl. app launch, Main.tsx:67); duplicate persisted cache can drift from source keys |

## (b) What breaks / lingers today (verified)

1. **Perpetual stale "update available" badge (HIGH).** After Wave-3, disabling a repo excludes it from `fetchPlugins` (`pluginManager.ts` uses `getEnabledRepositoriesFromDb()`). Fork `refreshPlugins` reconciles only against the fetched (enabled-repo) list, so installed plugins whose updates came from the disabled repo are **never revisited**; `hasUpdate` was only ever set `true` (usePlugins.ts:78) and only cleared by a manual `updatePlugin` (line 169). Badge + BottomNavigator tab badge (BottomNavigator.tsx:31-33, 114-116) and the per-row update button (PluginListItem.tsx:196 `item.hasUpdate || __DEV__`) linger indefinitely. Same lingers for plugins removed/downgraded by an enabled repo.

2. **Update signal contradicts the disable intent (HIGH).** Tapping the lingering update button calls `updatePlugin` → fetches `plugin.url` (raw code URL) directly, **bypassing the disabled repo** — i.e., the "disable repo" feature (the point of #1628) does not actually stop its plugins' updates; or, if the repo version was reverted/removed, the user gets a dead-end "No update found!" error with the badge still showing. Upstream's `toggleRepository` → `refreshPlugins({ clearUnavailableUpdates: repository.enabled })` clears exactly these flags on disable.

3. **Side effects inside `.filter()` predicate + unconditional writes (MED maintainability / LOW runtime).** `fetchedPlugins.filter(plg => { finded...; return false })` (usePlugins.ts:74-88) mutates installed objects and calls `setLastUsedPlugin` during iteration; the filter result is discarded. Not currently a data-corruption bug (objects come fresh from `JSON.parse` in `getMMKVObject`, no aliasing with React state; `filter` visits every element) but fragile: any future assignment of the filter result silently changes semantics. `setMMKVObject(INSTALLED_PLUGINS, ...)` fires on **every** refresh even when nothing changed (upstream writes only on reference-diff), and `filterPlugins` then rewrites both `FILTERED_*` keys → unnecessary MMKV IO + re-render of all Browse consumers on every app launch/pull-to-refresh/repo toggle.

4. **`LAST_USED_PLUGIN` normalization absent (MED, data-dependent).** Upstream added `getLastUsedPluginId` + a write-normalization step because legacy string values exist in the wild (older upstream lineage). Fork reads with `useMMKVObject<PluginItem>` — bare-string legacy value crashes renders (JSON.parse throw, no try/catch); quoted-string value silently kills the Last Used section and lastUsed sync. Fork's own write path is always an object (InstalledTab.tsx:69), so this only bites users with pre-existing old-format MMKV data.

5. **Snapshot drift of lastUsedPlugin (LOW).** Fork stores a full `PluginItem` snapshot synced only when `newer()` (usePlugins.ts:81-82) or on update (line 172-173); metadata changes without a version bump leave the Last Used entry stale. Upstream's id-string form (resolved from INSTALLED_PLUGINS at render) makes this impossible.

6. **No other duplication (verified).** `AvailableTab`, `InstalledTab`, `BottomNavigator` all consume the hook's filtered lists; `pluginManager.ts` has no selector logic; backup flow not affected. Only one implementation site to change.

## (c) Benefit statement — what the port fixes in the fork

Porting `pluginSelectors.ts` (pure, copy-verbatim candidate — imports only `@plugins/types` + `@utils/compareVersion`, both present in fork) + the `refreshPlugins` refactor + the `toggleRepository` wiring would:

- **Fix the stale-badge bug**: disabling a repo (or removal/downgrade of a plugin from an enabled repo) clears `hasUpdate` via `reconcileInstalledPluginUpdates(installed, fetched, clearUnavailableUpdates=true)` — the tab-bar badge, row update button, and "N updates" counts become truthful; the "disable repo stops its updates" contract of #1628 actually holds.
- **Remove mutation-in-predicate fragility** with a pure, immutable reconcile; `hasUpdate` becomes fully declarative (set true on newer, cleared on unavailable) instead of one-way sticky.
- **Eliminate unconditional `INSTALLED_PLUGINS` writes** (reference-diff guard) and — if the legacy `FILTERED_*` keys are dropped like upstream — remove two persisted cache keys and their per-refresh re-write/re-render churn; filtering becomes render-time and single-sourced from `INSTALLED_PLUGINS`/`AVAILABLE_PLUGINS`.
- **Harden `LAST_USED_PLUGIN`**: legacy string/object normalization prevents a potential render crash and silently-broken Last Used section on old user data, and (id-based storage) guarantees the Last Used entry always reflects the current installed plugin.
- **Straighten ordering parity** (`localeCompare` vs lodash `orderBy`) for non-ASCII plugin lists.
- Keeps fork's `hasSettings` additions (installPlugin/updatePlugin) intact — hand-merge surface is exactly the `refreshPlugins` block + imports + toggleRepository call site.

## Review

- **Correct**: fork `filterPlugins` predicates are behaviorally equivalent to upstream `filterInstalledPlugins`/`filterAvailablePlugins` (verified line-by-line, usePlugins.ts:44-66); Wave-3 `enabled` filter in `fetchPlugins` and migration 005 are committed and consistent; `updatePlugin` is the sole `hasUpdate` clearer; no selector logic duplicated outside `usePlugins`.
- **Blocker**: none for this read-only analysis task.
- **Fixed**: none (read-only).
- **Note**: `__DEV__` forces the update button visible (PluginListItem.tsx:196), which masks the stale-badge bug in dev builds — release-only reproduction. Also note the fork's `LAST_USED_PLUGIN` string-history could not be confirmed without git (`git log -S LAST_USED_PLUGIN` — supervisor to run); severity MED is conditional on legacy data actually existing in user MMKV stores.

## Residual risks

- Legacy `LAST_USED_PLUGIN` string values in the wild unverified (no git tool); the crash path is proven from `react-native-mmkv@3.3.3` source but requires such data to exist.
- Upstream diff hunks (exact post-refactor `usePlugins.ts`, `filterPlugins` removal, LAST_USED_PLUGIN storage format) taken from the task brief, not `git show`.
- Upstream's id-string `LAST_USED_PLUGIN` migration writes a bare string via `setMMKVObject` — if the fork ports that exact line, the fork's own `getMMKVObject`/`useMMKVObject` readers must also be migrated (they currently expect objects); port must include the read-side resolution to avoid introducing the very crash it fixes.
- Sorting parity change (`localeCompare`) is observable for non-ASCII plugin names; minor.
- `clearUnavailableUpdates` on disable also wipes `hasUpdate` for plugins whose update came from a *different* still-enabled repo (reconcile clears when the specific available entry is absent) — matches upstream, acceptable.