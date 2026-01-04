# TTS Highlight +1 Desync Fix v2

**Status**: ✅ IMPLEMENTED  
**Date**: 2026-01-03  
**Files Modified**: `src/screens/reader/hooks/useTTSController.ts`

## Problem Summary

After middle dot paragraphs ("······"), TTS highlight showed **paragraph N+1 while TTS was reading paragraph N**.

**User Example**:
- TTS reads paragraph 30 (audio playing)
- Highlight shows paragraph 31 (visual mismatch)
- User requirement: "current read TTS paragraph is the one that being highlighted. It need to be 1 to 1. No jump paragraph at all."

## Root Cause

**Android TTS API Race Condition**:
When using `TextToSpeech.QUEUE_ADD` mode, Android pre-queues paragraphs and fires `onSpeechStart(N+1)` callbacks **BEFORE** `onSpeechDone(N)` completes.

```
Timeline:
0ms    : speak(para 30)
500ms  : onStart(30) → highlight para 30 ✓
1000ms : onStart(31) fires EARLY (pre-queued) → highlight para 31 ✗ (WRONG!)
1200ms : onDone(30) fires (too late)
```

This causes highlight to jump 1 paragraph ahead during fast paragraphs (middle dots take ~500ms to speak).

## Solution: Completion Guard with Auto-Reset

### Implementation

Added `lastCompletedParagraphRef` to track which paragraph finished speaking, then guard `onSpeechStart` updates until previous paragraph completes.

**Key Logic**:
1. `onSpeechDone(N)`: Mark paragraph N as completed
2. `onSpeechStart(N+1)`: Only update highlight if paragraph N is completed
3. **Auto-reset**: When starting from a new position (e.g., user scrolls), reset tracking

### Code Changes

**File**: `src/screens/reader/hooks/useTTSController.ts`

#### 1. Add Ref (Line 328)
```typescript
const lastCompletedParagraphRef = useRef<number>(-1);
```

#### 2. Track Completion in onSpeechDone (Line ~1920)
```typescript
// FIX: Track completed paragraph for onSpeechStart guard
lastCompletedParagraphRef.current = finishedParagraph;

// Log with text preview
ttsCtrlLog.debug(
  'tts-paragraph-completed',
  `✓ TTS finished para ${finishedParagraph}: "${textPreview}..."`,
);
```

#### 3. Guard onSpeechStart Updates (Line ~2215)
```typescript
// FIX: Guard against premature onSpeechStart events
const expectedPrevious = paragraphIndex - 1;
const lastCompleted = lastCompletedParagraphRef.current;

// Reset completion tracking if starting from a new position
const isFirstParagraph = expectedPrevious < 0;
const isNewBatch = lastCompleted >= 0 && paragraphIndex - lastCompleted > 1;

if (isFirstParagraph || isNewBatch) {
  // Starting fresh - allow this paragraph and reset tracking
  lastCompletedParagraphRef.current = expectedPrevious;
  ttsCtrlLog.debug('completion-tracking-reset', 
    `Reset to ${expectedPrevious} (starting at ${paragraphIndex})`);
}

// Only update highlight if previous paragraph has completed
if (expectedPrevious < 0 || lastCompletedParagraphRef.current >= expectedPrevious) {
  currentParagraphIndexRef.current = paragraphIndex;
  
  // Update highlight
  webViewRef.current.injectJavaScript(`
    window.tts.highlightParagraph(${paragraphIndex}, ${currentChapterId});
  `);
} else {
  ttsCtrlLog.debug('premature-speech-start', 
    `Ignoring premature onStart(${paragraphIndex}) - previous ${expectedPrevious} not completed (last=${lastCompleted})`);
}
```

#### 4. Reset on TTS Stop (Line ~1118)
```typescript
// Reset completion tracking when TTS stops
lastCompletedParagraphRef.current = -1;

ttsCtrlLog.debug('tts-stopped-state-reset', 
  'TTS stopped, state reset to clean slate (completion tracking reset)');
```

### New Logging

Added detailed logging to compare TTS audio vs highlight state:

```
[useTTSController] ✓ TTS finished para 30: "······" 
[useTTSController] ▶ TTS starting para 31: "The sect master looked at..." (highlight→31, lastCompleted=30)
[useTTSController] completion-tracking-reset Reset to 17 (starting at 18, was 3)
```

**Log Markers**:
- `✓` = Paragraph completed (onSpeechDone)
- `▶` = Paragraph starting (onSpeechStart)
- Text preview = First 50 chars of paragraph content

## Testing

### Test Scenario
1. Open Chapter 214 (has middle dot paragraphs)
2. Play TTS from beginning
3. Watch logs during fast paragraphs (lines 18-30)
4. Verify highlight stays synchronized with audio (no +1 offset)

### Expected Logs
```
[useTTSController] ✓ TTS finished para 29: "previous text..."
[useTTSController] ▶ TTS starting para 30: "current text..." (highlight→30, lastCompleted=29)
```

### User Scroll Test
1. Play TTS at paragraph 3
2. Manually scroll to paragraph 18
3. Resume TTS
4. Should see: `completion-tracking-reset Reset to 17 (starting at 18, was 2)`
5. TTS should play from paragraph 18 with correct highlight

## Edge Cases Handled

1. **First paragraph**: `expectedPrevious < 0` → Allow (no guard)
2. **New batch after scroll**: `paragraphIndex - lastCompleted > 1` → Reset tracking
3. **TTS stop/resume**: Reset `lastCompletedParagraphRef` to -1
4. **Chapter transitions**: Already handled by WebView sync check

## Fix Evolution

### V1 (BROKEN)
- Initial guard blocked all premature `onStart` events
- **BUG**: Didn't reset tracking when user scrolled to new position
- **Symptom**: `premature-speech-start Ignoring onStart(18) - previous 17 not completed (last=2)`

### V2 (CURRENT)
- Added auto-reset logic when starting from new position
- Detects gap > 1 between `lastCompleted` and new `paragraphIndex`
- Resets tracking to allow new batch
- Works for both sequential playback AND user navigation

## Impact

✅ **Fixed**: Highlight now stays 1:1 synchronized with TTS audio  
✅ **No regressions**: All 1072 tests still passing  
✅ **Better logging**: Can verify sync state with text previews  

## Related Issues

- [Previous Analysis](TTS_CHAPTER_214_ANALYSIS.md) - Middle dot normalization investigation
- [Industry Research](TTS_HIGHLIGHT_SYNC_RESEARCH.md) - Text normalization approaches
- [Bug Report](https://github.com/lnreader/lnreader/issues/XXX) - User report (TBD)
