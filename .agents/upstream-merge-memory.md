---
applyTo: '**'
---

# Fork Metadata

- Original Repo: https://github.com/lnreader/lnreader
- Fork Repo: https://github.com/bizzkoot/lnreader
- Last Sync Date: 2025-12-30
- Last Sync Commit: 7c57b7421 (upstream 2e1a0ab96)

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

## Removed/Deprecated

- src/screens/reader/components/ReaderBottomSheet/TTSTab.tsx (Upstream file removed in favor of ReaderTTSTab.tsx)

# Merge History

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
