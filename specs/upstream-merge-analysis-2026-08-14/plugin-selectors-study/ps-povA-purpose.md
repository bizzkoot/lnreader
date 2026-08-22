I have all the evidence needed. Let me compile the purpose & design report.

---

## Review — POV: Upstream Purpose & Design Analyst — `pluginSelectors.ts` (upstream 909504a72)

### 1. Module purpose

`src/hooks/persisted/pluginSelectors.ts` is a **pure, side-effect-free selector/helper module** extracted from `usePlugins.ts`. It owns four responsibilities that were previously inlined/mutating inside the hook: (a) normalizing the legacy `LAST_USED_PLUGIN` MMKV value, (b) language filtering of installed plugins, (c) available-tab filtering (language + not-installed + name sort), and (d) **reconciling `hasUpdate` state between the persisted installed list and the freshly fetched registry**. It is the computational heart of the "repository enable/disable" feature's badge lifecycle. Verified imports (`@plugins/types`, `@utils/compareVersion`) both exist in the fork — the module is DIRECT-portable with zero adaptation.

### 2. Per-function contracts

**`getLastUsedPluginId(storedValue: unknown): string | undefined`**
- Input: the raw MMKV value under `LAST_USED_PLUGIN` (any shape). Output: plugin id string or `undefined`.
- String input → returned as-is (canonical form).
- Object with string `id` (`'id' in value && typeof value.id === 'string'`) → returns `value.id` (legacy form).
- `null`/`undefined`/object-without-string-id/number-id → `undefined`. Defensive: never throws, never trusts non-string ids.
- Used with a one-time normalization write in `refreshPlugins`: `if (id && typeof stored !== 'string') setMMKVObject(LAST_USED_PLUGIN, id)` — converts legacy object → canonical string once.

**`filterInstalledPlugins(installedPlugins, languagesFilter): PluginItem[]`**
- Pure, O(n). `Set`-based lang membership. Empty filter → empty result. No sorting, no mutation. Plugins with missing `lang` are excluded.

**`filterAvailablePlugins(availablePlugins, installedPlugins, languagesFilter): PluginItem[]`**
- Pure, O(n+m). Result = available plugins that (a) are in an enabled language AND (b) are **not** installed (excluded by `Set` of installed ids), sorted by **`a.name.localeCompare(b.name)`** — locale-aware, unlike the fork's `orderBy(..., 'name')` plain compare (fork `usePlugins.ts:60`). Filtering creates a new array so `.sort()` cannot mutate the input. Sorting relies on `name` being defined (typed required).

**`reconcileInstalledPluginUpdates(installedPlugins, availablePlugins, clearUnavailableUpdates = false): PluginItem[]`**
- Pure, O(n+m) via `Map` of available-by-id. Returns a **new array with same length/order**; each element is either the **same object reference** (no state change) or a **fresh object** (state changed). Three-way decision per installed plugin:
  1. `availablePlugin` missing **or** `!newer(available.version, installed.version)` → unchanged reference, **unless** `clearUnavailableUpdates && installedPlugin.hasUpdate`, then `{...installedPlugin, hasUpdate: false}`.
  2. Otherwise → `{...installedPlugin, hasUpdate: true, iconUrl: availablePlugin.iconUrl, url: availablePlugin.url}` — always a new object, even if `hasUpdate` was already true.

### 3. `hasUpdate` lifecycle semantics

- **Becomes true**: only when the plugin is still published by an *enabled* repo (present in `fetchPlugins()` output, which upstream now filters by `enabled` repos) AND the registry advertises a strictly newer version (`newer(avail, installed)`, strict numeric-dot compare via `@utils/compareVersion`).
- **Cleared**: exactly when `clearUnavailableUpdates === true` and the plugin currently has `hasUpdate` but no strictly-newer available version exists — i.e., repo disabled/removed, or the pending update was consumed/version caught up. Disabling a repo passes `clearUnavailableUpdates: repository.enabled` = **true**; enabling passes **false**.
- **Cleared only on disable flow, never on enable flow** — intentional: enabling one repo must not wipe badges belonging to other still-disabled repos. The disable event is the authoritative "clear my stale badges" signal.
- **iconUrl/url refresh**: when a newer version exists, the installed entry's `iconUrl`/`url` are re-stamped from the fresh manifest — live metadata sync (moved repo URL, changed icon) without a reinstall; also guarantees the update action (`updatePlugin`) fetches from the current URL.
- **`hasUpdate: false` on successful update** remains in the fork's `updatePlugin` (`usePlugins.ts:169`) and is orthogonal to reconciliation.

### 4. Changed-detection: `updatedInstalledPlugins.some((p, i) => p !== installedPlugins[i])`

- `reconcile` preserves order and length (`.map`), so index `i` in both arrays refers to the same plugin; the `!==` (reference identity) comparison is a correct and O(1)-per-element "did anything semantically change" test.
- **Why identity, not array identity or deep equality**: `.map` always returns a new array (array-identity would always-write, defeating the purpose); deep-equality on `PluginItem` (nested `customJS`/`customCSS` strings) is expensive and brittle. Element identity cleanly detects "only changed elements got new objects."
- **Effect vs the fork's always-write** (`usePlugins.ts:89-90`): when nothing changed (no updates available, no badges to clear — the common case), every element is the same reference → `some` is false → **`INSTALLED_PLUGINS` is not written**. This prevents: (1) gratuitous MMKV writes and downstream `useMMKVObject` re-render cascades on every `refreshPlugins` (app-start, repo toggle, add-repo); (2) clobbering concurrent install/uninstall/update writes with a pre-await snapshot in the no-change case (the fork's read-at-start + always-write pattern is a lost-update hazard); (3) the fork's **in-place mutation** of objects that components may already hold (mutation without identity change → stale UI until the always-write lands).
- **Precision caveat**: when *any* update is available, reconcile re-stamps a new object every refresh (same values, new identity) → `some` is true → a write still occurs. The write-skip optimization is effective exactly when there are zero updatable plugins; the iconUrl/url refresh justifies the write in the update case. This is intended, not a defect.
- **Residual race (upstream too)**: `refreshPlugins` reads `INSTALLED_PLUGINS` before the `await fetchPlugins()`; in the changed case a concurrent write can still be overwritten. The guard narrows the window; it does not eliminate the read-modify-write race. Fork shares this shape.

### 5. `getLastUsedPluginId` — legacy value normalization

- Upstream previously stored `LAST_USED_PLUGIN` via `useMMKVObject<PluginItem>` (a full plugin **object**). This refactor switches the canonical persisted shape to a **plain id string** (smaller, unambiguous, no staleness of metadata). `getLastUsedPluginId` bridges old installs: an object-shaped value still yields the id, and `refreshPlugins` performs a one-time migration write to the string form (`if (id && typeof stored !== 'string')`).
- **Regression if absent**: `useMMKVObject<PluginItem>` reading a string yields `lastUsedPlugin?.id === undefined` for every legacy-string value (strings lack `.id`), silently breaking last-used-plugin tracking/quick-access; and object-form values would keep flowing through object-typed code forever. The selector is the tolerance + migration point.

### 6. Why factored out of `usePlugins.ts`

1. **Testability**: all four functions are pure (no React, no MMKV, no fetch) — unit-testable without mocks/rendering; `newer` is also pure.
2. **Purity**: the hook mixes side effects (MMKV writes, async fetch, toasts, hook state) with computation; selectors separate derivation from effects. All functions avoid input mutation (filter/map/spread).
3. **Reuse**: lang-filter + installed-exclusion + sort is needed by more than one screen; the inline fork version (`filterPlugins`, `usePlugins.ts:44-66`) is only reachable through the hook and also *persists* derived lists (`FILTERED_*` MMKV keys). Selectors are callable anywhere with explicit args, and let consumers derive views directly from `INSTALLED_PLUGINS`/`AVAILABLE_PLUGINS` — removing the `refreshPlugins → filterPlugins(languagesFilter)` coupling and its stale-closure risk.
4. **Declarative lifecycle**: the entire `hasUpdate` set/clear/refresh policy lives in one pure function + an options param (`RefreshPluginsOptions { clearUnavailableUpdates?: boolean }`), instead of being interleaved in async mutation code.

### 7. Tests added for pluginSelectors in 909504a72 — UNVERIFIED

- No `pluginSelectors` test file exists in the fork, and no fork-side doc (`lane4-repo-controls.md`, README, REVIEW, `.agents/upstream-merge-memory.md`) names one. `lane4` lists upstream "tests" generically (RepositoryQueries/Drizzle harness — explicitly "do not copy upstream test harness"). I have no git tool, so **whether 909504a72 shipped a `pluginSelectors.test` is unverifiable from this repo** — parent must run `git show 909504a72 --stat`. The pure design is exactly the shape that makes such a test cheap; if upstream lacks one, porting should add fork-style unit tests (reconcile set/clear/no-op, identity-stability, legacy-id shapes).

### 8. User-visible behavior the combo enables / regressions if absent

- **Enabled**: disabling a repo instantly clears "Update" badges for its plugins (and any plugins whose updates are no longer pending) → accurate UI after repo control; enabling instantly re-surfaces badges via update re-discovery; updatable plugins' icon/URL metadata stays current; plugin screens don't re-render spuriously.
- **Fork regression if absent (current state, `usePlugins.ts`)**: `hasUpdate` is **never cleared** by any flow except a successful `updatePlugin` — after disabling/deleting a repo, stale badges persist indefinitely; `INSTALLED_PLUGINS` is written on every refresh; installed objects are mutated in place; `toggleRepository` (`SettingsRepositoryScreen.tsx:70-77`) cannot pass `clearUnavailableUpdates` (no options param exists). The Wave-3 port (commit 03683bd31) already shipped the DB/query/UI half of #1628; the badge-lifecycle half remains missing, making the repo-disable UX inconsistent (repo off but badges still shown).

### Findings (severity)

- `note` — `pluginSelectors.ts` is pure and DIRECT-portable: imports `@plugins/types` + `@utils/compareVersion`, both present in fork.
- `note` — `reconcile`'s write-skip only applies when zero updates are available; updatable plugins are re-stamped each refresh (intended, benign re-write).
- `note` — residual read-before-await race persists upstream and in any fork port; the `some` guard narrows, not eliminates, it.
- `note` — upstream `filterAvailablePlugins` uses `localeCompare`; fork's `orderBy(..., 'name')` differs (cosmetic, better in upstream).
- `medium` — upstream test coverage for pluginSelectors unverifiable without `git show 909504a72 --stat`; recommend adding fork-style unit tests on port.
- `medium` — fork currently carries the user-visible gap this module closes: stale `hasUpdate` badges after repo disable (`usePlugins.ts` inline refresh, no clear path, no options param).

---