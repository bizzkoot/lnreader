# Session Handoff: Continuous Scrolling Bug Fixes

**Date**: December 21, 2024 (Updated)  
**Session**: Invisible chapter transition implementation  
**Status**: 🟢 WORKING - User confirmed less jarring transitions

---

## LATEST UPDATE - December 21, 2024 (Session 3)

### INVISIBLE TRANSITION IMPLEMENTED

**User Request**: Make chapter transitions unobtrusive - user shouldn't notice the reload when trim happens.

**Solution Implemented**: Opacity-based transition hiding

**How It Works**:
1. When `chapter-transition` event fires (trim happens), set `isTransitioning = true`
2. WebView opacity immediately becomes 0 (invisible)
3. `getChapter()` loads the new chapter with correct paragraph position
4. On `onLoadEnd`, wait 350ms for scroll to settle
5. Set `isTransitioning = false` - WebView becomes visible again

**User Feedback**: "The transition is less jarring, see if there's anything you could do to reduce it further (making it much faster)"

### CRITICAL FIXES FROM EARLIER THIS SESSION

**Fix 1**: Changed from `setChapter()` to `getChapter()`:
- `setChapter()` only updated chapter state, not adjacent chapters
- `getChapter()` properly updates chapter, chapterText, nextChapter, prevChapter
- This fixed the bug where Chapter 4 wasn't stitching after Chapter 3 trim

**Fix 2**: Added nextChapter/prevChapter sync in `onLoadEnd`:
- HTML generation uses `initialNextChapter.current` refs
- These weren't updating after reload
- Now sync in `onLoadEnd` to ensure correct values

**Fix 3**: Reverted ref-based approach that broke TTS:
- Previous attempt used `activeChapterIdRef` to avoid reload
- This broke TTS - logs showed "TTS: highlightParagraph ignored - stale chapter"
- Returned to `getChapter()` which triggers proper HTML regeneration

### CURRENT STATE

**What's Working**:
- ✅ Chapter stitching (Ch2 → Ch3 → Ch4 → Ch5)
- ✅ DOM trim at 15% threshold
- ✅ React Native chapter context updates correctly
- ✅ TTS starts from visible paragraph after trim
- ✅ Paragraph position preserved across reload
- ✅ Invisible transition (opacity 0 during reload)
- ✅ Adjacent chapters update correctly (nextChapter, prevChapter)

**Possible Enhancements**:
- Reduce 350ms delay if scroll settles faster
- Consider dual-WebView approach for truly seamless transitions
- Add overlay view during transition for smoother UX

---

## PREVIOUS FIXES (December 21, 2024 - Sessions 1-2)

### ROOT CAUSE IDENTIFIED AND FIXED

**The Bug**: `chapterContainer.querySelectorAll('.readable:not(.hide)')` returned **0 elements** because:
- Elements DON'T have `class="readable"` 
- They're identified by **nodeName** (P, DIV, H1-H6, etc.) via `window.tts.readable()`

**Evidence from user logs**:
```
"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: 214, Chapter elements: 0, Calculated start: 214, Calculated end: 213, Count: 0"
```
- `Chapter elements: 0` = the query returned nothing!
- This caused `start: 214, end: 213` (end < start = invalid range)
- Paragraph 222 never matched boundary 1 because `222 <= 213` is false

### FIXES APPLIED

**Fix 1**: Changed boundary calculation in `receiveChapterContent()` (lines 287-312):
- Now uses `countReadableInContainer()` helper function
- Uses same traversal logic as `getReadableElements()` 
- Properly counts elements by checking `window.tts.readable(node)`

**Fix 2**: Fixed cache invalidation order:
- Cache is now invalidated BEFORE `getReadableElements()` is called
- This ensures newly appended chapter elements are included in the count

**Fix 3**: Fixed `trimPreviousChapter()` function (lines 526-537):
- Old code had bug: `if (originalChapterContent.tagName !== 'DIV')` skipped DIV-wrapped content
- New code: Uses `Array.from(children).filter()` to remove ALL non-stitched elements

### EXPECTED BEHAVIOR AFTER FIX

**Boundaries should now be correct**:
```
[{id:6082,start:0,end:213,count:214},{id:6083,start:214,end:447,count:234}]
```

**Trim should trigger at**:
- Paragraph 250 (214 + 15% of 234 = 214 + 35 = 249, rounded up to 250)
- Logs should show: `"[manageStitchedChapters] Paragraph 250 belongs to boundary 1 (chapter 6083)"`
- Followed by: `"Reader: Trimming previous chapter from DOM"`

---

## SESSION UPDATE - December 21, 2024 (Second Round)

### User Testing Results

**What worked:**
- ✅ Boundary calculation fixed - shows correct ranges now
- ✅ Paragraph matching works (e.g., "Paragraph 222 belongs to boundary 1")
- ✅ First trim triggered correctly at paragraph 255
- ✅ TTS started from visible paragraph and worked correctly

**What still needed fixing:**
1. Second trim showed "Removing 0 original chapter element(s)" - Chapter 3 (now stitched) wasn't removed
2. React Native still thought we were in Chapter 2 (header showed wrong chapter)
3. Chapter progress wasn't being saved correctly

### Additional Fixes Applied

**Fix 4**: `trimPreviousChapter()` now handles BOTH original and stitched chapters:
- Old code only removed non-stitched elements
- New code checks if original elements exist; if not, removes first stitched chapter

**Fix 5**: Added `chapter-transition` message to notify React Native when trim occurs:
- Calls `setChapter(currentChapter)` to update the main chapter state
- Updates adjacent chapters
- Injects updated chapter info back to WebView

**Files Modified:**
- `android/app/src/main/assets/js/core.js` (lines 535-600)
- `src/screens/reader/components/WebViewReader.tsx` (added chapter-transition handler)

---

## IMMEDIATE CONTEXT - START HERE

### What's Broken Right Now

**DOM Trim NOT Working**: User scrolls from Ch2 → Ch3 → Ch4, but previous chapters never get removed from DOM. Expected trim at paragraph ~250 (214 + 15% of 234), but no trim even at paragraph 490.

**Root Cause Identified**: Paragraphs 214+ (Ch3) are **NOT matching ANY boundary**! 

User's logs show:
```
"[manageStitchedChapters] Paragraph 211 belongs to boundary 0 (chapter 6082)"  ✅ Ch2 matched
"[manageStitchedChapters] First visible: 222, Boundaries: 2, Threshold: 15%"
(NO "belongs to" log!) ❌ Ch3 NOT matched!
"[manageStitchedChapters] First visible: 235, Boundaries: 2, Threshold: 15%"
(NO "belongs to" log!) ❌ Still not matched!
```

**Why This Breaks Everything**:
1. `manageStitchedChapters()` loops through boundaries to find which chapter user is in
2. For paragraph 222 (which is Ch3), loop finds NO match
3. Without a match, can't check trim condition (requires `i > 0`)
4. Trim check never runs, previous chapter never removed

---

## CRITICAL: Dev Build Asset Caching

**User's logs showed OLD code** instead of NEW code I wrote!

**Problem**: Files in `android/app/src/main/assets/js/core.js` are CACHED by dev builds. Metro bundler doesn't watch this directory.

**Solution**: Tell user to use ONE of these:
```bash
# Option 1: Clean dev build
pnpm run clean:full
pnpm run dev:start  # Terminal 1
pnpm run dev:android  # Terminal 2

# Option 2: Release build
pnpm run build:release:android
```

**Never assume dev build picked up core.js changes!**

---

## WHAT I DID THIS SESSION

### 1. Added Debug Logs (Lines 290-305, 589-595 in core.js)

**In `receiveChapterContent()` - Line 290**:
```javascript
console.log(
  `[receiveChapterContent] BOUNDARY DEBUG - ` +
  `Chapter: ${chapterId}, ` +
  `Total elements: ${allElements.length}, ` +
  `Chapter elements: ${chapterContainer.querySelectorAll('.readable:not(.hide)').length}, ` +
  `Calculated start: ${newChapterStart}, ` +
  `Calculated end: ${newChapterEnd}, ` +
  `Count: ${newChapterEnd - newChapterStart + 1}`
);
```

**In `manageStitchedChapters()` - Line 589**:
```javascript
console.log(`[manageStitchedChapters] BOUNDARIES DEBUG: ${JSON.stringify(this.chapterBoundaries.map(b => ({
  id: b.chapterId,
  start: b.startIndex,
  end: b.endIndex,
  count: b.paragraphCount
})))}`);
```

**Purpose**: These logs will reveal:
- **During append**: Are boundaries calculated correctly? (start: 214, end: 447?)
- **During scroll**: What ranges do boundaries actually have?
- **During matching**: Why doesn't paragraph 222 match boundary 1?

### 2. Updated Documentation

**File**: `specs/reader-continuous-scroll/IMPLEMENTATION_PLAN.md`

Added **"UPDATE 2: Boundary Mismatch Root Cause Discovery"** section covering:
- What happened in Round 1 & 2 testing
- Critical discovery (paragraph 222 no match)
- Root cause analysis (3 hypotheses)
- Debug logs added
- Dev build caching issue
- Lessons learned

**This document has EVERYTHING** - architecture, wrong approaches, implementation details, current bugs.

---

## WHAT USER NEEDS TO DO NEXT

### Step 1: Clean Rebuild (MANDATORY)

```bash
cd "/Users/muhammadfaiz/Custom APP/LNreader"
pnpm run clean:full
pnpm run dev:start  # Keep running in Terminal 1
pnpm run dev:android  # Terminal 2
```

### Step 2: Test and Capture Logs

1. Open Ch2 (ID: 6082, 214 paragraphs)
2. Scroll to 100% → Ch3 appends (ID: 6083, 234 paragraphs)
3. **IMMEDIATELY look for**: `"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083..."`
4. Continue scrolling into Ch3 (paragraphs 220, 230, 240)
5. **Look for**: `"[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,...},{id:6083,...}]"`
6. **Check**: Does paragraph 222 show `"belongs to boundary 1"` or NO log?
7. Send ALL logs from Ch3 append through paragraph 250

### Step 3: What to Look For

**If boundaries calculated correctly**:
```
"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: 448, Chapter elements: 234, Calculated start: 214, Calculated end: 447, Count: 234"
"[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,start:0,end:213,count:214},{id:6083,start:214,end:447,count:234}]"
"[manageStitchedChapters] Paragraph 222 belongs to boundary 1 (chapter 6083)"
```
→ Boundary calculation is correct, matching logic is the bug

**If boundaries calculated wrong**:
```
"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: 500, ..."  ← Wrong total!
OR
"[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,start:0,end:447,...},{id:6083,start:448,...}]"  ← Ch2 end is wrong!
```
→ `getReadableElements()` or calculation formula is the bug

**If still no match**:
```
"[manageStitchedChapters] First visible: 222, Boundaries: 2, Threshold: 15%"
(NO "belongs to" log)
```
→ Loop has off-by-one error or comparison logic bug

---

## HYPOTHESES - ROOT CAUSE

### Hypothesis 1: getReadableElements() Includes Hidden Elements

**Issue**: `allElements.length` includes paragraphs that shouldn't be counted.

**Check in logs**: Does `Total elements: X` match expected count?
- After Ch3 append: Should be 448 (214 + 234)
- If more than 448 → includes hidden/non-readable elements

**Fix if true**: Filter elements correctly in `getReadableElements()`.

### Hypothesis 2: Boundary 0 Has Wrong endIndex

**Issue**: Boundary 0 (Ch2) has `endIndex: 447` instead of `endIndex: 213`, so it catches ALL paragraphs including Ch3.

**Check in logs**: `"[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,start:0,end:???,...}]"`
- Should be `end:213`
- If `end:447` or higher → boundary 0 is wrong

**Fix if true**: Investigate why boundary 0's `endIndex` changed after Ch3 append.

### Hypothesis 3: Boundary Matching Loop Has Off-By-One Error

**Issue**: Comparison logic `firstVisibleIndex >= boundary.startIndex && firstVisibleIndex <= boundary.endIndex` has bug.

**Check in logs**: If boundaries are correct (214-447) but paragraph 222 still no match.

**Fix if true**: Debug loop logic, check for off-by-one in comparison.

---

## FILES TO CHECK BASED ON RESULTS

### If Calculation Bug (Hypothesis 1 or 2)

**File**: `android/app/src/main/assets/js/core.js`

**Lines 290-300**: Boundary calculation in `receiveChapterContent()`
```javascript
const allElements = this.getReadableElements();  // ← Check this method
const newChapterStart =
  allElements.length -
  chapterContainer.querySelectorAll('.readable:not(.hide)').length;
const newChapterEnd = allElements.length - 1;

this.chapterBoundaries.push({
  chapterId: chapterId,
  startIndex: newChapterStart,  // ← Check if correct
  endIndex: newChapterEnd,       // ← Check if correct
  paragraphCount: newChapterEnd - newChapterStart + 1,
});
```

**Lines ~180**: `getReadableElements()` method
- Does it filter correctly?
- Does it include hidden elements?
- Does it return consistent results?

### If Matching Bug (Hypothesis 3)

**File**: `android/app/src/main/assets/js/core.js`

**Lines 597-625**: Boundary matching loop in `manageStitchedChapters()`
```javascript
for (let i = 0; i < this.chapterBoundaries.length; i++) {
  const boundary = this.chapterBoundaries[i];
  
  if (
    firstVisibleIndex >= boundary.startIndex &&
    firstVisibleIndex <= boundary.endIndex
  ) {
    // Found match!
    // ...
    return; // ← Does this exit too early?
  }
}
```

---

## QUICK REFERENCE - BOUNDARY STRUCTURE

### Expected State After Ch2 → Ch3 Append

**DOM Structure**:
```html
<div id="chapterElement">
  <!-- Original Ch2 (no wrapper) -->
  <p class="readable">Paragraph 0</p>
  <p class="readable">Paragraph 1</p>
  ...
  <p class="readable">Paragraph 213</p>
  
  <!-- Appended Ch3 (with wrapper) -->
  <div class="stitched-chapter" data-chapter-id="6083" data-chapter-name="Chapter 3: ...">
    <div class="chapter-boundary-bordered">...</div>
    <div class="stitched-chapter-content">
      <p class="readable">Paragraph 214</p>
      <p class="readable">Paragraph 215</p>
      ...
      <p class="readable">Paragraph 447</p>
    </div>
  </div>
</div>
```

**this.chapterBoundaries**:
```javascript
[
  { chapterId: 6082, startIndex: 0, endIndex: 213, paragraphCount: 214 },
  { chapterId: 6083, startIndex: 214, endIndex: 447, paragraphCount: 234 }
]
```

**this.loadedChapters**: `[6082, 6083]`

### Expected Matching Behavior

| Paragraph | Expected Match | Should Trim? |
|-----------|---------------|--------------|
| 211 | Boundary 0 (Ch2), 98.6% progress | No (i=0) |
| 213 | Boundary 0 (Ch2), 100% progress | No (i=0) |
| 214 | Boundary 1 (Ch3), 0% progress | No (0% < 15%) |
| 222 | Boundary 1 (Ch3), 3.4% progress | No (3.4% < 15%) |
| 235 | Boundary 1 (Ch3), 9.0% progress | No (9.0% < 15%) |
| 250 | Boundary 1 (Ch3), 15.4% progress | **YES (15.4% >= 15%)** |
| 260 | Boundary 1 (Ch3), 19.7% progress | YES |

**Threshold Calculation**:
- Threshold = 15% of 234 = 35.1 → rounded to 36 paragraphs
- Trim should trigger at: 214 + 36 = paragraph 250

---

## CRITICAL LESSONS (DON'T FORGET!)

### ❌ DON'T Trust Dev Builds for core.js Changes

**Always** use `pnpm run clean:full` or `pnpm run build:release:android` when modifying files in `android/app/src/main/assets/`.

### ❌ DON'T Assume Code Works Because It Looks Right

User tested TWICE after fixes. Both times failed. Logs revealed the REAL problem (no boundary match) which code review missed.

### ✅ DO Add Debug Logs at Every Critical Step

Logs reveal runtime behavior code inspection can't show. Without logs showing "paragraph 222 has no belongs to log", we'd be iterating blindly.

### ✅ DO Trust User Testing Over Code Review

User's "still not working" is always valid. Their logs are the ground truth.

---

## WHAT'S ALREADY WORKING ✅

Don't waste time on these:

- ✅ DOM stitching (chapters append correctly)
- ✅ WebView persistence (same reader ID across appends)
- ✅ MMKV unread bug (fixed - 4 DB functions)
- ✅ Boundary display (shows correct previous chapter name)
- ✅ TTS clearing logic rewritten (but can't test until trim works)
- ✅ Trim calculation logic (absolute threshold) - **CODE IS CORRECT**

---

## SUMMARY - NEXT SESSION STARTS HERE

1. **Read user's logs** from clean rebuild test
2. **Look for**: `"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: ???..."`
3. **Check**: Is `Total elements: 448`? Are boundaries `[{...,end:213},{start:214,end:447,...}]`?
4. **Diagnose**:
   - If total ≠ 448 → Fix `getReadableElements()`
   - If boundary 0 end ≠ 213 → Fix boundary initialization
   - If boundaries correct but no match → Fix matching loop
5. **Apply fix** based on diagnosis
6. **Test again** with clean rebuild
7. **Once trim works** → Test TTS clearing
8. **Update docs** and commit

**Key File**: `android/app/src/main/assets/js/core.js` lines 290-300 (calculation) and 597-625 (matching)

**Expected Outcome**: Paragraph 222 should log `"belongs to boundary 1 (chapter 6083)"` and trim should trigger at paragraph 250.

---

**Status**: 🔴 Awaiting user testing  
**Blocker**: Need boundary debug logs to identify root cause  
**Next Action**: Analyze logs → Fix bug → Test → Verify → Document → Commit
