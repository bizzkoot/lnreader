# Upstream Merge Analysis — Full Report

**Date**: 2026-08-03 · **Upstream**: `original` @ `c3260e8e0` (2026-08-01) · **Fork**: `dev` @ `40c667679` (v2.1.3) · **Merge base**: `467a97dcf` (2025-12-24)

**Method**: 170 commits classified by 4 parallel analysis agents (chronological groups of ~43), each cross-referencing `git show` diffs against fork source; key claims independently spot-verified against fork files (see verification log at the end).

---

## 1. Divergence snapshot

| Metric | Value |
|---|---|
| Commits behind `original` | 170 |
| Commits ahead (`dev` only) | 306 |
| Files changed by fork since merge base | 596 |
| Files changed upstream since merge base | 1088 |
| Files changed by BOTH (overlap surface) | 206 |
| Upstream commits already in fork (patch-id match) | 0 (nothing cherry-picked) |
| Commit types | 66 fix, 56 feat, 17 chore, 14 refactor, 5 docs, 4 perf, 2 test, 1 ci |

## 2. The three architecture walls

| Wall | Upstream | Fork | Porting consequence |
|---|---|---|---|
| **Database** | Drizzle ORM + op-sqlite (#1735) + `manager/` + `drizzle/migrations` | expo-sqlite raw SQL + custom `MigrationRunner` + `tables/*.ts` | Drizzle commits NOT-FEASIBLE; only their *intent* translates to raw SQL |
| **TTS & native modules** | Nitro modules (`nitro-tts`, `nitro-epub`), Android MediaSession, WorkManager background tasks (#1889, #1896) | Custom Kotlin (`TTSHighlightModule.kt`, `TTSForegroundService.kt`, `DoHManagerModule.kt`, `NativeFile.kt`), `ttsNotification.ts`, react-native-background-actions | All upstream TTS work is dead to the fork **by design** — fork's stack is its differentiator |
| **Build & workflow** | Expo 55 managed (#1885), rock CLI (#1812), `assets/reader/js/` layout, `scripts/generate-env-file.cjs`, config plugins | Expo 54 bare, RN community CLI + Gradle 9.2.0, `android/app/src/main/assets/js/` layout | Path-level diffs never apply; reader-JS commits must be re-diffed at function level |

**State management also diverged**: upstream moved the novel screen to a zustand store (`useNovel`); fork uses its own `useNovel.ts` hook + `NovelContext`/`ChapterContext`. Perf refactors (`9805da63`, `3d102a52`) cannot transfer as code — only their perf *rationales*.

## 3. Classification summary (all 170)

| Batch | Count | Meaning |
|---|---|---|
| **A1** | 16 | Verified Tier-1 fixes — fork carries byte-identical pre-fix code; 8 verified clean-apply (DIRECT), a few need manual re-application |
| **A2** | 6 | SQL bug fixes — copy corrected raw SQL into fork's expo-sqlite layer |
| **A3** | 7 | Extended verified bug fixes — localized manual ports |
| **B** | 7 | High-value user-facing features (2–3 days) |
| **B-stretch** | 15 | Optional medium features |
| **C** | 7 | UX/theme train (prerequisite-ordered) |
| **C-optional** | 2 | Optional M3 polish |
| **D** | 5 | Project-scale rewrites (separate PRs) |
| **D-stretch** | 1 | Scheduled library updates (needs native work) |
| **D-optional** | 10 | Lower-priority project-scale candidates |
| **SKIP** | 94 | CI/release/docs/infra/ALREADY-HAVE/architecture-incompatible |

**PORT total: 76 commits.** Full per-commit detail: `commit-manifest.csv` + `reference/subagent/*`.

## 4. Skip categories & rationale

| Category | Count | Reason |
|---|---|---|
| SKIP-CI | 19 | Fork has separate GitHub Actions; release automation (draft releases, semver bump, APK verification) is upstream-only |
| SKIP-INFRA | 13 | rock CLI, Expo 55, managed workflow, repo reorganization, `lneader` org rebranding (actively harmful — would point users at wrong repo) |
| SKIP-DRIZZLE | 9 | Migration SQL / op-sqlite APIs; fork's MigrationRunner already covers recovery + counters |
| SKIP-OTHER | 20 | No clear user value or overlaps fork-critical files (incl. **trap commit `72bfcad0`** — lint cleanup touching WebViewReader/ReaderScreen/ChapterContext, zero value, maximal conflict surface) |
| ALREADY-HAVE | 9 | Fork shipped its own equivalents, often earlier: DoH (`4d982479`), MediaSession/media notification (`cc04287`, `74808f08`, `67d2c7c0`), WebView-reset fix (`02b6b984`), metro middleware (`58db0352`), EPUB exporter (`4cb1890b`), volume buttons (`52914b97`), collapsed-TTS guard (`cbe7d70e`) |
| SKIP-RELEASE | 6 | Version bumps; fork has own v2.1.3 numbering |
| SKIP-DOCS | 5 | Docs only |
| SKIP-I18N | 4 | Crowdin syncs at `src/i18n/` — fork stores `strings/languages/` with custom keys; only per-key diffs, never overwrite |
| SKIP-DEP | 3 | `@legendapp/list` 3.3.3 patches (fork pins ^2.0.16), hermes pinning |
| SKIP-NATIVE | 5 | WorkManager/native-background-tasks/background-actions-removal commits; **`9babe167` (remove background-actions manifest customization) would break the fork — do NOT port** |
| SKIP-NITRO | 1 | op-sqlite DevTools adapter |

## 5. Key findings

1. **The fork is 4–6 weeks behind on upstream *fix* quality while ahead on TTS.** The 2026-02→08 upstream fix cluster (tracker search, genre crashes, download removal, category reorder, date sorting, NativeFile crashes) targets shared legacy code the fork still carries pre-fix — the highest risk/benefit ratio available.
2. **Raw-SQL layer is a portability advantage.** Pre-Drizzle-era upstream SQL fixes (numeric page ordering, next-chapter logic, category built-in IDs, EPUB page ordering) map ~1:1 onto fork's `db.getAllAsync` layer.
3. **`NativeFile.kt` is a shared, stable seam** — both trees carry the same TurboModule file; the most reliable direct cherry-pick surface (`34be7a12`, `45c4ea8`, `4088d59`).
4. **Translation drift** (`src/i18n/languages/` vs `strings/languages/`) makes every Crowdin commit a manual merge, not a cherry-pick.
5. **Verified live fork bugs** (spot-checked during analysis):
   - `deleteReadChaptersFromDb` passes `chapter.novelId` twice → deletes the **wrong folder**; `deleteDownloads` runs `UPDATE Chapter SET isDownloaded = 0` **without WHERE** → wipes all download flags. (Upstream `c3260e8e0` ships the corrected functions and is the fork's porting vehicle; the novelId typo itself was first corrected upstream in the Drizzle migration `b8c177bc`.)
   - `ServiceManager.setMeta` throttle computes `delay = 1000 - now - lastNotifUpdate` → negative-delay timers, no throttling. (Upstream `57b9d41b`.)
   - Default-category resolution `WHERE sort = 1` breaks after category reorder. (Upstream `ee3a4f20`.)
   - Multi-page chapter ordering compares `page` as TEXT — `'10'` sorts before `'2'` in the ASC query (`getNextChapter`); in the DESC query (`getPrevChapter`) the failure mode is `'9'` before `'10'`. (Upstream `d15cf98`, `f069320`, `52d5c99c`.)
   - Unawaited `db.runAsync` inside `withTransactionAsync` (`NovelQueries.ts:180,321`, `helpers.tsx:133-137`) → SQLITE_BUSY/concurrency risk; the `withExclusiveTransactionAsync` + `await` fix is a **pre-Drizzle** expo-sqlite change that maps 1:1 onto fork code. (Upstream `0cb9da9027` — reclassified SKIP→PORT-A2 by review 2026-08-04.)
   - `normalizeText` in core.js doesn't strip leading/trailing quotes → TTS reads them aloud. (Upstream `54fedc2f`.)

## 6. Verification log (spot-checks performed during analysis)

- `src/database/queries/ChapterQueries.ts:167-184` — download-removal bugs confirmed
- `src/services/ServiceManager.ts:152-153` — inverted throttle + negative delay confirmed
- `android/.../NativeFile/NativeFile.kt` — unlink `throw` pre-fix state confirmed
- `src/screens/Categories/CategoriesScreen.tsx:94` — index-based keyExtractor bug confirmed
- `src/screens/reader/hooks/useChapter.ts:125` — no DB progress hydration on open
- `src/screens/reader/components/WebViewReader.tsx:473+` — settings synced via injectJavaScript (upstream `02b6b984` already covered)
- `android/app/src/main/assets/js/core.js:2203` — normalizeText lacks quote-strip
- `src/database/queries/NovelQueries.ts:180,321` + `src/database/utils/helpers.tsx:133-137` — unawaited `runAsync` inside `withTransactionAsync` (concrete fix: upstream `0cb9da9027` → `withExclusiveTransactionAsync` + `await`; concept of upstream `2cd5a97` also applies)

## 8. Review corrections (2026-08-04)

Independent 4-subagent review (`REVIEW-2026-08-04.md`) confirmed the analysis's core claims and found the following corrections, all applied:

1. **`0cb9da9027` reclassified SKIP-OTHER → PORT-A2** — pre-Drizzle expo-sqlite transaction-concurrency fix (verified `db.ts` at that commit imports expo-sqlite; dated 2026-01-15, before the Drizzle migration). Fork carries the identical pre-fix pattern.
2. **5 rows relabeled DIRECT/GREEN → MANUAL(-trivial)/YELLOW** (`31cb4b99`, `93bc5e5e`, `2a919ec0`, `f1fdafd3`, `a062beee`) — their upstream patches fail `git apply --check` on fork files that were rewritten (scaled dimensions, eslint headers, `@env` config). All remain valid PORTs.
3. **`9783c4d5e3` reclassified SKIP-OTHER → PORT-A1/low** — small safe deletion in shared SettingsRepositoryScreen.tsx; group1 subagent had recommended porting it.
4. **`c3c891cea0` relabeled SKIP-CI → SKIP-INFRA** — it is a 40-file managed-workflow migration, not CI tooling.
5. Counts updated accordingly: PORT 74→**76**, SKIP 96→**94**, A1 15→**16**, A2 5→**6**, SKIP-OTHER 22→**20**, SKIP-CI 20→**19**, SKIP-INFRA 12→**13**.

## 7. Recommended execution order

See `README.md` §Suggested execution order and the per-batch PRDs in `batches/`.
