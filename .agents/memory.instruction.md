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

## Screen Wake TTS Scroll Issue (2025-12-03)
- **Problem**: When screen wakes during background TTS after chapter transition, WebView scrolls to wrong paragraphs (from previous chapter) then jumps back
- **Cause**: 
  1. When screen wakes, WebView resumes and processes stale JS injections from RN's event listeners
  2. `onSpeechStart`/`onSpeechDone` still have queued calls for old chapter paragraphs
  3. These inject `highlightParagraph()` and `updateState()` with old indices, causing wrong scrolls
- **Solution**:
  1. Add chapter ID parameter to `highlightParagraph(paragraphIndex, chapterId)` and `updateState(paragraphIndex, chapterId)` in core.js
  2. Validate chapter ID before processing - reject stale events from old chapters
  3. Pass `prevChapterIdRef.current` in all RN inject calls
  4. Add screen wake handler in AppState listener to force sync WebView to current paragraph

## TTS Resume Skips First Paragraph (2025-12-03)
- **Problem**: When user confirms resume from prompt, TTS starts from next paragraph instead of saved paragraph
- **Cause**: `restoreState()` sets `currentElement` but then calls `next()` which advances to next element due to `findNextTextNode()` logic
- **Solution**: Call `speak()` directly instead of `next()` in `restoreState()` when `autoStart` is true. Also set `prevElement` to previous paragraph to prevent skip logic.

## TTS Slider UX (2025-12-03)
- **Problem**: Rate/pitch sliders only respond to tap, not drag. Hard to adjust values precisely.
- **Solution**:
  1. Add local state for slider values (`localRate`, `localPitch`) with drag tracking
  2. Use `onValueChange` for real-time display updates during drag
  3. Use `onSlidingComplete` to persist to settings
  4. Add +/- buttons for fine control
  5. Add visual markers (Slow/Normal/Fast, Low/Normal/High)
  6. Reduce max values to more usable ranges (3x speed, 2x pitch)

## TTS Multi-Chapter Continuation Bug (2025-12-04)
- **Problem**: TTS playback stops after transitioning to one chapter, won't continue to subsequent chapters
- **Root Cause**: After successful background TTS batch start in `WebViewReader.tsx`, `isTTSReadingRef.current` was not set to `true`. The `onQueueEmpty` handler checks this flag and ignores events if false.
- **Key Insight**: The TTS flow requires `isTTSReadingRef.current = true` for `onQueueEmpty` to trigger next chapter navigation
- **Solution**: Added `isTTSReadingRef.current = true;` in the `.then()` callback after successful `TTSHighlight.speakBatch()` call
- **Files Modified**: `src/screens/reader/components/WebViewReader.tsx`

## TTS Robotic/Low-Quality Voice Bug (2025-12-04)
- **Problem**: TTS sometimes uses robotic/low-quality voice instead of user's preferred voice
- **Root Cause**: In `TTSForegroundService.kt`, when preferred voice is not found in `ttsInstance.voices`, the loop completes silently without setting any voice, falling back to system default
- **Key Insight**: Android TTS doesn't throw errors on voice unavailability - it silently falls back. TypeScript-side retry logic is ineffective.
- **Solution**: 
  1. Added voice availability check with retry logic in native `speak()` and `speakBatch()` functions
  2. If preferred voice not found, refresh voices list and retry
  3. If still not found, select best quality voice for the same language as fallback
  4. Added logging for voice selection issues
- **Files Modified**: `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt`

# Failed Approaches (Avoid These)
- Adding retry logic only in TypeScript layer for voice issues - doesn't help because Android TTS doesn't throw errors on voice unavailability
- Using `global.showToast()` for notifications in service files - causes TypeScript errors due to missing type definitions
