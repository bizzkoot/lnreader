# Implementation Plan: Continuous Scrolling with DOM Stitching

**Feature**: Seamless chapter transitions via DOM manipulation  
**Status**: ✅ PRODUCTION READY - All Features Validated  
**Started**: December 19, 2024  
**Completed**: December 21, 2024  
**Last Updated**: December 21, 2024 14:37 GMT+8

---

## Executive Summary

### Goal
Implement seamless continuous scrolling by appending next chapter content to DOM without page reload, while maintaining TTS functionality and ensuring proper DOM cleanup.

### Final Status: ✅ ALL FEATURES WORKING

**Validated** ✅:
1. DOM stitching (chapters append correctly: Ch2 → Ch3 → Ch4 → Ch5)
2. Auto-trim at 15% threshold (removes previous chapter with smooth redraw)
3. Continuous operation (can stitch indefinitely without stopping)
4. TTS integration (starts from correct paragraph after trim)
5. Session save (previous chapter 100%, current chapter in-progress)

**User Feedback**: "Works well, transitions are less jarring"

---

## Architecture Overview

### Successful Implementation Flow

```
┌──────────────────────────────────────────────────┐
│  User Opens Chapter 2 (ID: 6082, 214 paragraphs) │
│  Boundaries: [{id:6082,start:0,end:213,count:214}] │
├──────────────────────────────────────────────────┤
│  User scrolls to 95% → triggers append           │
├──────────────────────────────────────────────────┤
│  React Native fetches Chapter 3 HTML             │
│  Uses local file if downloaded, else network     │
├──────────────────────────────────────────────────┤
│  WebView: receiveChapterContent() appends Ch3    │
│  DOM: [Ch2: 0-213] + [Ch3: 214-447]             │
│  loadedChapters = [6082, 6083]                   │
│  Boundaries: [                                    │
│    {id:6082,start:0,end:213,count:214},          │
│    {id:6083,start:214,end:447,count:234}         │
│  ]                                               │
├──────────────────────────────────────────────────┤
│  CRITICAL: Same window.reader object persists!   │
│  (Achieved via refs for nextChapter/prevChapter) │
├──────────────────────────────────────────────────┤
│  User scrolls to paragraph 250 (15% into Ch3)    │
│  Progress: (250-214)/234 = 15.4% ✅              │
├──────────────────────────────────────────────────┤
│  AUTO-TRIM TRIGGERS                              │
│  - trimPreviousChapter() removes Ch2             │
│  - chapter-transition message to React Native    │
│  - opacity = 0 (hide WebView)                    │
│  - getChapter(Ch3) reloads with position         │
│  - Wait 350ms for scroll to settle               │
│  - opacity = 1 (show WebView)                    │
│  - User sees brief flash, continues reading      │
├──────────────────────────────────────────────────┤
│  DOM: [Ch3: 0-233]  (Clean single chapter)       │
│  Boundaries: [{id:6083,start:0,end:233,count:234}] │
├──────────────────────────────────────────────────┤
│  TTS: When pressed, reads from visible chapter   │
│  → Ch3, starting from current paragraph ✅       │
├──────────────────────────────────────────────────┤
│  User exits: Session save                        │
│  → Ch2: 100% read ✅                             │
│  → Ch3: In-progress with correct paragraph ✅    │
└──────────────────────────────────────────────────┘
```

---

## ❌ WRONG APPROACHES (CRITICAL - NEVER RETURN TO THESE!)

> [!CAUTION]
> These approaches were tried and FAILED. Do NOT revert to them under any circumstances.

### 1. ❌ Don't Use `querySelectorAll('.readable')` for Counting

**Mistake**: Tried to count elements using CSS class selector
```javascript
// ❌ WRONG - Returns 0!
const chapterElements = chapterContainer.querySelectorAll('.readable:not(.hide)').length;
```

**Why It Failed**:
- Elements DON'T have `class="readable"`
- They're identified by **nodeName** (P, DIV, H1-H6, etc.)
- `window.tts.readable(node)` is the correct check
- Query returned 0 → boundaries calculated wrong → trim never triggered

**Evidence from Logs**:
```
"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: 214, Chapter elements: 0, Calculated start: 214, Calculated end: 213, Count: 0"
```
- `Chapter elements: 0` = selector found nothing!
- `end: 213 < start: 214` = invalid range

**✅ CORRECT Solution**:
```javascript
const countReadableInContainer = (container) => {
  let count = 0;
  const traverse = (node) => {
    if (node.nodeType === 1 && window.tts.readable(node)) {
      count++;
    }
    node.childNodes.forEach(child => traverse(child));
  };
  traverse(container);
  return count;
};

const chapterElementCount = countReadableInContainer(contentDiv);
const newChapterStart = allElements.length - chapterElementCount;
const newChapterEnd = allElements.length - 1;
```

**Lesson**: **Never assume CSS classes exist. Always use the same traversal logic that counts elements elsewhere.**

---

### 2. ❌ Don't Use `setChapter()` for Chapter Transitions

**Mistake**: Used `setChapter()` to update chapter after trim
```typescript
// ❌ WRONG - Only updates chapter state!
case 'chapter-transition':
  const newChapter = await getDbChapter(chapterId);
  setChapter(newChapter);  // Missing adjacent chapters!
  break;
```

**Why It Failed**:
- `setChapter()` only updates `chapter` state
- Doesn't update `chapterText`, `nextChapter`, `prevChapter`
- After first trim, Chapter 4 didn't append because `nextChapter` was stale
- User logs showed: "Next chapter not stitching after trim"

**✅ CORRECT Solution**:
```typescript
case 'chapter-transition':
  const { chapterId, paragraphIndex } = event.data;
  const newChapter = await getDbChapter(chapterId);
  
  if (newChapter) {
    // Use getChapter() - updates ALL chapter state
    getChapter(newChapter);
    
    // CRITICAL: Sync refs after HTML regeneration in onLoadEnd
    // (Because HTML uses initialNextChapter.current/initialPrevChapter.current)
  }
  break;

// In onLoadEnd handler
if (justTransitioned) {
  initialNextChapter.current = nextChapter;
  initialPrevChapter.current = prevChapter;
}
```

**Lesson**: **`setChapter()` is for simple state updates. `getChapter()` is for full chapter loading with all dependencies.**

---

### 3. ❌ Don't Use Ref-Based Approach Without Reload

**Mistake**: Tried to avoid WebView reload using refs
```typescript
// ❌ WRONG - TTS breaks!
const activeChapterIdRef = useRef(chapter.id);

case 'chapter-transition':
  activeChapterIdRef.current = newChapterId;
  // No reload, just update ref
  break;
```

**Why It Failed**:
- HTML generation uses `chapter.id` in initial render
- TTS checks `this.chapter.id` in WebView
- Ref update didn't regenerate HTML with new chapter ID
- TTS logs showed: "highlightParagraph ignored - stale chapter"

**✅ CORRECT Solution**:
```typescript
// Must reload WebView to regenerate HTML
case 'chapter-transition':
  const newChapter = await getDbChapter(chapterId);
  getChapter(newChapter);  // Triggers HTML regeneration
  
  // Hide reload with opacity transition
  setIsTransitioning(true);  // opacity = 0
  
  // onLoadEnd fires
  setTimeout(() => setIsTransitioning(false), 350);  // opacity = 1
  break;
```

**Lesson**: **WebView reload is required for HTML regeneration. Can't avoid it. Can only hide it with opacity.**

---

### 4. ❌ Don't Invalidate Cache After Getting Elements

**Mistake**: Called `invalidateCache()` in wrong order
```javascript
// ❌ WRONG - New elements not counted!
const allElements = this.getReadableElements();  // Gets old cache
this.invalidateCache();  // Too late!
```

**Why It Failed**:
- `getReadableElements()` uses cached results
- After appending Ch3, cache still only had Ch2 elements
- Boundaries calculated with wrong element count

**✅ CORRECT Solution**:
```javascript
// Invalidate FIRST
this.invalidateCache();
const allElements = this.getReadableElements();  // Gets fresh count including new chapter
```

**Lesson**: **Cache invalidation must happen BEFORE any read operations that depend on new content.**

---

### 5. ❌ Don't Assume All Chapters Have Same DOM Structure

**Mistake**: Single query to find all chapters
```javascript
// ❌ WRONG - Only finds stitched chapters!
const allChapters = this.chapterElement.querySelectorAll('[data-chapter-id]');
```

**Why It Failed**:
- **Original chapter**: Raw HTML in `chapterElement`, NO wrapper div with `data-chapter-id`
- **Stitched chapters**: Wrapped in `<div class="stitched-chapter" data-chapter-id="X">`
- Query missed original chapter entirely

**✅ CORRECT Solution**:
```javascript
const firstChapterId = this.loadedChapters[0];

if (firstChapterId === this.chapter.id) {
  // Original chapter - no data-chapter-id attribute
  const originalChapterContent = this.chapterElement.querySelector('.chapter-body') ||
                                 this.chapterElement.querySelector('[class*="chapter"]');
  if (originalChapterContent && originalChapterContent.tagName === 'DIV') {
    // Remove non-stitched children
    const children = originalChapterContent.children;
    const elementsToRemove = Array.from(children).filter(
      child => !child.classList.contains('stitched-chapter')
    );
    elementsToRemove.forEach(el => el.remove());
  }
} else {
  // Stitched chapter - has data-chapter-id
  const firstStitched = this.chapterElement.querySelector(
    `[data-chapter-id="${firstChapterId}"]`
  );
  if (firstStitched) {
    firstStitched.remove();
  }
}
```

**Lesson**: **Original chapter vs stitched chapters have fundamentally different DOM structures. Always handle both cases explicitly.**

---

### 6. ❌ Don't Forget First Chapter Boundary Initialization

**Mistake**: `chapterBoundaries = []` stayed empty
```javascript
// ❌ WRONG - First chapter never tracked!
this.chapterBoundaries = [];  // Empty forever
```

**Why It Failed**:
- `manageStitchedChapters()` checks `boundaries.length === 0` and returns early
- Even after Ch2 → Ch3 append, only Ch3 had boundary
- Auto-trim logic requires knowing which chapter user is in
- Without  boundary, couldn't detect user had moved to second chapter

**✅ CORRECT Solution**:
```javascript
// After first chapter loads (in calculatePages or onLoad)
if (this.chapterBoundaries.length === 0) {
  const elements = this.getReadableElements();
  this.chapterBoundaries.push({
    chapterId: this.chapter.id,
    startIndex: 0,
    endIndex: elements.length - 1,
    paragraphCount: elements.length
  });
}
```

**Lesson**: **Track ALL chapters in boundaries, including the first/original chapter, not just appended ones.**

---

## ✅ WORKING IMPLEMENTATION DETAILS

### 1. DOM Stitching (✅ VALIDATED)

**Files**: 
- `android/app/src/main/assets/js/core.js`: Lines 236-318 (`receiveChapterContent()`)
- `src/screens/reader/components/WebViewReader.tsx`: Lines 663-694 (`fetch-chapter-content` handler)

**How It Works**:

```javascript
// core.js - receiveChapterContent()
this.receiveChapterContent = function (chapterHtml, chapterId, chapterName) {
  // 1. Create container with metadata
  const chapterContainer = document.createElement('div');
  chapterContainer.className = 'stitched-chapter';
  chapterContainer.setAttribute('data-chapter-id', chapterId);
  chapterContainer.setAttribute('data-chapter-name', chapterName);
  
  // 2. Add boundary separator (if bordered mode)
  if (boundaryMode === 'bordered') {
    const previousChapters = this.chapterElement.querySelectorAll('[data-chapter-id]');
    const previousChapterName = previousChapters.length > 0
      ? previousChapters[previousChapters.length - 1].getAttribute('data-chapter-name')
      : this.chapter.name;
    
    const separator = document.createElement('div');
    separator.className = 'chapter-boundary-bordered';
    separator.innerHTML = `
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
  
  // 5. Track boundary (CRITICAL: Correct counting!)
  this.invalidateCache();  // MUST be first!
  const allElements = this.getReadableElements();
  
  // ✅ CORRECT: Use countReadableInContainer helper
  const countReadableInContainer = (container) => {
    let count = 0;
    const traverse = (node) => {
      if (node.nodeType === 1 && window.tts.readable(node)) count++;
      node.childNodes.forEach(child => traverse(child));
    };
    traverse(container);
    return count;
  };
  
  const chapterElementCount = countReadableInContainer(contentDiv);
  const newChapterStart = allElements.length - chapterElementCount;
  const newChapterEnd = allElements.length - 1;
  
  this.chapterBoundaries.push({
    chapterId: chapterId,
    startIndex: newChapterStart,
    endIndex: newChapterEnd,
    paragraphCount: chapterElementCount
  });
  
  // 6. Update tracking
  this.loadedChapters.push(chapterId);
  
  // 7. Notify React Native
  this.post({
    type: 'chapter-appended',
    data: { chapterId, chapterName, loadedChapters: this.loadedChapters }
  });
};
```

**Status**: ✅ VALIDATED
- Logs confirm: "Appended chapter", boundaries correct
- User can scroll Ch2 → Ch3 → Ch4 → Ch5 seamlessly

---

### 2. Auto-Trim with Smooth Transition (✅ VALIDATED)

**Purpose**: Remove previous chapter at 15% progression with minimal user interruption

**Files**:
- `core.js`: Lines 515-630 (`manageStitchedChapters`, `trimPreviousChapter`)
- `WebViewReader.tsx`: `chapter-transition` handler

**How It Works**:

```javascript
// core.js - manageStitchedChapters()
this.manageStitchedChapters = function () {
  // Safety checks
  if (this.loadedChapters.length <= 1) return;
  if (!this.chapterBoundaries || this.chapterBoundaries.length === 0) return;
  
  const threshold = this.generalSettings?.continuousScrollTransitionThreshold || 15;
  
  // Find first visible paragraph (O(n) with early exit)
  const readableElements = this.getReadableElements();
  let firstVisibleIndex = -1;
  
  for (let i = 0; i < readableElements.length; i++) {
    const rect = readableElements[i].getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      firstVisibleIndex = i;
      break;  // Early exit!
    }
  }
  
  if (firstVisibleIndex === -1) return;
  
  // Find which chapter user is in
  for (let i = 0; i < this.chapterBoundaries.length; i++) {
    const boundary = this.chapterBoundaries[i];
    
    if (firstVisibleIndex >= boundary.startIndex && 
        firstVisibleIndex <= boundary.endIndex) {
      
      // Calculate progress within this chapter
      const paragraphsIntoCurrent = firstVisibleIndex - boundary.startIndex;
      const progressPercent = (paragraphsIntoCurrent / boundary.paragraphCount) * 100;
      
      // Trim condition: 2nd+ chapter AND past threshold
      if (i > 0 && progressPercent >= threshold) {
        console.log(`Reader: User ${progressPercent.toFixed(1)}% into chapter ${boundary.chapterId}, trimming previous`);
        
        // Trim previous chapter
        const removedChapterId = this.trimPreviousChapter();
        
        if (removedChapterId) {
          // Notify React Native to reload with current chapter
          this.post({
            type: 'chapter-transition',
            data: {
              chapterId: boundary.chapterId,
              chapterName: boundary.chapterName || 'Unknown',
              paragraphIndex: paragraphsIntoCurrent  // Preserve position
            }
          });
        }
      }
      
      return;  // Exit after finding chapter
    }
  }
};

// core.js - trimPreviousChapter()
this.trimPreviousChapter = function () {
  if (this.loadedChapters.length <= 1) return null;
  
  const firstChapterId = this.loadedChapters[0];
  
  if (firstChapterId === this.chapter.id) {
    // Remove ORIGINAL chapter (no wrapper)
    const originalChapterContent = this.chapterElement.querySelector('.chapter-body') ||
                                   this.chapterElement.querySelector('[class*="chapter"]');
    if (originalChapterContent && originalChapterContent.tagName === 'DIV') {
      const children = originalChapterContent.children;
      const elementsToRemove = Array.from(children).filter(
        child => !child.classList.contains('stitched-chapter')
      );
      elementsToRemove.forEach(el => el.remove());
    }
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
  const removedBoundary = this.chapterBoundaries.shift();
  
  // Recalculate boundaries (indices shift down)
  const offsetAmount = removedBoundary.paragraphCount;
  this.chapterBoundaries.forEach(boundary => {
    boundary.startIndex -= offsetAmount;
    boundary.endIndex -= offsetAmount;
  });
  
  this.invalidateCache();
  console.log(`Reader: Trimmed chapter ${removedChapterId}, remaining: ${this.loadedChapters.length}`);
  
  return removedChapterId;
};
```

```typescript
// WebViewReader.tsx - chapter-transition handler
case 'chapter-transition':
  const { chapterId, paragraphIndex } = event.data;
  console.log(`WebViewReader: Chapter transition event, reloading to chapter ${chapterId}`);
  
  // Hide WebView during transition
  setIsTransitioning(true);  // opacity = 0
  
  // Get new chapter
  const newChapter = await getDbChapter(chapterId);
  
  if (newChapter) {
    // Use getChapter() to properly update all state
    getChapter(newChapter);
    
    // Note: HTML will regenerate, WebView will reload
    // Position is preserved via initialParagraphIndex ref
  }
  break;

// In WebView component
const [isTransitioning, setIsTransitioning] = useState(false);

<WebView
  ref={webViewRef}
  opacity={isTransitioning ? 0 : 1}  // Hide during transition
  onLoadEnd={() => {
    // Sync refs after HTML regeneration
    initialNextChapter.current = nextChapter;
    initialPrevChapter.current = prevChapter;
    
    // If transitioning, wait for scroll to settle
    if (isTransitioning) {
      setTimeout(() => {
        setIsTransitioning(false);  // Show WebView again
      }, 350);
    }
  }}
/>
```

**Status**: ✅ VALIDATED
- Triggers at 15% progression
- Brief flash (~350ms) during reload
- User feedback: "Less jarring, works well"

---

### 3. TTS Integration (✅ VALIDATED)

**Purpose**: TTS starts from correct paragraph after trim

**How It Works**:
1. After trim, DOM contains only visible chapter (e.g., Ch3)
2. TTS reads `this.chapter.id` which matches visible chapter
3. Paragraph indices reset to 0-based (e.g., was 250, now 36)
4. TTS highlights correct paragraph

**Status**: ✅ VALIDATED
- User confirmed: "TTS starts properly from current chapter"
- No "stale chapter" errors

---

### 4. Session Save (✅ VALIDATED)

**How It Works**:
1. User reads Ch2 100%, scrolls into Ch3 (e.g., paragraph 250)
2. Trim happens → Ch2 removed, Ch3 becomes single chapter
3. User exits reader
4. `saveProgress()` saves:
   - Ch2: 100% read ✅
   - Ch3: In-progress (paragraph 36, which was 250 before trim) ✅

**Status**: ✅ VALIDATED
- User confirmed: "Session save is perfect"
- Previous chapter marked 100%, current saved correctly

---

## Files Modified (All Validated ✅)

| File                | Status      | Changes                            | Key Lines                               |
| ------------------- | ----------- | ---------------------------------- | --------------------------------------- |
| `core.js`           | ✅ Validated | Stitching, boundaries, trim, TTS   | 236-318, 515-630                        |
| `WebViewReader.tsx` | ✅ Validated | Transition handling, opacity state | Custom handler for `chapter-transition` |
| `useChapter.ts`     | ✅ Validated | Exposed `getChapter`               | Hook exports                            |
| `ChapterQueries.ts` | ✅ Validated | MMKV cleanup                       | 4 unread functions                      |

---

## Validation Log Sequence

### Chapter Append (Successful):
```
Reader: Continuous scroll triggered
WebViewReader: Reading from local file
[receiveChapterContent] Chapter: 6083, Total elements: 448, Chapter elements: 234, Calculated start: 214, Calculated end: 447, Count: 234
Reader: Appended chapter Chapter 3 (total loaded: 2)
```

### Auto-Trim Trigger (Successful):
```
[manageStitchedChapters] First visible: 250, Boundaries: 2, Threshold: 15%
[manageStitchedChapters] Paragraph 250 belongs to boundary 1 (chapter 6083), progress: 15.4%
Reader: User 15.4% into chapter 6083, trimming previous
Reader: Trimmed chapter 6082, remaining: 1
```

### Chapter Transition (Successful):
```
WebViewReader: Chapter transition event, reloading to chapter 6083
[opacity = 0, WebView hidden]
[getChapter() loads Chapter 3]
[WebView HTML regenerates]
[onLoadEnd fires]
[Wait 350ms for scroll settle]
[opacity = 1, WebView visible]
```

### TTS Integration (Successful):
```
TTS: Starting from paragraph 36 (after trim)
TTS: Reading chapter 6083
TTS: highlightParagraph applied successfully
```

---

## Critical Success Factors

> [!WARNING]
> These implementation decisions are CRITICAL. Do NOT modify without thorough testing!

1. **Boundary Calculation**: MUST use `countReadableInContainer()`, NOT `querySelectorAll('.readable')`
2. **Cache Invalidation**: MUST happen BEFORE `getReadableElements()` call
3. **Chapter Transition**: MUST use `getChapter()`, NOT `setChapter()`
4. **WebView Reload**: Required for HTML regeneration, hidden via opacity transition
5. **Trim Logic**: MUST handle both original (no wrapper) and stitched (with wrapper) chapters
6. **First Chapter**: MUST initialize boundary for first chapter, not just appended ones

---

## Lessons Learned

### What Worked ✅

1. **Iterative Debugging**: Added comprehensive logs, user tested, analyzed, fixed
2. **User Validation**: Real device testing caught issues emulator didn't
3. **Documentation**: "WRONG APPROACHES" prevented returning to broken solutions
4. **Opacity Transition**: Effectively hides WebView reload with minimal UX impact

### Challenges ❌

1. **Element Counting**: CSS selectors unreliable, needed custom traversal
2. **WebView Lifecycle**: Reload required for HTML regeneration, can't avoid
3. **DOM Structure Variance**: Original vs stitched chapters need separate handling
4. **Dev Build Caching**: Asset changes not picked up, needed clean rebuilds

### Key Insights 💡

1. **Trust Runtime Logs Over Code Review**
   - Code looked correct but logs revealed actual bug
   - User's "still not working" is always valid

2. **Consistency in Traversal Logic**
   - Use same method to count elements and retrieve them
   - Don't assume CSS classes exist

3. **WebView Reload Is Necessary**
   - Can't avoid reload for HTML regeneration
   - Can only hide it with UX techniques

4. **Handle All Cases Explicitly**
   - Original chapter structure ≠ stitched chapter structure
   - Always check both paths

---

## Enhancement Opportunities 🚀

All core features working. See `READER_ENHANCEMENTS.md` for future improvements:

1. **Dual WebView Architecture** (6-9 hours) - Eliminate visible flash entirely
2. **Adaptive Transition Timing** (2-3 hours) - Reduce 350ms wait
3. **Progressive Pre-fetching** (3-4 hours) - Instant append
4. **Threshold Configuration UI** (2 hours) - User customization
5. **Transition Animations** (5-6 hours) - Multiple styles
6. **Visual Loading Indicator** (45 min) - User feedback

---

## Conclusion

**Current State**: ✅ PRODUCTION READY  
**All Features**: Validated by user testing  
**Quality**: Stable and robust  
**Next**: Ship or enhance based on priorities

**Document Version**: 6.0 (Complete Success Documentation)  
**Status**: All features working  
**Recommendation**: Ship as-is or implement quick-win enhancements
