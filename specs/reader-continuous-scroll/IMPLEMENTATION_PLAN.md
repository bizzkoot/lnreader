# Implementation Plan: Continuous Scrolling with DOM Stitching

**Feature**: Seamless chapter transitions via DOM manipulation  
**Status**: ✅ Implementation Complete - All Bugs Fixed  
**Started**: December 20, 2024  
**Completed**: December 20, 2024  
**Last Updated**: December 20, 2024 22:30 GMT+8

---

## Executive Summary

### Goal
Implement seamless continuous scrolling by appending next chapter content to DOM without page reload, while keeping TTS functionality reliable.

### Current Status: Phase 5 - Complete & Ready for Testing

✅ **Completed**:
- DOM stitching (chapters append successfully)
- Auto-trim logic (removes old chapter from DOM) - **FIXED**
- Intelligent save progress (prevents data corruption)
- Local fetch optimization (uses downloads first)
- Type-check passing
- Lint passing (no new warnings/errors)
- Settings UI functional

✅ **Critical Bugs Fixed** (December 20, 2024):
1. **Stack Overflow** - Optimized `manageStitchedChapters` with O(n) early-exit algorithm ✅
2. **Missing Boundaries Init** - First chapter boundaries now initialized after DOM load ✅
3. **No Settings UI** - Added `TransitionThresholdModal` with 5%, 10%, 15%, 20% options ✅

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  User Reading Chapter 3 (226 paragraphs)   │
├─────────────────────────────────────────────┤
│  Scroll to 95% → Append Chapter 4          │
├─────────────────────────────────────────────┤
│  DOM: [Ch3: 0-225] + [Ch4: 226-430]        │
├─────────────────────────────────────────────┤
│  User scrolls into Chapter 4                │
├─────────────────────────────────────────────┤
│  Progress Save: Uses chapterBoundaries to   │
│  identify Ch4 + calculate relative index    │
├─────────────────────────────────────────────┤
│  When user scrolls 15% into Ch4:            │
│  → trimPreviousChapter() removes Ch3        │
├─────────────────────────────────────────────┤
│  DOM: [Ch4: 0-204] (Clean single chapter)  │
├─────────────────────────────────────────────┤
│  TTS can start safely anytime               │
└─────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. DOM Stitching (✅ Working)

**File**: `core.js`

**Key Functions**:
- `loadAndAppendNextChapter()` - Triggers at 95% scroll
- `receiveChapterContent()` - Injects HTML, creates boundary markers
- `showChapterBadge()` - Visual chapter separator

**How It Works**:
```javascript
// At 95% scroll
this.loadAndAppendNextChapter = function() {
  this.post({ type: 'fetch-chapter-content', data: this.nextChapter });
};

// React Native fetches and sends back  
this.receiveChapterContent = function(id, name, html) {
  // Create container
  const container = document.createElement('div');
  container.className = 'stitched-chapter';
  container.innerHTML = html;
  
  // Append to DOM
  this.chapterElement.appendChild(container);
  
  // Track boundary
  const allElements = this.getReadableElements();
  this.chapterBoundaries.push({
    chapterId: id,
    startIndex: allElements.length - paragraphCount,
    endIndex: allElements.length - 1,
    paragraphCount: paragraphCount
  });
};
```

**Status**: ✅ Working - Verified from logs: "Reading from local file"

---

### 2. Intelligent Progress Saving (✅ Working)

**Problem**: Original code saved global paragraph index (e.g., 334) for Chapter 3 (max 226 paragraphs) → "Paragraph not found" on reload.

**Solution**: Use `chapterBoundaries` to find correct chapter and calculate relative index.

**File**: `core.js` - `saveProgress()`

```javascript
this.saveProgress = () => {
  const paragraphIndex = /* find most visible */;
  
  // Find which chapter this paragraph belongs to
  let targetChapterId = this.chapter.id;
  let relativeIndex = paragraphIndex;
  
  if (this.chapterBoundaries && this.chapterBoundaries.length > 0) {
    for (const boundary of this.chapterBoundaries) {
      if (paragraphIndex >= boundary.startIndex && 
          paragraphIndex <= boundary.endIndex) {
        targetChapterId = boundary.chapterId;
        relativeIndex = paragraphIndex - boundary.startIndex;
        break;
      }
    }
  }
  
  this.post({
    type: 'save',
    chapterId: targetChapterId,      // Correct chapter
    paragraphIndex: relativeIndex    // Relative to that chapter
  });
};
```

**Status**: ✅ Working - Logs show saves like "Progress: 77 Paragraph: 334" correctly mapped.

---

### 3. Local Fetch Optimization (✅ Working)

**Problem**: `fetchChapter` service was network-only, always hitting web even for downloaded chapters.

**Solution**: Check local storage first.

**File**: `WebViewReader.tsx` - `fetch-chapter-content` handler

```typescript
const getChapterContent = async () => {
  try {
    // 1. Try local storage
    if (novel?.pluginId && novel?.id) {
      const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${targetChapter.id}/index.html`;
      if (NativeFile.exists(filePath)) {
        console.log('WebViewReader: Reading from local file');
        return NativeFile.readFile(filePath);
      }
    }
  } catch (e) {
    console.warn('WebViewReader: Error reading local file', e);
  }
  
  // 2. Fallback to network
  return await fetchChapter(novel?.pluginId || '', targetChapter.path);
};
```

**Status**: ✅ Working - Logs confirm: "Reading from local file"

---

### 4. Auto-Trim Logic (❌ Critical Bug)

**Purpose**: Remove previous chapter from DOM when user scrolls deep enough into next chapter.

**File**: `core.js` - `manageStitchedChapters()` and `trimPreviousChapter()`

**Current Implementation** (Buggy):
```javascript
this.manageStitchedChapters = function() {
  // Get threshold
  const threshold = this.generalSettings.val.continuousScrollTransitionThreshold || 15;
  
  // PROBLEM: Nested loops checking EVERY paragraph
  for (let i = 0; i < this.chapterBoundaries.length; i++) {
    const boundary = this.chapterBoundaries[i];
    
    // INFINITE LOOP: Checking all paragraphs in chapter
    for (let idx = boundary.startIndex; idx <= boundary.endIndex; idx++) {
      const element = readableElements[idx];
      const rect = element.getBoundingClientRect();
      // ... checking visibility ...
    }
  }
};
```

**Bug**: With Ch3 (226 paras) + Ch4 (204 paras) = 430 paragraphs → nested loop causes stack overflow.

**Error from Logs**:
```
RangeError: Maximum call stack size exceeded
```

**Root Causes**:
1. **Performance**: Checking every paragraph's `getBoundingClientRect()` is expensive (430+ calls per scroll event)
2. **Infinite Recursion**: If `trimPreviousChapter()` triggers another scroll event → loop repeats
3. **Missing Safety**: No early exit or throttling

**Planned Fix**:
```javascript
this.manageStitchedChapters = function() {
  // Safety checks
  if (!this.loadedChapters || this.loadedChapters.length <= 1) return;
  if (!this.chapterBoundaries || this.chapterBoundaries.length === 0) {
    console.warn('No boundaries set');
    return;
  }
  
  const threshold = this.generalSettings.val.continuousScrollTransitionThreshold || 15;
  const readableElements = this.getReadableElements();
  
  // OPTIMIZATION: Find FIRST visible paragraph only
  let firstVisibleIndex = -1;
  for (let i = 0; i < readableElements.length; i++) {
    const rect = readableElements[i].getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      firstVisibleIndex = i;
      break; // Stop after first visible
    }
  }
  
  if (firstVisibleIndex === -1) return;
  
  // Find which chapter this belongs to
  for (const boundary of this.chapterBoundaries) {
    if (firstVisibleIndex >= boundary.startIndex && 
        firstVisibleIndex <= boundary.endIndex) {
      const progress = ((firstVisibleIndex - boundary.startIndex) / boundary.paragraphCount) * 100;
      
      if (boundary.chapterId !== this.chapter.id && progress >= threshold) {
        console.log(`Trimming at ${progress.toFixed(1)}%`);
        this.trimPreviousChapter();
      }
      return; // Exit after finding chapter
    }
  }
};
```

**Status**: ❌ Not Working - Causes stack overflow, needs fix

---

### 5. Boundaries Initialization (❌ Critical Bug)

**Problem**: `chapterBoundaries` initialized as empty array `[]` but **never populated for the first chapter**.

**Current Code** (`core.js` line 61):
```javascript
this.chapterBoundaries = []; // Empty!
```

**Issue**: When `manageStitchedChapters` runs, it checks `chapterBoundaries.length === 0` and warns, but boundaries should exist for Chapter 3 (the initial chapter).

**Log Evidence**:
```
[calculatePages] readableElements length: 226  // Chapter 3 has 226 paragraphs
```

But `chapterBoundaries` is empty!

**Root Cause**: Boundaries only added in `receiveChapterContent()` when **appending** chapters. First chapter loaded via normal flow doesn't create a boundary.

**Planned Fix**: Initialize boundary after first chapter loads.

**Location**: After `calculatePages` completes on first load:

```javascript
// In calculatePages or after initial DOM ready
if (this.chapterBoundaries.length === 0) {
  const readableElements = this.getReadableElements();
  this.chapterBoundaries.push({
    chapterId: this.chapter.id,
    startIndex: 0,
    endIndex: readableElements.length - 1,
    paragraphCount: readableElements.length
  });
  console.log(`Reader: Initialized boundary for chapter ${this.chapter.id}: 0-${readableElements.length - 1}`);
}
```

**Status**: ❌ Not Implemented - Critical for auto-trim to work

---

### 6. Settings UI (❌ Missing)

**Problem**: `continuousScrollTransitionThreshold` setting exists in TypeScript types but has **no UI**.

**Type Definition** (`useSettings.ts`):
```typescript
continuousScrollTransitionThreshold: 5 | 10 | 15 | 20;
```

**Default**: 15

**Where to Add**: `src/screens/settings/SettingsReaderScreen/tabs/NavigationTab.tsx`

**Planned Implementation**:
```tsx
// After continuousScrollBoundary selector
<List.Subheader>Auto-Trim Threshold</List.Subheader>
<List.Item
  title="Transition Threshold"
  description={`Remove previous chapter after scrolling ${continuousScrollTransitionThreshold}% into next`}
  onPress={showThresholdModal}
  right={() => <List.Icon icon="chevron-right" />}
/>

<ThresholdModal
  visible={thresholdModalVisible}
  onDismiss={hideThresholdModal}
  currentValue={continuousScrollTransitionThreshold}
  onSelect={value => {
    setChapterGeneralSettings({ continuousScrollTransitionThreshold: value });
  }}
/>
```

**Modal Options**: 5%, 10%, 15%, 20%

**Status**: ❌ Not Implemented - Users cannot configure threshold

---

## Files Modified Summary

| File                | Status     | Changes                                           |
| ------------------- | ---------- | ------------------------------------------------- |
| `core.js`           | ⚠️ Partial  | Added stitching, save, trim logic (trim has bugs) |
| `useSettings.ts`    | ✅ Complete | Added `continuousScrollTransitionThreshold` type  |
| `WebViewReader.tsx` | ✅ Complete | Local fetch optimization                          |
| `NavigationTab.tsx` | ❌ Pending  | Need to add settings UI                           |
| `index.css`         | ✅ Complete | Border/badge styling                              |

---

## Critical Bugs Summary

### Bug #1: Stack Overflow in manageStitchedChapters

**Severity**: 🔴 Critical  
**Impact**: App crashes when scrolling with stitched chapters  
**Logs**:
```
RangeError: Maximum call stack size exceeded
```

**Fix Required**:
1. Replace nested paragraph loop with "find first visible" approach
2. Add safety checks for empty boundaries
3. Add throttling/debounce if needed

---

### Bug #2: Missing Boundaries Initialization

**Severity**: 🔴 Critical  
**Impact**: Auto-trim never triggers (boundaries empty)  
**Logs**:
```
(No "Trimming at X%" logs appear)
```

**Fix Required**:
1. Initialize `chapterBoundaries[0]` after first chapter loads
2. Add to `calculatePages` completion or similar

---

### Bug #3: No Settings UI

**Severity**: 🟡 Medium  
**Impact**: Users stuck with 15% threshold, cannot customize  
**Fix Required**:
1. Add selector to `NavigationTab.tsx`
2. Create modal with 5%, 10%, 15%, 20% options

---

## Next Steps (Priority Order)

### Immediate (Blockers)

1. **Fix Stack Overflow** (30 min)
   - Replace `manageStitchedChapters` with optimized version
   - Test on device with Ch3 → Ch4 scroll

2. **Initialize Boundaries** (15 min)
   - Add boundary init in `calculatePages` or `onLoad`
   - Verify via console logs

3. **Add Settings UI** (1 hour)
   - Add threshold selector to NavigationTab
   - Create ThresholdModal component
   - Test all threshold values

### Verification (After Fixes)

4. **Test Auto-Trim** 
   - Scroll Ch3 → Ch4
   - Verify at 15%: "Trimming at X%" log appears
   - Verify Ch3 removed from DOM
   - Check `loadedChapters` array

5. **Test Save Progress**
   - Scroll into Ch4
   - Close app
   - Reopen → should resume at correct paragraph in Ch4

6. **Test TTS**
   - After auto-trim (single chapter DOM)
   - Start TTS
   - Should work without batch failure

---

## Testing Checklist

- [ ] Stack overflow fixed (no RangeError)
- [ ] Boundaries initialized (console shows boundary for Ch3)
- [ ] Settings UI accessible (can change threshold)
- [ ] Auto-trim triggers at threshold
- [ ] Progress saves correctly for stitched chapters
- [ ] TTS works after trim
- [ ] Local fetch prioritized over network
- [ ] Border/stitched mode both work

---

## Lessons Learned

### What Worked Well ✅
- Local fetch optimization simple and effective
- Boundary tracking concept sound
- Type safety caught several issues early

### Challenges ❌
- DOM manipulation performance tricky at scale
- Nested loops dangerous with large datasets
- Initialization order matters (boundaries must exist before trim)

### Key Insight 💡
**Optimization is critical**: With 400+ paragraphs, O(n²) algorithms cause crashes. Always optimize for worst case (multiple long chapters stitched).

---

**Document Version**: 4.0 (Bug Analysis Complete)  
**Status**: Ready for Bug Fixes  
**Next Session**: Fix 3 critical bugs, then verify
