# Continuous Scroll & TTS Integration - Status Report

**Last Updated**: December 21, 2024  
**Status**: ✅ Core features working, ⚠️ TTS-triggered trim incomplete

---

## Overview

Continuous scrolling allows seamless chapter transitions by stitching the next chapter to the current chapter's DOM. When combined with TTS, this creates a smooth reading experience without interruptions.

##✅ Working Features

### 1. Chapter Stitching (95% Threshold)
- ✅ Next chapter auto-fetches and appends to DOM at 95% scroll
- ✅ Boundaries track paragraph ranges per chapter
- ✅ Seamless scroll transition between chapters
- ✅ `nextChapter` reference properly updated

### 2. Chapter Trimming (15% Threshold  
- ✅ Previous chapter removed from DOM at 15% scroll in next chapter
- ✅ DOM fully redrawn via `getChapter()` → proper state sync
- ✅ Scroll position preserved with pixel-perfect accuracy
- ✅ Chapter progress saved correctly (100% for previous, current% for new)
- ✅ `chapter-transition` event triggers full reload

### 3. TTS in Single Chapter
- ✅ TTS works perfectly in non-stitched chapters
- ✅ Highlight paragraphs correctly
- ✅ Scroll follows TTS position
- ✅ Auto-advance to next chapter (with download wait)

### 4. TTS Scroll Sync Dialog
- ✅ Detects when user scrolls away during TTS
- ✅ Shows dialog with chapter context (stitched mode aware)
- ✅ "Continue from here" option triggers stitched chapter clear
- ✅ "Keep TTS position" option scrolls back and clears

### 5. TTS Restart After Stitched Clear  
- ✅ `clearStitchedChapters()` removes other chapters from DOM
- ✅ `window.reader.chapter.id` updated immediately (fix #1)
- ✅ `prevChapterIdRef` synchronized in React Native (fix #2)
- ✅ TTS auto-restart at correct paragraph in single chapter
- ✅ TTS highlight and audio work correctly

---

## ⚠️ Known Issue: TTS-Triggered Trim Incomplete

### Problem

When TTS triggers `clearStitchedChapters()` (via scroll sync dialog), it updates the WebView but **doesn't fully reload the chapter in React Native**. This leaves the app in an inconsistent state.

### Symptom

**Scenario**:
1. User scrolls from Chapter 2 → Chapter 3 (stitched)
2. User starts TTS in Chapter 3 → scroll sync dialog appears
3. User clicks "Continue from here" → `clearStitchedChapters()` executes
4. ✅ TTS works correctly (highlight + audio)
5. User exits reader
6. ❌ **User re-enters → inconsistent state** (DOM has wrong paragraph count,React Native may think it's Chapter 2)

### Root Cause

- **Normal Trim** (scroll-based): Sends `chapter-transition` event → calls `getChapter()` → **full reload**
- **TTS Trim** (dialog-based): Sends `stitched-chapters-cleared` event → updates adjacent chapters only → **NO full reload**

### What's Missing

The `stitched-chapters-cleared` handler in `WebViewReader.tsx` line ~824:
```typescript
case 'stitched-chapters-cleared':
  // Updates adjacent chapters, prevChapterIdRef
  // ❌ Does NOT call getChapter() to fully reload chapter state
```

### Impact

- **Low**: Affects only users who start TTS in stitched chapters before 15% threshold
- **Workaround**: User can manually navigate away and back to reset state
- **Does NOT affect**: Normal scroll-based trim (99% of cases)

---

## Technical Architecture

### File Structure

```
android/app/src/main/assets/js/
├── core.js                          # WebView logic

src/screens/reader/
├── components/
│   ├── WebViewReader.tsx            # Main WebView component, message handler
│   ├── TTSScrollSyncDialog.tsx      # Stitched-aware dialog
├── hooks/
│   ├── useTTSController.ts          # TTS state, batch playback
│   ├── useScrollSyncHandlers.ts     # Dialog confirm/cancel logic
```

### Key Functions

#### `core.js` (WebView)

| Function                       | Purpose                                                  |
| ------------------------------ | -------------------------------------------------------- |
| `manageStitchedChapters()`     | Monitors scroll, triggers stitch/trim at thresholds      |
| `receiveChapterContent()`      | Appends next chapter HTML to DOM                         |
| `clearStitchedChapters()`      | Removes other chapters, optionally auto-restarts TTS     |
| `setTTSRestartIntent()`        | Stores restart parameters (chapterId, paragraph, resume) |
| `getChapterInfoForParagraph()` | Converts global index → chapter-local index              |

#### `WebViewReader.tsx` (React Native)

| Event Handler               | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| `fetch-chapter-content`     | Fetches HTML from storage/network                                    |
| `chapter-appended`          | Updates `nextChapter` state                                          |
| `stitched-chapters-cleared` | Updates adjacent chapters + `prevChapterIdRef` ⚠️ **NO getChapter()** |
| `chapter-transition`        | **Full reload** via `getChapter()` ✅ Correct                         |

#### `useScrollSyncHandlers.ts`

| Function                       | Purpose                                                   |
| ------------------------------ | --------------------------------------------------------- |
| `handleTTSScrollSyncConfirm()` | Calls `setTTSRestartIntent()` + `clearStitchedChapters()` |
| `handleTTSScrollSyncCancel()`  | Scrolls to TTS position + `clearStitchedChapters()`       |

---

## Implementation Highlights

### Fix #1: Immediate `window.reader.chapter.id` Update

**File**: `core.js`, line ~537

After `clearStitchedChapters()` removes chapters from DOM, it immediately updates the chapter context:

```javascript
// CRITICAL FIX: Update this.chapter IMMEDIATELY to match the visible chapter
this.chapter = {
  ...this.chapter,
  id: visibleChapterId,
  name: visibleChapterName,
};
```

**Why**: TTS auto-restart executes 200ms later. Without this, `window.tts` would still check against the old chapter ID, causing "stale chapter" errors.

### Fix #2: Synchronize `prevChapterIdRef`

**File**: `WebViewReader.tsx` line ~865

When `stitched-chapters-cleared` event is received, update the TTS controller's ref:

```typescript
tts.prevChapterIdRef.current = visibleChapter.id;
```

**Why**: React Native injects TTS commands like `highlightParagraph(index, chapterId)`. The `chapterId` comes from `prevChapterIdRef`. Without this sync, WebView would reject commands with "stale chapter 6082, current is 6083" errors.

---

## Next Steps

### Priority 1: Fix TTS-Triggered Trim

**Goal**: Make TTS-triggered trim equivalent to scroll-triggered trim.

**Solution**: Modify `stitched-chapters-cleared` handler to call `getChapter()`:

```typescript
case 'stitched-chapters-cleared':
  // Current: Updates adjacent chapters only
  // TODO: Call getChapter(visibleChapter) for full reload
  // This will: reload HTML, update all state, resync WebView
```

**Considerations**:
- Will trigger HTML reload → brief visual flash?
- Need to preserve TTS state across reload
- Test: TTS should resume correctly after `getChapter()` completes

### Priority 2: Optimize Trim Visual Experience  

**Current**: Trim causes brief visual "jump" as DOM is redrawn

**Ideas**:
- Dual WebView architecture (investigated, rejected due to React Native layout constraints - see `DUAL_WEBVIEW_INVESTIGATION.md`)
- Opacity transition during trim
- Pre-render next WebView off-screen

### Priority 3: Add Integration Tests

**Coverage Needed**:
- ✅ TTS restart in stitched chapter (unit test exists)
- ❌ Full E2E: Scroll → Stitch → TTS → Trim → Restart
- ❌ State consistency after TTS-triggered trim

---

## Testing Checklist

### Manual Testing

#### Normal Scroll-Based Trim
1. ✅ Scroll to 95% in Chapter N
2. ✅ Chapter N+1 stitches
3. ✅ Scroll to 15% in Chapter N+1
4. ✅ Chapter N trims, DOM redraws
5. ✅ Scroll position preserved
6. ✅ Exit → re-enter → correct state

#### TTS-Triggered Trim (⚠️ Known Issue)
1. ✅ Scroll to 95% in Chapter N
2. ✅ Chapter N+1 stitches
3. ✅ Start TTS in Chapter N+1 (before 15%)
4. ✅ Scroll sync dialog → "Continue from here"
5. ✅ TTS works (highlight + audio)
6. ❌ **Exit → re-enter → inconsistent state**

### Automated Tests

| Test File                                | Coverage                         |
| ---------------------------------------- | -------------------------------- |
| `useScrollSyncHandlers.stitched.test.ts` | ✅ Unit tests for dialog handlers |
| E2E tests                                | ❌ TODO                           |

---

## Lessons Learned

### What Worked

1. **Immediate `window.reader.chapter` update**: Crucial for TTS to work during the 200ms auto-restart window.
2. **Synchronizing `prevChapterIdRef`**: React Native must pass correct chapterId to WebView commands.
3. **Comprehensive logging**: Made debugging stale chapter errors much easier.

### What Didn't Work

1. **Dual WebView approach**: React Native's layout system doesn't support seamless WebView swapping.
2. **Relying on React Native reload alone**: WebView needs its own internal chapter context for TTS.

### Future Enhancements

- **Smarter trim threshold**: Use viewport height instead of fixed 15%
- **Predictive stitching**: Stitch at 90% if user is scrolling fast
- **Background chapter caching**: Pre-fetch next 2-3 chapters for instant stitching

---

## Related Documentation

- `SESSION_HANDOFF.md`: Original continuous scroll implementation notes
- `DUAL_WEBVIEW_INVESTIGATION.md`: Why dual WebView was rejected
- `archive/`: Old planning and implementation docs
