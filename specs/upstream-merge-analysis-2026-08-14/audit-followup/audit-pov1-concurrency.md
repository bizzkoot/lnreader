# Follow-up Audit POV-1: Concurrency & Async State Safety

**Date**: 2026-08-15 · **Range**: f0e3b4767..HEAD (fix commits) · **Reviewer**: fresh-context subagent (read-only)

All target files inspected. Since I have no shell access, I could not run `git diff` directly; I reviewed the current working-tree state of every audit-target file (which is what the diff's post-state equals — working tree is clean). Here is the review.

---

# POV-1: CONCURRENCY & ASYNC STATE SAFETY — Review

Method note: read-only tools only; `git diff f0e3b4767 HEAD -- <files>` should be run by supervisor to confirm the exact hunk scope (working tree clean, so current files = commit post-state).

## Findings (SEVERITY | CONCERN | evidence | fix)

### 1. src/plugins/pluginManager.ts — `withPluginMutationLock`
- **CORRECT** | release-on-reject guaranteed: `try { return await operation(); } finally { release(); }` at pluginManager.ts:98-101. A synchronous throw from `operation()` is also caught by the same try (operation called inside try at line 99). `await previous` (line 96) can never reject (`previous` is only resolved via `release`). No lost chain: each call appends a fresh promise (lines 91-94) before awaiting.
- **CORRECT** | install/uninstall/update all wrapped (lines 156-163); `refreshPlugins`/`fetchPlugins` deliberately unwrapped (fetch reads only network; reconcile writes happen under the write lock). Confirmed no install path mutates `INSTALLED_PLUGINS` outside `withWriteLock`.
- **NOTE** | pluginManager.ts:52-55 `fetch()` in `installPluginUnlocked` has no timeout. A hung network fetch holds the global plugin queue forever, blocking all subsequent install/uninstall/update. Not a rejection (release still runs) — a hang. Fix: `AbortController` timeout.

### 2. src/hooks/persisted/usePlugins.ts — write lock + staleness guard
- **(a) Deadlock: NO.** Lock order is strictly plugin-lock → write-lock (lines 154-156, 185-187, 209-211). `refreshPlugins` takes ONLY write-lock (lines 91-125). No cycle is constructible: no path holds write-lock while waiting on plugin-lock. Nested wait (install holds plugin-lock while queued on write-lock behind a refresh) is bounded — refresh's critical section is synchronous.
- **(b) Ordering: CORRECT.** `++refreshRequestIdRef` (line 90) → `await fetchPlugins()` (line 91) → `await withWriteLock` (line 92) → re-read `INSTALLED_PLUGINS` (line 96) → id check (lines 97-99) → reconcile/write. The check sits between re-read and any write; the re-read is side-effect-free, so a stale refresh bails before writing (no torn state). An older refresh already queued when a newer one starts also bails correctly on acquiring the lock.
- **(c) Reference-identity conditional write: CORRECT.** `reconcileInstalledPluginUpdates` (pluginSelectors.ts:52-74) returns the *same* object ref for unchanged entries and a new ref only when `hasUpdate`/`iconUrl`/`url` change. So `some((p,i) => p !== installed[i])` (usePlugins.ts:110-113) is an exact "anything changed" test; skip-write when identical verified by test `usePlugins.refreshPlugins.test.ts:81-99`.
- **(d) `clearUnavailableUpdates && fetched.complete` gating: CORRECT.** reconcile's 3rd arg is the conjunction (line 100); test at :172-185 verifies no badge clear on `complete:false`. Partial catalog still overwrites `AVAILABLE_PLUGINS` (line 123) even when `complete:false` — plugins from failed repos vanish from the available list until the next successful fetch (installed entries and `hasUpdate` are protected). LOW.
- **(e) lastUsedPlugin re-stamp: CORRECT for same id.** Inside the `some(...)` block (lines 114-121); index bounds safe (reconcile is 1:1). Cross-instance stale closure: `lastUsedPlugin` is the render-time value of *this* `usePlugins` instance; another instance's `setLastUsedPlugin` may not yet be visible → a missed re-stamp or re-stamp of the same id (id is the only identity used) — benign. LOW/NOTE.
- **(f) Live LANGUAGES_FILTER read: CORRECT.** `getMMKVObject<string[]>(LANGUAGES_FILTER) || languagesFilter` (lines 124-125, 171, 203, 230) reads MMKV inside the write lock; MMKV setters write synchronously so the live read is current.
- **LOW | `withWriteLock` queue is PER-INSTANCE** (`useRef(Promise.resolve())` inside the hook, line 62). `usePlugins()` is instantiated in Main.tsx:47, AvailableTab.tsx:131, PluginListItem.tsx:~28, InstalledTab.tsx:~30, SettingsRepositoryScreen.tsx:31 — five independent write queues. Today this cannot corrupt state because every write-lock block is synchronous/atomic (no awaits between `getMMKVObject` and `setMMKVObject`), so all cross-instance read-modify-writes of `INSTALLED_PLUGINS` serialize at the JS event loop. But the serialization guarantee is illusory: any future `await` added inside a write-lock block (e.g., a DB call in reconcile) creates a real cross-instance stale-overwrite window. Fix: hoist the queue to module scope exactly like `pluginMutationQueue` in pluginManager.ts:85.
- **NOTE | Main.tsx effect re-fetch churn.** `refreshPlugins` deps include `lastUsedPlugin?.id` and `languagesFilter` (usePlugins.ts:129-134); Main's effect deps `[isOnboarded, refreshPlugins, updateLibraryOnLaunch]` (Main.tsx:62-69) therefore re-runs and re-fetches all repos on every source-open (`setLastUsedPlugin`, InstalledTab.tsx:69) and every language-filter toggle. No loop (id re-stamp is same-string → identity stable), but a wasted fetch per action. LOW/NOTE.

### 3. src/hooks/persisted/useHistory.ts — generation guard
- **CORRECT.** clearAllHistory: bump → `await deleteAllHistory()` → `await getHistory()` (lines 39-42); getHistory bumps again (line 26). In-flight reads are invalidated *before* the mutation starts, so a stale `setHistory` can never land after a delete completes. The final getHistory runs strictly after the awaited mutation, so it reads post-mutation state. Double-mutation interleaving is also safe (only the highest generation writes; verified by trace). isLoading: `setIsLoading(true)` per getHistory; `finally` clears only when generation matches (line 37) — no stuck skeleton, no premature clear. No finding.

### 4. src/hooks/persisted/useUpdates.ts — rethrow vs swallow
- **CORRECT.** `getDetailedUpdates` rethrows after `setError` (line 52). Sole caller: UpdateNovelCard.tsx:64-73 `.then/.catch` (keeps snapshot). No other callers (grep: useUpdates.ts + UpdateNovelCard only). `getUpdates` swallows (line 79) — its callers (UpdatesScreen.tsx:129 in `.then`, useFocusEffect setTimeout) never observe a rejection; consistent.
- **LOW | no generation guard on `getUpdates`/`getDetailedUpdates`.** A slow focus-triggered overview fetch can resolve after a `deleteChapter().then(getUpdates)` refetch (UpdatesScreen.tsx:129) and overwrite `updatesOverview` with pre-delete rows — a real, if narrow, stale-async-overwrite path. Also `getUpdates` deps `[lastUpdateTime, setLastUpdateTime]` (line 81) recreate the callback when `LAST_UPDATE_TIME` changes, re-running the focus effect once (duplicate fetch, no loop). Fix: mirror useLibrary's request-id guard.

### 5. LibraryScreen.tsx + hooks/useLibrary.ts — guards
- **CORRECT.** Index clamp: `setIndex(Math.min(currentIndex, categories.length-1))` (LibraryScreen.tsx:115-118). `currentNovels` uses `categories[index]?.novelIds ?? []` (line 128). `updateCategory` action guarded: `categories[index]?.id !== 2 && categories[index] && ...` (lines 333-341). `openRandom` guards `randomNovel` (line 292). useLibrary: `loadRequestIdRef` guard on `setLibrary` (useLibrary.ts:63-78) + dedicated stale-discard test (useLibrary.test.ts:136-166).
- **NOTE** | render precedes the clamp effect: one frame where `navigationState.index` can exceed `routes.length` (TabView may warn); all consumers in that frame are optional-chained, so no crash. NOTE | Actionbar `onPress: async () => { await Promise.all(markAllChaptersRead(...)) }` (LibraryScreen.tsx:401-420) has no catch → DB rejection would be an unhandled rejection (pre-existing pattern; `removeNovelsFromLibrary` is sync, safe).

### 6. ConfirmationDialog.tsx (actual path: `src/components/ConfirmationDialog/ConfirmationDialog.tsx`, not `.../dialog/...`)
- **CORRECT.** `handleOnSubmit`: `setIsConfirming(true)` → `await onSubmit()` → `onDismiss()` only on success; catch logs via rate-limited logger (no unhandled rejection); `finally` resets `isConfirming` (lines 39-49). Dialog stays open on failure (`visible` unchanged); both buttons disabled while confirming; `onDismiss` suppressed mid-flight (line 55). This catch is what makes PluginListItem's unhandled `uninstallPlugin(item).then(...)` (PluginListItem.tsx:98-101) safe — the returned promise is awaited by the dialog. Tests exist (2, per memory 54b36d5da).

### 7. useChapter.ts — insertHistory ordering
- **CORRECT.** `insertHistory = async (id) => db.runAsync(...)` (HistoryQueries.ts:23-25) — the write is awaited inside, so `insertHistory(chapter.id).then(...)` (useChapter.ts:220-224) resolves post-insert; the subsequent `getDbChapter` reads the post-insert row. Deps `[incognitoMode, setLastRead, chapter.id, chapter, checkAutoDownload]` cover the mutation trigger.
- **NOTE** | cleanup-path read `getDbChapter(chapter.id).then(setLastRead)` (lines 227-229) vs the new chapter's insertHistory chain: safe today only because expo-sqlite serializes statements on the single connection (cleanup read executes before the new insert), so `setLastRead` order is old→new. A future parallel-connection refactor would expose this as a stale overwrite; worth a comment.

### 8. UpdateNovelCard.tsx — guards
- **CORRECT.** `navigateToNovel` guards `chapterListInfo.updatesPerDay && chapterList[0]` (lines 93-108). The `chapterList`-variant fallback `chapterListInfo` (lines 55-65) yields `updatesPerDay = chapterList?.length`, so empty list → `null` render + no navigation. `updateList` catches refresh failures (lines 63-73) — dialog/screen stays consistent.

## Explicit answers
- **(A) Stale async result overwrites newer data?** No concrete path in the audited fixes. plugin refresh/install/update: request-id guard + re-read-under-lock + atomic (no-await) write blocks make stale overwrite impossible today (only the per-instance write-queue fragility — LOW #2). useHistory: generation guard sound. useLibrary: request-id guard tested. Two residual windows: (i) `useUpdates.getUpdates` focus-fetch vs delete-refetch (LOW #4), (ii) useChapter cleanup-read ordering relies on expo-sqlite serialization (NOTE #7). `AVILABLE_PLUGINS` overwritten by partial (`complete:false`) catalog is intended-but-lossy (LOW #2d).
- **(B) Can the two queues deadlock or reorder?** No deadlock: strict plugin→write lock order; refresh never takes the plugin lock → no cycle. No harmful reorder: all INSTALLED_PLUGINS write blocks are synchronous/atomic and reconcile is merge-only (never removes installed entries), so any interleaving order is semantically safe. The plugin queue is correctly module-global; the write queue is per-instance (see LOW #2).
- **(C) Any unhandled promise rejection introduced?** One: **Main.tsx:67 `refreshPlugins();` has no `.catch`** (all other callers do: AvailableTab.tsx:181-185 `.finally().catch`, SettingsRepositoryScreen.tsx:43/73/86 try/catch or `.catch`, updatePlugin PluginListItem.tsx:113-115, install AvailableTab.tsx:104-112, uninstall via ConfirmationDialog catch). refreshPlugins can reject via `getEnabledRepositoriesFromDb` (synchronous DB read at cold start — the exact window the "hack" comment at Main.tsx:66 acknowledges) or `getMMKVObject` JSON.parse on corrupt MMKV. MED. Secondary: LibraryScreen Actionbar async onPress (NOTE #5). No other unhandled-rejection sites.

## Verified-correct summary
plugin lock lifecycle (release-on-reject/rethrow/lost-chain) ✅; refresh request-id ordering ✅; reference-identity conditional write ✅; `complete` gating ✅; live LANGUAGES_FILTER read ✅; useHistory generations ✅; ConfirmationDialog catch ✅; insertHistory await ✅; category guards ✅; UpdateNovelCard guards ✅; getDetailedUpdates sole caller catches ✅.

## Residual risks
1. Main.tsx:67 unguarded `refreshPlugins()` → unhandled rejection on cold-start DB race or corrupt MMKV (MED).
2. Per-instance write queue — cross-instance corruption if any await is ever added inside a write-lock block (LOW).
3. useUpdates missing generation guard — narrow stale overview overwrite after deleteChapter (LOW).
4. Plugin install `fetch()` without timeout — hung request pins the global plugin queue (LOW/NOTE).
5. Main.tsx refresh re-fetch on every lastUsedPlugin/languagesFilter change (NOTE).
6. No tests cover the plugin/write lock queues, useHistory generation guard, or useUpdates staleness — only refreshPlugins wiring (5), ConfirmationDialog (2), useLibrary stale-discard (+2) exist.
