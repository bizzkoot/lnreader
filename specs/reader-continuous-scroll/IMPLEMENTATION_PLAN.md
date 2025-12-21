# Implementation Plan: Continuous Scrolling with DOM Stitching

**Feature**: Seamless chapter transitions via DOM manipulation  
**Status**: 🔧 Phase 4 - Bug Fixes In Progress  
**Started**: December 19, 2024  
**Last Updated**: December 20, 2024 23:00 GMT+8

---

## Executive Summary

### Goal
Implement seamless continuous scrolling by appending next chapter content to DOM without page reload, while maintaining TTS functionality and ensuring proper DOM cleanup.

### Current Status: Active Debugging & Iteration

✅ **Working**:
- DOM stitching (chapters append correctly: Ch2 → Ch3 → Ch4)
- Boundary tracking (tracks paragraph indices per chapter)
- Intelligent save progress (maps global → chapter-relative indices)
- Local fetch optimization (prioritizes downloaded chapters)
- WebView persistence (same `reader` object across appends)
- MMKV unread bug fix (clears progress when marking unreadry display fix (shows correct previous chapter name)

🔧 **In Progress**:
- TTS stitched chapter clearing (clears to visible chapter, not original) - **FIX APPLIED, NEEDS TESTING**
- DOM auto-trim (logic exists but not triggering correctly)**Started**: DADDED, AWAITING USER TESTING**

---

## Architecture Overview

```
┌──────────────────────────────────────────────────┐
│  User Opens Chapter 2 (ID: 6082, 214 paragraphs) │
├──────────────────────────────?14}]  │
├──────────────────────────────────────────────────┤
│  User scrolls to 100% → triggers append          │
├──────────────────────────────────────────────────┤
│  React Native fetches Chapter 3 HTML             │
│ ─────────────────────────────────────────────┤
│  DOM: [Ch2: 0-213] + [Ch3: 214-447]             │
│  this.loadedChapters = [6082, 6083]       
```
┌─────608?214-447, 234}                          │
│  ]                                               │
├──────────────────────────────────────────────────┤
│  CRITICAL: Same window.reader object persists!   │
│  (Fixed by removing nextChapter/prevChapter      │
│   from memoizedHTML deps)                        │
├───────────────────────────────────│  React Native fetches Chapter 3 HTML             │
│ ───────────────────────────────?0-233]  (Clean single chapter)    │
├──────────────────────────────────────────────────┤
│  TTS: When pressed, clear stitched chapters      │
│  but keep VISIBLE chapter (not original)         │
│  → If at Ch4, keep Ch4, remove Ch2 & Ch3         │
└──────────────────────────────────────────────────┘
```

---

## ❌ WRONG APPROACHES (CRITICAL - AVOID THESE)

### 1. Don't Include Changing State in HTML Memo Dependencies
**Mistake**: Had `nextChapter`, `prevChapter` in `memoiz├─────────────────?
reader_1766238902934... → loadedChapters=[6082,6083] ✅
reader_1766238940662... → loadedChapters=[6082] ❌ (NEW OBJECT!)
```

**Fix**: 
```typescript
// Create refs for initial values
const initialNextChapter = useRef(nextChapter);
const initialPrevChapter = useRef(prevChapter);

// Use refs in HTML generation
const memoizedHTML = useMemo(() => {
  return `
    var initialReaderConfig = ${JSON.stringify({
      nextChapter: initialNextChapter.current,  // ✅ Use ref!
      prevChapter: initialPrevChapter.current,
    })}
  `;
}, [
  readerSettings,
  stableChapter,
  html,
  // ✅ REMOVED: nextChapter, prevChapter ← KEY FIX!
]);

// Update via injection instead
webViewRef.current?.injectJavaScript(`
  window.reader.nextChapter = ${JSON.stringify(newNextChapter)};
`);
```

**Lesson**: **React `useMemo` dependencies control when expensive computations rerun. If HTML regenerates, WebView relreader_1766238902934..e truly static/unchanging values.**

---

### 2. Don't Assume All Chapters Have Same DOM Structure
**Mistake**: Used `querySelectorAll('[data-chapter-id]')` to find ALL chapters including original.

**Consequence**: 
- **Original chapter** (loaded via normal flow): Raw HTML elements in `chapterElement`, NO wrapper div with `data-chapter-id`
- **Appended chapters**: Wrapped in `<div class="stitched-chapter" data-chapter-id="X">`
- Query only found appended chapters, missed original!

**Fix**: Check `visibleChapterIndex === 0` separately:
```javascript
if (visibleChapterIndex === 0) {
  // Original chapter visible → remove all .stitched-chapter elements
  allStitchedElements.forEach(el => el.remove());
} else {
  // Stitched
/pter visible → remove original content + other stitched
  const originalElements = Array.from(this.chapterElement.childNodes).filter(
    node => node.nodeType === 1 && !node.classList.contains('stitched-chapter')
  );
  originalElements.forEach(el => el.remove());
}
```

**Lesson**: **Original chapter vs stitched chapts have fundamentally different DOM structures. Always handle both cases explicitly.**

---

### 3. Don't Use Nested Loops on Large Datasets
**Mistake**: Early version had nested loops checking every paragraph in every chapter:
```javascript
for (let i = 0; i < boundaries.length; i++) {
  for (let idx = boundary.startIndex; idx <= boundary.endIndex; idx++) {
    element.getBoundingClientRect(); // Expensive!
  }
}
```

**Consequence**: With 3 chapters (600+ paragraphs), called `getBoundingClientRect()` 600+ times per scroll event → stack overflow → app crash.

**Fix**: O(n) early-exit algorithm:
```javascript
let firstVisibleIndex = -1;
for (let i = 0; i < readableElements.length; i++) {
  const rect = readableElements[i].getBoundingClientRect();
  if (rect.top < window.innerHeight && rect.bottom > 0) {
    firstVisibleIndex = i;
    break; // ✅ Stop immediately after finding first visible
  }
}
```

**L}
```

**Lesson**: **Original chapter vs stit1000+ elements. Always optimize for worst case. Use early-exit patterns.**

---

### 4. Don't Forget to Initialize First Chapter Boundary
**Mistake**: `chapterBoundaries = []` initialized empty, never populated for first chapter.

**Consequence**: `manageStitchedChapters()` returned early because `boundaries.length === 0`. Auto-trim never worked!

**Fix**: Initialize after first `calculatePages()` completes:
```javascript
if (this.chapterBoundaries.length === 0) {
  const readableElements = this.getReadableElements();
  this.chapterBoundaries.push({
    chapterId: this.chapter.id,
    startIndex: 0,
    endIndex: readableElements.length - 1,
    paragraphCount: readableElements.length,
  });
}
```

**Lesson**: **Track ALL chapters in boundaries, i  if (rect.top < window.innerHeight && rect.bottom > 0) {
chapter, not just appended ones.**

---

## Implementation Details

### 1. DOM Stitching (✅ WORKING)

**Files**: 
- `android/app/src/main/assets/js/core.js`: Lines 236-318 (`receiveChapterContent()`)
- `src/screens/reader/components/WebViewReader.tsx`: Lines 663-694 (`fetch-chapter-content` handler)

**How It Works**:

```javascript
// core.js - Line 236
this.receiveChapterContent = function (chapterHtml, chapterId, chapterName) {
  // 1. Create container with metadata
  const chapterContainer = document.createElement('div');
  chapterContainer.className = 'stitched-chapter';
  chapterContainer.setAttribute('data-chapter-id', chapterId);
  chapterContainer.setAttribute('data-chapter-name', chapterName);
  
  // 2. Add bou    chapterId: this.chapter.idf (boundaryMode === 'bordered') {
    // ✅ FIXED: Get previous chapter name from DOM, not this.chapter.name
    const previousChapters = this.chapterElement.querySelectorAll('[data-chapter-id]');
    const previousChapterName = previousChapters.length > 0
      ? previousChapters[previousChapters.length - 1].getAttribute('data-chapter-name')
      : this.chapter.name;
    
    const separator = document.createElement('div');
    separator.className = 'chapt
**How It Works**:

```javascript
// core.js = `
      <div class="chapter-boundary-end">— End of ${previousChapterName} —</div>
      <div class="chapter-boundary-start">— ${chapterName} —</div>
    `;
    chapterContainer.appendChild(separator);
  }
  
  // 3. Add chapter content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'stitched-chapter-content';
  contentDiv.innerHTML = chapterHtml;
  chapterContainer.appendChild(contentDiv);
  
  // 4. Append to DOM
  this.chapterElement.appendChild(chapterContainer);
  
  // 5. Track boundary
  const allElements = this.getReadableElements();
  const newChapterStart = allElements.length - 
    chapterContainer.querySelectorAll('.readable:not(.hide)').length;
  const newChapterEnd = allElements.length - 1;
  
  this.chapterBoundaries.push({
    chapterId: chapterId,
    startIndex: newChapterStart,
    endIndex: newChapterEnd,
    paragraphCount    separator.className = 'chapt
**How It Works**:
ate tracking
  this.loadedChapters.push(chapterId);
  
  // 7. Notify React Native
  this.post({
    type: 'chapter-appended',
    data: { chapterId, chapterName, loadedChapters: this.loadedChapters }
  });
};
```

**React Native Side** (`WebViewReader.tsx` - Line 663):

```typescript
case 'fetch-chapter-content':
  const getChapterContent = async () => {
    // ✅ OPTIMIZATION: Try local storage first
    if (novel?.pluginId && novel?.id) {
      const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${targetChapter.id}/index.html`;
      if (NativeFile.exists(filePath)) {
        console.log('WebViewReader: Reading from local file');
        return NativeFile.readFile(filePath);
      }
    }  const newChapterEnd = allElements.length - 1;
  
  this.chapterBounId || '', targetChapter.path);
  };
  
  const html     cht getChapterContent();
  webViewRef.current?.injectJavaScript(`
    if (window.reader) {
      window.reader.receiveChapterContent(${JSON.stringify(html)}, ${targetChapter.id}, ${JSON.stringify(targetChapter.name)});
    }
  `);
```

**Status**: ✅ WORKING
- Verified from logs: "Chapter appended", "total: 2", "total: 3"
- Boundaries tracked correctly: `[6082,6083,6084]`
- Same reader ID persists across appends

---

### 2. MMKV Unread Bug Fix (✅ WORKING)

**Problem**: Mark chapter unread → MMKV key `chapter_progress_${chapterId}` persists → reopen chapter scrolls to old saved position, not 0%.

**Solution**: Delete MMKV key in all unread functions.

**File**: `src/database/queries/ChapterQueries.ts`

```typescript
// Line 14: Add import
import { MMKVStorage         return NativeFile.readFile(filePath);
      }
    }  hapterUnread = (chapterId: number) => {
  MMKVStorage.delete(`chapter_progress_${chapterId}`); // ✅ NEW
  return db.runAsync('UPDATE Chapter SET `unread` = 1 WHERE id = ?', chapterId);
};

// Line 91-98: Updated
export const markChaptersUnread = (chapterIds: number[]) => {
  chapterIds.forEach(id => MMKVStorage.delete(`chapter_progress_${id}`)); // ✅ NEW
  return db.execAsync(`UPDATE Chapter SET \`unread\` = 1 WHERE id IN (${chapterIds.join(',')})`);
};

// Line 203-221: Changed from sync to async
export const markPreviousChaptersUnread = async (chapterId: number, novelId: number) => {
  // ✅ NEW
**Problem**: Mark chapter unread → M.getAllAsync<{ id: number }>(
    'SELECT id FROM Chapter WHERE id <= ? AND novelId = ?',
    chapterId,
    novelId,
  );
  // ✅ NEW: Delete MMKkeys
  chapters.forEach(chapter => MMKVStorage.delete(`chapter_progress_${chapter.id}`));
  return db.runAsync('UPDATE Chapter SET `unread` = 1 WHERE id <= ? AND novelId = ?', chapterId, novelId);
};

// Line 103-117: Changed from sync to async
export const markAllChaptersUnread = async (novelId: number) => {
  // ✅ NEW: Query all chapter IDs
  const chapters = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM Chapter WHERE novelId = ?',
    novelId,
  );
  // ✅ NEW: Delete all MMKV keys
  chapters.forEach(chapter => MMKVStorage.delete(`chapter_progress_${chapter.id}`));
  return db.runAsync('UPDATE Chapter SET `unread` = 1 WHERE novelId = ?', novelId);
};
```

**Status**: ✅ WORKING
- User confirmed: Mark unread → opens to paragraph 0 ✅

---

### 3. TTS Stitched Chapter Clearing (🔧 FIX APPLIED,**Problem**lem**: User at Chapter 4 → Press TTS → Jumps to Chapter 2.

**Root Cause**: 
- `this.chapter` = Original chapter loaded (Chapter 2)
- Visible chapter = Where user currently is (Chapter 4)
- `clearStitchedChapters()` kept `this.chapter` instead of visible chapter

**Challenge**: Original chapter has NO wrapper div, appended chapters do. Can't use single query to find all.

**Current Solution** (`core.js` - Lines 359-457):

```javascript
this.clearStitchedChapters = function () {
  // 1. Find first visible paragraph
  const readableElements = this.getReadableElements();
  let firstVisibleIndex = -1;
  for (let i = 0; i < readableElements.length; i++) {
    const rect = readableElements[i].getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      firstVisibleIndex = i;
      break;
    }
  }
  
  // 2. Map to chapter boundary
  let visibleChapterI
---

### 3. TTS Stitched Chapter Clearing (🔧 FIX APPLname;
  let visibleChapterIndex = 0;
  
  for (let i = 0; i < this.chapterBoundaries.length; i++) {
    const boundary = this.chapterBoundaries[i];
    if (firstVisibleIndex >= boundary.startIndex && 
        firstVisibleIndex <= boundary.endIndex) {
      visibleChapterId = boundary.chapterId;
      visibleChapterIndex = i;
      
      // Get name from DOM if stitched
      const chapterEl = this.chapterElement.querySelector(`[data-chapter-id="${visibleChapterId}"]`);
      if (chapterEl) {
        visibleChapterName = chapterEl.getAttribute('data-chapter-name');
      }
      break;
    }
  }
  
  // 3. Clear based on visible chapter type
  const allStitchedElements = this.chapterElement.querySelectorAll('.stitched-chapter');
  
  if (visibleChapterIndex === 0) {
    // ✅ ORIGINAL chapter visible → Remove all stitched only
    console.log('      break;
    }
  }
  
 inal, removing stitched chapters');
    allStitchedElements.forEach(el => el.remove());  let visibleChapterIndex = 0;
  
  for (let i = 0; i <chapterBoundaries = [this.chapterBoundaries[0]];
    
  } else {
    // ✅ STITCHED chapter visible → Remove original + other stitched
    console.log(`Reader: Visible chapter is stitched (ID: ${visibleChapterId}), removing others`);
    
    const visibleElement = Array.from(allStitchedElements).find(el =>
      el.getAttribute('data-chapter-id') === String(visibleChapterId)
    );
    
    if (visibleElement) {
      // Remove original chapter content (no .stitched-chapter class)
      const originalElements = Array.from(this.chapterElement.childNodes).filter(
        node => node.nodeType === 1 && !node.classList.contains('stitched-chapter')
      );
      originalElements.forEach(el => el.remove());
      
      // Remove other stitched chapters
      allStitchedElements.forEach(el => {
        if (el !== visibleElement) el.remove();
      });
      
      // Up    allStitchedElements.forEach(el  = [visibleChapterId];
      const remainingElements = this.getReadableElements();
      this.chapterBoundaries = [{
        chapterId: visibleChapterId,
        startIndex: 0,
        endIndex: remainingElements.length - 1,
        paragraphCount: remainingElements.length,
      }];
    } else {
      console.warn('Reader: Could not find visible stitched chapter element, keeping original');
    }
  }
  
  // 4. Notify React Native
  this.post({
    type: 'stitched-chapters-cleared',
    data: { chapterId: visibleChapterId, chapterName: visibleChapterName }
  });
};
```

**React Native Handler** (`WebViewReader.tsx` - Lines 787-855):

```typescript
case 'stitched-chapters-cleared':
  const eventData = event.data as { chapterId: number; chapterName: string };
  console.log(`WebViewReader: Stitched chapters cleared to chapter ${eventData.chapterId}`);
  
  // Get visible chapter from DB
  const visibleChapter = await getDbChapter(eventData.chapterId      
 (!visibleChapter) {
    console.warn('WebViewReader: Could not find visible chapter in DB');
    break;
  }
  
  // Query new prev/next chapters
  const newPrevChapter = visibleChapter.position! > 0
    ? await getDbChapter(visibleChapter.id - 1)
    : undefined;
    
  const newNextChapter = await getNextChapter(
    visibleChapter.novelId,
    visibleChapter.position!,
    visibleChapter.page,
  );
  
  // Update React state
  if (newNextChapter && newPrevChapter) {
    setAdjacentChapter([newNextChapter, newPrevChapter]);
  } else if (newNextChapter) {
    setAdjacentChapter([newNextChapter, undefined]);
  } else if (newPrevChapter) {
    setAdjacentChapter([undefined, newPrevChapter]);
  } else {
    setAdjacentChapter([undefined, u  console.log(`WebViewReader: Stitched chapters cleare to WebView
  webViewRef.current?.injectJavaScript(`
    if (window.reader) {
      window.reader.chapter = ${JSON.stringify({ id: visibleChapter.id, name: visibleChapter.name })};
      window.reader.nextChapter = ${JSON.stringify(newNextChapter || undefined)};
      window.reader.prevChapter = ${JSON.stringify(newPrevChapter || undefined)};
      console.log('Reader: Chapter context updated after stitched-chapters-cleared');
    }
  `);
  break;
```

**Status**: 🔧 FIX APPLIED, NEEDS TESTING
- Implementation complete with two code paths (original vs stitched)
- User's previous test was with OLD code
- Need fresh test: Rebuild → Scroll to Ch4 → Press TTS → Should stay in Ch4

---

### 4. DOM Auto-Trim (🔧 DEBUG LOGS ADDED, AWAITING USER TESTING)

**Purpose**: Auto-remove previous chapter when user scrolls 15% into next chapter. Ensures clean single-chapter DOM for TTS.

**File**: `core.js` - Lines 515-592 (`ma  webViewRef.current?.injectJavaScript(`
    if (windowanageStitchedChapters = function () {
  // Safety checks
  if (this.loadedChapters.length <= 1) {
    console.log('[manageStitchedChapters] Only one chapter, skipping');
    return;
  }
  if (!this.chapterBoundaries || this.chapterBoundaries.length === 0) {
    console.warn('[manageStitchedChapters] No boundaries set, skipping');
    return;
  }
  if (!this.generalSettings) {
    console.warn('[manageStitchedChapters] No generalSettings, skipping');
    return;
  }
  
  const threshold = this.generalSettings.val.continuousScrollTransitionThreshold || 15;
  const readableElements = this.getReadableElements();
  
  // ✅ OPTIMIZATION: Find FIRST visible paragraph only (O(n) with early exit)
  let firstVisibleIndex = -1;
  for (let i = 0; i < readableElements.length; i++) {
    const element = 
**File**: `core.js` - Lines 515-592 (`ma  webViewRef.current?.injectJavaScript(`
    if (windowanageStitchedChapters = fun 0) {
      firstVisibleIndex = i;
      break; // Early exit!
    }
  }
  
  if (firstVisibleIndex === -1) {
    console.log('[manageStitchedChapters] No visible paragraph found');
    return;
  }
  
  console.log(`[manageStitchedChapters] First visible: ${firstVisibleIndex}, Boundaries: ${this.chapterBoundaries.length}, Threshold: ${threshold}%`);
  
  // Find which chapter this paragraph belongs to
  for (let i = 0; i < this.chapterBoundaries.length; i++) {
    const boundary = this.chapterBoundaries[i];
    
    if (firstVisibleIndex >= boundary.startIndex && 
        firstVisibleIndex <= boundary.endIndex) {
      
      // Calculate progress within THIS chapter
      const progressInChapter = 
        ((firstVisibleIndex - boundary.startIndex) / boundary.paragraphCount) * 100;
      
      // ✅ NEW DEBUG LOG: Shows why condition might not be met
      console.l**File**: `core.js`titchedChapters] Paragraph ${firstVisibleIndex} belongs to boundary ${i} (chapter ${boundary.chapterId}), ` +
        `progress: ${progressInChapter.toFixed(1)}%, i=${i}, threshold=${threshold}`
      );
      
      // Trim condition: 2nd+ chapter AND past threshold
      if (i > 0 && progressInChapter >= threshold) {
        console.log(`Reader: User ${progressInChapter.toFixed(1)}% into chapter ${boundary.chapterId}, trimming previous`);
        this.trimPreviousChapter();
      }
      
      return; // Exit after finding chapter
    }
  }
};
```

**Trim Logic** (`trimPreviousChapter()` - Lines 459-510):

```javascript
this.trimPreviousChapter = function () {
  if (this.loadedChapte      
      // Calculate progress withile.log('Reader: Trimming previous chapter from DOM');
  
  // Find and remove first chapter
  const firstChapterId = this.loadedChapters[0];
  
  if (firstChapterId === this.chapter.id) {
    // Remove ORIGINAL chapter (no .stitched-chapter class)
    // ... removal logic ...
  } else {
    // Remove FIRST stitched chapter
    const firstStitched = this.chapterElement.querySelector(
      `[data-chapter-id="${firstChapterId}"]`
    );
    if (firstStitched) {
      firstStitched.remove();
    }
  }
  
  // Update tracking
  const removedChapterId = this.loadedChapters.shift();
  const removedBoundary =         this.trimPreviousCht();
  
  // Recalculate boundaries (indices shift down)
  const offsetAmount = removedBoundary.paragraphCount;
  this.chapterBoundaries.forEach(boundary => {
    boundary.startIndex -= offsetAmount;
    boundary.endIndex -= offsetAmount;
  });
  
  this.invalidateCache();
  console.log(`Reader: Trimmed chapter ${removedChapterId}, remaining: ${this.loadedChapters.length}`);
  
  return true;
};
```

**Current Issue**: Trim NOT triggering.

**User's Debug Logs**:
```
"[manageStitchedChapters] First visible: 461, Boundaries: 3, Threshold: 15%"
```

But NO log: `"Reader: User X% into chapter Y, trimming previous"`

**New Debug Log Added**: Will show which boundary matched and why condition not met:
```
"[manageStitchedChapters] Paragraph 461 belongs to boundary X (    );
    if (firstStitched) {
      fi=15"
```

**Status**: 🔧 AWAITING USER TESTING
- Debug log added to reveal progress calculation
- Need user to test and provide new logs
- Will show: boundary index, progress percentage, condition values

---

## Files Modified

| File | Status | Changes | Lines |
|------|--------|---------|-------|
| `core.js` | 🔧 In Progress | Stitching, boundaries, trim, TTS clearing, debug logs | 236-318, 359-457, 515-592 |
| `WebViewReader.tsx` | ✅ Complete | Local fetch, refs fix, handlers | 143-150, 330-442, 663-694, 787-855 |
| `useChapter.ts` | ✅ Complete | Exposed `setAdjacentChapter` | 57-59, 319 |
| `ChapterQueries.ts` | ✅ Complete | MMKV cleanup in 4 functions | 14, 84-89, 91-98, 103-117, 203-221 |
| `useSettings.ts` | ✅ Complete | `continuousScr
**New Debug Log Added**: Will shss` | ✅ Complete | Border/badge styling | - |

---

## Next Steps (Priority Order)

### P0 IMMEDIATE: User Testing

1. **Test TTS Clearing Fix** (15 min)
   - Rebuild: `pnpm run build:release:android`
   - Test: Open Ch2, scroll to Ch4, press TTS
   - Expected logs:
     - `"Reader: Found 2 stitched chapter elements"`
     - `"Reader: Visible chapter is at boundary index 2 (ID: 6084)"`
     - `"Reader: Visible chapter is stitched (ID: 6084), removing others"`
     - `"Reader: Stitched chapters cleared, DOM reset to single chapter (Chapter 4)"`
   - Expected behavior: Stay in Chapter 4, TTS starts from visible position

2. **Test DOM Trim Debugging** (10 min)
   - Same build, scroll slowly Ch2 → Ch3
   - Watch logs at ~10%, 15%, 20% into Ch3
 | `ChapterQueries.ts` | ✅ Complete | MMKV cleanup in 4 functions | 14, 84-8Z), progress: A%, i=Y, threshold=15"`
   - This reveals why trim condition not met

---

### P1 NEXT: Iterate Based on Results

3. **If TTS Still Fails** (30 min)
   - Check if `visibleChapterId` matches `data-chapter-id` attribute
   - Verify `visibleChapterIndex` calculation
   - Add more logs in finding logic

4. **If Trim Still Doesn't Trigger** (30 min)
   - Analyze progress calculation from new logs
   - Check boundary indices correctness
   - Verify threshold comparison logic

---

### P2 FUTURE: Polish

5. **Settings UI** (1 hour)
   - Add threshold selector in NavigationTab.tsx
   - Create modal with 5%, 10%, 15%, 20% options
   - Test all threshold values

6. **Documentation** (30 min)
   - Update TASKS.md with current status
   - Update READER_ENHANCEMENTS.md with architecture details
   - Git commit after all working

---

## Testing Ch   - Watch logs at ~10%, 15%, 20% into Chpends (same reader ID)
- [x] Boundaries track correctly
- [x] Save progress maps global → relative indices
- [x] Local fetch prioritized
- [x] MMKV unread bug fixed
- [x] Boundary display shows correct chapter names
- [ ] TTS clears to visible chapter (fix applied, not tested)
- [ ] DOM trim triggers at threshold (debug logs added, not tested)
- [ ] TTS works after trim
- [ ] Settings UI accessible

---

## Lessons Learned

### What Worked Well ✅
- Boundary tracking concept is solid
- Local fetch optimization simple and effective
- Type safety caught issues early (setAdjacentChapter type mismatch)
- Debug logging infrastructure helpful
- User testing revealed issues logs didn't show (boundary display bug)

### Challenges ❌
- WebView lifecycle tricky (memo deps matter!)
- DOM struct   - Update TASKS.l vs stitched) not obvious
- State transitions complex (clearing → updating context → injecting)
- Testing requires physical device (not emulator-friendly)

### Key Insights 💡

1. **WebView Persistence is Critical**
   - If HTML regenerates, WebView reloads → state lost
   - Use refs for initial values, inject updates afterward
   - Never put changing state in memo dependencies

2. **DOM Structure Matters**
   - Original chapter has no wrapper, stitched chapters do
   - Can't use single query to find all chapters
   - Always check both cases when querying/removing

3. **Boundaries Must Be Complete**
   - Track ALL chapters, including first one
   - Boundaries enable: save progress, trim detection, TTS clearing
   - Initialize boundaries for first chapter after DOM ready

4. **Debug Logs Are Essential**
   - Complex state transitions ne
### Challenges ❌
- WebView lifecycle tricky (memo deps matter!)lculation logs will reveal trim issue
   - Don't assume code works - verify with logs!

---

**Document Version**: 5.0 (Comprehensive Session Summary)  
**Status**: Fixes Applied, Awaiting User Testing  
**Next Session**: Test latest code → Iterate based on logs → Complete documentation → Git commit

---

## UPDATE 2: Boundary Mismatch Root Cause Discovery

**Date**: December 20, 2024 23:45 GMT+8  
**Issue**: DOM trim NOT triggering despite fix applied  
**Status**: 🔴 CRITICAL BUG FOUND - Boundaries not matching correctly

### What Happened

**Round 1 Testing** (User):
- Built dev version
- Scrolled Ch2 (paras 0-213) → Ch3 (should be paras 214-447) → Ch4
- Expected: Trim at paragraph ~250 (214 + 15% of 234)
- Result: NO TRIM, even at paragraph 490!

**Round 2 Testing** (After calculation fix):
- Applied fix for threshold calculation (absolute vs relative)
- User rebuilt and tested again
- Result: **STILL NO TRIM!**

**Critical Discovery**: User's logs showed:
```
"[manageStitchedChapters] Paragraph 211 belongs to boundary 0 (chapter 6082), progress: 98.6%, i=0, threshold=15"
"[manageStitchedChapters] First visible: 222, Boundaries: 2, Threshold: 15%"
(NO "belongs to" log!)
"[manageStitapters] First visible: 235, Boundaries: 2, Threshold: 15%"
(NO "belongs to" log!)
```

**The Problem**:
1. Paragraph 211 (Ch2) correctly matches "boundary 0" ✅
2. Paragraph 222 (which is Ch3!) has NO "belongs to" log ❌
3. This means **paragraph 222+ is NOT matching ANY boundary!**
4. The loop finishes without finding which chapter the user is in
5. Trim cond- Built dev version
- Scro boundary matched

### Root Cause Analysis

**Expected Boundaries After Ch3 Appends**:
- Boundary 0: Ch2, paragraphs 0-213 (214 count)
- Boundary 1: Ch3, paragraphs 214-447 (234 count)

**What's Actually Happening**:
- Boundary 0: Correct (0-213)
- Boundary 1: **WRONG INDICES** - not 214-447!
- Paragraphs 214+ fall outside all boundary ranges
- Loop exits without match
- Trim check never runs (requires `i"[manageStitchedChapters] First visible: 222, Boundaries: 2, Threshold: 15%"
(NO "belo290-300

```javascript
// Calculate and store boundary for this chapter
const allElements = this.getReada"[manageStitapters] FnewChapterStart =
  allElements.length -
  chapterContainer.querySelectorAll('.readable:not(.hide)').length;
const newChapterEnd = allElements.length - 1;

this.chapterBoundaries.push({
  chapterId: chapterId,
  startIndex: newChapterStart,  // ← SUSPECTED BUG!
  endIndex: newChapterEnd,       // ← SUSPECTED BUG!
  paragraphCount: newChapterEnd - newChapterStart + 1,
});
```

**Hypothesis**: After Ch3 appends:
- `allElements.length` should be 448 (214 + 234)
- `newChapterStart` calculation: `448 - 234 = 214` ✅ (looks correct!)

**What's Actually Happening**:
- Boundary 0: )
- BUT: Paragraph 222 is NOT matching boundary 1!

**Possible Causes**:
1. `allElements` includes hidden/non-readable elements → wrong count
2. Boundary 0 has wrong `endIndex` (not 213, maybe 447?) → catches all paragraphs
3. Boundary 1 `startIndex`/`endIndex` calculated wrong
4. Boundary matching loop has off-by-one error

### Additional Problem: Dev Build Not Picking Up Changes

**User's logs showed OLD log format**:
```
"[manageStitchedChapters] Paragraph 211 belongs to boundary 0..."
```

**But code has NEW log format**:
```
"[manageStitchedChapters] TRIM CHECK - Prev chapter paras: ..."
```

**This confirms**: Dev build (`pnpm run dev:android`) is **caching assets** and NOT using updated `core.js`!

**Why This Happens**:
- `core.js` lives in `android/app/src/main/assets/js/`
- Metro bundler might not watch this directory
- Dev mode may use cached JavaScript bundle
- Changes to `core.
**What's Actually Happening**:
- Boundary 0: )
- BUT: Paragraph 222 id` or `pnpm run clean:full` before dev build.

### Debug Logs Added (Lines 290-305, 589-595)

**In `receiveChapterContent()`**:
```javascript
console.log(
  `[receiveChapterContent] BOUNDARY DEBUG - ` +
  `Chapter: ${chapterId}, ` +
  `Total elements: ${allElements.length}, `4. Boundary matching loop has off-by-one error

### AtorAll('.readable:not(.hide)').length}, ` +
  `Calculated start: ${newChapterStart}, ` +
  `Calculated end: ${newChapterEnd}, ` +
  `Count: ${newChapterEnd - newChapterStart + 1}`
);
```

**In `manageStitchedChapters()`**:
```javascript
console.log(`[manageStitchedChapters] BOUNDARIES DEBUG: ${JSON.stringify(this.chapterBoundaries.map(b => ({
  id: b.chapterId,
  start: b.startIndex,
  end: b.endIndex,
  count: b.paragraphCount
})))}`);
```

**What These Will Reveal**:

1. **During Append**: See exact calculation values
   ```
   "[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: 448, Chapter elements: 234, Calculated start: 214, Calculated en
### Debug Logs Added (Lines 290-305, 589-595)

**In `receiveChary ranges
   ```
   "[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,start:0,end:213,count:214},{id:6083,start:214,end:447,count:234}]"
   ```

3. **Boundary Matching**: Will show which boundary paragraph falls into
   ```
   "[manageStitchedChapters] Paragraph 222 belongs to boundary 1 (chapter 6083)"
   ```

If paragraph 222 still has NO "belongs to" log, it means:
- Boundary 1 has start > 222 OR end < 222
- The calculated indices are wrong
- Need to inves`igate `getReadableElements()` or `querySelectorAll` logic

### Next Steps (UPDATED)

**P0 CRITICAL - Full Clean Rebuild** (User must do):
```bash
pnpm run clean:full
pnpm run dev:start  # Terminal 1
pnpm run dev:android  # Terminal 2
```

**P0 CRITICAL - Test with New Logs** (User provides):
1. Open Ch2, scroll to trigger Ch3 append
2. Look for: `"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: 448..."`
3. Continue scrolling into Ch3 (paragraphs 220-240)
4. Look for: `"[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,start:0,end:213,...},{id:6083,start:214,end:447,...}]"`
5. Check if paragraph 222 shows: `"belongs to boundary 1"` or NO log

**P1 ANALYSIS - Based on New   ```
   "[manageStitchedChapters] Paragraph 222 belongs to boundary → boundary matching logic bug
- If `start: X, end: Y` where 222 not in range → calculation bug in `receiveChapterContent`
- If `Total elements: Z` where- The calculaadableElements()` includes wrong elements

**P2 FIX - After Root Cause Found**:
- If calculation bug: Fix `newChapterStart`/`newChapterEnd` formula
- If matching bug: Fix comparison logic in `manageStitchedChapters` loop
- If elements bug: Filter hidden/non-readable elements correctly

### Lessons Learned (CRITICAL)

❌ **DON'T assume dev builds pick up asset changes**
- Files in `android/app/src/main/assets/` may be cached
- Always use `clean:full` when modifying `core.js`
- Or use release builds for testing: `pnpm run build:release:android`

❌ **DON'T assume calculations are correct without verification**
- The threshold calculation fix was correct
- But revealed a deeper bug: boundaries themselves are wrong
- Always verify assumptions with comprehensive debug logs

✅ **DO a- If `start: X, end: Y` where 222 not in range → calculation bug inpend
- Log all boundaries during matching
- Log which boundary matched for paragraph
- Logs reveal what code inspection misses

✅ **DO trust user testing over code review**
- User's "still not working" is always valid
- Their logs showed the REAL problem: no boundary match
- Code looked correct, but runtime behavior revealed bug

---

**Status**: 🔴 Debug logs added, awaiting user testing with clean rebuild  
**Blocker**: Need logs showing actual boundary ranges to identify root cause  
**Next**: User provides logs → Analyze boundary indices → Fix calculation or matching logic

