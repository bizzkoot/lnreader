# TTS Stitched Chapter Restart - Technical Implementation

**Feature**: Seamless TTS playback across stitched chapters  
**Status**: ✅ Working (with known limitation)  
**Date**: December 21, 2024

---

## Problem Statement

When TTS is playing and user scrolls into a stitched chapter, TTS needs to restart in the new chapter after clearing the DOM. This requires coordinating between WebView JavaScript and React Native to ensure the chapter context is synchronized.

### User Flow

```
1. TTS playing in Chapter 2 (paragraph 150)
2. User scrolls → Chapter 3 stitches to DOM
3. TTS scroll sync dialog appears: "Keep TTS position" vs "Continue from here"
4. User chooses "Continue from here" (paragraph 220 in stitched view = paragraph 6 in Chapter 3)
5. → clearStitchedChapters() must remove Chapter 2, keep Chapter 3 only
6. → TTS must auto-restart at paragraph 6 in Chapter 3
7. → Highlight must work correctly (no "stale chapter" errors)
```

---

## Architecture

### Two Contexts Must Sync

| Context          | Location                   | Chapter ID Source                              |
| ---------------- | -------------------------- | ---------------------------------------------- |
| **WebView**      | `window.reader.chapter.id` | Updated by `clearStitchedChapters()`           |
| **React Native** | `prevChapterIdRef.current` | Updated by `stitched-chapters-cleared` handler |

**Critical**: Both must have the **same chapter ID** for TTS commands to work.

###Data Flow

```
User clicks "Continue from here" in scroll sync dialog
       ↓
useScrollSyncHandlers.handleTTSScrollSyncConfirm()
       ↓
webView.injectJavaScript(`
  window.reader.getChapterInfoForParagraph(220)
  → { chapterId: 6083, localIndex: 6, chapterName: "Chapter 3..." }
       ↓
  window.reader.setTTSRestartIntent(6083, 6, true)
  → Stores restart parameters
       ↓
  window.reader.clearStitchedChapters()
  → Removes Chapter 2 from DOM
  → Updates window.reader.chapter.id = 6083  ✅ Fix #1
  → Sends stitched-chapters-cleared event to RN
`)
       ↓
WebViewReader receives 'stitched-chapters-cleared' event
       ↓
tts.prevChapterIdRef.current = 6083  ✅ Fix #2
       ↓
clearStitchedChapters() auto-restart (200ms later)
       ↓
window.tts.changeParagraphPosition(6)
window.tts.resume(true)
       ↓
TTS commands inject: highlightParagraph(6, 6083)
       ↓
WebView checks: 6083 === window.reader.chapter.id ✅ PASS
RN passes chapterId: prevChapterIdRef.current (6083) ✅ PASS
       ↓
TTS highlight works! 🎉
```

---

## Implementation Details

### 1. Chapter Info Resolution

**File**: `core.js`, `getChapterInfoForParagraph()`

Converts global paragraph index to chapter-specific index:

```javascript
this.getChapterInfoForParagraph = function (globalParagraphIndex) {
  if (this.chapterBoundaries.length === 0) {
    // Single chapter - index is already local
    return {
      chapterId: this.chapter.id,
      localIndex: globalParagraphIndex,
      chapterName: this.chapter.name,
    };
  }

  // Stitched mode - find which boundary contains this paragraph
  for (let i = 0; i < this.chapterBoundaries.length; i++) {
    const boundary = this.chapterBoundaries[i];
    if (globalParagraphIndex >= boundary.startIndex &&
        globalParagraphIndex <= boundary.endIndex) {
      const localIndex = globalParagraphIndex - boundary.startIndex;
      return {
        chapterId: boundary.chapterId,
        localIndex,
        chapterName: /* extracted from DOM */,
      };
    }
  }
  return null;
};
```

**Example**:
- Input: `globalParagraphIndex = 220`
- Boundaries: `[{id: 6082, start: 0, end: 213}, {id: 6083, start: 214, end: 447}]`
- Output: `{chapterId: 6083, localIndex: 6, chapterName: "Chapter 3..."}`

### 2. TTS Restart Intent

**File**: `core.js`, `setTTSRestartIntent()`

Stores parameters for delayed auto-restart:

```javascript
this.setTTSRestartIntent = function (targetChapterId, paragraphInChapter, shouldResume) {
  this.ttsRestartPending = true;
  this.ttsRestartTargetChapterId = targetChapterId;
  this.ttsRestartParagraphInChapter = paragraphInChapter;
  this.ttsRestartAfterClear = shouldResume;
};
```

**Why delayed**: `clearStitchedChapters()` manipulates DOM. We wait 200ms for DOM to stabilize before calling `window.tts.resume()`.

### 3. Clear Stitched Chapters

**File**: `core.js`, `clearStitchedChapters()`

```javascript
// Remove other chapters from DOM
for (let i = chapters.length - 1; i >= 0; i--) {
  if i !== visibleIndex) {
    chapters[i].remove();
  }
}

// Update loaded chapters array
this.loadedChapters = [visibleChapterId];

// Invalidate cached elements
this.cachedReadableElements = null;

// ✅ FIX #1: Update chapter context IMMEDIATELY
this.chapter = {
  ...this.chapter,
  id: visibleChapterId,
  name: visibleChapterName,
};

// Send event to React Native
ReactNativeWebView.postMessage(JSON.stringify({
  type: 'stitched-chapters-cleared',
  data: { chapterId: visibleChapterId, chapterName: visibleChapterName },
}));

// Auto-restart TTS after 200ms
if (this.ttsRestartPending) {
  setTimeout(() => {
    const readableElements = this.getReadableElements();
    if (this.ttsRestartParagraphInChapter >= 0 &&
        this.ttsRestartParagraphInChapter < readableElements.length) {
      window.tts.changeParagraphPosition(this.ttsRestartParagraphInChapter);
      if (this.ttsRestartAfterClear) {
        window.tts.resume(true); // forceResume = skip scroll check
      }
    }
  }, 200);
}
```

### 4. React Native Handler

**File**: `WebViewReader.tsx`, `handleMessage()`

```typescript
case 'stitched-chapters-cleared':
  const { chapterId, chapterName } = event.data;
  
  getDbChapter(chapterId).then(async visibleChapter => {
   // Update adjacent chapters
    const newPrevChapter = await getDbChapter(chapterId - 1);
    const newNextChapter = await getNextChapter(/* ... */);
    setAdjacentChapter([newNextChapter, newPrevChapter]);

    // ✅ FIX #2: Synchronize TTS chapter ID ref
    tts.prevChapterIdRef.current = visibleChapter.id;

    // Inject updated chapter context to WebView
    webViewRef.current?.injectJavaScript(`
      window.reader.chapter = {id: ${visibleChapter.id}, name: "${chapterName}"};
      window.reader.nextChapter = /* ... */;
      window.reader.prevChapter = /* ... */;
    `);
  });
```

### 5. Scroll Sync Handlers

**File**: `useScrollSyncHandlers.ts`

```typescript
const handleTTSScrollSyncConfirm = useCallback(() => {
  const { visibleIndex, isResume, isStitched } = ttsScrollPromptDataRef.current;

  if (isStitched) {
    webViewRef.current?.injectJavaScript(`
      (function() {
        const chapterInfo = window.reader.getChapterInfoForParagraph(${visibleIndex});
        if (!chapterInfo) return;

        window.reader.setTTSRestartIntent(
          chapterInfo.chapterId,
          chapterInfo.localIndex,
          ${isResume}
        );

        window.reader.clearStitchedChapters();
      })();
    `);
  } else {
    // Single chapter - direct resume
    webViewRef.current?.injectJavaScript(`
      window.tts.changeParagraphPosition(${visibleIndex});
      ${isResume ? 'window.tts.resume(true);' : ''}
    `);
  }
}, [/* ... */]);
```

---

## Testing Strategy

### Unit Tests

**File**: `useScrollSyncHandlers.stitched.test.ts`

Tests confirm that:
1. ✅ `getChapterInfoForParagraph()` is called with correct index
2. ✅ `setTTSRestartIntent()` receives correct chapterId, localIndex, isResume
3. ✅ `clearStitchedChapters()` is triggered
4. ✅ Edge cases handled (null refs, missing chapter names)

### Manual Testing Checklist

1. ✅ TTS playing in Chapter 2
2. ✅ Scroll to Chapter 3 (stitched)
3. ✅ Scroll sync dialog appears
4. ✅ Click "Continue from here"
5. ✅ Verify console logs:
   - `"Reader: Paragraph 220 → Chapter 6083, Local Index 6"`
   - `"Reader: TTS restart intent stored - chapter 6083, paragraph 6, resume: true"`
   - `"Reader: Updated chapter context immediately - ID: 6083"`
   - ` "WebViewReader: Updating TTS prevChapterIdRef from 6082 to 6083"`
   - `"Reader: Auto-restart executing - 234 paragraphs available"`
   - `"Reader: Auto-resuming TTS at paragraph 6"`
6. ✅ NO "stale chapter" errors
7. ✅ TTS highlight appears at paragraph 6
8. ✅ TTS audio matches highlighted text

---

## Known Limitations

### Issue: Incomplete State Update After TTS-Triggered Trim

**Symptom**: After TTS triggers trim via scroll sync dialog, exiting and re-entering the reader shows incorrect state (wrong chapter or paragraph count).

**Root Cause**: `stitched-chapters-cleared` event updates WebView and adjacent chapters, but **doesn't call `getChapter()`** to fully reload the chapter in React Native.

**Workaround**: User can manually navigate away and back.

**Proper Fix** (TODO): Modify `stitched-chapters-cleared` handler to call `getChapter(visibleChapter)` for full reload, similar to `chapter-transition` event.

---

## Debugging Tips

### Enable Console Logs

In WebViewReader, set `__DEV__ && onLogMessage(ev)` to see all WebView console logs.

### Common Errors

| Error                                                                     | Cause                                  | Fix                                                            |
| ------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| `"TTS: highlightParagraph ignored - stale chapter 6082, current is 6083"` | `window.reader.chapter.id` not updated | ✅ Fixed by immediate update in `clearStitchedChapters()`       |
| `"useTTSController: [STALE] onSpeechStart chapter 6082 != 6083"`          | `prevChapterIdRef` not synced          | ✅ Fixed by updating ref in `stitched-chapters-cleared` handler |
| `"Reader: Invalid restart paragraph 300 (total: 234)"`                    | Global index used instead of local     | Ensure `getChapterInfoForParagraph()` is called                |

### Verify Sync

Add breakpoint or log in:
- `core.js:537` - Check `this.chapter.id` after update
- `WebViewReader.tsx:865` - Check `tts.prevChapterIdRef.current`
- `useTTSController.ts:1531` - Check `currentChapterId` in injected command

Both should have the **same value** (e.g., 6083).

---

## Future Enhancements

1. **Eliminate 200ms delay**: Use MutationObserver to detect when DOM is stable, restart immediately
2. **Persist TTS state across full reload**: Allow TTS to survive `getChapter()` calls (for proper trim fix)
3. **Background chapter  preparation**: Pre-render next chapter elements for instant stitching
4. **Smart boundary calculation**: Use viewport height instead of fixed percentages

---

## Related Files

- `/Users/muhammadfaiz/Custom APP/LNreader/android/app/src/main/assets/js/core.js`
- `/Users/muhammadfaiz/Custom APP/LNreader/src/screens/reader/components/WebViewReader.tsx`
- `/Users/muhammadfaiz/Custom APP/LNreader/src/screens/reader/hooks/useTTSController.ts`
- `/Users/muhammadfaiz/Custom APP/LNreader/src/screens/reader/hooks/useScrollSyncHandlers.ts`
- `/Users/muhammadfaiz/Custom APP/LNreader/src/screens/reader/hooks/__tests__/useScrollSyncHandlers.stitched.test.ts`
