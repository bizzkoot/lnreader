---
applyTo: '**'
---

# Fork Metadata

- Original Repo: https://github.com/lnreader/lnreader
- Fork Repo: https://github.com/bizzkoot/lnreader
- Last Sync Date: 2025-12-14
- Last Sync Commit: 3d95c4927 (upstream 8d15e418e)

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
