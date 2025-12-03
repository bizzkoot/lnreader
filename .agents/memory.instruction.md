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
