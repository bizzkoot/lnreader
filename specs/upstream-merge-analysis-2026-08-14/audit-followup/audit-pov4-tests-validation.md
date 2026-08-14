# Follow-up Audit POV-4: Tests & Validation

**Date**: 2026-08-15 · **Range**: f0e3b4767..HEAD (fix commits) · **Reviewer**: fresh-context subagent (read-only)

I have completed my static review. All evidence gathered. Let me compile the final artifact.

---

# POV-4: TESTS & VALIDATION — AUDIT FINDINGS (range f0e3b4767..HEAD = bc68fbbb8, 54b36d5da, 02f0127de[docs], ae7f8d60f[amend of f70bd92f0])

**Constraint note:** This reviewer has no shell/exec tool (read/grep/find/ls only). Gates were **not executable here** — exact commands are listed for the parent to run. All code/test/locale claims below were verified statically against the working tree (HEAD = ae7f8d60f, confirmed via `.git/logs/HEAD`).

## Per-finding

SEVERITY | FINDING | evidence

- **NOTE | Gates NOT runnable by reviewer (no shell tool)** | type-check/lint/format/jest all require `pnpm` exec. Recorded claims in `.agents/upstream-merge-memory.md` (2026-08-15 entry): type-check ✅, lint 0 errors (7 pre-existing warnings) ✅, format ✅, 94 suites/1496 tests (3 pre-existing network fails), TTS wake-cycle ✅ refill ✅, native C++ debug build ✅. These match the post-54b36d5da state, i.e. **pre-hardening** (see next finding).
- **LOW | Claimed full-suite count appears stale vs HEAD** | Memory records "usePlugins.refreshPlugins wiring (5)" → working tree `src/hooks/persisted/__tests__/usePlugins.refreshPlugins.test.ts` has **6** tests; the 6th ("does not clear badges when repository refresh is incomplete", L171) pairs with the `complete` flag in `pluginManager.ts` `FetchPluginsResult` (`fetchPlugins` L93–143, gated in `usePlugins.ts` L95 `clearUnavailableUpdates && fetched.complete`) — i.e., added by the harden commit → current count ≥1497, not 1496. Also "backup 2 suites/27 tests": static count is **34** (backupSchema 21 + BackupPruning 13). Claimed numbers need re-confirmation.
- **MED | `pluginManager.withPluginMutationLock` serialization — NO test** | `pluginManager.ts:87-100` (`pluginMutationQueue` chaining). Only an identity mock (`withPluginMutationLock: jest.fn(op => op())`) at `usePlugins.refreshPlugins.test.ts:48`; no pluginManager test file exists. Concurrent install/uninstall/update serialization is the exact race the queue exists to fix — untested.
- **MED | `useHistory` generation guard — NO test** | `useHistory.ts:21-49` `requestGenerationRef` (stale-response discard + error/finally gating). Zero test files reference useHistory.
- **MED | `useUpdates` error handling — NO test** | `useUpdates.ts` `getDetailedUpdates` (catch → `setError` + rethrow, L42–46) and `getUpdates` (catch → `setError`, L58–65). Only a `jest.mock('@hooks/persisted/useUpdates')` in `services/updates/__tests__/index.test.ts:27`.
- **MED-HIGH | `ChapterQueries.insertChapters` changes-based upsert — NO direct test** | `ChapterQueries.ts:30-72` (INSERT…WHERE NOT EXISTS, then changes===0 → guarded UPDATE with `(page IS NOT ? OR position IS NOT ? OR …)`). `NovelQueries.test.ts` mocks `insertChapters` as `jest.fn()` entirely; no ChapterQueries suite exercises the upsert branch.
- **LOW | migrations 002/003 tableExists/throw — partial coverage only** | Integration test (`migrationRunner.upgrade-path.integration.test.ts`) covers empty-DB skip (user_version=0 → 002/003 no-op, 004 throws) and v1 addColumn+backfill. **002's `allColumnsExist` throw path and 003's `tableExists` no-op are never asserted directly.** The 003 unit test is the weakest in the range: uses `new Function` over regex-extracted source text (brittle), and "should handle multiple column additions" tests a **self-defined inline migration**, not `migration003`.
- **LOW | `RepositoryQueries.normalizeRepository` never exercised with numeric 0/1** | `RepositoryQueries.ts:4-6`; tests mock `enabled: true/false` booleans (never `0`/`1`), so `Number(repository.enabled) !== 0` normalization + the `Repository.enabled: boolean` type drift are hidden by mocks.
- **MED | `services/epub/import.ts` asset collision/rewrite — NO test** | `createAssetNameMap` (`-2/-3` collision suffixing, normalizePath, basename), `rewriteAssetReferences` (css `url()` rewrite, `#?` suffix stripping, scheme skip), chapter `href/src=` rewrite — zero coverage (grep confirms no import.ts test).
- **MED | `LibraryUpdateQueries` changes — NO direct test** | `updateNovelChapters` `chapterNumber` in INSERT + guarded UPDATE (L74–100), `updateNovelMetadata` now `await downloadFile` (L28). `services/updates/__tests__/index.test.ts` mocks the module wholesale.
- **MED | `NovelScreen.selectAllChapters` try/catch + `selectionVersionRef` — no component test** | `NovelScreen.tsx:73-91`; `ChapterQueries.selection.test.ts` covers only the DB layer (getPageChapterIds/getChaptersByIds chunking), not the UI wiring (filter/page args, race guard, toast on error).
- **NOTE | Epub.cpp — no automated coverage (device-test risk)** | `shared/Epub.cpp:372-437` (`isSupportedImageMediaType`, `hasProperty`, `findImageReference` bare-`#` skip verified present, `findCoverImagePath`); no C++ test harness exists; requires device-level validation.
- **NOTE | ConfirmationDialog test path differs from claimed** | Claimed `src/components/dialog/ConfirmationDialog/__tests__/…` does not exist; actual `src/components/__tests__/ConfirmationDialog.test.tsx`. Content is genuine (see TEST-QUALITY).
- **LOW | `getEnabledRepositoriesFromDb` test asserts SQL string + mocked passthrough, not real filtering** | `RepositoryQueries.test.ts` returns both enabled+disabled rows via mock; only the SQL string `WHERE enabled = 1` is asserted. No real-SQLite disable→exclude round trip (unlike 005 migration test).
- **NOTE | `useLoadingColors` consolidation is NOT a scaling-surface change** | `utils/useLoadingColors.ts` (new) + 10 consumers; `components/Skeleton/useLoadingColors.tsx` deleted; `scaling.ts`/`useScaledDimensions.ts` untouched per audit-pov2 fingerprint check and current tree.

## Task 2 — New/updated tests: genuine vs tautological

- **usePlugins.refreshPlugins.test.ts (6 tests) — GENUINE.** Conditional INSTALLED_PLUGINS write (reference identity), hasUpdate write, last-used re-stamp, clearUnavailableUpdates semantics incl. `complete:false` guard and default-false. All would fail on revert of the corresponding guard (verified against `usePlugins.ts` L69–123). Weaknesses: withPluginMutationLock/useMMKVObject mocked generically; no concurrent-refresh stale-request test (refreshRequestIdRef).
- **ConfirmationDialog.test.tsx (2 tests) — GENUINE.** Deferred dismiss (dismiss only after await) + rejection-keeps-open with re-interactive button (would fail if `handleOnSubmit` reverted to fire-and-dismiss).
- **useLibrary.test.ts (6 tests) — GENUINE.** Refetch-after-success hides loading (fails without the `!hasLoadedRef.current || hasErrorRef.current || searchText` gate) and stale request-id discard (fails without `loadRequestIdRef` guard). Verified against `useLibrary.ts`.
- **ChapterQueries.range.test.ts (6) / selection.test.ts (12) — GENUINE but SQL-string-fragile.** Exact LIMIT/OFFSET math and 500-chunk boundaries; fail on revert to position-window/no-chunking. Embedded cosmetic double-space (`'page = ?  AND unread = 1'`) is brittle to formatting edits.
- **ChapterQueries.tts.test.ts (6) — GENUINE mock SQL assertions** (pre-range TTS-query coverage; reviewed, not new).
- **003_add_tts_state.test.ts (11) — WEAK/partly TAUTOLOGICAL.** `new Function` source-extraction tests; multi-column test exercises a self-defined migration, not the real one; only the ALTER-throw propagation test is meaningful.
- **backupSchema.test.ts (21) — GENUINE for the falsy-preservation fix.** `backupMMKVData()` asserts `false`/`0`/`''` survive (would fail on `if (value)` style guard revert; impl at `utils.ts:385-401` uses `=== undefined`).

## Task 3 — COVERAGE GAPS (fixes with NO direct test)

1. pluginManager `withPluginMutationLock` serialization (MED)
2. useHistory generation guard (MED)
3. useUpdates error handling (MED)
4. ChapterQueries `insertChapters` changes-based upsert (MED-HIGH)
5. migrations 002/003 tableExists/throw — partial (LOW)
6. RepositoryQueries `normalizeRepository` numeric normalization (LOW)
7. import.ts asset collision/rewrite (MED)
8. LibraryUpdateQueries chapterNumber UPDATE + await downloadFile (MED)
9. NovelScreen select-all try/catch/race (MED)
10. Epub.cpp (NOTE — device-test risk; no harness)

## Task 4 — LOCALE PARITY: **PASS** (static)

- `repositories.disable/disableTitle/disableWarning/toggle`: present in **all 35** locale files under `strings/languages/` (grep counts: disable 35, disableTitle 35, disableWarning 35, toggle 35).
- `common.later` (35), `common.skipVersion` (35).
- `emptyChapterMessage` contains `%{reportUrl}` in **all 35** files (34 non-en + en), binding fixed (en wording updated separately).
- `strings/types/index.ts` carries all key families (L220–229, L270, L275).

## Task 5 — Protected surfaces: **CLEAN** (static reconstruction)

Reconstructed changed-file union for f0e3b4767..HEAD (memory `.agents/upstream-merge-memory.md` 2026-08-15 + audit docs + static verification of each harden-commit file): `strings/languages/*`, `ConfirmationDialog.tsx`, `utils/useLoadingColors.ts` (+test, `components/Skeleton/useLoadingColors.tsx` deleted), `NovelQueries.ts`, `ChapterQueries.ts`, `RepositoryQueries.ts`, `services/updates/LibraryUpdateQueries.ts`, `migrations/002/003/index.ts`, `hooks/persisted/{useHistory,usePlugins,useUpdates,pluginSelectors}.ts`, `plugins/pluginManager.ts`, `NovelScreen.tsx`, `NovelScreenList.tsx`, `SettingsRepositoryScreen.tsx`, `services/epub/import.ts`, `shared/Epub.cpp`, plus the 3 new/updated test files. **None** are TTS-pipeline (htmlParagraphExtractor/useTTSController/useTTSUtilities/ttsBridge/TTSAudioManager/TTSState/novelTtsSettings/WebViewReader/core.js/`*.kt`), DoH (SettingsAdvancedScreen DoH paths/DoHManagerModule.kt), scaling (scaling.ts/useScaledDimensions.ts), or per-novel TTS settings (useSettings.ts tts*/AccessibilityTab/ReaderTTSTab/TtsTextCleanupModal) surfaces. Caveat: per-commit attribution for ae7f8d60f is reconstructed, not `git diff`-verified.

---

## GATES-PASSED (actual)
**NOT-RUN** (no shell tool). Parent must execute:
```
cd /Users/muhammadfaiz/CustomAPP/LNreader
git diff --check f0e3b4767 HEAD
pnpm run type-check
pnpm run lint
pnpm run format:check
pnpm run test -- --testPathPattern="backup|usePlugins|ConfirmationDialog|useLibrary|ChapterQueries|migration|LibraryUpdate"
pnpm run test            # full suite (optional; recorded claim 94 suites/1496 tests)
cd android && ./gradlew :app:compileDebugCpp  # native C++ debug build
```
Note: `--testPathPattern="LibraryUpdate"` matches **no** suite (test path is `services/updates/__tests__/index.test.ts`); the pattern as given covers ~15 suites via backup/usePlugins/ConfirmationDialog/useLibrary/ChapterQueries/migration.

## TEST-QUALITY verdict
New tests in 54b36d5da (refreshPlugins wiring, ConfirmationDialog, useLibrary) are **genuine regression tests that fail on revert**; ChapterQueries range/selection are genuine but SQL-string-brittle; backupSchema falsy test is genuine; the **003 migration test is weak/partly tautological**. No dead tests found. The batch's highest-risk untested area is the harden commit's serialization/upsert/error-handling logic (gaps 1–4, 7–9).

## COVERAGE-GAPS
As listed in Task 3 (10 items).

## LOCALE-PARITY verdict
**PASS** — all new keys present in all 35 locale files; `%{reportUrl}` bound everywhere.

## residual-risks
- Gates unverified (reviewer had no shell); claimed counts (94/1496, backup 27) are stale/inexact vs static working-tree counts (≥1497; backup 34).
- Harden commit (ae7f8d60f) diff could not be git-extracted; file list reconstructed from docs + working-tree inspection.
- 10 fixes carry no direct test (gaps above); Epub.cpp needs device-level validation.
- No BLOCKERs found; no edits applied (review-only).
