# Active Context

## Current Goals

- Completed upstream merge and validation.
- - Merged upstream/master into dev.
- - Resolved conflicts in build.gradle, core.js, package.json, etc.
- - Fixed TypeScript errors by removing conflicting TTSTab.tsx.
- - Verified logic with regression tests (Jest, TTS simulation).
- - Verified build configuration with Gradle dry run.
- Current state: Stable dev branch with upstream changes and local TTS features preserved.

## Key Files Modified

- `src/screens/reader/components/WebViewReader.tsx`: TTS wake/resume flow with smart index init
- `src/screens/reader/components/ttsWakeUtils.js`: Testable helper functions
- `src/screens/reader/components/__tests__/ttsWakeUtils.test.js`: Jest test suite (17 tests)
- `src/utils/htmlParagraphExtractor.ts`: HTML paragraph extraction utility
- `src/services/TTSAudioManager.ts`: TTS queue management
- `android/app/src/main/assets/js/core.js`: WebView-side highlighting logic

## Test Commands

```bash
# Run all tests
pnpm test

# Run specific TTS tests
pnpm test -- --testPathPattern=ttsWakeUtils
```

## Current Blockers

- None (Ready for real-device verification)