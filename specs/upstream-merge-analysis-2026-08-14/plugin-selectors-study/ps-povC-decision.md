All evidence gathered (read-only). Here is the decision report for POV C — Decision Advisor. The runtime persists this to the authoritative output path.

---

# POV C — DECISION ADVISOR: Should the fork port upstream `pluginSelectors.ts` (+ usePlugins refactor + toggleRepository wiring)?

## Inherited decisions
- Branch `merge/upstream-sync-2026-08-14` carries 12 Wave-1..3 commits, **not pushed**; 03683bd31 shipped repo enable/disable (#1628) + migration 005. Migration registry now `[002,003,004,005]`; Batch D must use 006+.
- `pluginSelectors.ts` was **deliberately NOT ported** and flagged for follow-up. `.agents/upstream-merge-memory.md:70` rationalizes it as "dead code in fork — fork's refreshPlugins equivalent inline".
- Wave-3 gates passed (type-check, lint, format, 1469 tests, TTS wake-cycle/refill, migration upgrade-path 39/39). Zero TTS/DoH/scaling/per-novel files touched.
- lane4 verdict on 909504a72: **PARTIAL / PORT-with-care**; `pluginSelectors.ts` = NEW file, direct-copy candidate pending import check (verified pure: only `@plugins/types` type import + `@utils/compareVersion`).

## Diagnosis
- The fork's inline `refreshPlugins` (`usePlugins.ts:70-93`) is behaviorally **NOT** equivalent to upstream: `hasUpdate` is **never cleared**. After Wave-3's new "disable repository" toggle, a user who disables a repo keeps stale "update available" badges (consumed at `BottomNavigator.tsx:32`, rendered at `PluginListItem.tsx:196`). Wave-3 shipped the disable switch **without its badge-cleanup companion** — a latent UX regression in the same feature.
- The memory note "dead code in fork" is now outdated: `pluginSelectors.ts` is the carrier of the `clearUnavailableUpdates` fix, which is only meaningful *because* Wave-3 added repo disabling. The two halves belong to the same feature.
- Two fork-divergence traps make a **verbatim** port wrong: (1) `LAST_USED_PLUGIN` — upstream stores a string id and migrates legacy objects via `getLastUsedPluginId`; fork stores a full `PluginItem` object and `InstalledTab.tsx:186-197` renders `item={lastUsedPlugin}` directly. Porting the `setMMKVObject(LAST_USED_PLUGIN, id)` write would corrupt the fork's object storage and break the Last-Used card. (2) Upstream removed `FILTERED_*` persisted keys ("legacyFilteredPluginKeys removal"); 6 fork consumers depend on the hook's filtered return values — the fork's `filterPlugins` machinery must stay.

## Drift / contradiction check
- **No conflict** with inherited decisions — this is the previously flagged follow-up, executed now (same branch, before push) rather than deferred.
- **Revised assumption**: memory's "dead code in fork" is superseded; the selector module is now load-bearing for the badge-clear fix. Revision is narrow (port with 2 documented adaptations), not a broad pivot.
- No quiet assumption changes otherwise: hook public API shape stays identical; `newer` (now `usePlugins.ts:78` only) moves into the selectors file; `hasSettings` blocks in install/update stay untouched.

## Recommendation: **PORT-NOW** — single follow-up commit on `merge/upstream-sync-2026-08-14`, before push
Why: same feature, current port base is known/verified, pure-TS surface (no native, no DB, no migrations), smallest risk window while the branch is still unpublished. Deferring only postpones a known badge-staleness bug into the release and grows base-drift cost. SKIP is untenable (latent UX bug ships with Wave-3).

**Effort: ~2.5–4 h** (1–2 focused sessions)
| Step | File(s) | Change | Est |
|---|---|---|---|
| 1 | NEW `src/hooks/persisted/pluginSelectors.ts` | Direct copy (imports verified resolvable: `@utils/compareVersion`, type-only `@plugins/types`) | ~15 min |
| 2 | `src/hooks/persisted/usePlugins.ts` | Async refresh + `RefreshPluginsOptions` + reconcile + conditional write; drop `newer` import; **keep** filterPlugins machinery + filtered-key persistence + object-format lastUsedPlugin + `hasSettings` blocks | ~45–60 min |
| 3 | `src/screens/settings/SettingsRepositoryScreen/SettingsRepositoryScreen.tsx` | `toggleRepository`: `refreshPlugins({ clearUnavailableUpdates: repository.enabled })` (lines 68–77) | ~10 min |
| 4 | NEW `src/hooks/persisted/__tests__/pluginSelectors.test.ts` | Mirror upstream (4 pure fns); jest infra ready (react-native-mmkv mock in `jest.config.cjs`, `@testing-library/react-hooks@8.0.1` present) | ~45–60 min |
| 5 | Optional `usePlugins.test.ts` mirror | Feasible; only if upstream hunk confirmed via git (not verifiable read-only) — otherwise skip | ~1–2 h |
| 6 | Gates | type-check, lint:fix, format, full suite, Browse smoke | ~30–60 min |

**Regression surface (verified consumers, all unaffected — hook API unchanged):**
- `filteredAvailablePlugins`: AvailableTab.tsx:131 · `filteredInstalledPlugins`: InstalledTab.tsx:33, Migration.tsx:18, MigrationNovels.tsx:40, useGlobalSearch.ts:42, BottomNavigator.tsx:30 · `lastUsedPlugin`: InstalledTab.tsx:186–197 · `refreshPlugins`: Main.tsx:47 (launch), SettingsRepositoryScreen.tsx:31, AvailableTab.tsx:169 (`.finally()` — async signature stays Promise-returning) · `languagesFilter/toggleLanguageFilter`: BrowseScreen.tsx:27, BrowseSettings.tsx:20.
- `NovelInfoHeader.tsx:143` reads `AVAILABLE_PLUGINS` MMKV directly — still written unconditionally, unaffected.
- **No** TTS/DoH/migration/scaling/per-novel files touched.

**Intentional behavior deltas (all improvements, call out in PR):** conditional `INSTALLED_PLUGINS` write (kills re-render churn from no-op writes), `hasUpdate` cleared on repo-disable, in-place mutation removed.

**Mini implementation plan (concrete):**
1. Add `pluginSelectors.ts` verbatim (4 exports).
2. `usePlugins.ts`:
   - Replace inline reconcile block with:
     ```ts
     const updatedInstalledPlugins = reconcileInstalledPluginUpdates(
       installedPlugins, fetchedPlugins, clearUnavailableUpdates,
     );
     if (updatedInstalledPlugins.some((p, i) => p !== installedPlugins[i])) {
       setMMKVObject(INSTALLED_PLUGINS, updatedInstalledPlugins);
       // fork adaptation: keep object-form LAST_USED_PLUGIN in sync (upstream stores string id)
       const idx = installedPlugins.findIndex(p => p.id === lastUsedPlugin?.id);
       if (idx !== -1 && updatedInstalledPlugins[idx] !== installedPlugins[idx]) {
         setLastUsedPlugin(updatedInstalledPlugins[idx]);
       }
     }
     setMMKVObject(AVAILABLE_PLUGINS, fetchedPlugins);
     filterPlugins(languagesFilter);   // KEEP — fork persists FILTERED_* keys
     ```
   - Add `RefreshPluginsOptions { clearUnavailableUpdates?: boolean }`; `async ({ clearUnavailableUpdates = false } = {})`.
   - **Do NOT** port the `getLastUsedPluginId` storage-migration write (would corrupt fork's object format).
3. `SettingsRepositoryScreen.tsx:68-77`: `refreshPlugins({ clearUnavailableUpdates: repository.enabled })` (current-state semantics: disabling → `true` → stale badges cleared; enabling → `false`).
4. Tests: mirror upstream `pluginSelectors.test.ts`; extend with a clearUnavailableUpdates case (badge cleared when plugin leaves available; retained when update still present).
5. Gates + manual smoke: disable a repo → Updates badge count (BottomNavigator) drops; re-enable → no premature clears.

## Risks
- **LAST_USED_PLUGIN format trap** (main): mitigated by keeping object storage + ref-identity sync block; skipping the upstream migration write is the safe adaptation.
- **Upstream filtered-keys removal**: do not port; fork consumers depend on persisted filtered lists.
- **Unknown upstream test shape** (no git/shell this run): mirror pluginSelectors tests authoritatively; treat usePlugins.test.ts port as optional/conditional.
- **Reference-identity edge**: `getMMKVObject` re-parses each call, so only compare `updatedInstalledPlugins[i] !== installedPlugins[i]` within the same refresh (as drafted) — do not compare against the stateful `lastUsedPlugin` object directly.
- If branch is pushed before this commit, port base drifts slightly and review coherence suffers — keep sequencing tight.

## Need from main agent
- None blocking. One confirmation, not required for porting: adopt upstream's string-id `LAST_USED_PLUGIN` + InstalledTab lookup refactor? **Recommend NO** (expands blast radius for zero user-visible gain).

## Suggested execution prompt (worker handoff IS warranted)
> On branch `merge/upstream-sync-2026-08-14`, port upstream 909504a72's selector refactor as ONE follow-up commit: (1) copy `src/hooks/persisted/pluginSelectors.ts` verbatim from upstream; (2) refactor `usePlugins.ts` `refreshPlugins` to `async ({ clearUnavailableUpdates = false }: RefreshPluginsOptions = {})` using `reconcileInstalledPluginUpdates`, conditional `INSTALLED_PLUGINS` write, keep `filterPlugins(languagesFilter)` and the persisted `FILTERED_*` keys, keep the object-form `LAST_USED_PLUGIN` sync via the reference-identity block (do NOT port the string-id migration); keep `hasSettings` blocks in install/update intact; (3) wire `SettingsRepositoryScreen.toggleRepository` to `refreshPlugins({ clearUnavailableUpdates: repository.enabled })`; (4) add `pluginSelectors.test.ts` mirroring upstream incl. a clearUnavailableUpdates case; (5) run gates: `pnpm run type-check`, `pnpm run lint:fix`, `pnpm run format`, `pnpm run test`; (6) manual smoke: disable a repo → Updates badge clears; re-enable → no badge loss; last-used card still renders. Do not touch TTS/DoH/migrations.

---