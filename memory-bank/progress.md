# Progress

## Done

- [x] Initialize project
- [x] Implement TTS background playback fixes (native `onQueueEmpty`, persistent wake lock)
  - Files: `TTSForegroundService.kt`, `TTSHighlightModule.kt`, `TTSAudioManager.ts`, `TTSHighlight.ts`, `WebViewReader.tsx`, `core.js`
  - Commit: e7aa3b86 (pushed to `dev`)
- [x] Fix paragraph highlighting by aligning utterance IDs (`utterance_<index>`)
- [x] **Fix background TTS next chapter navigation** (2025-12-03)
  - **Problem**: When screen is off, WebView JS is suspended so chapter navigation via `navigateChapter()` fails - WebView re-renders but doesn't execute new JS
  - **Solution**: Added `backgroundTTSPendingRef` flag. When chapter changes AND flag is set:
    1. Extract paragraphs from HTML using new `htmlParagraphExtractor.ts` utility
    2. Start TTS batch directly from React Native without waiting for WebView
  - **Files modified**:
    - `src/screens/reader/components/WebViewReader.tsx`: Added backgroundTTSPendingRef, prevChapterIdRef, chapter change effect
    - `src/utils/htmlParagraphExtractor.ts`: New utility to extract readable paragraphs from HTML
    - `src/services/TTSAudioManager.ts`: Reduced "No more items to refill" log spam (only log once per batch)
    - `android/app/src/main/assets/js/core.js`: Added bounds checking in `highlightParagraph()` to handle stale indices

## Doing

- [ ] Run on-device QA: background TTS through chapter boundaries with screen off

## Next

- [ ] Open PR for review and run CI pipelines