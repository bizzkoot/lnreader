# Active Context

## Current Goals

- **Fix TTS background playback and paragraph highlighting** (native + RN + WebView)
  - Previous: Added native `onQueueEmpty` event, persistent wake lock in `TTSForegroundService`, and ensured `utterance_<index>` IDs
  - **Latest (2025-12-03)**: Fixed background TTS next chapter navigation when screen is off
    - Added `htmlParagraphExtractor.ts` to extract paragraphs from HTML in RN
    - Added `backgroundTTSPendingRef` to coordinate chapter transitions
    - Reset paragraph indices on chapter change to prevent stale highlighting
    - Reduced log spam for "No more items to refill"

## Key Files Modified

- `src/screens/reader/components/WebViewReader.tsx`: Background TTS chapter navigation
- `src/utils/htmlParagraphExtractor.ts`: New utility for HTML paragraph extraction
- `src/services/TTSAudioManager.ts`: Log spam reduction
- `android/app/src/main/assets/js/core.js`: Bounds checking in highlightParagraph

## Current Blockers

- None