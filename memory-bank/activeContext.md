# Active Context

## Current Goals

- **TTS Background Playback & Screen Wake Fixes (2025-12-03)**
- Implemented comprehensive fixes for TTS issues during background playback and screen wake:
- 1. **Chapter ID Validation**: Added chapter ID parameter to `highlightParagraph()` and `updateState()` in core.js to prevent stale events from old chapters causing wrong scrolls when screen wakes
- 2. **Screen Wake Sync**: Added AppState 'active' handler in WebViewReader.tsx to force WebView sync to current TTS paragraph position when user wakes screen during background playback
- 3. **Resume Fix**: Fixed `restoreState()` to call `speak()` directly instead of `next()`, preventing the saved paragraph from being skipped on resume
- 4. **Slider UX**: Enhanced TTS settings sliders with real-time value display, +/- buttons, better touch areas, and visual markers
- All changes committed and pushed to dev branch.

## Key Files Modified

- `src/screens/reader/components/WebViewReader.tsx`: Background TTS chapter navigation
- `src/utils/htmlParagraphExtractor.ts`: New utility for HTML paragraph extraction
- `src/services/TTSAudioManager.ts`: Log spam reduction
- `android/app/src/main/assets/js/core.js`: Bounds checking in highlightParagraph

## Current Blockers

- None