# Continuous Scrolling - Feature Overview

**Feature**: Seamless chapter-to-chapter reading  
**Status**: ⚠️ Implemented with Critical Bugs  
**Updated**: December 20, 2024 20:17 GMT+8

---

## Quick Summary

**What It Does**: Automatically loads next chapter content into current view when user scrolls to 95%, creating seamless reading experience without page reloads.

**Current State**:
- ✅ Chapters append correctly
- ✅ Downloads prioritized over network
- ✅ Progress saves correctly
- ❌ Auto-trim crashes (stack overflow)
- ❌ Settings not accessible to users

---

## How It Works

### User Experience

1. **Reading Chapter 3**  
   User scrolls normally through 226 paragraphs

2. **Approaching End (95%)**  
   Chapter 4 content automatically fetches and appends to page

3. **Seamless Transition**  
   User keeps scrolling - no page reload, no button press  
   Border separator shows "Chapter 4: Misunderstanding (4)"

4. **Auto-Cleanup (BROKEN)**  
   *Should happen*: When user is 15% into Ch4, Ch3 removed from DOM  
   *Actually happens*: App crashes with stack overflow

### Technical Flow

```
DOM State Evolution:
──────────────────────

Initial Load:
┌─────────────────────────┐
│ Chapter 3 (0-225)       │
│ chapterBoundaries: []   │ ← BUG: Should have Ch3 entry
└─────────────────────────┘

After 95% Scroll:
┌─────────────────────────┐
│ Chapter 3 (0-225)       │
├─────────────────────────┤
│ Chapter 4 (226-429)     │
│ chapterBoundaries:      │
│   [0] Ch4: 226-429      │ ← BUG: Ch3 missing
└─────────────────────────┘

Should Happen at 15% Ch4:
┌─────────────────────────┐
│ Chapter 4 (0-203)       │ ← Ch3 removed, indices reset
│ chapterBoundaries:      │
│   [0] Ch4: 0-203        │
└─────────────────────────┘

Actually Happens:
💥 RangeError: Maximum call stack size exceeded
```

---

## Implementation Components

### 1. DOM Stitching ✅

**What**: Append next chapter HTML to current page  
**Where**: `core.js` - `loadAndAppendNextChapter()`, `receiveChapterContent()`  
**Status**: Working  

**Evidence**:
```
Reader: Continuous scroll triggered
WebViewReader: Reading from local file
Reader: Appended chapter Chapter 4 (total loaded: 2)
```

### 2. Smart Progress Saving ✅

**What**: Track which chapter user is viewing, save relative progress  
**Where**: `core.js` - `saveProgress()`  
**Status**: Working  

**How**:
- Paragraph 334 in combined DOM
- Belongs to Ch4 (starts at 226)
- Relative index: 334 - 226 = 108
- Saves as: `{chapterId: 6084, paragraphIndex: 108}`

**Evidence**:
```
Progress: 77 Paragraph: 334  ← Combined index
(Internally mapped to Ch4, para 108)
```

### 3. Local Fetch Optimization ✅

**What**: Check downloaded files before hitting network  
**Where**: `WebViewReader.tsx` - `fetch-chapter-content` handler  
**Status**: Working  

**Evidence**:
```
WebViewReader: Reading from local file  ← Uses download
(vs "fetching from network")
```

###4. Auto-Trim ❌

**What**: Remove previous chapter when user scrolls into next  
**Where**: `core.js` - `manageStitchedChapters()`, `trimPreviousChapter()`  
**Status**: **BROKEN - Causes Stack Overflow**  

**Should Do**:
```
User scrolls to paragraph 226 (Ch4 starts)
User scrolls to paragraph 256 (15% into Ch4)
→ Remove Ch3 from DOM
→ Reset indices: Ch4 now 0-203
→ DOM clean for TTS
```

**Actually Does**:
```
manageStitchedChapters() called on scroll
  → Loop through boundaries
    → Loop through 430 paragraphs
      → Call getBoundingClientRect() 430 times
        → Triggers more scroll events
          → manageStitchedChapters() called again
            → INFINITE RECURSION
              → 💥 CRASH
```

**Bug**: Nested loops + no throttling = O(n²) performance death

### 5. Settings UI ❌

**What**: Let users configure auto-trim threshold  
**Where**: `NavigationTab.tsx` (not added)  
**Status**: **MISSING**  

**Problem**: Setting exists in code (`continuousScrollTransitionThreshold: 15`) but no UI to change it.

**User Impact**: Stuck with 15% threshold, cannot customize.

---

## Critical Bugs

### Bug #1: Stack Overflow 🔴

**Error**:
```
RangeError: Maximum call stack size exceeded
```

**Cause**: `manageStitchedChapters` checks every paragraph on every scroll event.

**Fix**: Check only first visible paragraph:
```javascript
// BEFORE (broken)
for (chapter in boundaries) {
  for (para = start to end) { // 430 iterations!
    getBoundingClientRect()
  }
}

// AFTER (fixed)
let firstVisible = findFirstVisibleParagraph(); // 1 iteration, early exit
checkWhichChapter(firstVisible);
```

### Bug #2: Missing Initialization 🔴

**Problem**: First chapter never added to `chapterBoundaries`.

**Evidence**: Array stays empty `[]` even though 226 paragraphs exist.

**Impact**: Auto-trim logic thinks only 1 chapter exists, never triggers trim.

**Fix**: After first load:
```javascript
if (chapterBoundaries.length === 0) {
  chapterBoundaries.push({
    chapterId: currentChapter.id,
    startIndex: 0,
    endIndex: paragraphCount - 1,
    paragraphCount: paragraphCount
  });
}
```

### Bug #3: No Settings UI 🟡

**Problem**: Users cannot access threshold setting.

**Fix**: Add to settings screen:
```
[ ] Auto-Trim Threshold
    Description: Remove previous chapter after scrolling X% into next
    Options: 5%, 10%, 15%, 20%
    Current: 15%
```

---

## What's Next

### Immediate (Blockers)
1. Fix stack overflow (30 min)
2. Initialize boundaries (15 min)
---
### Then
3. Add settings UI (1 hour)
4. Test everything (1 hour)

### Testing Checklist
- [ ] No stack overflow errors
- [ ] Auto-trim triggers at threshold
- [ ] Ch3 removed from DOM when in Ch4
- [ ] Progress saves correctly
- [ ] TTS works after trim
- [ ] Settings UI functional

---

## For Next Developer

### What You Need to Know

1. **The Feature is 80% Done**  
   Core logic works. Two critical bugs blocking completion.

2. **Priority Order**  
   Must fix stack overflow first (app crashes). Then boundaries init (enables trim). Then UI (nice-to-have).

3. **Files to Edit**  
   - `core.js` line 405-443 (rewrite `manageStitchedChapters`)
   - `core.js` find init point (add boundary for Ch1)
   - `NavigationTab.tsx` (add settings UI)

4. **How to Test**  
   - Open Chapter 3: Misunderstanding (3) - ID 6083
   - Scroll to 95% → Ch4 should append
   - Keep scrolling into Ch4
   - At 15%: Should see "Trimming" log
   - Verify `loadedChapters` changes from `[6083, 6084]` to `[6084]`

5. **Expected Logs (After Fix)**  
   ```
   Reader: Appended chapter Chapter 4 (total loaded: 2)
   Reader: User 15.3% into chapter 6084, trimming previous
   Reader: Trimmed chapter 6083, 1 chapter(s) remaining
   ```

### Debug Commands

Check boundaries:
```javascript
// In browser console
console.log(window.reader.chapterBoundaries);
// Should show: [{ chapterId: 6083, startIndex: 0, endIndex: 225, ... }]
```

Check loaded chapters:
```javascript
console.log(window.reader.loadedChapters);
// Initially: [6083]
// After append: [6083, 6084]
// After trim: [6084]
```

---

## Design Decisions

### Why Auto-Trim?

**Alternatives Considered**:
1. Keep all chapters (memory leak, TTS issues)
2. Auto-navigate (jarring UX, loses scroll position)
3. **Auto-trim (chosen)**: Clean DOM, seamless to user

**Tradeoff**: Added complexity (boundaries tracking) vs better UX.

### Why 15% Default?

- 5%: Too eager, might trim before user settles
- 10%: Early enough to clean DOM quickly
- **15%**: Sweet spot - user clearly committed to next chapter
- 20%: Almost at end, defeats purpose

### Why Local-First Fetch?

- Saves data (rural users appreciate)
- Faster (instant vs network latency)
- Works offline
- No downside (fallback to network exists)

---

## Metrics to Track

Once stable, monitor:
- **Crash Rate**: Should be 0% (currently: 100% with stitched chapters)
- **Average Chapters Stitched**: Expect 1-3 per session
- **Trim Trigger Rate**: Should match scroll past threshold
- **Data Saved**: Compare network usage before/after

---

**Status**: Feature implemented, critical bugs found, fixes planned  
**Blocker**: Stack overflow prevents testing  
**ETA to Stable**: 2.5 hours (fix bugs + test)  
**Risk**: Medium (core logic sound, just optimization issues)
