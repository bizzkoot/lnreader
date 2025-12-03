---
applyTo: '**'
---

# Coding Preferences
- Use project's existing style (2 spaces, single quotes, trailing commas)
- Path aliases: `@components`, `@utils`, `@hooks`, `@services`, etc.
- No console.log (use conditional logging with __DEV__)
- Use TypeScript strict mode

# Project Architecture
- React Native + WebView for reader (native modules for TTS, file access)
- TTS: Native Android service (`TTSForegroundService.kt`) + RN bridge (`TTSHighlightModule.kt`) + JS module (`TTSAudioManager.ts`)
- Reader: WebView with JS (`core.js`) communicates with RN via `postMessage`/`injectJavaScript`
- When screen is off, WebView JS is suspended - use RN-side logic for background operations

# Solutions Repository

## TTS Background Playback (2025-12-03)
- **Problem**: TTS fails to continue to next chapter when screen is off
- **Cause**: WebView JS is suspended, so `navigateChapter()` doesn't trigger new JS execution
- **Solution**: 
  1. Set `backgroundTTSPendingRef = true` before navigation
  2. Watch for `chapter.id` + `html` changes in useEffect
  3. Extract paragraphs from HTML using regex (`htmlParagraphExtractor.ts`)
  4. Start TTS batch directly from RN

## Stale Paragraph Index (2025-12-03)
- **Problem**: "updateState index X out of bounds" during chapter transition
- **Cause**: Old utterance IDs (e.g., `utterance_179`) still arriving after navigating to new chapter
- **Solution**: Reset `currentParagraphIndexRef = 0` on chapter change + bounds check in `highlightParagraph()`

## Log Spam Reduction (2025-12-03)
- **Problem**: "No more items to refill" logged on every `onSpeechDone` after queue exhausted
- **Solution**: Added `hasLoggedNoMoreItems` flag to only log once per batch

## Cross-Chapter Event Pollution (2025-12-03)
- **Problem**: Save events from old chapter corrupt new chapter's progress during transitions
- **Cause**: WebView's `updateState()` sends save events without chapter ID; old WebView still processes while new chapter loads
- **Key Insight**: WebView-side state updates continue independently of RN chapter state
- **Solution**:
  1. Add `chapterId` to ALL save events in `core.js` (5 locations)
  2. Validate `chapterId` in RN's `onMessage` handler for save events
  3. Add 1-second grace period (`chapterTransitionTimeRef`) after chapter change
  4. Clear TTSAudioManager queue state before starting new batch
  5. Reject events with mismatched or missing chapterId during grace period

## ForegroundService Error on Android 12+ (2025-12-03)
- **Problem**: `ForegroundServiceStartNotAllowedException` during chapter transitions
- **Cause**: Android 12+ restricts starting foreground services from background
- **Solution**: Track `isServiceForeground` state, only call `startForeground()` when not already foreground
