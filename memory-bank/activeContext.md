# Active Context

## Current Goals

- **TTS Background Multi-Chapter Playback Fix (2025-12-04)**
- Fixed a critical bug where TTS could not transition to 2nd+ chapters during background playback (screen off).
- **Root Cause**: When TTS navigates to a new chapter during background playback, the WebView does NOT reload with the new chapter's HTML - it keeps the old chapter loaded. React Native side correctly updates to the new chapter, but WebView's `reader.chapter.id` stays at the old chapter. When TTS event handlers try to inject JavaScript for highlighting/state updates, core.js rejects them as "stale chapter" because the IDs don't match.
- **Solution**: Added `isWebViewSyncedRef` to track if WebView has current chapter loaded:
- - Set to `false` when background TTS navigation starts
- - Set to `true` when WebView's onLoadEnd fires
- - TTS event handlers check this flag before injecting JS
- - When not synced, skip WebView injections but continue TTS playback
- - Progress is saved via RN's saveProgress() regardless of WebView state
- **Files Changed**: WebViewReader.tsx

## Key Files Modified

- `src/screens/reader/components/WebViewReader.tsx`: Background TTS chapter navigation
- `src/utils/htmlParagraphExtractor.ts`: New utility for HTML paragraph extraction
- `src/services/TTSAudioManager.ts`: Log spam reduction
- `android/app/src/main/assets/js/core.js`: Bounds checking in highlightParagraph

## Current Blockers

- None