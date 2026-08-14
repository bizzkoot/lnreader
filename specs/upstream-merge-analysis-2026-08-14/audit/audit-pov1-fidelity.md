Audit complete. I have verified every commit against its upstream source and the working tree.

---

# PORT-FIDELITY AUDIT — merge/upstream-sync-2026-08-14

## Per-commit verdict table

| Fork commit | Upstream source | Intent preserved? | Deviations (intentional / bug?) | Severity |
|---|---|---|---|---|
| 4c5b45229 | 63349de1b (#1960) | YES | (a) Bulk mutations (`markChaptersRead/Unread`, `updateChapterProgressByIds`, `deleteChapters`, `bookmarkChapters`) run each chunk as a separate `execAsync` — upstream wraps all chunks in ONE `dbManager.write` transaction. Crash between chunks → partial apply. Intentional-adaptive (no drizzle tx wrapper), not load-bearing in normal use. (b) `getPageChapterIds` drops upstream's `excludedScanlators` param — fork has no scanlator filter in its raw-SQL `novelSettings.filter`; page-scoping (`page = ?`) matches upstream #1960 intent exactly. (c) Select-all race guard (`selectionVersionRef`) is inert: the fork's `setSelected` (context) never bumps the version, but the whole select-all is synchronous (`getAllSync`) so no real race exists — defensive dead code. (d) `bookmarkChapters` CASE-toggle ≡ upstream `NOT` for 0/1 (only diverges on NULL rows, which the schema's `DEFAULT 0` makes unreachable in practice). | LOW |
| 4221a7f9e | 8a12529ba (#1955) | YES | None. `clearUpdates` = drop trigger → bulk-clear → recreate, inside one `withExclusiveTransactionAsync`. **Verified** `createNovelTriggerQueryUpdate` in `src/database/tables/NovelTable.ts:52` creates `update_novel_stats_on_update` with julianday body, and is the SAME constant used by db.ts bootstrap and migration 004 (`src/database/migrations/004_recreate_novel_triggers.ts:100`). Dialog awaits async onSubmit with loading/disabled. | OK |
| 487d58faf | 1eb8c587c | YES | Uses fork's existing `libraryScreen.empty` key instead of upstream's `libraryScreen.emptyCategory` (key exists in en:426/id_ID:496; wording differs from upstream's "no categories" empty state). | NOTE |
| 895f714f6 | 15560b67b (#1977) | YES | None — `coverSource` useMemo is identical; `getPlugin().imageRequestInit` verified present in fork's pluginManager (UA injected at init, line ~71). | OK |
| 119a9b257 | 13885320a (#1945) | YES | Upstream's `if (!novelIds.length) return` guard (added in the same commit) NOT ported — `updateNovelCategories([])` would emit `WHERE id IN ()` (invalid SQL). Pre-existing exposure (old code had same pattern for the DELETE), and all callers pass non-empty arrays (NovelScreenButtonGroup `[novel.id]`; LibraryScreen only when `selectedNovelIds.length > 0`), so not a new regression. | LOW |
| 944b2b3ea | 3ac611f63(#1622) + 91358ad3d(#1946) + 197d8670f(#1948) | YES | (a) #1946 ported as a fixed allowlist (`isSupportedImageMediaType`: jpeg/jpg/png/svg/gif/webp/bmp, `shared/Epub.cpp:349`) vs upstream's open `media_type.rfind("image/",0)==0` — avif/heic/tiff/etc. excluded from `imagePaths` copy and from cover-doc resolution. Conservative narrowing, not flagged. (b) #1948 cover-document resolution chain ported verbatim (verified all 4 branches at `Epub.cpp:474-486`). (c) #1622 SVG-image-wrapper normalizer (`normalizeEpubChapter`) SKIPPED — documented deviation; consequence: spine chapters whose images are `<svg><image>` wrappers don't render images, and no `img` alt normalization. Cover documents still resolve via `findCoverImagePath` without the normalizer. | LOW (documented) |
| 6fb30f26c | 51560195b(#1964) + e0c89cdd9 | YES | Wholesale final-state port (base file was pre-e0c89cdd9). Final `useLoadingColors.ts` == upstream final (0.03/0.05/0.06 constants, mix-based, 3-tuple return). All 8 consumers destructure `[highlightColor, backgroundColor]` — no breakage. | OK |
| a8da9255d | 57eca11a9 | YES | Fork types `History.inLibrary`/`UpdateOverview.inLibrary` as `boolean` vs upstream `boolean \| null`; fork's Novel.inLibrary column is nullable (`DEFAULT 0`, no NOT NULL) so legacy NULLs would be typed incorrectly — cosmetic. Route-param `inLibrary` IS honored: useNovel seeds `novel` state from params and skips the DB re-fetch when params exist (`useNovel.ts:242-249`), so the "Add to library" button state is correct. | LOW |
| 8c49e6c05 | none (lint) | n/a | Dep array narrowed to `chapterListInfo.inLibrary`/`.updatesPerDay` property paths; all referenced values covered (verified callback body). Property-path deps are non-standard for exhaustive-deps but functionally correct. | NOTE |
| 03683bd31 | 909504a72 (#1628) | YES | (a) `getEnabledRepositoriesFromDb` lacks upstream's `.orderBy(id)` — cosmetic (AUTOINCREMENT insert order ≡ id order; dedup via `uniqBy(reverse(...))` unaffected). (b) Disable-confirm uses the fork's ConfirmationDialog (OK/Cancel) instead of upstream's `confirmFirst`+`confirmLabel` — `repositories.disable` key added to strings but unused; primary button reads "OK" not "Disable". Cosmetic. (c) `Repository.enabled` typed `boolean` but holds raw 0/1 — all usages truthy, safe. Migration 005 verified: idempotent columnExists guard, `enabled INTEGER NOT NULL DEFAULT 1`, registered in `migrations/index.ts`, converges with fresh schema, runner passes the sync SQLiteDatabase. | NOTE |
| ba2e07c63 | 3bf025108 + 3ad6e372f + f69e5d6a7 | MOSTLY — **1 bug** | **BUG**: `readerScreen.emptyChapterMessage` was updated to the `%{reportUrl}` wording in ~30 non-English locales (e.g. id_ID:673, de_DE, fr_FR…) while `src/screens/reader/utils/sanitizeChapterText.ts:41` still passes only `{pluginId, novelName, chapterName}` — no `reportUrl`. i18n-js v4 default `missingPlaceholder` substitutes `[missing "reportUrl" value]`, so the "report plugin issue" link in the empty-chapter fallback is broken in all non-English locales. en/strings.json:585 was (inconsistently) left with the old hardcoded-URL text, proving the code gap was noticed for en but not for the other locales. Also NOTE: id_ID lacks the `repositories.*` keys (mirrors upstream Weblate lag; falls back to en). `common.later`/`skipVersion` added only where fork-referenced (NewUpdateDialog:285-287) — documented and verified. | **MED** |
| 4757b3aee | none (format) | n/a | Pure prettier. | OK |
| 06852a6a8 | 909504a72 (#1628, pluginSelectors) | YES | `pluginSelectors.ts` byte-identical to upstream (verified line-by-line: `getLastUsedPluginId`, `filterInstalledPlugins`, `filterAvailablePlugins`, `reconcileInstalledPluginUpdates`). `refreshPlugins` uses reconcile, persists only when changed, and re-syncs the object-form LAST_USED_PLUGIN by id — equivalent to upstream's string-id path. `getLastUsedPluginId` exported-but-unused and FILTERED_* keys retained — both documented. | OK |
| 7883b28cd skip claim | — | **VERIFIED** | `TTSForegroundService.kt` has full audio-focus: `AudioFocusRequest` (30, 47), listener with `AUDIOFOCUS_LOSS`/`LOSS_TRANSIENT`/`GAIN` (167-179), `requestAudioFocus()` via `AudioFocusRequest.Builder` API 26+ (822-853), `abandonAudioFocus()` (870-880). Skip justified. | OK |

## BLOCKER list
None.

## MED list with fixes
1. **ba2e07c63 — broken `reportUrl` in empty-chapter message (non-English locales).**
   - Evidence: `strings/languages/id_ID/strings.json:673` (and ~30 others) contain `<a href='%{reportUrl}'>`; `src/screens/reader/utils/sanitizeChapterText.ts:41` passes no `reportUrl`; `strings/languages/en/strings.json:585` retains the old hardcoded-URL text (inconsistent).
   - Fix (pick one): (a) revert `emptyChapterMessage` in non-en locales to the old hardcoded-URL wording (matches en), or (b) pass `reportUrl: 'https://github.com/LNReader/lnreader-sources/issues/new/choose'` in `sanitizeChapterText` and (ideally) update en to the same wording. Option (b) matches upstream intent; option (a) is the minimal consistency fix.

## LOW list with fixes
1. **4c5b45229** — chunked bulk mutations not wrapped in a transaction (upstream wraps all chunks in one write tx). Fix: wrap the per-chunk loop in `db.withExclusiveTransactionAsync` in `markChaptersRead/Unread`, `updateChapterProgressByIds`, `bookmarkChapters`, `deleteChapters` (`src/database/queries/ChapterQueries.ts`).
2. **119a9b257** — missing empty-`novelIds` guard in `updateNovelCategories` (`src/database/queries/NovelQueries.ts:275`). Fix: `if (!novelIds.length) return;` at the top (upstream's exact guard).
3. **a8da9255d** — `History.inLibrary`/`UpdateOverview.inLibrary` typed `boolean` but DB column nullable (`NovelTable.ts:22` has no NOT NULL). Fix: type `boolean | null` (upstream's typing) and default `inLibrary: false` at consumption sites that already do so.
4. **944b2b3ea** — `isSupportedImageMediaType` allowlist excludes image types upstream accepts (`image/*` prefix). If avif/heic support matters, switch to `media_type.rfind("image/", 0) == 0`.

## NOTE list
- 4c5b45229: select-all race guard is dead code (sync reads) — harmless; `getPageChapterIds` drops scanlator filter (fork has none); CASE bookmark toggle equivalent.
- 487d58faf: `libraryScreen.empty` vs upstream `emptyCategory` wording.
- 03683bd31: `repositories.disable` string unused (dialog shows "OK"); `getEnabledRepositoriesFromDb` no ORDER BY; `Repository.enabled` 0/1 vs boolean.
- 8c49e6c05: property-path deps (`chapterListInfo.inLibrary`) may trip `exhaustive-deps` (would prefer the object) — functional behavior correct.
- ba2e07c63: id_ID missing `repositories.*` keys (English fallback; mirrors upstream Weblate lag).
- 06852a6a8: fork's `refreshPlugins` re-syncs LAST_USED_PLUGIN on any entry change (slightly broader than upstream's hasUpdate-only trigger) — intentional adaptation.

## Residual risks
- The `%{reportUrl}` placeholder bug is user-visible only on scrape-empty chapters, but it affects every non-English locale; severity held at MED.
- Transaction-atomicity deviations in 4c5b45229 only matter under mid-batch crash/kill.
- Type-loose `boolean` vs `boolean | null` (a8da9255d) could surface if legacy rows contain NULL `inLibrary`.
- No test or lint run was possible (read-only audit) — tests referenced in the batch (`ChapterQueries.selection.test.ts`, `clearUpdates.test.ts`, migration005 tests, useLoadingColors, pluginSelectors, useLibrary) should be executed before merge.