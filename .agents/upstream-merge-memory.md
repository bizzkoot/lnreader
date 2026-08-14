---
applyTo: '**'
---

# Fork Metadata

- Original Repo: https://github.com/lnreader/lnreader
- Fork Repo: https://github.com/bizzkoot/lnreader
- Last Sync Date: 2026-08-05
- Last Sync Commit: c3260e8e0 (upstream/master @ 2026-08-01) — analyzed 2026-08-03; batches A (29 fixes), B (7 features), C (7 theme/UX items) ported 2026-08-04/05
- Divergence: full merge infeasible (3 architecture walls: Drizzle/op-sqlite, Nitro/WorkManager, Expo-managed) → selective cherry-pick / manual port strategy

# Custom Modifications Registry

## Modified Files

- android/app/build.gradle (Version Code)
- android/app/src/main/assets/js/core.js (Advanced TTS)
- android/app/src/main/assets/js/index.js (Advanced TTS)
- package.json (Version 2.0.6)
- src/database/queries/NovelQueries.ts (Transaction Safety)
- src/hooks/persisted/useSettings.ts (Extended Settings)
- src/screens/reader/components/ReaderBottomSheet/ReaderBottomSheet.tsx (Custom TTS Tab)
- src/screens/reader/components/WebViewReader.tsx (Advanced TTS & Background Playback)
- src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx (Advanced TTS Settings)

## Added Features

- TTS Live Update Integration
- Custom TTS handling in WebViewReader
- Background TTS Playback
- Screen Wake Sync
- Batch A: 29 upstream safety fixes (DB/download/native-file/reader) — see Batch A history entry
- Batch B: Kitsu tracker, parallel library updates, first-unread FAB, jump-to-chapter, EPUB chapter numbers, skip-version updates, download cooldown — see Batch B history entry
- Batch C: context ThemeProvider + theme-ID migration, dynamic Material You colors, MD3 Slider, TopTabBar, standardized bottom sheet, modernized Menu — see Batch C history entry

## Removed/Deprecated

- src/screens/reader/components/ReaderBottomSheet/TTSTab.tsx (Upstream file removed in favor of ReaderTTSTab.tsx)
- @react-native-community/slider (replaced by MD3 Slider, Batch C-3)
- src/screens/settings/SettingsReaderScreen/components/TabBar.tsx (replaced by TopTabBar, Batch C-5)

## 2026-08-14 - Upstream Merge Analysis (32 commits, 4-POV REVIEWED - no code changes)

**Analysis Range**: upstream/master @ 990cd4f2e (2026-08-11) from last sync c3260e8e0 (2026-08-01)
**Commits Analyzed**: 32 (24 fix, 3 feat, 2 chore, 1 perf, 1 docs, 1 i18n) — NOTE: upstream/main is STALE (2024 v1.1.19); fork tracks upstream/master
**Method**: 5 parallel lane subagents (portability) + 4 parallel POV subagents (fork-integrity / user-value / effort-cost / strategic) + main-agent spot-verification (all 8 live-bug claims CONFIRMED)
**Docs**: specs/upstream-merge-analysis-2026-08-14/ (README.md, lane1-5, pov-review/, REVIEW-2026-08-14.md)
**Outcome**: 16/32 worth porting (7 bug-fix units + 2 UX + 1 feature + 1 translation pass) in 3 waves; 3 deferred (atomic epub export, APK size, custom-code page); 14 SKIP

**Verified live fork bugs (all confirmed):** select-all only selects loaded 300-batch (NovelScreen:277, #1960); clearUpdates full-table UPDATE freeze (ChapterQueries:267, #1955); Epub.cpp whitelist jpeg/png/jpg only (#1622/#1946); Epub.cpp cover ignores media-type (#1948); TTSForegroundService audio-focus-only, no PhoneStateListener (#1976); useLibrary.getLibrary no try/finally; NovelInfoHeader drops image headers (#1977); useLoadingColors still primary-tinted (#1964)

**DO-NOW (3 waves, est 4.5-5d):** W1 bug fixes: 63349de1b (select-all), 8a12529ba (clear freeze - SURGICAL around DoH block), 1eb8c587c (library skeleton), 15560b67b (cover headers), 13885320a (categories→library, tx discipline), epub trio 3ac611f63+91358ad3d+197d8670f (ONE unit, shared/Epub.cpp, one rebuild), 7883b28cd (TTS stop on calls - READ_PHONE_STATE maxSdkVersion=31 policy). W2: skeleton pair 51560195b+e0c89cdd9 (post-e0c89cdd9 wholesale), 57eca11a9 (library-status nav). W3: 909504a72 (repo enable/disable - claims MIGRATION 005, coordinate w/ Batch D), translation pass 3bf025108+3ad6e372f+f69e5d6a7 (id_ID first, per-key, protect fork keys)
**DO-LATER:** e4246dee5 (atomic export - after export flow bakes; SAF atomicity unverified), 3ece098b9 (APK size - lottie removal NOT safe: native splash uses lottie; gradle/R8 blast radius; StatsScreen hunks → D3), 64707409b (custom-code v2 RED - own PR next 1-2 syncs BEFORE D2; gate: textRemover.js DOM audit vs fork TTS index contract; ToggleButton rename; never memoizedHTML deps)
**SKIP (14):** 179feb56e, 675f19ef9, 23f9b183b, b9d1abcf2, 586e08514, a727c229c, 67e01bc2d (D3 reference), c6679b7f4, 084dcccab, 990cd4f2e, c3482a851, c3b75ebeb, 7f1f76408 (all ALREADY-HAVE/ARCH)
**Migration registry note**: [002,003,004]; 005 reserved for 909504a72 if ported this sync (Batch D D1 then takes 006)

## 2026-08-14 - Upstream Sync WAVES 1-3 IMPLEMENTED ✅ (merge/upstream-sync-2026-08-14, 12 commits, NOT pushed)

**Range**: upstream/master @ 990cd4f2e; ports from 32-commit analysis (see 2026-08-14 analysis record below)
**Method**: sequential worker subagents (orchestrator = main agent, reviewed each diff + ran gates between waves)
**Commits (12)**: 4c5b45229 (select-all #1960), 4221a7f9e (clearUpdates freeze #1955 — trigger-bypass + bulk UPDATE in withExclusiveTransactionAsync), 487d58faf (library stuck skeleton), 895f714f6 (cover headers #1977), 119a9b257 (categories→library #1945), 944b2b3ea (EPUB formats+cover #1622/#1946/#1948 — shared/Epub.cpp), 6fb30f26c (skeleton colors #1964), a8da9255d (library-status nav 57eca11a9), 8c49e6c05 (lint dep fix), 03683bd31 (repo enable/disable #1628 + migration 005), ba2e07c63 (translations 3bf025108/3ad6e372f/f69e5d6a7), +1 style commit
**SKIPPED in-wave**: 7883b28cd (TTS phone calls) — VERIFIED upstream is audio-focus handling ALREADY in fork (TTSForegroundService.kt); PhoneStateListener variant inert without runtime permission → SKIP-ALREADY-HAVE. 3ece098b9, e4246dee5, 64707409b deferred (see analysis record).
**Gates**: type-check ✅, lint 0 errors (7 pre-existing warnings) ✅, format ✅, **91 suites / 1469 tests passing** (+37 vs baseline 1432; 3 pre-existing network-dependent useGithubUpdateChecker failures), TTS wake-cycle 7/7 ✅, refill ✅, migration upgrade-path 39/39 ✅ (incl. new 005)
**Migration registry NOW**: [002,003,004,005]. **Batch D must use 006+** (005 claimed by repo-enable migration).
**Key implementation notes**:
- clearUpdates: drops update trigger inside tx, bulk UPDATE, recreates trigger from NovelTable constant (avoids per-row aggregate write amplification)
- ChapterQueries: new chunkChapterIds (500/batch) + chunked bulk ops (markChaptersRead/Unread, deleteChapters, updateChapterProgressByIds, bookmarkChapters) + getPageChapterIds/getChaptersByIds (select-all spans full current source page, filter-respecting)
- Epub.cpp: isSupportedImageMediaType (svg/gif/webp/bmp), findCoverImagePath for cover DOCUMENTS, property_cover_id (properties=cover-image) + media-type guard on cover resolve
- Repo controls: migration 005 + RepositoryTable enabled column + setRepositoryEnabled/getEnabledRepositoriesFromDb + fetchPlugins filters enabled repos only (installed plugins cached, unaffected) + RepositoryCard Switch (0/1 coercion) + Switch backward-compat a11y props. pluginSelectors.ts NOT ported (dead code in fork — fork's refreshPlugins equivalent inline)
- Translations: per-key merges ONLY; id_ID restored 468→687 keys + 8 fork keys re-merged; f69e5d6a7 ported only 2 fork-referenced keys (common.later, common.skipVersion)
- Zero TTS-pipeline/DoH/scaling/per-novel files touched

## 2026-08-14 - pluginSelectors.ts FOLLOW-UP IMPLEMENTED ✅ (commit 06852a6a8)

**Context**: 3-POV subagent study (specs/upstream-merge-analysis-2026-08-14/plugin-selectors-study/) found the Wave-3 repo-disable switch shipped WITHOUT its badge-cleanup companion — fork's hasUpdate was one-way sticky (stale 'update available' badges persist forever after disabling a repo; update button bypasses disabled repo). Memory's earlier 'dead code in fork' note for pluginSelectors.ts is SUPERSEDED.
**Ported** (upstream 909504a72): src/hooks/persisted/pluginSelectors.ts verbatim (getLastUsedPluginId, filterInstalledPlugins, filterAvailablePlugins, reconcileInstalledPluginUpdates); usePlugins.refreshPlugins → async({clearUnavailableUpdates}) with pure reconcile + reference-identity conditional INSTALLED_PLUGINS write; filterPlugins delegates to pure selectors (localeCompare sort); SettingsRepositoryScreen.toggleRepository → await refreshPlugins({ clearUnavailableUpdates: repository.enabled }).
**Fork adaptations (NOT ported)**: LAST_USED_PLUGIN string-id migration (fork stores PluginItem object — kept object-form sync); FILTERED_* persisted keys removal (6 fork consumers depend). hasSettings blocks intact.
**Tests**: NEW pluginSelectors.test.ts (18 tests). Gates: type-check ✅, lint 0 errors ✅, format ✅, **92 suites / 1487 tests** (3 pre-existing network fails), TTS wake-cycle ✅ refill ✅.
**Behavior fixes**: stale badges cleared on repo disable; no more unconditional MMKV writes; no mutation-in-filter.

# Merge History

## 2026-08-03 - Upstream Merge Analysis (170 commits, PLANNED - no code changes)

**Analysis Range**: upstream/master @ c3260e8e0 (2026-08-01) from merge base 467a97dcf (2025-12-24)
**Commits Analyzed**: 170 (66 fix, 56 feat, 17 chore, 14 refactor, 5 docs, 4 perf, 2 test, 1 ci)
**Method**: 4 parallel subagents (chronological groups) cross-referencing git diffs vs fork source; key claims spot-verified
**Strategy**: Selective cherry-pick / manual port (full merge still infeasible - 3 architecture walls)

**Architecture Walls (unchanged since 2025-12-30, now deeper):**
1. DB: upstream Drizzle ORM + op-sqlite (#1735) vs fork expo-sqlite raw SQL + custom MigrationRunner
2. TTS/Native: upstream Nitro modules + MediaSession + WorkManager (#1889/#1896) vs fork custom Kotlin (TTSHighlightModule, TTSForegroundService, DoH) + background-actions
3. Build: upstream Expo 55 managed + rock CLI (#1885/#1812) vs fork Expo 54 bare + Gradle 9.2.0

**Outcome**: 76 of 170 commits worth porting (batches A-D). 94 skipped (CI/release/docs/infra/ALREADY-HAVE/Drizzle). (Updated 2026-08-04 after independent review - see below.)

**Key findings:**
- Fork often carries byte-identical PRE-FIX code - has the same live bugs upstream just fixed
- Verified live fork bugs: deleteReadChaptersFromDb passes novelId as chapter id (wrong folder); deleteDownloads UPDATE without WHERE wipes all flags; ServiceManager.setMeta negative-delay throttle; WHERE sort=1 default-category breaks on reorder; TEXT page comparison in multi-page queries; TTS reads quotes aloud (normalizeText); unawaited runAsync inside withTransactionAsync (NovelQueries/helpers.tsx)
- ALREADY-HAVE (skip): DoH, MediaSession/media notification, WebView-reset fix, metro middleware, EPUB exporter, volume buttons
- TRAP commit: 72bfcad03 (lint cleanup touching WebViewReader/ReaderScreen/ChapterContext) - never cherry-pick
- Raw-SQL layer is a PORTABILITY ADVANTAGE for pre-Drizzle-era SQL fixes

**Batches planned (details in specs/upstream-merge-analysis-2026-08/):**
- Batch A (29 fixes, half-day): 16 Tier-1 (8 DIRECT clean-apply + 8 MANUAL) + 6 SQL + 7 extended (incl. c3260e8e0 download-removal fix and 0cb9da9027 tx-concurrency fix)
- Batch B (7 features + 15 stretch): Kitsu tracker, ignorable updates, EPUB chapter numbers, parallel library updates, first-unread FAB, jump-to-chapter fix, download cooldown
- Batch C (7 + 2): theme refactor -> dynamic Material You colors -> MD3 slider/tabs/menu
- Batch D (5 core + 10 optional, separate PRs): time tracking, in-chapter search, stats overhaul, reader perf sprint, scheduled updates

**2026-08-04 - Independent Review + Corrections Applied**: 4 review subagents verified the analysis (all 6 live-bug claims CONFIRMED, 9/9 ALREADY-HAVE SOUND, trap commit correct, PRDs SOUND). Corrections applied to manifest/PRDs/analysis/README: (1) 0cb9da9027 reclassified SKIP->PORT-A2 (pre-Drizzle expo-sqlite tx fix); (2) 5 DIRECT labels -> MANUAL (31cb4b99, 93bc5e5e, 2a919ec0, f1fdafd3, a062beee - fork rewrote those files, hunks fail apply); (3) 9783c4d5e3 reclassified SKIP->PORT-A1/low; (4) c3c891cea0 relabeled SKIP-CI->SKIP-INFRA; PRD-C now requires BOTH surfaceContainerLow+High keys; PRD-A 45c4ea8ca0 now includes epub/import.ts hunk. Full report: specs/upstream-merge-analysis-2026-08/REVIEW-2026-08-04.md

**Docs**: specs/upstream-merge-analysis-2026-08/ (README.md, analysis.md, commit-manifest.csv, batches/PRD-A..D, REVIEW-2026-08-04.md)
**Status**: Batch A ✅ + Batch B ✅ COMPLETED 2026-08-04 on `merge/original-sync-batch-b` (head `275c106`, 32 commits ahead of master, PUSHED to origin 2026-08-04); Batch C ✅ COMPLETED 2026-08-05 on `merge/original-sync-batch-c` (pushed); Batch D pending. ✅ CORRECTED: dev has NO pending TTS work — TTS text-cleanup was merged to master via PR #18 (`a7c030a64`); the only dev-only commit is `6550a7884` (docs/merge review), already inside the batch branch history.

**2026-08-04 - Batch A (Safety Fixes) ✅ COMPLETED**: 29/29 upstream fixes ported on `merge/original-sync-batch-b`. Validated: **73 suites / 1265 tests passing (zero regressions)**. Last item: `8f53550d2c` restore tracker search requests (commit `d61228002`).

**2026-08-04 - Batch B (High-Value Features, core 7/7) ✅ COMPLETED**: ported via sequential subagents (orchestrator = main agent, checked each diff + ran gates). 
- B-1 `799845426c` parallel library updates (`a1d23a0a2`, +2 unit tests)
- B-2 `c40edd5b2c` Kitsu tracker (`f7c4b65e8`, kitsu.ts byte-identical to upstream, 14 unit tests, kitsu.png extracted via `git cat-file`)
- B-3 `8f237909d5` first-unread-chapter button/FAB (`0c6a6dc96`)
- B-4 `4ad0639796` jump-to-chapter loads unloaded batches + drawer end-reach (`62091cb07`, console.error→novelLog)
- B-5 `345d084eba` EPUB chapter numbers (`032723bbc`, fork's cd-z epub-creator loop; strings/types regenerated)
- B-6 `c0877a9b06` skip-version update notifications (`7ecb98ab4`, HYBRID port: preserved fork's richer NewUpdateDialog, added ignoreVersion to useGithubUpdateChecker + fixed first-launch check bug)
- B-7 `5d996f1388` configurable download cooldown (`398ecb958`, modal adapted to fork scaling)
- Validated: type-check ✅, lint ✅ (5 pre-existing warnings), format ✅, **75 suites / 1281 tests passing**, TTS wake-cycle 7/7 ✅, TTS refill ✅.
- Stretch items (15) NOT ported — deferred.

**2026-08-05 - Batch C (UX/Theme train, core 7/7) ✅ COMPLETED**: ported on `merge/original-sync-batch-c` (branch from batch-b head; sequential subagents, main agent checked each).
- C-1 `8f47e8fd1e` theme-switcher refactor → context `ThemeProvider` + legacy-id migration 1-21→100-108 (`b07e701bb`; SKIPPED react-native-theme-switch-animation native dep)
- C-2 `44c8e54ed8` dynamic Material You colors (`0f0dd626a`; ADDED @pchmn/expo-material3-theme dep + jest mock; Android 12+ only, graceful fallback)
- C-3 `0c8546188e` MD3 Slider replacing @react-native-community/slider (`b1b08f7f2`; migrated 7 fork consumers incl. ReaderTTSTab/AccessibilityTab; dep removed)
- C-4 `6d2a9f8e15` slider flicker fix (`2f27e8e`)
- C-5 `3d34658d0f` M3 top tab indicators (`d7f25f94a`; new TopTabBar + SettingsReaderScreen TabView rework; used theme.surface since surfaceContainer keys absent then)
- C-6 `17c891e133` bottom-sheet UX standardization (`a8e6a24ba`; added surfaceContainerLow+High to ThemeColors + computed colors; layout.ts; 9 consumers cleaned; upstream retains handleComponent={null})
- C-7 `e9f6bdaa20` Menu modernization (`54d5d758a`; NativeModal outside-tap/back dismiss + M3 tokens, kept uiScale scaling)
- Validated: type-check ✅, lint ✅ (0 errors; 7 warnings pre-existing/Slider-inline), format ✅, **78 suites / 1294 tests passing**, TTS wake-cycle 7/7 ✅, TTS refill ✅.
- Optional C items (`098782d6aa`, `99c31d56bb`) NOT ported.

## 2025-12-30 - Upstream Merge Analysis (FAILED - DIVERGENCE DETECTED)

**Analysis Summary:**

- **Upstream Commits to Merge**: 116 commits from upstream/main
- **Divergence Point**: Fork has 60+ commits not in upstream
- **Conflict Count**: 100+ conflicts (unsolvable via auto-merge)
- **Status**: MERGE IMPOSSIBLE - Requires manual intervention

**Root Cause Analysis:**

The fork has significantly diverged from upstream through:

1. **JavaScript → TypeScript Migration**: Fork converted .js → .tsx, upstream kept .js
2. **Architecture Changes**:
   - Fork uses custom native modules (TTSForegroundService.kt, TTSHighlightModule.kt)
   - Upstream uses different EPUB parser (epubParser/ directory)
   - Fork's Redux setup completely refactored
3. **Deleted vs Modified Conflicts**: Fork deleted many .js files that upstream still has
4. **Source Plugins**: Complete source overhaul - fork deleted/rewrote many sources

**Conflict Categories:**

1. **File Rename Conflicts** (40+):
   - ReaderScreen.js → ReaderScreen.tsx
   - NovelBottomSheet.js → NovelBottomSheet.tsx
   - All tracker components renamed

2. **Delete/Modify Conflicts** (50+):
   - MainActivity.java, MainApplication.java (fork uses .kt)
   - Redux store, reducers, actions (fork migrated)
   - Source plugin files (fork rewrote)

3. **Content Conflicts** (10+):
   - WebViewReader.tsx (fork heavily modified for TTS)
   - package.json (different deps, versions)
   - Android build files (different configurations)

**Recommended Actions:**

**Option 1: Cherry-Pick Selective Upstream Features** (RECOMMENDED)

- Identify specific upstream features you need
- Manually cherry-pick those commits
- Adapt code to fork's architecture
- Pros: Preserves custom TTS features
- Cons: Time-consuming, requires careful testing

**Option 2: Rebase Fork on Latest Upstream** (HIGH RISK)

- Force rebase dev branch on upstream/main
- Manually resolve 100+ conflicts
- Risk: High chance of breaking TTS features
- Pros: Cleaner merge history eventually

**Option 3: Fork Becomes Independent** (ALTERNATIVE)

- Treat fork as independent project
- Track upstream commits manually
- Adopt only critical fixes
- Pros: No merge conflicts
- Cons: Miss upstream improvements

**Option 4: Start Fresh Branch from Upstream** (LAST RESORT)

- Create new branch from upstream/main
- Manually port TTS features (weeks of work)
- Pros: Clean upstream integration
- Cons: Massive rework required

**Upstream Changes Worth Reviewing (2023-2024):**

Priority 1 (Bug Fixes):

- e95506919: Volume Button Scroll on Next Chapter
- a83b4b1a3: Fix Retry Button
- df8da48c3: Fix NovelUpdates Covers
- e600828bc: Fix Cloudflare on NovelUpdates

Priority 2 (Features):

- 8a85f4eaf: Jump to Last Read Chapter
- f53b0eac8: Local EPUB Support (conflicts with fork's native EPUB)
- 36cb7fc39: Horizontal Reading Mode

Priority 3 (Source Updates):

- All source plugin updates can be cherry-picked independently

**Conclusion:**
The fork is no longer merge-compatible with upstream due to fundamental architectural differences. A full merge is not feasible. Recommend Option 1 (cherry-pick) or Option 3 (independent fork path).

**Baseline Tests Before Merge Attempt:**

- type-check: ✅ Passed
- lint: ✅ Passed
- test: ✅ All tests passed (TTS wake cycle validation)

**Checkpoint Created:**

- checkpoint-20251230-060447-before-upstream-merge

---

## 2025-12-14 - Upstream Merge (PR #7)

- Strategy: Auto-merge (GREEN - zero conflicts)
- Commits: 2 from upstream/master
  - 8d15e418e: Translation updates (Crowdin)
  - 3849b797c: Plugin settings fix (closes upstream #1674)
- Merge Commit: 3d95c4927
- Conflicts: None (automatic merge succeeded)
- Affected Files:
  - src/hooks/persisted/usePlugins.ts (+1 line: hasSettings property)
  - 34 translation JSON files (enhanced notifications/backup strings)
- Local Checks:
  - type-check: ✅ Passed
  - lint: ✅ Passed (18 warnings, 0 errors)
  - format:check: ✅ Passed
  - test: ✅ 23 suites, 241 tests passed
  - TTS validation: ✅ All wake cycle tests passed
- PR: https://github.com/bizzkoot/lnreader/pull/7
- Result: PR created and mergeable
- Fork Features: All custom TTS, UI scaling, backup features validated and intact

## 2025-12-07 - Upstream Merge & Validation

- Kept fork versions for config files.
- Manually patched `WebViewReader.tsx` (Battery fix + TTS).
- Deleted conflicting `TTSTab.tsx`.
- Type Check: Passed
- Lint: Passed
- Jest: Passed (4 suites)
- TTS Simulation: Passed (Refill & Wake Cycle)
- Build Dry Run: Passed

## 2025-12-11 - Merge dev -> master (PR #3)

- Strategy: Test-merge locally then open PR from `dev` into `master`
- Commits: 19 (head: ba60ecf9)
- Merge branch: merge/dev-into-master-20251211-ba60ecf9
- PR: https://github.com/bizzkoot/lnreader/pull/3
- Conflicts: None (automatic merge succeeded)
- Local Checks: lint: 17 warnings (no errors); type-check: passed; unit tests: 17 suites, 164 tests, all passed
- Result: PR opened and mergeable (MERGEABLE / CLEAN)
- Merged: Yes
- Merge Commit: 5e737d8e
- Merge Date: 2025-12-11 21:46:22 +0800
- Post-merge Checks (local): lint: 17 warnings (no errors); type-check: passed; unit tests: all passed
- Merge Branch Deleted: Yes (origin branch `merge/dev-into-master-20251211-ba60ecf9` removed)

## 2026-08-05 - Post-Port Audit of Batches A/B/C (43 commits ahead of origin/master) + 1 FIX

**Method**: 4 parallel read-only review subagents (Batch A / Batch B / Batch C / fork-integrity cross-cut) + main-agent verification of the one MED finding. Gates run independently: type-check ✅, lint 0 errors ✅, **78 suites / 1294 tests passing** ✅.

**Batch A (21 code commits) — 19 ✅ CORRECT / 1 ⚠️ MED / 2 ⚠️ LOW**:
- ✅ Faithful ports incl. edfdbaea6 (download-deletion scoping, exemplary tests), 261b379a1 (core.js TTS quote-strip, length-preserving, index-contract safe), b0b32fe28 (progress restore, no TTS interference), 969f088cb's await fix, d61228002 (tracker search submit).
- ⚠️ **MED — FIXED (commit fa5e10b76)**: 969f088cb ported `withExclusiveTransactionAsync` but kept `db.runAsync` inside callbacks. expo-sqlite's `withExclusiveTransactionAsync` opens a NEW connection (`useNewConnection: true`); statements must run on the `txn` object. `db.runAsync` inside executed OUTSIDE the transaction → atomicity silently lost for `restoreLibrary`, `_restoreNovelAndChapters`, `transactionAsync` (helpers.tsx), `migrateNovel`. Fix: all 6 sites now use `tx` (4 fixed + ChapterQueries/LibraryUpdateQueries already correct). Test mock updated (tx proxies shared runAsync mock; all 54 DB tests still pass). Verified: grep shows zero `db.runAsync` inside transaction callbacks.
- ⚠️ LOW (deferred): f4f8defdf (EPUB range export not reworked to LIMIT/OFFSET — pre-existing multi-page position-window quirk); cf5b5923e (julianday trigger half inert on existing installs — no trigger recreation on bootstrap).

**Batch B (7 features) — all ✅ CORRECT, 0 regressions**: B-1 parallel updates (2 tests), B-2 Kitsu (byte-identical, 14 tests; upstream-inherited score-scale quirk noted), B-3 first-unread FAB, B-4 jump-to-chapter + drawer end-reach, B-5 EPUB chapter numbers (⚠️ minor: first-submit staleness reading setting from closure instead of payload — inherits pre-existing epubUseAppTheme pattern), B-6 skip-version (fork's richer dialog preserved; first-launch check bug fixed intentionally), B-7 download cooldown (service actually uses getChapterDownloadCooldownMs; no hard-coded sleep left). No TTS/DoH/MMKV files touched.

**Batch C (7 theme/UX + 1 build patch) — all ✅ PASS, 0 regressions**: C-1 theme-ID migration 1-21→100-108 map verified complete, no stale consumers; C-2 Material You graceful fallback <Android 12 (⚠️ low/latent: jest mock exports fn instead of boolean false for isDynamicThemeSupported — harmless, no test renders those screens); C-3 MD3 Slider — zero @react-native-community/slider refs remain, all 7 fork consumers migrated, TTS min/max/step preserved; C-4 flicker fix; C-5 TopTabBar; C-6 surfaceContainerLow/High computed both modes; C-7 Menu keeps uiScale; 494ad9707 expo-material3-theme gradle patch verified applied in node_modules. ⚠️ low: ErrorFallback renders outside ThemeProvider (App.tsx dbError/AppErrorBoundary paths) → unstyled error screens; upstream wraps inside.

**Fork-integrity cross-cut — ✅ INTACT**: Zero TTS-pipeline / TTS-state-machine / TTS-native / DoH / per-novel-settings code touched. Only deletions: upstream's TabBar.tsx (replaced by TopTabBar) + MangaUpdatesLoginDialog→TrackerLoginDialog rename (92% preserved). Dependencies: -@react-native-community/slider +@pchmn/expo-material3-theme, all fork deps retained.

**Outcome**: 42/43 commits verified good as intended. 1 real defect found & fixed (fa5e10b76). 5 low-severity non-blocking items tracked (4 deferred, 1 latent test-mock shape).

## 2026-08-05 - Quick-Fix Batch IMPLEMENTED (items 1, 3, 4, 5 from audit) ✅

**Committed**: ebea3c75a on `merge/original-sync-batch-c` (no PR created, per request). Implemented via sequential chain of 2 subagents (EPUB bundle → app/mock bundle), main agent reviewed diffs + ran full gates.

- **Item 1 (EPUB range export) FIXED**: `getNovelDownloadedChapters` range branch → `LIMIT ? OFFSET ?` over flat (page, position) global order (was per-page position-window → wrong/duplicated chapters on multi-page novels). 6 tests in `ChapterQueries.range.test.ts`.
- **Item 3 (EPUB toggle staleness) FIXED**: new `EpubExportOptions` payload + `buildEpubExportOptions()` pure helper; `ExportEpubModal` submits LIVE toggle values; `ExportNovelAsEpubButton` consumes `options.*` at export time (all 4 toggles; persistence call kept). 4 tests.
- **Item 4 (ErrorFallback theming) FIXED**: dbError path wrapped in ThemeProvider; ThemeProvider moved ABOVE AppErrorBoundary (boundary-caught errors now themed; ThemeProvider is MMKV-only, safe during dbError).
- **Item 5 (mock fidelity) FIXED**: `isDynamicThemeSupported` is plain boolean `false` in jest mock (was jest.fn → truthy → wrong branch in future dynamic-theme tests).
- **Validated**: type-check ✅, eslint 0 errors ✅, format ✅, **80 suites / 1304 tests passing** (+10 vs baseline). One transient Slider flake seen in an intermediate run, clean on 2 consecutive full runs.

**Remaining open item**: Item 2 (julianday triggers inert on existing installs) → Batch D, own migration PR (highest blast radius: migration runner; needs upgrade-path test from user_version=2). Mitigation already documented in AGENTS.md divergence note.

## 2026-08-05 - Batch D PR #1 (item #2) IMPLEMENTED ✅ (commit b6b367df6)

**Item 2 (julianday triggers inert on existing installs) — FIXED** on `merge/original-sync-batch-c` (no PR, per workflow). Implemented via sequential chain of 2 subagents (migration worker → test worker) from the multi-POV scope review; main agent reviewed diffs + ran full gates.

- **`src/database/migrations/004_recreate_novel_triggers.ts`** (new): column guard (PRAGMA table_info; SQLite does NOT validate trigger-body col refs at CREATE — throw, don't skip) → DROP ×4 → CREATE ×4 from shared NovelTable/CategoryTable constants → julianday lastUpdatedAt backfill (same subquery as triggers).
- **`NovelTable.ts`**: update trigger now `AFTER UPDATE OF isDownloaded, unread, readTime, updatedTime ON Chapter` (was firing on every Chapter UPDATE incl. per-paragraph TTS progress saves; verified semantically safe). Single source of truth → fresh installs converge.
- **`add_category`** included (pre-migration installs lacked it → NULL sort).
- **db.ts untouched**: fresh installs stay user_version=2 (004 runs as idempotent no-op, 003 precedent). Registry = [002, 003, 004].
- **Tests (28 new)**: better-sqlite3 devDep + `ExpoLikeDb` adapter + real MigrationRunner (NOT node:sqlite — CI pins Node 20). 004 test: drift invariant (sqlite_master.sql === exported constants), trigger fire, lexicographic-vs-chronological divergence (09:00 wins over 8:00), backfill, column-list non-firing on progress-only, idempotency, column guards. Upgrade-path test: fresh/v1/v2/v3/empty/large-novel. LibraryQueries sort-rewrite test.
- **Validated**: type-check ✅, eslint 0 errors ✅, format ✅, **84 suites / 1332 tests passing** (+28 vs baseline).

**Batch D remaining**: time tracking, in-chapter search, stats overhaul, reader perf sprint, scheduled updates. Deferred items from this PR documented: incremental insert trigger (30×), batch-op write amplification, bootstrap drop-recreate (→ stats-overhaul PR).
