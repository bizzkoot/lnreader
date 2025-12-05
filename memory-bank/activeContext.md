# Active Context

## Current Goals

- **TTS Wake/Resume Flow Fix (2025-12-04)**
- Fixed bug where waking screen during background TTS (3rd+ chapter) would restart TTS from paragraph 0 instead of current position.
- **Root Cause**: Chapter-change effect was unconditionally resetting `currentParagraphIndexRef` and `latestParagraphIndexRef` to 0. When screen wakes, the indices were already reset before native TTS events could update them.
- **Solution**: Three-part fix implemented:
  1. **Smart Index Initialization**: `initialIndex = Math.max(dbIndex, mmkvIndex, ttsStateIndex)` instead of reset to 0
  2. **Grace Period Filtering**: Block stale/early save events during chapter transitions (chapter mismatch, backward progress, initial 0)
  3. **Pause-Sync-Resume Flow**: On screen wake → pause native TTS → sync UI to correct paragraph → resume TTS
- **New Refs Added**: `autoResumeAfterWakeRef`, `wasReadingBeforeWakeRef`
- **Files Changed**: WebViewReader.tsx, ttsWakeUtils.js (new), ttsWakeUtils.test.js (new)

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