---
applyTo: '**'
---

# Fork Metadata

- Original Repo: https://github.com/lnreader/lnreader
- Fork Repo: https://github.com/bizzkoot/lnreader
- Last Sync Date: 2025-12-07
- Last Sync Commit: 5422fc02

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

## 2025-12-07 - Upstream Merge & Validation

- Strategy: Manual Resolution (Prioritized Fork Features)
- Conflicts: 9 files (Resolved by keeping fork version + manual patches)
- Resolution:
  - Kept fork versions for config files.
  - Manually patched `WebViewReader.tsx` (Battery fix + TTS).
  - Deleted conflicting `TTSTab.tsx`.
- Tests:
  - Type Check: Passed
  - Lint: Passed
  - Jest: Passed (4 suites)
  - TTS Simulation: Passed (Refill & Wake Cycle)
  - Build Dry Run: Passed
- Status: Pushed to origin/dev
