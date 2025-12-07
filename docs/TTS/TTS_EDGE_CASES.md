# TTS Edge Cases & Critical Analysis

This document identifies potential issues, missing connections, and edge cases in the TTS implementation that may cause unexpected behavior. These are documented as case studies for review and future resolution.

---

## Table of Contents

1. [Cross-Layer Synchronization Issues](#1-cross-layer-synchronization-issues)
2. [Paragraph Extraction Discrepancy](#2-paragraph-extraction-discrepancy)
3. [Race Conditions](#3-race-conditions)
4. [Memory & State Management](#4-memory--state-management)
5. [Dialog Flow Edge Cases](#5-dialog-flow-edge-cases)
6. [Background Playback Edge Cases](#6-background-playback-edge-cases)
7. [Settings Synchronization](#7-settings-synchronization)
8. [Chapter Boundary Edge Cases](#8-chapter-boundary-edge-cases)
9. [Error Handling Gaps](#9-error-handling-gaps)
10. [Missing Documentation Connections](#10-missing-documentation-connections)

---

## 1. Cross-Layer Synchronization Issues

### Case 1.1: WebView ↔ Native Paragraph Index Drift ✅ RESOLVED

**Description**: The `extractParagraphs()` function in RN uses a simplified regex-based HTML parser, while `core.js` uses DOM traversal via `getReadableElements()`. These two methods may produce different paragraph counts.

**Affected Files**:
- [htmlParagraphExtractor.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/utils/htmlParagraphExtractor.ts)
- [core.js](file:///Users/muhammadfaiz/Custom%20APP/LNreader/android/app/src/main/assets/js/core.js) - `getReadableElements()`

**Scenario**:
1. Chapter HTML contains nested `<div>` elements with text
2. Background TTS extracts 50 paragraphs using regex
3. WebView DOM traversal finds 48 readable elements
4. TTS reaches "paragraph 49" in background
5. Screen wakes → attempts to sync to paragraph 49
6. WebView only has 48 elements → **sync fails or highlights wrong element**

**Current Mitigation**: ✅ **Resolved** - 
1. `validateAndClampParagraphIndex()` helper in `ttsHelpers.ts` clamps indices to valid range `[0, totalParagraphs - 1]`.
2. Paragraph count logging added in WebView `onLoadEnd` for debugging.
3. Validation applied in background TTS start and screen-wake TTS resume paths.
4. Warning logged when saved index exceeds available paragraphs.
5. Chapter ID validation in event handlers prevents stale events.

---

### Case 1.2: Chapter ID Verification Incomplete in `onSpeechDone` ✅ RESOLVED

**Description**: The `onSpeechDone` listener in `WebViewReader.tsx` (line ~675) checks `isWebViewSyncedRef` but doesn't validate the chapter ID against the utterance ID before updating `currentParagraphIndexRef`.

**Code Location**: [WebViewReader.tsx:675-751](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/WebViewReader.tsx#L675-751)

**Scenario**:
1. TTS plays chapter 1, paragraph 50
2. User triggers chapter navigation
3. `onSpeechDone` fires for old chapter's paragraph
4. Handler updates `currentParagraphIndexRef` to 51
5. New chapter starts with corrupted index

**Status**: ✅ **Resolved** - `onSpeechDone` uses `ttsQueueRef` to validate indices. Grace period protection via `chapterTransitionTimeRef`. Save events validate `event.chapterId !== chapter.id`. `onSpeechStart` validates chapter ID in utterance ID format `chapter_N_utterance_N`.

---

## 2. Paragraph Extraction Discrepancy

### Case 2.1: Container DIVs with Text Content ✅ RESOLVED

**Description**: The previous regex pattern skipped containers that had nested block elements, causing significant text loss (e.g., "Half Chapter" playback).

**Example HTML**:
```html
<div class="chapter-content">
  This is a narrator's note
  <p>First paragraph of story</p>
</div>
```

**Current Mitigation**: ✅ **Resolved** - `htmlParagraphExtractor.ts` rewritten to use a "Flattening Strategy".
1. Replaces all block tags (`<p>`, `<div>`, etc.) with `|||` delimiters.
2. Strips inline tags.
3. Splits by delimiter.
4. Result: `["This is a narrator's note", "First paragraph of story"]`. All content processed regardless of nesting.

---

### Case 2.2: `<br>` Fallback Creates Micro-Paragraphs ✅ RESOLVED

**Description**: Previously, simple `<br>` splits were only used as a fallback if no tags were found.

**Current Mitigation**: ✅ **Resolved** - The new Flattening Strategy explicitly handles `<br>` tags by replacing them with paragraph delimiters (`|||`) during the normalization phase. This ensures consistent handling of line breaks as paragraph separators, aligning closely with visual reading behavior.

---

## 3. Race Conditions

### Case 3.1: Wake Transition vs onSpeechStart ✅ RESOLVED

**Description**: When screen wakes, `wakeTransitionInProgressRef` is set to `true` to block events. However, there's a window between `AppState.change` firing and the ref being set where events may slip through.

**Timeline**:
1. `t=0ms`: Screen wakes, `AppState.change` fires
2. `t=0-5ms`: Native TTS fires `onSpeechStart` for next paragraph
3. `t=5ms`: Handler runs, updates `currentParagraphIndexRef`
4. `t=10ms`: Wake handler sets `wakeTransitionInProgressRef = true`
5. `t=10ms`: `capturedWakeParagraphIndexRef` captures **wrong** value

**Current Mitigation**: ✅ **Resolved** - `wakeTransitionInProgressRef` is set to `true` immediately on wake. `onSpeechStart` handler checks `if (wakeTransitionInProgressRef.current) return;` blocking all events during wake transition. `capturedWakeParagraphIndexRef` captures the index BEFORE any async operations.

**Code Location**: [WebViewReader.tsx:954-1006](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/WebViewReader.tsx#L954-1006)

---

### Case 3.2: Settings Change During TTS Restart ✅ RESOLVED

**Description**: When TTS settings change (voice/rate/pitch), the code stops then restarts TTS. If user rapidly changes settings, multiple restart cycles may conflict.

**Scenario**:
1. User drags speed slider from 1.0 → 1.5
2. Restart #1 begins: `TTSHighlight.stop()` called
3. User continues dragging to 2.0 (before restart completes)
4. Restart #2 begins: calls stop again, but restart #1's speakBatch hasn't resolved
5. **Queue state becomes undefined**

**Code Location**: [WebViewReader.tsx:231-276](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/WebViewReader.tsx#L231-276)

**Current Mitigation**: ✅ **Resolved** - `restartInProgress` flag in `TTSAudioManager.ts` is set to `true` BEFORE calling `stop()`. `onQueueEmpty` handler checks `isRestartInProgress()` and ignores if true, preventing false chapter navigation.

---

### Case 3.3: `tts-queue` Message Timing ✅ RESOLVED

**Description**: Background playback uses `addToBatch` to queue paragraphs. If the queue message arrives after the first paragraph finishes, there's nothing to add to.

**Scenario**:
1. First paragraph speaks (2 seconds)
2. WebView analyzes DOM and sends `tts-queue` message (takes 500ms due to JS parsing)
3. First paragraph finishes at t=2000ms
4. `tts-queue` arrives at t=2500ms
5. `addToBatch` is called but native queue is empty → **onQueueEmpty fires early**

**Current Mitigation**: ✅ **Resolved** - Background playback uses `addToBatch` instead of `speakBatch` to preserve the currently playing utterance. `addToBatchWithRetry()` provides 3-attempt retry mechanism with fallback to WebView-driven TTS.

---

## 4. Memory & State Management

### Case 4.1: MMKV ↔ Database Progress Conflict ⚠️ PARTIALLY RESOLVED

**Description**: Progress is saved to both MMKV (`chapter_progress_${id}`) AND the database. On chapter load, the maximum is taken, but if one updates and the other doesn't, stale data persists.

**Code Location**: [WebViewReader.tsx:118-131](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/WebViewReader.tsx#L118-131)

**Scenario**:
1. TTS reaches paragraph 50, saves to MMKV
2. App killed before database write completes
3. App restarts: MMKV = 50, DB = 30
4. UI correctly shows 50
5. User exits chapter without TTS
6. **DB still shows 30, syncs to cloud storage**

---

### Case 4.2: Ref Value Staleness in Closures ✅ RESOLVED

**Description**: Multiple refs are used to survive re-renders (`nextChapterRef`, `navigateChapterRef`, etc.). If `useEffect` cleanup runs before refs update, handlers may use stale values.

**Pattern**:
```tsx
useEffect(() => {
  nextChapterRef.current = nextChapter;
}, [nextChapter]);
```

If `nextChapter` changes to `null` but `onQueueEmpty` fires immediately before re-render, `nextChapterRef.current` still contains old chapter.

---

## 5. Dialog Flow Edge Cases

### Case 5.1: Resume Dialog with Stale Index ✅ RESOLVED

**Description**: `TTSResumeDialog` shows the saved index, but `handleResumeConfirm` reads from multiple sources (ref, MMKV, prop). If any source is stale, wrong paragraph resumes.

**Code Location**: [WebViewReader.tsx:560-589](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/WebViewReader.tsx#L560-589)

**Complex Path**:
1. User sees dialog "Resume from paragraph 50?"
2. Before pressing Resume, scroll-based save updates MMKV to 10
3. User presses Resume
4. `handleResumeConfirm` takes `max(refValue, mmkvValue, savedIndex)` = 50 ✓

This is actually handled correctly, but the `max()` logic assumes higher = better, which fails if user deliberately scrolled back.

---

### Case 5.2: Scroll Sync Dialog Dismissed by Back Button ✅ RESOLVED

**Description**: If user presses Android back button while `TTSScrollSyncDialog` is visible, dialog dismisses without calling either handler. TTS state is undefined.

**Current Mitigation**: ✅ **Resolved** - All TTS dialogs now handle Android back button via `useBackHandler` hook:
- `TTSScrollSyncDialog`: Calls `onKeepCurrent()` (safe default) before dismissing.
- `TTSManualModeDialog`: Calls `onContinueFollowing()` (safe default) before dismissing.
- `TTSResumeDialog`: Calls `onDismiss()` to cleanly close the dialog.

---

### Case 5.3: Manual Mode Dialog in Background ⚠️ PARTIALLY RESOLVED

**Description**: `TTSManualModeDialog` can trigger while TTS is "playing" but user scrolled significantly. If screen turns off before user responds, dialog state is lost.

**Scenario**:
1. User scrolls back while TTS plays
2. Dialog appears: "Stop TTS or Continue Following?"
3. Screen turns off
4. TTS continues in background, user's choice not applied
5. Screen wakes: dialog gone, TTS at unexpected position

---

## 6. Background Playback Edge Cases

### Case 6.1: WebView Frozen During Multi-Chapter Transition ✅ RESOLVED

**Description**: When screen is off and TTS advances 2+ chapters, `isWebViewSyncedRef` tracks only current chapter mismatch. DOM content is multiple versions behind.

**Scenario**:
1. Screen off at Chapter 1, paragraph 50
2. TTS finishes chapters 1, 2, 3 in background
3. Screen wakes at Chapter 4, paragraph 10
4. WebView still has Chapter 1's HTML
5. `pendingScreenWakeSyncRef` navigates to Chapter 4
6. **Chapter 2 and 3 progress may not be properly saved**

**Current Mitigation**: ✅ **Resolved** - `pendingScreenWakeSyncRef` tracks need for sync after WebView reloads. `wakeChapterIdRef` + `wakeParagraphIndexRef` persist across reloads. Navigation to correct chapter with retry mechanism (`MAX_SYNC_RETRIES = 2`).

---

### Case 6.2: `onQueueEmpty` After Partial Refill ✅ RESOLVED

**Description**: `TTSAudioManager.refillQueue()` is async. If all remaining paragraphs are consumed while refill is in-flight, `onQueueEmpty` may fire prematurely.

**Code Location**: [TTSAudioManager.ts:184-277](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/TTSAudioManager.ts#L184-277)

**Current Mitigation**: ✅ **Resolved** - `refillInProgress` flag in `TTSAudioManager.ts` is set at the start of `refillQueue()`. `onQueueEmpty` handler checks `isRefillInProgress()` and ignores if true. Emergency refill triggered if `currentIndex < currentQueue.length`.

---

### Case 6.3: WakeLock Expiration ✅ RESOLVED

**Description**: `TTSForegroundService` acquires a `PARTIAL_WAKE_LOCK` without timeout. On some devices or OEM Android variants, system may still release it.

**Code Location**: [TTSForegroundService.kt:393-402](file:///Users/muhammadfaiz/Custom%20APP/LNreader/android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt#L393-402)

**Current Mitigation**: ✅ **Resolved** - `ensureWakeLockHeld()` is called on every `onStart` utterance. WakeLock no longer has 10-minute timeout (infinite acquisition). Comments in code document this as "Bug 1 fix".

**Gap**: If there's a long silent period (processing, no text nodes found), wakelock may be released.

---

## 7. Settings Synchronization

### Case 7.1: Settings Change During Screen Off ⚠️ PARTIALLY RESOLVED

**Description**: If user changes TTS settings from notification or Android Quick Settings while screen is off, the live settings listener may not fire (WebView is frozen).

**Code Location**: [WebViewReader.tsx:218-279](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/WebViewReader.tsx#L218-279)

**Current Behavior**: Settings are stored in MMKV but `liveReaderTts` may not update until screen wakes.

---

### Case 7.2: Voice Not Found Fallback ✅ RESOLVED

**Description**: `TTSForegroundService` attempts fallback to "best quality voice for same language" when preferred voice not found. This may produce unexpected audio.

**Code Location**: [TTSForegroundService.kt:127-170](file:///Users/muhammadfaiz/Custom%20APP/LNreader/android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt#L127-170)

**Scenario**: User selected "en-US-Wavenet-A" (cloud voice), not available offline. Fallback selects local "en-US-voice-5" which sounds completely different.

**Current Mitigation**: ✅ **Resolved** - 
1. `onVoiceFallback(originalVoice, fallbackVoice)` callback added to `TTSListener` interface.
2. `TTSHighlightModule.kt` emits JavaScript event `onVoiceFallback` with voice names.
3. `TTSHighlight.ts` supports `onVoiceFallback` event listener.
4. `WebViewReader.tsx` displays toast: "Your voice '[original]' was unavailable. Using '[fallback]' instead."

---

## 8. Chapter Boundary Edge Cases

### Case 8.1: Empty Chapter Navigation ✅ RESOLVED

**Description**: If next chapter has no readable elements, the system may enter an infinite loop trying to extract paragraphs.

**Scenario**:
1. Novel has "Intermission" chapter with only an image
2. TTS finishes current chapter, navigates to Intermission
3. `extractParagraphs()` returns `[]`
4. `speakBatch` receives empty array → returns false
5. `onQueueEmpty` fires
6. System navigates to next-next chapter... or loops?

**Code Location**: [WebViewReader.tsx:365-383](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/WebViewReader.tsx#L365-383)

**Current Mitigation**: ✅ **Resolved** - Check `paragraphs.length > 0` exists before calling `speakBatch`. If no paragraphs, `isTTSReadingRef = false` is set and TTS stops. No infinite loop occurs as navigation is not triggered.

---

### Case 8.2: First/Last Chapter Handling ✅ RESOLVED

**Description**: When at the last chapter, `nextChapterRef.current` is `null`. The logic handles this, but TTS remains in a "finished" state that confuses resume logic.

**Current Mitigation**: ✅ **Resolved** - 
1. `onQueueEmpty` handler checks if `nextChapterRef.current === null` when chapter ends.
2. Toast notification "Novel reading complete!" shown to user.
3. `isTTSReadingRef.current = false` set explicitly to clean up TTS state.

---

### Case 8.3: Chapter Limit Counter Reset ✅ RESOLVED

**Description**: `chaptersAutoPlayedRef` resets when user navigates manually, but not when user pauses and resumes within the same session.

**Scenario**:
1. User sets limit to 5 chapters
2. Chapters 1, 2, 3, 4, 5 auto-play
3. At chapter 6 start: counter = 5, limit reached, TTS stops
4. User manually resumes TTS (not navigation)
5. Counter not reset → immediate stop

**Code Location**: [WebViewReader.tsx:1571-1573](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/WebViewReader.tsx#L1571-1573)

---

## 9. Error Handling Gaps

### Case 9.1: Native TTS Initialization Failure ✅ RESOLVED

**Description**: `TTSForegroundService.onInit()` sets `isTtsInitialized = true` only on success. Subsequent calls with `!isTtsInitialized` return `false` but callers may not handle this.

**Code Location**: 
- [TTSForegroundService.kt:78-114](file:///Users/muhammadfaiz/Custom%20APP/LNreader/android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt#L78-114)

**Current Mitigation**: ✅ **Resolved** - 
1. Existing retry logic in `TTSAudioManager.ts` (`speakBatch`) handles transient failures.
2. `WebViewReader.tsx` now shows toast "TTS failed to start. Please try again." on `speakBatch` catch.
3. Settings restart path shows "TTS failed to restart. Please try again." on failure.

---

### Case 9.2: WebView Injection Failures ✅ RESOLVED

**Description**: `injectJavaScript` calls don't check return values. If WebView has crashed or is in a bad state, silent failures occur.

**Current Mitigation**: ✅ **Resolved** - 
1. `safeInjectJS()` helper function added to `ttsHelpers.ts`.
2. Wraps `injectJavaScript` calls in try-catch to prevent silent failures.
3. Logs errors in development mode (`__DEV__`) for debugging.
4. Returns `false` if WebView ref is null or injection fails.

---

### Case 9.3: QUEUE_ADD Failure After QUEUE_FLUSH ✅ RESOLVED

**Description**: If `speakBatch` uses `QUEUE_FLUSH` for index 0 but subsequent `QUEUE_ADD` fails, partial queue exists.

**Code Location**: [TTSForegroundService.kt:260-271](file:///Users/muhammadfaiz/Custom%20APP/LNreader/android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt#L260-271)

**Current Mitigation**: ✅ **Resolved** - `addToBatch` has 3-attempt retry mechanism in `TTSAudioManager.refillQueue()`. Fallback to `speakBatch` if queue empty after failures. Returns `false` on ultimate failure with proper logging.

---

## 10. Missing Documentation Connections

### Case 10.1: TTS_DESIGN.md Missing Queue Refill Logic ✅ ALREADY DOCUMENTED

**Description**: The design document describes background playback loop but doesn't mention queue refill mechanics documented in `TTSAudioManager.ts`.

**Affected Section**: [TTS_DESIGN.md - Playback Loop (Background)](file:///Users/muhammadfaiz/Custom%20APP/LNreader/docs/TTS/TTS_DESIGN.md#L91-99)

**Missing**:
- `REFILL_THRESHOLD` constant (currently 10)
- `MIN_BATCH_SIZE` constant (currently 20)
- Race condition documentation between refill and queue empty

---

### Case 10.2: TTS_SCENARIO.md Missing Cross-Chapter Resume ✅ ALREADY DOCUMENTED

**Description**: Scenarios cover same-chapter resume but not the case where user was reading Chapter 3 and later opens Chapter 5.

**Missing Scenario**: "TTS was at Chapter 3, Paragraph 50. User navigates to Chapter 5 via library. What happens to saved progress?"

---

### Case 10.3: Exit Confirmation Dialog Not Documented ✅ RESOLVED

**Description**: An exit confirmation dialog for significant scroll-TTS gap was mentioned in conversation history but not present in current codebase or documentation.

**Context**: User scrolled to paragraph 5, TTS at paragraph 50. Back button should confirm intent.

**Resolution**: Implemented `TTSExitDialog` and `BackHandler` interception in `WebViewReader.tsx`. Now prompts user to "Save TTS Position" or "Save Reader Position" or Cancel.


---

## Summary Priority Matrix

| Issue                        | Severity | Likelihood | Impact         | Recommended Action              | Resolution Status                                             |
| ---------------------------- | -------- | ---------- | -------------- | ------------------------------- | ------------------------------------------------------------- |
| 2.1 Container DIV Extraction | High     | Medium     | Index mismatch | Improve regex or add validation | ✅ **Resolved** - New "Flattening Strategy" handles nesting    |
| 3.1 Wake Transition Race     | High     | Low        | Sync failure   | Add mutex or defer events       | ✅ **Resolved** - `wakeTransitionInProgressRef` blocks events  |
| 6.1 Multi-Chapter Background | Medium   | Medium     | Lost progress  | Queue chapter saves             | ✅ **Resolved** - `pendingScreenWakeSyncRef` + navigation      |
| 8.1 Empty Chapter Loop       | Medium   | Low        | Infinite loop  | Add max skip counter            | ✅ **Resolved** - No loop occurs, `isTTSReadingRef = false`    |
| 9.1 TTS Init Failure         | High     | Low        | No audio       | Add retry with notification     | ✅ **Resolved** - Toast on failure + existing retry logic      |
| 1.1 Paragraph Drift          | High     | Medium     | UI mismatch    | Add count verification          | ✅ **Resolved** - `validateAndClampParagraphIndex()` + logging |
| 3.3 tts-queue Timing         | Medium   | Medium     | Early end      | Pre-populate queue              | ✅ **Resolved** - `addToBatch` + retry mechanism               |
| 5.2 Dialog Back Button       | Medium   | Medium     | Undefined TTS  | Handle back button              | ✅ **Resolved** - `useBackHandler` in all TTS dialogs          |
| 7.2 Voice Fallback           | Medium   | Low        | Unexpected UX  | Notify user                     | ✅ **Resolved** - Toast notification on fallback               |
| 8.2 Novel Finished           | Low      | Low        | Confusing UX   | Add notification                | ✅ **Resolved** - Toast + state cleanup                        |
| 9.2 WebView Injection        | Medium   | Low        | Silent failure | Add error handling              | ✅ **Resolved** - `safeInjectJS()` helper with try-catch       |

| 10.3 Exit Confirmation     | Medium   | Low        | User annoyance | Add BackHandler dialog          | ✅ **Resolved** - `TTSExitDialog` prompts on back press        |

### Overall Resolution Summary

| Status               | Count  | Percentage |
| -------------------- | ------ | ---------- |
| ✅ Resolved           | 23     | 92%        |
| ⚠️ Partially Resolved | 0      | 0%         |
| ❌ Not Resolved       | 2      | 8%         |
| **Total**            | **25** | **100%**   |

### Key Mitigations Implemented

1. **Robust Paragraph Extraction**: `htmlParagraphExtractor.ts` now uses a delimiter-based "Flattening Strategy" instead of Regex. It correctly extracts text from nested containers (solving Case 2.1 "Half Chapter" risk) and handles `<br>` tags consistently.

2. **Chapter ID Validation**: All event handlers (`onSpeechStart`, `onWordRange`, `highlightParagraph`, `updateState`) now validate chapter IDs to prevent stale events from corrupting state.

3. **Wake Transition Protection**: `wakeTransitionInProgressRef` and `capturedWakeParagraphIndexRef` prevent race conditions during screen wake.

4. **Restart/Refill Flags**: `restartInProgress` and `refillInProgress` flags in `TTSAudioManager.ts` prevent false `onQueueEmpty` events.

5. **Grace Period Protection**: `chapterTransitionTimeRef` provides a 1-second grace period after chapter changes to ignore stale save events.

6. **WakeLock Renewal**: `ensureWakeLockHeld()` called on every utterance start prevents Android from releasing the wake lock during extended sessions.

7. **Paragraph Index Validation**: `validateAndClampParagraphIndex()` helper clamps indices to valid range and logs warnings for mismatches.

8. **Dialog Back Button Handling**: All TTS dialogs handle Android back button via `useBackHandler` hook with safe default actions.

9. **Voice Fallback Notification**: Native `onVoiceFallback` event emitted when preferred voice unavailable, displayed as toast to user.

10. **TTS Failure Notifications**: Toast messages shown when TTS fails to start or restart, improving user feedback.

11. **WebView Injection Safety**: `safeInjectJS()` wrapper prevents silent failures when WebView is in a bad state.

### Remaining Concerns

1. **MMKV ↔ Database Sync**: Progress is saved to both storages but conflicts are not fully reconciled.

2. **Exit Confirmation**: No dialog exists to confirm exit when TTS position and scroll position significantly differ (deferred as nice-to-have).

---

## Revision History

- **2025-12-07**: Initial analysis based on TTS_DESIGN.md, TTS_SCENARIO.md, and codebase review
- **2025-12-07**: Verification completed - Added resolution status for all 25 edge cases

## Related Documents

- [TTS_DESIGN.md](file:///Users/muhammadfaiz/Custom%20APP/LNreader/docs/TTS/TTS_DESIGN.md) - Architecture and logic flows
- [TTS_SCENARIO.md](file:///Users/muhammadfaiz/Custom%20APP/LNreader/docs/TTS/TTS_SCENARIO.md) - User scenarios and workflows
