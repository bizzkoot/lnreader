I now have complete fork-side evidence for all 10 commits. Let me compose the final artifact.

## Review
- **Correct**: I verified the fork working tree state (dev @ d4fe64c48, upstream/master @ 990cd4f2e via loose refs), mapped every lane commit's affected files against the fork, and confirmed the parent-provided file lists (useChapterSelection.ts / useNovelScreenActions.ts / UpdateNovelChapterGroup.tsx / NovelChapterGroup.tsx all MISSING; ChapterQueries.ts, backup/utils.ts, useUpdates.ts, ConfirmationDialog.tsx, SettingsAdvancedScreen.tsx, NovelQueries.ts, LibraryQueries.ts, useLibrary.ts, db.ts, error.ts, AppErrorBoundary all HAS).
- **Note**: No shell tool is available in my subagent toolset, so I could not run `git show`/`git cat-file`/`git log`. All fork-side conclusions below are verified from working-tree reads (working tree = fork dev head per loose refs). Upstream-side claims (exact hunks) rest on the parent-provided commit metadata (titles, issue numbers, file lists) and are flagged where inference is involved. Git commands a future implementer must run are listed in the porting guidance.

---

# LANE 1 — DB Queries & Related Fixes (10 commits)

## 63349de1b fix: Select All Chapters Across Lazy-Loaded Batches (#1960)

- **Files (upstream)**: src/database/queries/ChapterQueries.ts, src/hooks/persisted/useDownload.ts, src/hooks/persisted/useNovel/store/chapterActions.ts, useNovel/store/novelStore.types.ts, useNovel/store/useChapterOperations.ts, src/screens/novel/NovelScreen.tsx, src/screens/novel/hooks/useChapterSelection.ts, src/screens/novel/hooks/useNovelScreenActions.ts
- **Fork file status**:
  - `src/database/queries/ChapterQueries.ts` — **HAS**, raw SQL (expo-sqlite), fork-diverged (has `getPageChaptersBatched`, `getNovelChapters`, fork helpers). `getNovelChapters(novelId)` (line 351) already returns **all** chapters, no limit.
  - `src/hooks/persisted/useDownload.ts` — **HAS**, fork-diverged (background-actions `ServiceManager` wrapper; upstream uses native background-task infra).
  - `src/hooks/persisted/useNovel/store/chapterActions.ts`, `novelStore.types.ts`, `useChapterOperations.ts` — **MISSING**. These are upstream zustand-store internals. Fork equivalent: `src/hooks/persisted/useNovel.ts` (single hook + `NovelContext.tsx`).
  - `src/screens/novel/NovelScreen.tsx` — **HAS**, fork-modified (uses `useNovelContext()`, `Portal`, `LegendList`). **Live bug verified**: lines 277–280 — `onPress={() => { setSelected(chapters); }}` on the `select-all` appbar action only selects currently **loaded batches** (300/batch via `getPageChaptersBatched`), exactly the bug #1960 fixes.
  - `src/screens/novel/hooks/useChapterSelection.ts` — **MISSING**. Selection state is inline in NovelScreen.tsx (`const [selected, setSelected] = useState<ChapterInfo[]>([])`, line 60).
  - `src/screens/novel/hooks/useNovelScreenActions.ts` — **MISSING** (verified: no `hooks/` dir under `src/screens/novel/`; actions are inline in NovelScreen + `useNovel`/`NovelContext`).
- **Portability**: MANUAL
- **Safety score**: 78/100 (GREEN)
- **Overlap with fork-custom code**: yes — NovelScreen.tsx (fork's selection UI, uses fork NovelContext/Portal/Actionbar) and useDownload.ts (fork background-actions wrapper). No TTS/DoH/MMKV-settings/migration overlap.
- **Porting guidance**:
  1. In `NovelScreen.tsx` select-all handler (line 277–280), replace `setSelected(chapters)` with an async call to `getNovelChapters(novel.id)` (already exists, all pages/all batches) then `setSelected(allChapters)`. Consider whether upstream filters by sort/filter/page — default is unfiltered all-chapters; verify against upstream `chapterActions.selectAllChapters`.
  2. Inspect upstream's `useDownload.ts` hunk: hypothesis (verify against diff) is chunked task enqueue — the fork's `downloadChapters` maps 1 task/chapter into the ServiceManager MMKV queue; selecting thousands of chapters then pressing download could balloon the queue. If upstream chunked it, port that pattern onto the fork's `ServiceManager.manager.addTask` (fork `useDownload.ts`).
  3. Do NOT create fork `useNovel/store/*` or `useChapterSelection.ts` — map upstream store logic 1:1 onto `useNovel.ts` + NovelScreen inline state.
  4. Add a test: mock `getPageChaptersBatched` (300-row batch) + `getNovelChapters`, assert select-all selects >300 chapters.
- **Verdict**: PORT

## 179feb56e fix: Include All Chapters Beyond the 1000-Row UI Limit (#1938)

- **Files (upstream)**: src/database/queries/ChapterQueries.ts (+ tests), src/services/backup/utils.ts (+ tests)
- **Fork file status**:
  - `ChapterQueries.ts` — **HAS**, raw SQL. `getNovelChapters` (line 351) has **no LIMIT**; `getPageChaptersBatched` (line 427) uses 300/batch purely as UI pagination (infinite scroll via LegendList), which reaches all rows. There is **no 1000-row cap anywhere** in fork chapter queries (`getDetailedUpdatesFromDb` line 578 also has no limit).
  - `src/services/backup/utils.ts` — **HAS**, heavily fork-modified (v2 schema, typed MMKV entries, `legacyMode`/`stripForkChapterFields`, restore tracker, `compatibility` import). Backs up via `getNovelChapters(novel.id)` (no limit) → all chapters already included.
  - Tests — upstream Drizzle tests not applicable; fork has its own ChapterQueries/backup test suites.
- **Portability**: SKIP-ALREADY-HAVE
- **Safety score**: 85/100 (GREEN)
- **Overlap with fork-custom code**: no (backup/utils.ts is fork-owned but untouched by this port; fork already satisfies the intent).
- **Porting guidance**: Verify with `git show 179feb56e` that the upstream change is purely removing a `.limit(1000)` from Drizzle chapter queries; if it also adds a distinct no-limit query for backup, confirm fork `getNovelChapters` (already unlimited) is used in `prepareBackupData`. If the diff contains anything else (e.g., a new count query), re-evaluate that hunk. Optionally add a fork regression test: seed >1000 chapters, assert backup JSON contains all.
- **Verdict**: SKIP

## 675f19ef9 fix: Make Update Chapters Reactive and Remove Display Limit (#1953)

- **Files (upstream)**: src/database/queries/ChapterQueries.ts, src/hooks/persisted/useUpdates.ts, src/screens/updates/components/UpdateNovelChapterGroup.tsx
- **Fork file status**:
  - `ChapterQueries.ts` — **HAS**. `getUpdatedOverviewFromDb` and `getDetailedUpdatesFromDb` (line 578) have **no LIMIT** → the "remove display limit" half is already satisfied.
  - `src/hooks/persisted/useUpdates.ts` — **HAS**, fork-diverged (has `useLastUpdate`, MMKV `LAST_UPDATE_TIME`, focus refresh; see 23f9b183b).
  - `src/screens/updates/components/UpdateNovelChapterGroup.tsx` — **MISSING**. Fork equivalent: `UpdateNovelCard.tsx` (single component handling both 1-chapter and N-chapter accordion cases; loads chapterList on mount + accordion press via `updateList()`/`getDetailedUpdates`).
- **Portability**: SKIP-ALREADY-HAVE (limit half); the "reactive" half, if it is more than mount-time loading, is PARTIAL/manual against `UpdateNovelCard.tsx`.
- **Safety score**: 80/100 (GREEN)
- **Overlap with fork-custom code**: no TTS/DoH overlap. `useUpdates.ts`/`UpdateNovelCard.tsx` are fork-owned (scaled styles, UpdateContext).
- **Porting guidance**: Run `git show 675f19ef9` to see what "reactive" means precisely. If it re-fetches the chapter list when `updatesOverview`/download state changes, port that onto `UpdateNovelCard.tsx`'s `updateList` effect deps (currently `[chapterListInfo.novelId, getDetailedUpdates, onlyDownloadedChapters]`). Do not create `UpdateNovelChapterGroup.tsx`.
- **Verdict**: SKIP (re-check diff for the "reactive" hunk before closing)

## 8a12529ba fix: Prevent Update Clearing From Freezing App (#1955)

- **Files (upstream)**: src/components/ConfirmationDialog/ConfirmationDialog.tsx, ChapterQueries.ts, src/screens/settings/SettingsAdvancedScreen.tsx
- **Fork file status**:
  - `ConfirmationDialog.tsx` — **HAS**, fork-customized (Batch C-7 Menu modernization + `useAppSettings`/`scaleDimension`/`AppText`; `handleOnSubmit` calls `onSubmit(); onDismiss();` synchronously). Upstream hunk will not apply cleanly.
  - `ChapterQueries.ts` — **HAS**. **Identical risk verified**: `clearUpdates` (line 267) = `db.execAsync('UPDATE Chapter SET updatedTime = NULL')` — full-table UPDATE on the JS thread; same freeze the upstream fix addresses.
  - `SettingsAdvancedScreen.tsx` — **HAS** and **contains the fork DoH section** (`List.Section` "DNS over HTTPS" + DoH provider modal + restart dialog, lines ~150–165 and ~330+). **Overlap confirmed.**
- **Portability**: MANUAL (all three files diverge; SettingsAdvancedScreen must preserve DoH)
- **Safety score**: 55/100 (YELLOW)
- **Overlap with fork-custom code**: **yes** — SettingsAdvancedScreen.tsx (DoH provider picker/restart flow + `DoHManager` imports). ChapterQueries.ts is fork raw-SQL (not TTS-related). ConfirmationDialog is fork-C-7-customized.
- **Porting guidance**:
  1. `git show 8a12529ba` to extract the exact mechanism (likely: async `onSubmit` with busy state in ConfirmationDialog, and/or moving `clearUpdates` off the JS thread, and/or chunked UPDATE).
  2. Port the ConfirmationDialog async-submit hunk manually onto the fork dialog: add `loading` prop, await `onSubmit` before `onDismiss()`, keep `scaleDimension` styles intact.
  3. Port the ChapterQueries fix onto raw SQL: e.g., chunked `UPDATE Chapter SET updatedTime = NULL WHERE id IN (SELECT id FROM Chapter WHERE updatedTime IS NOT NULL LIMIT ?)` loop inside `withExclusiveTransactionAsync`, or delegate to `ServiceManager.manager.addTask` (fork's background-actions) — prefer whichever upstream did; fork has both options.
  4. In `SettingsAdvancedScreen.tsx`, update only the clear-updates submit handler (`onSubmit={() => { clearUpdates(); ... }}`); do NOT touch the DoH block, imports, or dialogs. Diff should touch a handful of lines.
  5. Add a test asserting `clearUpdates` is batched/async (fork DB test style with better-sqlite3/ExpoLikeDb).
- **Verdict**: PORT-with-care

## 23f9b183b fix: Refresh Updates Screen on Focus (#1956)

- **Files (upstream)**: src/hooks/persisted/useUpdates.ts, src/screens/updates/UpdatesScreen.tsx
- **Fork file status**:
  - `useUpdates.ts` — **HAS**, and **already refreshes on focus**: `useFocusEffect` (lines ~64–72) runs `getUpdates()` on a `setTimeout(0)`.
  - `UpdatesScreen.tsx` — **HAS**, fork-modified (uses `useUpdateContext()`, scaled styles, `tabPress`→TaskQueue listener).
- **Portability**: SKIP-ALREADY-HAVE
- **Safety score**: 85/100 (GREEN)
- **Overlap with fork-custom code**: no (no TTS/DoH/migrations).
- **Porting guidance**: Verify via `git show 23f9b183b` whether upstream binds the refresh to the UpdatesScreen route focus rather than a provider-level `useFocusEffect`. Fork caveat: `useUpdates` is called inside `UpdateContextProvider` (mounted in `navigators/Main.tsx` wrapping the tab navigator), so its `useFocusEffect` binds to the parent stack's focus, not the Updates tab focus. If the upstream diff adds screen-level focus wiring and that behavior gap matters (e.g., updates stale after returning from a chapter read without leaving the tab), add a `useFocusEffect` inside `UpdatesScreen.tsx` calling `getUpdates()`. Low priority otherwise.
- **Verdict**: SKIP

## 57eca11a9 fix: Pass Library Status Through Novel Navigation

- **Files (upstream)**: ChapterQueries.ts, HistoryQueries.ts, database/types, HistoryScreen, HistoryCard, NovelChapterGroup (MISSING in fork), UpdateNovelChapterGroup (MISSING in fork)
- **Fork file status**:
  - `ChapterQueries.ts` — **HAS** (raw SQL; no isLocal/inLibrary in any SELECT).
  - `HistoryQueries.ts` — **HAS**; `getHistoryFromDb` selects `Chapter.*, Novel.pluginId, Novel.name/path/cover/id` — **lacks `Novel.isLocal` and `Novel.inLibrary`**.
  - `database/types/index.ts` — **HAS**; `History` interface has no `isLocal`/`inLibrary`.
  - `HistoryScreen.tsx` — **HAS**; tabPress → Novel params `{name, path, cover, pluginId}` — no `isLocal`.
  - `HistoryCard.tsx` — **HAS**; both Novel navigations omit `isLocal`.
  - `NovelChapterGroup.tsx`, `UpdateNovelChapterGroup.tsx` — **MISSING** (fork uses `NovelScreenList`/`ChapterItem` and `UpdateNovelCard.tsx`).
  - `src/navigators/types/index.ts` — fork Novel route **already accepts `isLocal?: boolean`** (line 103); `NovelScreen.tsx` already reads `route.params?.isLocal` (line ~330 `isLocal={novel?.isLocal ?? route.params?.isLocal}`). So the plumbing half-exists.
- **Portability**: PARTIAL (3 files portable manually: HistoryQueries.ts, types, HistoryCard/HistoryScreen; 2 upstream files map to different fork files)
- **Safety score**: 65/100 (YELLOW)
- **Overlap with fork-custom code**: no (no TTS/DoH/migrations/settings; touches History UI which is fork-scaled).
- **Porting guidance**:
  1. `git show 57eca11a9` — extract the exact upstream ChapterQueries hunk (may add library-status columns to a history/update query) and confirm intent.
  2. HistoryQueries.ts: add `Novel.isLocal, Novel.inLibrary` to the SELECT; add optional `isLocal?: boolean; inLibrary?: boolean` to `History` in `database/types/index.ts`.
  3. HistoryCard.tsx + HistoryScreen.tsx tabPress: pass `isLocal: history.isLocal` (and `inLibrary` if the Novel route/`useNovel` can consume it) in the Novel route params.
  4. Map the UpdateNovelChapterGroup hunk onto `UpdateNovelCard.tsx`'s `navigateToNovel` (pass `isLocal`).
  5. ChapterItem's `navigateToChapter` passes a `NovelInfo` — if upstream also passes status into Chapter route, mirror it there.
  6. Add/extend HistoryQueries tests asserting the new columns are selected.
- **Verdict**: PORT-with-care

## 13885320a fix: Add Novels To Library When Setting Categories (#1945)

- **Files (upstream)**: src/database/queries/NovelQueries.ts, NovelScreenButtonGroup.tsx, tests
- **Fork file status**:
  - `NovelQueries.ts` — **HAS**, fork-modified for transaction safety (`runAsync`/`runSync` helpers, `withExclusiveTransactionAsync` discipline from Batch A). `updateNovelCategories` (line 275) only rewrites `NovelCategory` rows — **does NOT set `Novel.inLibrary = 1`**.
  - `src/screens/novel/components/NovelScreenButtonGroup/NovelScreenButtonGroup.tsx` — **HAS**, fork-modified (memo `Button`, `useScaledDimensions`, `scaleDimension`, `AppText`). Bug surface verified: long-press on the follow button opens `SetCategoryModal` with `novelIds={[novel.id]}` regardless of `inLibrary` → a non-library novel can get categories without entering the library (inconsistent state), matching #1945.
  - Tests — fork has `NovelQueries` tests (upstream tests not applicable verbatim).
- **Portability**: MANUAL
- **Safety score**: 72/100 (GREEN)
- **Overlap with fork-custom code**: yes — NovelQueries.ts is fork-modified for transaction safety (Batch A `fa5e10b76` fixed `db.runAsync`-inside-tx there); any edit must keep statements on the `tx`/`runSync` objects. No TTS/DoH overlap.
- **Porting guidance**:
  1. `git show 13885320a` — confirm upstream mechanism (likely `switchNovelToLibraryQuery`-style inLibrary flip when categories are set, or a guard in the button group).
  2. Prefer the NovelQueries.ts route: inside `updateNovelCategories` (or a wrapper invoked by SetCategoriesModal OK), add `UPDATE Novel SET inLibrary = 1 WHERE id IN (...)` for the target novelIds — but note fork's `switchNovelToLibraryQuery` also inserts the default-category row + toasts; choose the minimal correct behavior that matches upstream and doesn't double-insert the default category.
  3. Alternatively/also guard in NovelScreenButtonGroup: only expose SetCategoryModal long-press when `inLibrary`, or first call `switchNovelToLibrary`. Verify against upstream's chosen surface (it touched NovelScreenButtonGroup.tsx).
  4. Keep fork's transaction-safety pattern: batch the new statement into the existing `queries: QueryObject[]` and execute via `runSync(queries)`.
  5. Add a NovelQueries test: set categories for a non-library novel → assert `inLibrary = 1`.
- **Verdict**: PORT

## b9d1abcf2 fix: Refresh Library Download Counts After Deletion

- **Files (upstream)**: src/database/queries/LibraryQueries.ts, src/screens/library/hooks/useLibrary.ts, tests
- **Fork file status**:
  - `LibraryQueries.ts` — **HAS**; no computed download-count query — the fork's counts come from the `Novel.chaptersDownloaded` column maintained by **SQL triggers** (`NovelTable.ts`: insert/update-of-`isDownloaded`/delete triggers recompute `chaptersDownloaded`/`chaptersUnread`/`totalChapters`). DB counts cannot go stale.
  - `src/screens/library/hooks/useLibrary.ts` — **HAS**, fork-modified; already refetches on focus (`useFocusEffect(() => getLibrary())`, line ~106) and on restore-task completion (restoreTasksCount watcher, lines ~125–137). `LibraryScreen.tsx` also calls `refetchLibrary()` after every bulk action (lines 459/484/496/504).
- **Portability**: SKIP-ALREADY-HAVE
- **Safety score**: 85/100 (GREEN)
- **Overlap with fork-custom code**: no (trigger design predates and supersedes the fix).
- **Porting guidance**: Run `git show b9d1abcf2` to confirm upstream's change is a UI re-query after `deleteDownloads`/`deleteReadChapters`. In the fork, deletions fire the `update_novel_stats_on_update` trigger (Batch D migration 004 verified), and library re-queries on focus — so behavior is equivalent. Only if the upstream diff reveals a missing refetch in the fork's DownloadsScreen→Library round-trip should a small `refetchLibrary`/focus hook be added. Optionally add a trigger test asserting `chaptersDownloaded` decrements after a bulk delete (004 test file already covers trigger firing on `isDownloaded` updates).
- **Verdict**: SKIP

## 586e08514 fix: Resolve Migration Crash (#1967)

- **Files (upstream)**: src/database/db.ts, src/utils/error.ts, AppErrorBoundary, tests
- **Fork file status**:
  - `src/database/db.ts` — **HAS**, fork raw expo-sqlite + custom `MigrationRunner` (`src/database/utils/migrationRunner.ts`), `initializeDatabase()` with PRAGMA try/catch and `user_version` guard. Upstream db.ts is Drizzle — **not portable**. But the *crash-resilience concept* is already present: `MigrationRunner.runMigrations` wraps each migration in `db.withTransactionSync` with try/catch, logs via rate-limited logger, and shows a toast before rethrowing; `initializeDatabase` guards PRAGMA failures.
  - `src/utils/error.ts` — **HAS** and is already a rich fork module (`AppError`, `NetworkError`/`StorageError`/`TTS_ERROR`, `safeAsync`, `handleOperationError`, `getErrorMessage`, `createErrorGuard`, `ignoreError`). Fork db.ts already imports `getErrorMessage`.
  - `AppErrorBoundary.tsx` — **HAS**; fork already hardened it (themed `ErrorFallback`, `ThemeProvider` moved above boundary, dbError path wrapped — quick-fix batch item 4, committed 2026-08-05). 
  - Tests — fork has migration-runner + upgrade-path test suites (004/upgrade-path) covering runner failure behavior.
- **Portability**: SKIP-ARCH (db.ts) + SKIP-ALREADY-HAVE (error.ts / AppErrorBoundary)
- **Safety score**: 90/100 (GREEN)
- **Overlap with fork-custom code**: yes in the "protected" sense — db.ts/MigrationRunner is fork-custom; the port should NOT touch it unless the upstream diff reveals a specific new crash mode the fork's runner still has (e.g., a specific PRAGMA ordering). Nothing to change.
- **Porting guidance**: Review `git show 586e08514` for the *specific* crash (likely Drizzle `db.transact` on a migration error). Map any new guard onto `MigrationRunner`/`initializeDatabase` only if it is not already covered (it appears covered: PRAGMA try/catch, per-migration tx + catch + toast, version guard). No action expected.
- **Verdict**: SKIP

## a727c229c fix: Optimize Novel Counter Migration

- **Files (upstream)**: drizzle/20260727081855_calm_chimera/migration.sql, db.test.ts
- **Fork file status**: drizzle/ dir **MISSING** (fork: `src/database/migrations/002_add_novel_counters.ts` + `004_recreate_novel_triggers.ts`).
- **Portability**: SKIP-ARCH (Drizzle SQL not applicable); **concept applies** to fork's `002`.
- **Safety score**: 90/100 (GREEN)
- **Overlap with fork-custom code**: yes — fork migrations are fork-custom (MigrationRunner + column-guard patterns). No TTS/DoH overlap.
- **Porting guidance** (optional, low value): fork `002` runs **5 separate full-table UPDATEs** to backfill `chaptersDownloaded/chaptersUnread/totalChapters/lastReadAt/lastUpdatedAt`. Optimization concept: combine into a single `UPDATE Novel SET ... (scalar subqueries) ...` (mirror the trigger bodies in `NovelTable.ts`). This is one-time (fresh installs only; existing installs already ran 002) — low priority. `004` already consolidated trigger definitions; if a follow-up migration (005) were ever needed it could also fold in the combined backfill. No action required now.
- **Verdict**: SKIP (concept note for future migration work)

---

## Summary table

| hash | title | portability | score | verdict |
|---|---|---|---|---|
| 63349de1b | Select All Chapters Across Lazy-Loaded Batches (#1960) | MANUAL | 78/100 GREEN | PORT |
| 179feb56e | Include All Chapters Beyond the 1000-Row UI Limit (#1938) | SKIP-ALREADY-HAVE | 85/100 GREEN | SKIP |
| 675f19ef9 | Make Update Chapters Reactive and Remove Display Limit (#1953) | SKIP-ALREADY-HAVE | 80/100 GREEN | SKIP (verify diff) |
| 8a12529ba | Prevent Update Clearing From Freezing App (#1955) | MANUAL | 55/100 YELLOW | PORT-with-care |
| 23f9b183b | Refresh Updates Screen on Focus (#1956) | SKIP-ALREADY-HAVE | 85/100 GREEN | SKIP |
| 57eca11a9 | Pass Library Status Through Novel Navigation | PARTIAL | 65/100 YELLOW | PORT-with-care |
| 13885320a | Add Novels To Library When Setting Categories (#1945) | MANUAL | 72/100 GREEN | PORT |
| b9d1abcf2 | Refresh Library Download Counts After Deletion | SKIP-ALREADY-HAVE | 85/100 GREEN | SKIP |
| 586e08514 | Resolve Migration Crash (#1967) | SKIP-ARCH + ALREADY-HAVE | 90/100 GREEN | SKIP |
| a727c229c | Optimize Novel Counter Migration | SKIP-ARCH | 90/100 GREEN | SKIP (concept noted) |

**Cross-cutting notes for the orchestrator:**
- 4 of 10 commits are worth porting (2 clean-ish manual ports + 2 with-care), 6 are SKIP with fork-side justification.
- The two highest-value ports: **63349de1b** (verified live bug at NovelScreen.tsx:277–280) and **8a12529ba** (verified live freeze risk at ChapterQueries.ts:267).
- **8a12529ba is the only commit in this lane with fork-custom DoH overlap** (SettingsAdvancedScreen.tsx) — apply its hunks surgically around the DoH block.
- No lane commit touches the TTS pipeline (WebViewReader/htmlParagraphExtractor/useTTSController/TTSState/novelTtsSettings), DoH native (DoHManagerModule.kt), UI scaling, MMKV settings schema, or the novel store (useNovel.ts) in a breaking way. NovelQueries.ts (13885320a) must preserve the Batch A transaction-safety discipline (`tx`-object statements).