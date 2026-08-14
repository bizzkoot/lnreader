All scope files read and cross-checked against implementations. Here is the deliverable.

---

# POV-4: TESTS & VALIDATION QUALITY — AUDIT FINDINGS

**Method**: Compared each new/updated test against the working-tree implementation it targets (SQL strings, helper semantics in `src/database/utils/helpers.tsx`, `color.mix` recomputation, `compareVersion.newer`, migration runner version bumps). No tests executed (read-only); "would fail on revert" is a static trace of assertion vs. implementation.

## Per-test verdicts

### 1. `ChapterQueries.selection.test.ts` (new, 240 lines) — MEANINGFUL | gap: UI wiring | severity: none (MED for gap)
- Asserts exact SQL + chunk boundaries for `getPageChapterIds`, `getChaptersByIds`, `markChaptersRead/Unread`, `updateChapterProgressByIds`, `bookmarkChapters`, `deleteChapters` (lines 55–120, 1200-id chunk tests assert 3 calls + exact `IN (...)` slices).
- Order-preservation + missing-row-skip + empty-input no-ops are real behavior (lines 95–115). MMKV delete count asserted (line ~100).
- Verified against `ChapterQueries.ts` (`chunkChapterIds`, `getPageChapterIds`, `getChaptersByIds`); assertions match `helpers.runSync` calling `db.runSync(sql, [])` (params default), so mock call-shape is correct.
- Not dead: reverting the fix (no chunking / LIMIT-free ID fetch) breaks every chunk assertion.
- GAP: `NovelScreen.selectAllChapters` wiring (getPageChapterIds + getChaptersByIds + `selectionVersionRef` race guard) has no component test.
- NOTE: SQL assertions embed cosmetic double-space (`'page = ?  AND unread = 1'`) — fragile to unrelated formatting edits.

### 2. `ChapterQueries.clearUpdates.test.ts` (new, 149 lines) — MEANINGFUL (best in batch) | gap: missing-trigger path | severity: LOW
- Mock tests assert exact statement sequence inside a single `withExclusiveTransactionAsync` incl. `DROP TRIGGER IF EXISTS` and that the final statement is the *exported* `createNovelTriggerQueryUpdate` constant (single source of truth, lines 45–85).
- Real-better-sqlite3 test (lines 90–149) proves: timestamps nulled, `lastUpdatedAt` nulled, trigger survives, and still fires on a subsequent UPDATE (`after.lastUpdatedAt === '2024-02-01'`).
- GAP: never exercises the DROP-on-missing-trigger path (trigger is always created before `clearUpdates`); error path (execAsync rejection inside tx) untested. Both low-value since behavior is identical (`IF EXISTS`/`IF NOT EXISTS`).
- Suggested fix: seed a v2/v3-style DB *without* the trigger, run `clearUpdates`, assert trigger exists and fires.

### 3. `useLibrary.test.ts` (new, 131 lines) — MEANINGFUL | gap: requestId race + no-reload-on-refetch | severity: MED
- Covers the stuck-loading fix: loading stops on success (lines 71–82), error surfaced + loading stops (83–92), recovery via `refetchLibrary` (93–110), focus-callback identity stable across rerenders (111–119, would fail if the `useCallback` wrapper reverted).
- Verified against `useLibrary.ts`: mocks match imports (`useLibrarySettings`, `useMMKVObject`, `ServiceManager.manager.STORE_KEY`); global `jest.setup.js` provides `useFocusEffect` mock.
- GAP (the exact regression symptom): no test that a refetch *after* a successful load does **not** re-show `isLoading` (the `!hasLoadedRef.current || hasErrorRef.current || searchText` gate); no test of the `loadRequestIdRef` guard (stale response clobbering). Test 1 is weak (passes pre-fix).
- Suggested fix: add "refetch after success keeps isLoading false" and "two overlapping loads — stale result is discarded".

### 4. `HistoryQueries.test.ts` (additions) — MEANINGFUL but THIN | gap: data-level tautology + UpdateOverview untested | severity: MED
- `Novel.inLibrary` added to mock rows (lines 66–82, 181–201, 413–420) and `stringContaining('Novel.inLibrary')` (lines 96–101) — this assertion fails on revert; it is the real check.
- `expect(result.every(item => item.inLibrary)).toBe(true)` is a **mock tautology**: `getHistoryFromDb` passes the mock rows through unchanged; it proves nothing about the JOIN.
- GAP: no real-SQLite verification (the clearUpdates/migration tests established that pattern and it was not reused here). **`getUpdatedOverviewFromDb`'s `Novel.inLibrary AS inLibrary` addition has NO test at all** (grep confirms). HistoryCard/HistoryScreen navigation params untested.
- Suggested fix: real-better-sqlite3 test seeding Chapter+Novel rows asserting `inLibrary` values from the JOIN; string-containment check for `getUpdatedOverviewFromDb`.

### 5. `NovelQueries.test.ts` (addition, lines 857–864) — MEANINGFUL | gap: ordering/atomicity | severity: LOW
- Asserts `db.runSync` called with exactly `'UPDATE Novel SET inLibrary = 1 WHERE id IN (1)'` + `[]`. Traced through `helpers.tsx`: single-element QueryObject → `db.runSync(sql, [])` — mock shape correct, and the assertion **fails on revert** (first query would become the `DELETE FROM NovelCategory`).
- GAP: doesn't assert the category DELETE/INSERT statements still execute after the inLibrary line (order/atomicity), nor the `categoryIds.length === 0` fallback combined with the new inLibrary query. Existing "default category" test only asserts `toHaveBeenCalled()`.
- Suggested fix: assert the full ordered query list for a 2-novel call.

### 6. `RepositoryQueries.test.ts` (additions) — MEANINGFUL (thin, mock-based) | gap: type drift masked | severity: LOW–MED
- `getEnabledRepositoriesFromDb` (SQL `WHERE enabled = 1`) and `setRepositoryEnabled` (1/0 binding) asserted.
- GAP: tests mock `enabled: true` (boolean) while SQLite returns `0`/`1` — the declared `Repository.enabled: boolean` type drifts from runtime number, and the mock hides it. Migration test correctly asserts numbers (`toBe(1)`/`toBe(0)`). All runtime consumers use truthiness so no live bug.
- GAP: `pluginManager.fetchPlugins` filtering by `getEnabledRepositoriesFromDb` is untested (no pluginManager test file exists).
- Suggested fix: one real-SQLite round-trip (create → disable → `getEnabledRepositoriesFromDb` excludes); type `enabled` as `number`/`boolean` union or normalize on read.

### 7. `005_add_repository_enabled.test.ts` (new, 101 lines) — MEANINGFUL (high) | gap: error path | severity: LOW
- Real SQLite via `createExpoLikeDb`: adds column, defaults `enabled=1`, idempotency guard, convergence with fresh `createRepositoryTableQuery`, manual-disable preserved. Traced against `migration005.migrate` (guard + ALTER) — assertions match.
- GAP: the `catch → rate-limited log → rethrow` ALTER-failure path untested; migrationRunner-level legacy-Repository (column missing) is only tested in the dedicated file, never through the runner.

### 8. `migrationRunner.upgrade-path.integration.test.ts` (updated 4→5) — MEANINGFUL (high) | gap: stale describe title | severity: LOW
- All five paths assert `user_version: 5`; julianday trigger bodies + backfill correctness verified incl. 10-novel/5000-chapter dataset. The v1-path now runs 002–005 through the runner.
- GAP: none of the runner paths exercise 005's ALTER branch (every seed uses `createRepositoryTableQuery`, which already includes `enabled`); acceptable split with the dedicated 005 test.
- NOTE: `describe('MigrationRunner upgrade paths → migration004')` (line ~170) is stale — should read "→ migration005".

### 9. `useLoadingColors.test.ts` (new, 46 lines) — MEANINGFUL | gap: hook wrapper | severity: none
- Golden values verified by manual `color.mix` recomputation for all 6 cases (strengths 0.03/0.06 and 0.05/0.06; light/dark/pure-black hex all match). Would catch strength-tweak regressions.
- GAP: `useLoadingColors` hook itself (settings wiring + useMemo deps) untested — trivial, acceptable.

### 10. `pluginSelectors.test.ts` (new, 18 tests) — MEANINGFUL (high) | gap: wiring | severity: MED (wiring) / NOTE (version edge)
- `getLastUsedPluginId` string/object/malformed cases; filter non-mutation; `reconcileInstalledPluginUpdates` reference-identity semantics and all 9 clear-unavailable branches — all traced to implementation, all would fail on revert.
- GAP: `usePlugins.refreshPlugins` wiring (fetchPlugins → reconcile → `setMMKVObject(INSTALLED_PLUGINS)` → the **fork-specific lastUsedPlugin object-sync branch** → `filterPlugins`) has zero tests — the fork deviation is exactly where untested risk sits.
- NOTE: `compareVersion` treats `'1.0'` vs `'1.0.0'` as "newer" (`equal` returns false on segment-count mismatch) — can spuriously set `hasUpdate`; pre-existing helper, untested edge that the new reconcile logic inherits.

## Cross-cutting gaps (task checklist)

| Gap | Evidence | Verdict | Severity |
|---|---|---|---|
| epub C++ changes (all image formats + cover-doc fallback chain: `isSupportedImageMediaType`, `hasProperty`, `findImageReference`, `findCoverImagePath`, 5-branch cover resolution) | `shared/Epub.cpp` (lines ~341–413, 458–482); no test files under `shared/`, no C++ harness exists; TS wrapper `importEpub` also untested | **Acceptable but notable**: non-trivial logic with zero automated coverage; no harness to add cheaply | NOTE |
| NovelScreen select-all UI untested | `NovelScreen.tsx` `selectAllChapters` (lines ~70–90) | DB layer tested, composition (filter/page args + `selectionVersionRef`) not | MED |
| refreshPlugins reconcile wiring untested | `usePlugins.ts` `refreshPlugins` (lines ~88–115) | Selector tested; wiring + lastUsedPlugin sync not | MED |
| clearUpdates missing-trigger path untested | `ChapterQueries.clearUpdates.test.ts` | Real-SQLite test always creates trigger first | LOW |
| translation key parity untested | 34 locale files touched; only `en/strings.json` gets `repositories.*` (other locales fall back via `i18n.enableFallback`); no parity test | Pre-existing gap; `StringMap` is manually synced | LOW |
| repository Switch UI untested | `RepositoryCard.tsx` (Switch + disable-confirm dialog) | No component test; no test infra for this screen | MED |
| ConfirmationDialog async-confirm untested in fork | `ConfirmationDialog.tsx` `handleOnSubmit` (loading + dismiss-after-await); upstream added `Dialog.test.tsx` coverage, fork ported none | The UI half of the freeze fix is unverified | MED |
| Backup/restore drops enabled state | `src/services/backup/utils.ts:865` restore calls `createRepository(url)` only | Feature-completeness gap (restored repos re-enabled) | NOTE |
| `Repository.enabled` number/boolean type drift | `types/index.ts` vs `005_add_repository_enabled.test.ts` (`toBe(1)`) | Mock hides drift; consumers truthiness-safe today | NOTE |
| `UpdateOverview.inLibrary` untested | `ChapterQueries.ts:635` + `useUpdates.ts` | No test for the overview query change | LOW |

**No BLOCKERs. No dead tests found** — every new/updated test's key assertion traces to the corresponding implementation change and would fail if that change were reverted. Mocks follow the established patterns (`jest.mock('@database/db')` surface for query tests; `createExpoLikeDb`/better-sqlite3 for migrations; pure-function tests mock-free).

## Prioritized missing tests worth adding

1. **MED-HIGH — `usePlugins.refreshPlugins` wiring test** (mock `fetchPlugins`): reconcile result written to INSTALLED_PLUGINS only on change; lastUsedPlugin object re-stamped when its entry changes (fork deviation); `filterPlugins` re-run; `clearUnavailableUpdates` passed on repo disable.
2. **MED — NovelScreen select-all behavioral test**: selected set equals `getPageChapterIds` × `getChaptersByIds` output for a lazy-loaded multi-page novel; stale-selection version ref (second tap before first resolves).
3. **MED — useLibrary regression pair**: refetch after success does not re-enter loading; overlapping loads discard stale result (`loadRequestIdRef`).
4. **MED — ConfirmationDialog async confirm**: dismiss deferred until `onSubmit` resolves; buttons disabled/loading while confirming; error in `onSubmit` still dismisses (current fork flow).
5. **MED — Repository enabled integration**: real better-sqlite3 — disable repo → `getEnabledRepositoriesFromDb` excludes it; `pluginManager.fetchPlugins` skips disabled repo (mocked `fetch`); RepositoryCard toggle enable-direct / disable-via-confirm.
6. **LOW-MED — History/Update overview real-SQLite test**: `inLibrary` value from the Chapter⋈Novel JOIN and from `getUpdatedOverviewFromDb`, mirroring the clearUpdates real-SQLite pattern.
7. **LOW — clearUpdates on a pre-004 schema** (no update trigger present): recreate still fires after.
8. **LOW — translation key parity**: every locale JSON contains every `StringMap` key with non-empty value (cheap, prevents silent fallback).
9. **NOTE — pluginSelectors version edge**: `'1.0'` vs `'1.0.0'`, pre-release suffixes, `'1.0.0-beta'` (currently strips to `1.0.0`).
10. **NOTE — epub**: at minimum a TS-level test of `importEpub`'s cover/static-file move flow with a mocked `NativeEpub` (accept the C++ core as untested until a harness exists).