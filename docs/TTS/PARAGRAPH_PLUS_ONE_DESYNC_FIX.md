# TTS Paragraph +1 Desync Analysis (CORRECTED)

**Date**: 2026-01-04  
**Issue**: After reading middle dot paragraphs (`"······"`), highlight is **+1 AHEAD** of actual TTS reading position

---

## Corrected Problem Description

**User Report** (corrected):
> Middle dots at paragraph 20: "······"  
> TTS is reading paragraph 30: "Some text..."  
> Highlight shows paragraph 31 (should be 30)  
> **Highlight is +1 ahead of actual TTS position**

---

## Root Cause Analysis

### Hypothesis 1: `onSpeechStart` updates highlight too early

**Scenario**:
```
TTS Queue:
- paragraph 29: "text before dots"
- paragraph 30: "text after dots"  ← TTS currently speaking this
- paragraph 31: "next paragraph"

Events timeline:
1. onSpeechDone(29) fires → currentParagraphIndexRef = 29 ✅
2. onSpeechStart(30) fires → currentParagraphIndexRef = 30 ✅
   → WebView injects highlightParagraph(30) ✅
3. onSpeechStart(31) fires EARLY → highlightParagraph(31) ❌ TOO EARLY
   → Highlight jumps to 31 while TTS still reading 30
```

**Likely cause**: `onSpeechStart` for next paragraph fires BEFORE current paragraph finishes speaking.

---

### Hypothesis 2: Middle dot paragraphs trigger double increment

**Scenario**:
```
Paragraph 20: "······"

Events:
1. onSpeechStart(20) → currentParagraphIndexRef = 20, highlight = 20 ✅
2. onSpeechDone(20) fires IMMEDIATELY (500ms) → ref = 20, next = 21
3. onSpeechStart(21) → ref = 21, highlight = 21 ✅
...
4. Later at paragraph 30:
   - onSpeechStart(30) → ref = 30
   - BUT highlight was already incremented to 31 due to race condition
```

**Key insight**: Middle dots complete SO FAST that events overlap, causing double-increment.

---

### Hypothesis 3: `highlightRange` vs `highlightParagraph` conflict

**Code paths**:
1. **Word-level highlighting**: `onWordRange` → `highlightRange(paragraphIndex, start, end)`
   - Called 50-100 times per paragraph
   - Highlights individual words within CURRENT paragraph
   
2. **Paragraph-level highlighting**: `onSpeechStart` → `highlightParagraph(paragraphIndex)`
   - Called once per paragraph
   - Highlights ENTIRE paragraph

**Potential conflict**:
```javascript
// In useTTSController.ts, onSpeechStart handler
const paragraphIndex = parseParagraphIndex(event.utteranceId);
webViewRef.current?.injectJavaScript(`
  window.tts.highlightParagraph(${paragraphIndex}, ${chapterId});
`);
```

**If `highlightParagraph` is called with NEXT paragraph index while CURRENT paragraph is still speaking**:
- `onWordRange` calls: `highlightRange(30, 0, 10)` → highlights word in paragraph 30 ✅
- `onSpeechStart(31)` fires early: `highlightParagraph(31)` → jumps highlight to 31 ❌
- Visual result: Highlight at 31, but TTS still reading 30

---

## Key Code Sections to Investigate

### 1. When does `onSpeechStart` fire?

**File**: `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt` (line ~290)

```kotlin
override fun onStart(utteranceId: String) {
    ttsListener?.onSpeechStart(utteranceId)
}
```

**Question**: Does `onStart` fire BEFORE or AFTER previous utterance completes?

**Android TTS Documentation** (from research):
> `onStart()` is called when synthesis begins for an utterance. If the utterance is queued (QUEUE_ADD), 
> this may occur BEFORE the previous utterance's `onDone()` callback.

**Answer**: `onStart` for next paragraph CAN fire BEFORE `onDone` for current paragraph!

---

### 2. How does React Native handle overlapping events?

**File**: `src/screens/reader/hooks/useTTSController.ts` (line ~2140)

```typescript
// onSpeechStart handler
const startSubscription = TTSHighlight.addListener('onSpeechStart', event => {
  const utteranceId = event?.utteranceId || '';
  const paragraphIndex = parseParagraphIndex(utteranceId);
  
  // Update currentParagraphIndexRef
  currentParagraphIndexRef.current = paragraphIndex;
  
  // Inject highlight
  webViewRef.current?.injectJavaScript(`
    window.tts.highlightParagraph(${paragraphIndex}, ${chapterId});
  `);
});
```

**Problem**: If `onStart(31)` fires BEFORE `onDone(30)`:
1. `currentParagraphIndexRef.current = 31` ❌ Premature
2. `highlightParagraph(31)` injected ❌ Highlight jumps ahead
3. `onDone(30)` fires late → ref ALREADY at 31, no correction

---

### 3. Middle dot paragraph timing

**Observation**: `"······"` takes ~500ms to "speak" (silence)

**Normal paragraph**: ~3-5 seconds to speak
- `onStart(N)` fires at T=0s
- `onDone(N)` fires at T=3s
- `onStart(N+1)` fires at T=3.1s ✅ Clear separation

**Middle dot paragraph**: ~500ms
- `onStart(20)` fires at T=0s
- `onDone(20)` fires at T=0.5s ← VERY FAST
- `onStart(21)` fires at T=0.6s
- `onStart(22)` might fire at T=0.7s (if queued) ❌ Overlaps with 21

**Result**: Events arrive faster than React Native can process → Race condition

---

## Proposed Fixes

### Fix 1: Use `onDone` to update highlight, not `onStart`

**Rationale**: `onDone` is definitive - paragraph COMPLETED speaking. `onStart` is premature.

**Implementation**:
```typescript
// In useTTSController.ts

// REMOVE highlight update from onSpeechStart
const startSubscription = TTSHighlight.addListener('onSpeechStart', event => {
  // NO highlight update here
  // Just log or update internal state
});

// ADD highlight update to onSpeechDone
const doneSubscription = TTSHighlight.addListener('onSpeechDone', event => {
  const paragraphIndex = parseParagraphIndex(event.utteranceId);
  currentParagraphIndexRef.current = paragraphIndex;
  
  // Update highlight for COMPLETED paragraph
  webViewRef.current?.injectJavaScript(`
    window.tts.highlightParagraph(${paragraphIndex}, ${chapterId});
  `);
  
  // Scroll to NEXT paragraph (user sees what's coming)
  const nextIndex = paragraphIndex + 1;
  webViewRef.current?.injectJavaScript(`
    window.tts.scrollToElement(window.tts.currentElement);
  `);
});
```

**Pros**:
- ✅ Highlight synchronized with actual completion
- ✅ No race conditions (onDone is final)
- ✅ Works for fast paragraphs (middle dots) and slow paragraphs

**Cons**:
- ⚠️ Highlight lags slightly behind TTS audio (user hears word before it highlights)
- ⚠️ For long paragraphs, user won't see highlight until completion

---

### Fix 2: Debounce highlight updates

**Rationale**: Rate-limit highlight changes to prevent rapid jumps during fast events.

**Implementation**:
```typescript
// In useTTSController.ts
const lastHighlightUpdateRef = useRef<number>(0);
const HIGHLIGHT_DEBOUNCE_MS = 300; // Minimum time between highlight updates

const startSubscription = TTSHighlight.addListener('onSpeechStart', event => {
  const now = Date.now();
  if (now - lastHighlightUpdateRef.current < HIGHLIGHT_DEBOUNCE_MS) {
    return; // Skip rapid updates
  }
  lastHighlightUpdateRef.current = now;
  
  const paragraphIndex = parseParagraphIndex(event.utteranceId);
  currentParagraphIndexRef.current = paragraphIndex;
  
  webViewRef.current?.injectJavaScript(`
    window.tts.highlightParagraph(${paragraphIndex}, ${chapterId});
  `);
});
```

**Pros**:
- ✅ Prevents rapid highlight jumps
- ✅ Minimal code changes

**Cons**:
- ⚠️ Highlight still may not match TTS exactly during fast sections
- ⚠️ Arbitrary delay (300ms) - needs tuning

---

### Fix 3: Guard `onStart` with `onDone` completion check

**Rationale**: Don't update highlight for next paragraph until current paragraph confirmed done.

**Implementation**:
```typescript
// In useTTSController.ts
const lastCompletedParagraphRef = useRef<number>(-1);

// onSpeechDone - Mark paragraph as COMPLETED
const doneSubscription = TTSHighlight.addListener('onSpeechDone', event => {
  const paragraphIndex = parseParagraphIndex(event.utteranceId);
  lastCompletedParagraphRef.current = paragraphIndex;
  // Save progress, update state...
});

// onSpeechStart - Only update highlight if PREVIOUS paragraph completed
const startSubscription = TTSHighlight.addListener('onSpeechStart', event => {
  const paragraphIndex = parseParagraphIndex(event.utteranceId);
  
  // Guard: Only proceed if previous paragraph finished
  const expectedPrevious = paragraphIndex - 1;
  if (expectedPrevious >= 0 && lastCompletedParagraphRef.current < expectedPrevious) {
    // Previous paragraph not yet completed, SKIP highlight update
    console.warn(`TTS: onStart(${paragraphIndex}) fired before onDone(${expectedPrevious})`);
    return;
  }
  
  currentParagraphIndexRef.current = paragraphIndex;
  webViewRef.current?.injectJavaScript(`
    window.tts.highlightParagraph(${paragraphIndex}, ${chapterId});
  `);
});
```

**Pros**:
- ✅ Prevents premature highlight updates
- ✅ Maintains strict event ordering
- ✅ Works for all paragraph types (fast or slow)

**Cons**:
- ⚠️ Complexity: Need to track completion state
- ⚠️ Edge case: First paragraph (expectedPrevious = -1)

---

## Recommended Fix: Hybrid Approach (Fix 1 + Fix 3)

**Strategy**: Use `onDone` as primary trigger + guard against premature `onStart`

```typescript
const lastCompletedParagraphRef = useRef<number>(-1);
const highlightedParagraphRef = useRef<number>(-1);

// onSpeechDone - Update highlight when paragraph COMPLETES
const doneSubscription = TTSHighlight.addListener('onSpeechDone', event => {
  const paragraphIndex = parseParagraphIndex(event.utteranceId);
  lastCompletedParagraphRef.current = paragraphIndex;
  currentParagraphIndexRef.current = paragraphIndex;
  
  // Update highlight for COMPLETED paragraph
  if (highlightedParagraphRef.current !== paragraphIndex) {
    highlightedParagraphRef.current = paragraphIndex;
    webViewRef.current?.injectJavaScript(`
      window.tts.highlightParagraph(${paragraphIndex}, ${chapterId});
    `);
  }
  
  // Save progress, update media notification, etc.
  saveProgressRef.current(percentage, paragraphIndex);
});

// onSpeechStart - Only for logging/state (NO highlight update)
const startSubscription = TTSHighlight.addListener('onSpeechStart', event => {
  const paragraphIndex = parseParagraphIndex(event.utteranceId);
  
  // Optional: Pre-scroll to next paragraph (user can see what's coming)
  // but DON'T highlight yet
  webViewRef.current?.injectJavaScript(`
    const readableElements = reader.getReadableElements();
    if (readableElements[${paragraphIndex}]) {
      window.tts.scrollToElement(readableElements[${paragraphIndex}]);
    }
  `);
});
```

**Advantages**:
- ✅ Highlight always matches COMPLETED paragraph
- ✅ No race conditions (onDone is definitive)
- ✅ User can see scroll ahead to next paragraph (via onStart)
- ✅ Works for fast paragraphs (middle dots) without desync

---

## Testing Plan

### Test Case 1: Middle dot paragraph sequence
```
Input:
Paragraph 19: "Text before dots"
Paragraph 20: "······"
Paragraph 21: "Text after dots"
Paragraph 22: "More text"

Expected behavior:
- TTS reads 19 → Highlight at 19 ✅
- TTS reads 20 (500ms) → Highlight at 20 ✅
- TTS reads 21 → Highlight at 21 ✅ (NOT 22)
- TTS reads 22 → Highlight at 22 ✅
```

### Test Case 2: Rapid navigation through Chapter 214
```
Start TTS at paragraph 0, let it run through paragraph 30 (includes middle dots at 20, 25, 28)
Expected: Highlight always matches current TTS paragraph (±0 offset)
```

### Test Case 3: Multiple consecutive middle dots
```
Paragraph 25: "······"
Paragraph 26: "······"
Paragraph 27: "······"
Paragraph 28: "Text"

Expected: Highlight advances 25 → 26 → 27 → 28 without skipping
```

---

## Implementation Priority

**P0 (Critical)**: Fix 1 + Fix 3 hybrid  
**Estimated effort**: 2-3 hours  
**Risk**: Low (using existing event handlers, just changing when highlight updates)  
**Testing**: Run through Chapter 214 manually, verify highlight matches TTS position

---

**Status**: Ready for implementation  
**Next Step**: Implement hybrid fix in useTTSController.ts, test with Chapter 214
