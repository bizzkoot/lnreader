# Continuous Scrolling - Task Breakdown

**Status**: Phase 2 - Critical Bug Fixing  
**Last Updated**: December 20, 2024 20:17 GMT+8

---

## Phase 1: Core Implementation ✅ COMPLETE

- [x] Remove bottom banner UI
- [x] Implement `loadAndAppendNextChapter()`
- [x] Implement `receiveChapterContent()`
- [x] Add chapter boundary tracking (`chapterBoundaries` array)
- [x] Add CSS for bordered/stitched modes
- [x] Integrate `fetchChapter` with local storage check
- [x] Fix TypeScript and lint errors
- [x] Type-check passing

---

## Phase 2: Integration & Optimization ⚠️ BUGS FOUND

### Completed ✅
- [x] Intelligent save progress (uses `chapterBoundaries`)
- [x] Local fetch optimization (checks downloads first)
- [x] Add `continuousScrollTransitionThreshold` setting type
- [x] Auto-trim logic structure (`manageStitchedChapters`, `trimPreviousChapter`)

### Critical Bugs Discovered ❌

#### Bug #1: Stack Overflow 🔴
- **File**: `core.js` line 405-443
- **Function**: `manageStitchedChapters()`
- **Issue**: Nested `for` loop checking ALL paragraphs causes infinite recursion
- **Error**: `RangeError: Maximum call stack size exceeded`
- **Impact**: App crashes when scrolling with stitched chapters
- **Fix**: Replace with "find first visible paragraph" approach

**Current Broken Code**:
```javascript
// PROBLEM: O(n²) complexity with 400+ paragraphs
for (let i = 0; i < this.chapterBoundaries.length; i++) {
  for (let idx = boundary.startIndex; idx <= boundary.endIndex; idx++) {
    const rect = readableElements[idx].getBoundingClientRect(); // Called 400+ times!
  }
}
```

**Planned Fix**:
```javascript
// Find FIRST visible paragraph only - O(n)
let firstVisibleIndex = -1;
for (let i = 0; i < readableElements.length; i++) {
  const rect = readableElements[i].getBoundingClientRect();
  if (/* visible */) {
    firstVisibleIndex = i;
    break; // Stop immediately
  }
}
```

---

#### Bug #2: Missing Boundaries Init 🔴
- **File**: `core.js` line 61
- **Variable**: `this.chapterBoundaries = []`
- **Issue**: First chapter boundary never created
- **Impact**: Auto-trim never triggers (boundaries array empty)
- **Evidence**: No "Trimming at X%" logs in console

**Current Code**:
```javascript
// Line 61
this.chapterBoundaries = []; // Empty - WRONG!

// Boundaries only added when APPENDING (line 275)
// But first chapter never creates boundary
```

**Planned Fix**:
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

---

#### Bug #3: No Settings UI 🟡
- **File**: `NavigationTab.tsx`
- **Setting**: `continuousScrollTransitionThreshold`
- **Issue**: Type exists, default works, but no UI to change it
- **Impact**: Users cannot customize threshold (stuck at 15%)

**Planned Fix**: Add selector after `continuousScrollBoundary`:
```tsx
<List.Item
  title="Auto-Trim Threshold"
  description={`${continuousScrollTransitionThreshold}%`}
  onPress={showThresholdModal}
/>
```

---

## Phase 3: Bug Fixes 🔄 IN PROGRESS

### Priority 1: Fix Stack Overflow (BLOCKER)
- [ ] Replace `manageStitchedChapters` with optimized version
- [ ] Add safety checks for null/undefined
- [ ] Test with Ch3 (226) + Ch4 (204) = 430 paragraphs
- [ ] Verify no RangeError in logs

### Priority 2: Initialize Boundaries (BLOCKER)
- [ ] Find initialization point (after DOM load)
- [ ] Add boundary for first chapter
- [ ] Verify via console log: "Initialized boundary for chapter X"
- [ ] Test auto-trim triggers

### Priority 3: Add Settings UI
- [ ] Create `ThresholdModal` component
- [ ] Add to `NavigationTab.tsx`
- [ ] Options: 5%, 10%, 15%, 20%
- [ ] Test threshold changes reflected in behavior

---

## Phase 4: Verification 📋 PENDING

### Functional Tests
- [ ] Auto-trim triggers at configured threshold
- [ ] Previous chapter removed from DOM (verify `loadedChapters.length`)
- [ ] Progress saves correctly for stitched chapters
- [ ] TTS works after trim (no batch failure)
- [ ] Local files prioritized over network
- [ ] Bordered vs stitched mode both work

### Regression Tests
- [ ] Normal chapter navigation unaffected
- [ ] Non-continuous mode still works
- [ ] TTS without stitching still works
- [ ] Progress saving in single chapters correct

---

## Known Issues & Workarounds

### Issue: Stack Overflow
**Workaround**: Disable continuous scrolling until fix deployed  
**ETA**: 30 minutes to fix

### Issue: No Boundaries
**Workaround**: None - auto-trim won't work  
**ETA**: 15 minutes to fix

### Issue: No Settings UI
**Workaround**: Users get default 15% threshold  
**ETA**: 1 hour to implement

---

## Dependencies

### Fixed (No Blockers)
- ✅ Type definitions (`useSettings.ts`)
- ✅ Local fetch service (`WebViewReader.tsx`)
- ✅ Save progress logic (`core.js` - `saveProgress()`)
- ✅ CSS styling (`index.css`)

### Blocked (Waiting on Fixes)
- ❌ Auto-trim functionality (blocked by Bug #1 and #2)
- ❌ User configuration (blocked by Bug #3)
- ❌ Full verification (blocked by all 3 bugs)

---

## Time Estimates

| Task                  | Estimate      | Status                                   |
| --------------------- | ------------- | ---------------------------------------- |
| Fix stack overflow    | 30 min        | NOT STARTED                              |
| Initialize boundaries | 15 min        | NOT STARTED                              |
| Add settings UI       | 1 hour        | NOT STARTED                              |
| Test auto-trim        | 30 min        | BLOCKED                                  |
| Test progress save    | 15 min        | CAN TEST NOW                             |
| Test TTS integration  | 30 min        | BLOCKED                                  |
| Regression testing    | 1 hour        | BLOCKED                                  |
| **TOTAL**             | **3.5 hours** | **1 hour complete, 2.5 hours remaining** |

---

## Session Handoff Notes

### What Works Now ✅
1. **DOM Stitching**: Chapters append correctly at 95%
2. **Local Fetch**: Uses downloads, logs: "Reading from local file"
3. **Smart Save**: Correctly maps paragraph 334 → Ch4 para 108 (relative)
4. **Type Safety**: All TypeScript checks pass

### What's Broken ❌
1. **Auto-Trim**: Stack overflow crash, never removes old chapters
2. **Boundaries**: First chapter missing from `chapterBoundaries`
3. **Settings**: No UI to change threshold

### Next Person Should
1. **START HERE**: Fix `manageStitchedChapters` (see Bug #1 fix above)
2. **THEN**: Initialize boundaries (see Bug #2 fix)
3. **FINALLY**: Add settings UI (see Bug #3 fix)
4. **TEST**: Verify auto-trim works, no crashes

### Files to Edit
- `core.js` lines 405-443 (manageStitchedChapters)
- `core.js` add boundary init (find right place)
- `NavigationTab.tsx` (+100 lines for UI)

---

**Current Blocker**: Stack overflow preventing any testing of auto-trim  
**Ready for**: Bug fixing session  
**Est. Time to Stable**: 2.5 hours
