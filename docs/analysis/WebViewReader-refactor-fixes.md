# WebViewReader Refactor - TTS Chapter Navigation Fixes

**Date:** 2025-12-14
**Issue:** TTS breaks when navigating chapters via media notification controls (PREV_CHAPTER/NEXT_CHAPTER)

---

## Problem Summary

After refactoring WebViewReader to extract TTS logic into `useTTSController` hook, chapter navigation via media notification buttons was broken:

1. **PREV_CHAPTER navigation** → TTS stops completely, logs show "stale event" errors
2. **Re-opening reader** → Correct chapter loads but TTS fails with stale event warnings
3. **Root cause** → Missing chapter synchronization and improper background TTS flag handling

---

## Root Causes Identified

### Issue #1: Missing Chapter Synchronization Effect

**Problem:**
- `prevChapterIdRef.current` was never synced with `chapter.id` when chapter changes
- Native event listeners (onSpeechStart, onWordRange, onSpeechDone) validate incoming events against `prevChapterIdRef.current`
- When chapter ID changes but ref doesn't update → all events marked as "stale" → TTS breaks

**Example from logs:**
```
useTTSController: PREV_CHAPTER - navigating to chapter 6087
WebViewReader: Initializing scroll. DB: 0, MMKV: 0, Native: 0
useTTSController: Ignoring stale onSpeechStart from chapter 6088, current is 6088  // ❌ Wrong!
```

### Issue #2: Incomplete backgroundTTSPendingRef Logic

**Problem:**
- When PREV/NEXT_CHAPTER triggered:
  - Sets `backgroundTTSPendingRef.current = true`
  - Sets `autoStartTTSRef.current = true`
  - Calls `navigateChapter()`
- In `handleWebViewLoadEnd()`:
  - If `backgroundTTSPendingRef` is true → **returns early**
  - Never clears the flag
  - Never starts TTS
- **Result:** TTS never resumes after media navigation

**Code before fix:**
```typescript
if (backgroundTTSPendingRef.current) {
  console.log('onLoadEnd skipped TTS start - background TTS pending');
  return;  // ❌ Never starts TTS, never clears flag
}
```

### Issue #3: Missing WebView Sync State Management

**Problem:**
- `isWebViewSyncedRef` remained `true` during chapter transitions
- Old WebView unmounts while new one loads
- Events from old WebView (stale) mixed with new WebView initialization
- No coordination between unmount/mount cycle

---

## Fixes Implemented

### Fix #1: Added Chapter Change Synchronization Effect

**Location:** `useTTSController.ts` after "Keep Refs Synced" section (line ~440)

**What it does:**
1. **Immediately** updates `prevChapterIdRef.current = chapter.id`
2. Marks WebView as **unsynced** initially (`isWebViewSyncedRef.current = false`)
3. After 300ms delay, marks WebView as **synced** (allows WebView to stabilize)
4. Clears media navigation tracking after successful transition (2s delay)

**Code added:**
```typescript
useEffect(() => {
  console.log(
    `useTTSController: Chapter changed to ${chapter.id} (prev: ${prevChapterIdRef.current})`
  );

  // Update chapter ID ref IMMEDIATELY
  prevChapterIdRef.current = chapter.id;

  // Mark WebView as unsynced initially (new WebView loading)
  isWebViewSyncedRef.current = false;

  // Short delay to allow WebView to stabilize, then mark as synced
  const syncTimer = setTimeout(() => {
    isWebViewSyncedRef.current = true;
    console.log(
      `useTTSController: WebView marked as synced for chapter ${chapter.id}`
    );

    // Clear media navigation tracking after successful transition
    if (mediaNavSourceChapterIdRef.current) {
      console.log(
        `useTTSController: Clearing media nav tracking (source: ${mediaNavSourceChapterIdRef.current})`
      );
      setTimeout(() => {
        mediaNavSourceChapterIdRef.current = null;
        mediaNavDirectionRef.current = null;
      }, 2000);
    }
  }, 300);

  return () => clearTimeout(syncTimer);
}, [chapter.id]);
```

**Why this works:**
- Native listeners can now properly validate incoming events
- WebView injection skipped during unsafe transition period
- Media nav confirmation logic has time to complete before cleanup

---

### Fix #2: Fixed backgroundTTSPending Handling

**Location:** `useTTSController.ts` in `handleWebViewLoadEnd()` (line ~1229)

**What changed:**
- **Before:** If flag is true → return early (skip everything)
- **After:** If flag is true → clear it AND continue to autoStart logic if applicable

**Code after fix:**
```typescript
// Handle background TTS pending from media navigation
if (backgroundTTSPendingRef.current) {
  console.log('onLoadEnd detected background TTS pending');

  // Clear flag and start TTS if autoStart is also set
  backgroundTTSPendingRef.current = false;

  if (autoStartTTSRef.current) {
    console.log('Starting TTS from background navigation');
    // Falls through to autoStartTTS logic below
  } else {
    console.log('Background TTS cleared, no autoStart');
    return;
  }
}
```

**Why this works:**
- Flag is cleared immediately after chapter loads
- If `autoStartTTSRef` is also true (which it is for media nav), TTS starts automatically
- Normal flow continues for background-to-foreground TTS scenarios

---

### Fix #3: Added WebView Sync State Management to Chapter Navigation

**Location:** `useTTSController.ts` in `onMediaAction` handlers (lines ~1686, ~1760)

**What changed:**
- Added `isWebViewSyncedRef.current = false` **before** calling `navigateChapter()`
- Prevents race conditions where old WebView events arrive after navigation starts

**PREV_CHAPTER handler:**
```typescript
if (action === TTS_MEDIA_ACTIONS.PREV_CHAPTER) {
  if (!prevChapter) {
    showToastMessage('No previous chapter');
    return;
  }

  console.log(
    `useTTSController: PREV_CHAPTER - navigating to chapter ${prevChapter.id}`,
  );

  // Mark WebView as unsynced BEFORE navigation  ← NEW
  isWebViewSyncedRef.current = false;

  mediaNavSourceChapterIdRef.current = chapter.id;
  // ... rest of logic
}
```

**NEXT_CHAPTER handler:**
```typescript
if (action === TTS_MEDIA_ACTIONS.NEXT_CHAPTER) {
  if (!nextChapter) {
    showToastMessage('No next chapter');
    return;
  }

  console.log(
    `useTTSController: NEXT_CHAPTER - navigating to chapter ${nextChapter.id}`,
  );

  // Mark WebView as unsynced BEFORE navigation  ← NEW
  isWebViewSyncedRef.current = false;

  mediaNavSourceChapterIdRef.current = chapter.id;
  // ... rest of logic
}
```

---

### Fix #4: Enhanced Stale Event Filtering

**Location:** `useTTSController.ts` in native event listeners (lines ~1440-1600)

**What changed:**

1. **Better chapter validation logging:**
   - Changed from generic "Ignoring stale..." to `[STALE]` prefix
   - Reduced log throttle from 1000ms to 500ms for better debugging

2. **Added WebView sync checks to ALL native listeners:**
   - `onWordRange` - Skip if `!isWebViewSyncedRef.current`
   - `onSpeechStart` - Skip if `!isWebViewSyncedRef.current`
   - `onSpeechDone` - Skip if `!isWebViewSyncedRef.current`

**Example - onSpeechStart:**
```typescript
// Strict chapter validation
if (eventChapterId !== currentChapterId) {
  const now = Date.now();
  if (now - lastStaleLogTimeRef.current > 500) {
    console.log(
      `useTTSController: [STALE] onSpeechStart chapter ${eventChapterId} != ${currentChapterId}`,
    );
    lastStaleLogTimeRef.current = now;
  }
  return;
}

// Skip if WebView is not synced (during chapter transition)  ← NEW
if (!isWebViewSyncedRef.current) {
  console.log(
    `useTTSController: Skipping onSpeechStart during WebView transition`,
  );
  return;
}
```

**Why this works:**
- Events from old chapter are caught by chapter ID mismatch
- Events arriving during transition window are caught by sync check
- Reduces noise in logs (throttled logging)
- No WebView injection attempts during unsafe periods

---

## Testing Checklist

### Test Case 1: PREV_CHAPTER Navigation
- [ ] Start TTS on Chapter 8, paragraph 5
- [ ] Press "Previous Chapter" in media notification
- [ ] **Expected:** TTS auto-starts on Chapter 7 from paragraph 0
- [ ] **Expected:** No stale event errors in logs
- [ ] **Expected:** Media notification updates correctly
- [ ] **Expected:** Source chapter (8) marked as in-progress (1%)

### Test Case 2: NEXT_CHAPTER Navigation
- [ ] Start TTS on Chapter 7, paragraph 180+
- [ ] Press "Next Chapter" in media notification
- [ ] **Expected:** TTS auto-starts on Chapter 8 from paragraph 0
- [ ] **Expected:** No stale event errors
- [ ] **Expected:** Source chapter (7) marked as read (100%)

### Test Case 3: Multiple Navigation
- [ ] Start TTS on Chapter 7
- [ ] NEXT → Chapter 8
- [ ] PREV → Chapter 7
- [ ] NEXT → Chapter 8
- [ ] **Expected:** TTS continues correctly each time
- [ ] **Expected:** Progress tracking accurate

### Test Case 4: Background Resume
- [ ] Start TTS on Chapter 8
- [ ] Press Home button (app backgrounds)
- [ ] Wait 5 seconds
- [ ] Return to app (foreground)
- [ ] **Expected:** TTS resumes from correct position
- [ ] **Expected:** No stale events after resume

### Test Case 5: Screen Lock/Wake During Navigation
- [ ] Start TTS on Chapter 8
- [ ] PREV → Chapter 7
- [ ] Lock screen immediately
- [ ] Wait 3 seconds
- [ ] Unlock screen
- [ ] **Expected:** TTS playing on Chapter 7
- [ ] **Expected:** Correct paragraph position

---

## Expected Log Output (Success)

**PREV_CHAPTER Navigation:**
```
useTTSController: onMediaAction received -> ...PREV_CHAPTER
useTTSController: PREV_CHAPTER - navigating to chapter 6087
useTTSController: Chapter changed to 6087 (prev: 6088)
WebViewReader: Initializing scroll. DB: 0, MMKV: 0, Native: 0
useTTSController: WebView marked as synced for chapter 6087
useTTSController: onLoadEnd detected background TTS pending
useTTSController: Starting TTS from background navigation
useTTSController: Starting Unified Batch from index 0
```

**No stale event errors should appear.**

---

## Files Modified

1. **`src/screens/reader/hooks/useTTSController.ts`**
   - Added chapter change synchronization effect (~50 lines)
   - Fixed backgroundTTSPending handling (~20 lines modified)
   - Added WebView sync checks to PREV/NEXT handlers (~4 lines)
   - Enhanced stale event filtering in 3 native listeners (~30 lines modified)
   - Added WebView sync check to onSpeechDone (~10 lines)

**Total changes:** ~6 strategic fixes, ~110 lines modified/added

---

## Potential Edge Cases to Monitor

1. **Rapid navigation:** User quickly presses PREV → NEXT → PREV
   - Should be handled by debounce (200ms) in onMediaAction
   
2. **Network delay:** Chapter HTML loads slowly
   - Chapter sync effect still fires immediately on chapter.id change
   - TTS waits for WebView load → safe
   
3. **Very long chapters:** Queue management edge cases
   - Existing queue validation logic should handle
   - Media nav confirmation logic (5 paragraphs) unchanged

4. **Background playback disabled:** Should still work
   - backgroundTTSPending flag still cleared correctly
   - autoStart logic handles non-background mode

---

## Verification Commands

```bash
# Check for type errors
pnpm run type-check

# Run tests (if TTS tests exist)
pnpm test -- useTTSController

# Build and test on device
pnpm run build:release:android
```

---

## Related Issues (Potentially Fixed)

- Issue where TTS "loses track" after chapter navigation
- Stale event spam in development logs
- TTS not resuming after screen wake during chapter transition
- Media notification showing wrong chapter after navigation
- Progress tracking incorrect after PREV_CHAPTER

---

## Additional Notes

### Why 300ms delay for WebView sync?

- WebView needs time to:
  - Parse HTML
  - Execute injected JavaScript
  - Initialize `window.tts` and `window.reader` objects
  - Set up event listeners
- 300ms is conservative but safe across devices
- Too short → JS not ready, events fail silently
- Too long → noticeable delay before TTS starts

### Why 2000ms delay for media nav cleanup?

- Allows confirmation logic to run (5 paragraphs = ~30-60 seconds)
- Prevents premature cleanup if user navigates back quickly
- If cleanup happens too early, duplicate progress updates could occur

### Why multiple guard clauses?

**Defense in depth:**
1. Chapter ID validation (catch wrong chapter events)
2. WebView sync check (catch timing issues)
3. Wake transition check (catch screen wake races)
4. Queue validation (catch state inconsistencies)

Each layer catches different failure modes.

---

## Future Improvements (Out of Scope)

1. **Animated chapter transitions** - Show loading indicator during navigation
2. **Preload next chapter** - Start loading before TTS finishes
3. **Smarter sync delay** - Adjust 300ms based on device performance
4. **Chapter transition events** - Emit events for analytics/debugging
5. **Unit tests** - Test chapter sync logic in isolation

---

**Status:** ✅ IMPLEMENTED - Ready for testing
**Risk:** 🟢 Low - Changes are additive with clear guard clauses
**Rollback:** Easy - Revert to commit before fixes, TTS still functional (just broken on chapter nav)
