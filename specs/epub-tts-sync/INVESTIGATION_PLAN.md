# EPUB TTS Synchronization - Implementation Document

## ✅ RESOLVED - December 22, 2025

---

## Problem Statement

### User Issue
TTS (Text-to-Speech) highlight was +1 position ahead of actual TTS voice in EPUB format.

### Visual Symptom
No chapter title visible at Paragraph 0 - the reader would speak "Chapter 1 - The Boy Who Lived" but highlight was on the first paragraph of content.

### Impact
- Poor user experience with TTS misalignment
- Confusing highlight behavior during reading
- Progress tracking inaccuracy

---

## Requirements

1. **Chapter title must be visible** at Paragraph 0 for EPUBs that lack explicit titles
2. **TTS audio must align with highlight** - when TTS speaks paragraph N, highlight should be on paragraph N
3. **No regression** to existing functionality (stitched chapters, settings changes)
4. **Title styling must be compatible with TTS highlight** - text must remain visible when highlighted
5. **Existing titles should not be duplicated** - smart detection of existing chapter headers

---

## Investigation Process

### Phase 1: Research
1. Analyzed code flow from React Native to WebView
2. Identified that `enhanceChapterTitles()` function existed in `core.js`
3. Discovered function was only called in:
   - `setHtml()` - triggered on settings changes, NOT initial load
   - `receiveChapterContent()` - only for stitched/continuous scroll chapters

### Phase 2: Root Cause
**The HTML is pre-loaded in WebView template BEFORE `core.js` runs.**

In `WebViewReader.tsx`:
```html
<div id="LNReader-chapter">
  ${html}  <!-- Already rendered! -->
</div>
<script src="core.js"></script>  <!-- Runs AFTER HTML is in DOM -->
```

In `core.js` constructor:
```javascript
this.rawHTML = this.chapterElement.innerHTML;  // Line 36 - HTML already exists
```

**Result**: `enhanceChapterTitles()` was never called on initial page load.

### Phase 3: Solution Design
Add an initial enhancement call immediately after `enhanceChapterTitles` function definition, within the reader constructor IIFE.

---

## Implementation

### Solution Code (core.js lines 1610-1638)

```javascript
// INITIAL LOAD: Enhance chapter title for TTS synchronization
// This runs once when page loads to ensure chapter title is visible at Paragraph 0
// Fixes: TTS highlight +1 offset issue in EPUBs where titles are hidden/unstyled
// NOTE: We use 'self' because we're still inside the reader constructor IIFE
const self = this;
(function initialEnhancement() {
  console.log('[INITIAL-ENHANCE] Running initial chapter title enhancement');
  console.log('[INITIAL-ENHANCE] chapter object:', self.chapter);
  console.log('[INITIAL-ENHANCE] chapter name:', self.chapter?.name);

  if (self.chapter && self.chapter.name) {
    const originalHtml = self.chapterElement.innerHTML;
    const enhancedHtml = self.enhanceChapterTitles(
      originalHtml,
      self.chapter.name
    );

    // Only update DOM if enhancement actually changed the HTML
    if (enhancedHtml !== originalHtml) {
      self.chapterElement.innerHTML = enhancedHtml;
      self.rawHTML = enhancedHtml;
      console.log('[INITIAL-ENHANCE] Chapter title enhanced on initial load');
    } else {
      console.log('[INITIAL-ENHANCE] No changes needed - title already exists');
    }
  } else {
    console.log('[INITIAL-ENHANCE] Skipped - no chapter name available');
  }
})();
```

### Title Styling (TTS Highlight Compatible)

**Before (problematic)**:
```css
color: #222 !important;
background: #f9f9f9 !important;
border-bottom: 3px solid #ccc !important;
box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
```

**After (TTS compatible)**:
```css
color: inherit !important;  /* Matches reader text color */
/* No background, border, or box-shadow */
```

### Files Modified

| File | Change |
|------|--------|
| `android/app/src/main/assets/js/core.js` | Added initial enhancement IIFE, updated title styling |
| `specs/epub-tts-sync/INVESTIGATION_PLAN.md` | Documentation |
| `src/screens/reader/components/__tests__/chapterTitleEnhancement.test.ts` | NEW - 22 test cases |

---

## Failure & Recovery

### Initial Failure
First implementation caused WebView to freeze completely.

**Cause**: Used `reader.` (window.reader) inside the constructor IIFE:
```javascript
// WRONG - window.reader doesn't exist yet!
reader.chapterElement.innerHTML = enhancedHtml;
```

**Error**: `window.reader` is `undefined` during constructor execution because the IIFE hasn't completed yet.

### Fix
Captured `this` reference before the IIFE:
```javascript
const self = this;  // Capture reference while 'this' is valid
(function initialEnhancement() {
  self.chapterElement.innerHTML = enhancedHtml;  // Works!
})();
```

---

## Testing

### Automated Tests (22 cases)
- ✅ Title HTML generation with correct classes
- ✅ Inherit color for TTS highlight compatibility
- ✅ No background/border styling
- ✅ Special characters and Unicode support
- ✅ Existing title detection (h1-h6, classes, patterns)
- ✅ HTML insertion (with/without body tag)
- ✅ Edge cases (empty HTML, whitespace)

### Validation Results

| Check | Status |
|-------|--------|
| Lint | ✅ 0 new errors |
| Type-check | ✅ Passed |
| Tests | ✅ 571 passed (including 22 new) |
| Manual Testing | ✅ Confirmed working |

### Manual Verification Steps
1. Run `pnpm run clean:full && pnpm run dev:android`
2. Open an EPUB chapter
3. Verify chapter title is visible at top (Paragraph 0)
4. Start TTS - highlight should align with audio

---

## Key Learnings

1. **WebView HTML loading**: HTML is in DOM before JavaScript runs
2. **IIFE scope**: Cannot reference `window.reader` inside reader constructor
3. **TTS highlight**: Custom backgrounds interfere with highlight visibility
4. **Smart detection**: Prevent duplicate titles by checking for existing headers

---

## Related Files

- `android/app/src/main/assets/js/core.js` - Main reader JavaScript
- `src/screens/reader/components/WebViewReader.tsx` - WebView template generation
- `src/screens/reader/hooks/useChapter.ts` - Chapter text loading
- `src/screens/reader/utils/sanitizeChapterText.ts` - HTML sanitization

---

## Previous Investigation (Historical)