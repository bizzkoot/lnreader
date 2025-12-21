# Debug Checklist: Boundary Mismatch Bug

**Quick Reference** for analyzing user's test logs after clean rebuild.

---

## STEP 1: Check Boundary Calculation (During Ch3 Append)

### Look For This Log:
```
"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: ???, Chapter elements: ???, Calculated start: ???, Calculated end: ???, Count: ???"
```

### ✅ CORRECT VALUES:
- `Total elements: 448` (214 from Ch2 + 234 from Ch3)
- `Chapter elements: 234` (Ch3 paragraph count)
- `Calculated start: 214` (448 - 234)
- `Calculated end: 447` (448 - 1)
- `Count: 234` (447 - 214 + 1)

### ❌ IF WRONG:

**Total elements ≠ 448**:
- **Problem**: `getReadableElements()` includes hidden/non-readable elements
- **Fix Location**: `core.js` ~line 180, check filtering logic
- **Action**: Ensure query is `.querySelectorAll('.readable:not(.hide)')`

**Calculated start ≠ 214 or end ≠ 447**:
- **Problem**: Calculation formula wrong
- **Fix Location**: `core.js` lines 290-295
- **Action**: Review formula `allElements.length - chapterContainer.querySelectorAll(...).length`

---

## STEP 2: Check All Boundaries (During Scroll in Ch3)

### Look For This Log:
```
"[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,start:0,end:213,count:214},{id:6083,start:214,end:447,count:234}]"
```

### ✅ CORRECT VALUES:

**Boundary 0 (Ch2)**:
- `start: 0`
- `end: 213`
- `count: 214`

**Boundary 1 (Ch3)**:
- `start: 214`
- `end: 447`
- `count: 234`

### ❌ IF WRONG:

**Boundary 0 has end > 213** (e.g., `end: 447`):
- **Problem**: Boundary 0 was modified after Ch3 append OR initialized wrong
- **Fix Location**: 
  - Check `core.js` lines ~290-300 (append logic)
  - Check boundary 0 initialization (after first `calculatePages`)
- **Action**: Ensure boundary 0 never gets updated after initialization

**Boundary 1 has start ≠ 214 or end ≠ 447**:
- **Problem**: Calculation in `receiveChapterContent` was wrong (see Step 1)
- **Fix Location**: `core.js` lines 290-295
- **Action**: Fix boundary calculation formula

**Boundaries overlap** (e.g., boundary 0 end >= boundary 1 start):
- **Problem**: Serious logic error, boundaries should be continuous and non-overlapping
- **Fix Location**: Review entire boundary tracking logic
- **Action**: Ensure boundaries are: `[0-213], [214-447], [448-X], ...`

---

## STEP 3: Check Boundary Matching (Paragraph 222)

### Look For These Logs:
```
"[manageStitchedChapters] First visible: 222, Boundaries: 2, Threshold: 15%"
"[manageStitchedChapters] BOUNDARIES DEBUG: [...]"
"[manageStitchedChapters] Paragraph 222 belongs to boundary 1 (chapter 6083), progress: 3.4%, i=1, threshold=15"
```

### ✅ CORRECT BEHAVIOR:

**Must see**: `"Paragraph 222 belongs to boundary 1 (chapter 6083)"`
- Shows paragraph 222 (Ch3) matched boundary 1 ✅
- Progress: `(222 - 214) / 234 * 100 = 3.4%` ✅
- Trim condition: `3.4% < 15%` → No trim yet (correct) ✅

### ❌ IF NO "belongs to" LOG:

**Log shows**:
```
"[manageStitchedChapters] First visible: 222, Boundaries: 2, Threshold: 15%"
"[manageStitchedChapters] BOUNDARIES DEBUG: [...]"
(NO "belongs to" log!)
```

**Problem**: Paragraph 222 is NOT matching any boundary!

**Possible Causes**:
1. Boundary 1 has wrong range (doesn't include 222)
2. Matching loop has off-by-one error
3. Loop exits early before checking boundary 1

**Fix Locations**:
- If boundaries wrong: See Step 1 & 2 fixes
- If boundaries correct: `core.js` lines 597-625 (matching loop logic)

**Action**: Check comparison logic:
```javascript
if (
  firstVisibleIndex >= boundary.startIndex &&  // ← 222 >= 214? ✅
  firstVisibleIndex <= boundary.endIndex       // ← 222 <= 447? ✅
) {
  // Should match!
}
```

---

## STEP 4: Check Trim Trigger (Paragraph 250+)

### Look For These Logs (at paragraph 250):
```
"[manageStitchedChapters] First visible: 250, Boundaries: 2, Threshold: 15%"
"[manageStitchedChapters] BOUNDARIES DEBUG: [...]"
"[manageStitchedChapters] Paragraph 250 belongs to boundary 1 (chapter 6083), progress: 15.4%, i=1, threshold=15"
"[manageStitchedChapters] TRIM CHECK - Prev chapter paras: 214, Current chapter paras: 234, Threshold para: 250, Current visible: 250, Should trim: true"
"Reader: User at paragraph 250 (>= 250), trimming previous chapter 6082"
"Reader: Trimmed chapter 6082, 1 chapter(s) remaining"
```

### ✅ CORRECT BEHAVIOR:

**Must see**:
1. `"Paragraph 250 belongs to boundary 1"` ← Matching works
2. `"progress: 15.4%"` ← Progress calculation correct (36/234 = 15.4%)
3. `"TRIM CHECK - ... Threshold para: 250"` ← Threshold calculated correctly (214 + 36)
4. `"Should trim: true"` ← Trim condition met (250 >= 250)
5. `"trimming previous chapter 6082"` ← Trim executed

### ❌ IF NO TRIM:

**Log shows**:
```
"[manageStitchedChapters] Paragraph 250 belongs to boundary 1 (chapter 6083), progress: 15.4%, i=1, threshold=15"
(NO "TRIM CHECK" log!)
```

**Problem**: Trim condition not being checked despite match found.

**Possible Causes**:
1. `i > 0` condition failing (but i=1, so should pass)
2. Code after matching is wrong
3. Loop returns before reaching trim check

**Fix Location**: `core.js` lines 609-625 (after boundary match found)

**Action**: Ensure trim check code runs:
```javascript
if (
  firstVisibleIndex >= boundary.startIndex &&
  firstVisibleIndex <= boundary.endIndex
) {
  // ... progress calculation ...
  
  // ← TRIM CHECK SHOULD BE HERE!
  if (i > 0) {
    const prevBoundary = this.chapterBoundaries[i - 1];
    const thresholdParagraphCount = prevBoundary.paragraphCount + Math.ceil((boundary.paragraphCount * threshold) / 100);
    const shouldTrim = firstVisibleIndex >= thresholdParagraphCount;
    
    if (shouldTrim) {
      this.trimPreviousChapter();
    }
  }
  
  return; // ← Exit AFTER trim check, not before!
}
```

---

## QUICK DECISION TREE

```
User provides logs
    ↓
Check Step 1: Boundary calculation during append
    ↓
├─ Total elements ≠ 448? → Fix getReadableElements()
├─ Calculated indices wrong? → Fix calculation formula
└─ Values correct? → Continue to Step 2
    ↓
Check Step 2: All boundaries during scroll
    ↓
├─ Boundary 0 end ≠ 213? → Fix boundary initialization
├─ Boundary 1 start ≠ 214 or end ≠ 447? → Fix from Step 1
└─ Boundaries correct? → Continue to Step 3
    ↓
Check Step 3: Paragraph 222 matching
    ↓
├─ NO "belongs to" log? → Fix matching loop (lines 597-625)
└─ Has "belongs to" log? → Continue to Step 4
    ↓
Check Step 4: Trim at paragraph 250
    ↓
├─ NO "TRIM CHECK" log? → Fix trim condition placement
├─ "Should trim: false"? → Fix threshold calculation
└─ "Should trim: true" + trimmed? → ✅ BUG FIXED!
```

---

## EXPECTED LOG SEQUENCE (Full Success)

### During Ch3 Append:
```
"Reader: Continuous scroll triggered (mode: always, boundary: bordered, next: Chapter 3: Misunderstanding (3))"
"WebViewReader: Fetching chapter content for Chapter 3: Misunderstanding (3)"
"WebViewReader: Reading from local file"
"WebViewReader: Got chapter HTML (19815 chars)"
"[receiveChapterContent] BOUNDARY DEBUG - Chapter: 6083, Total elements: 448, Chapter elements: 234, Calculated start: 214, Calculated end: 447, Count: 234"
"[receiveChapterContent] After push: loadedChapters = [6082,6083], length = 2"
"Reader: Appended chapter Chapter 3: Misunderstanding (3) (total loaded: 2)"
```

### At Paragraph 222 (Ch3 Start):
```
"[manageStitchedChapters] First visible: 222, Boundaries: 2, Threshold: 15%"
"[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,start:0,end:213,count:214},{id:6083,start:214,end:447,count:234}]"
"[manageStitchedChapters] Paragraph 222 belongs to boundary 1 (chapter 6083), progress: 3.4%, i=1, threshold=15"
"[manageStitchedChapters] TRIM CHECK - Prev chapter paras: 214, Current chapter paras: 234, Threshold para: 250, Current visible: 222, Should trim: false"
```

### At Paragraph 250 (15% into Ch3):
```
"[manageStitchedChapters] First visible: 250, Boundaries: 2, Threshold: 15%"
"[manageStitchedChapters] BOUNDARIES DEBUG: [{id:6082,start:0,end:213,count:214},{id:6083,start:214,end:447,count:234}]"
"[manageStitchedChapters] Paragraph 250 belongs to boundary 1 (chapter 6083), progress: 15.4%, i=1, threshold=15"
"[manageStitchedChapters] TRIM CHECK - Prev chapter paras: 214, Current chapter paras: 234, Threshold para: 250, Current visible: 250, Should trim: true"
"Reader: User at paragraph 250 (>= 250), trimming previous chapter 6082"
"Reader: Trimmed chapter 6082, 1 chapter(s) remaining"
"[manageStitchedChapters] First visible: 36, Boundaries: 1, Threshold: 15%"  ← Now paragraph 36 (was 250, shifted by -214)
```

### After Trim (Paragraphs Renumbered):
- Old paragraph 250 → New paragraph 36 (250 - 214)
- Boundary 0 removed, boundary 1 becomes boundary 0
- New boundary 0: `{id: 6083, start: 0, end: 233, count: 234}`

---

**Use this checklist** to quickly diagnose which fix is needed based on user's logs!
