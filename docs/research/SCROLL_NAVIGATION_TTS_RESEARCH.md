# LNReader: Scroll Detection, Chapter Navigation & TTS Integration Research

**Date**: December 20, 2025  
**Purpose**: Support implementing auto-mark 100% for short chapters and continuous scrolling feature

---

## Executive Summary

### 1. Scroll Detection Mechanism (3 Key Points)

1. **Debounced Scroll Listener** (`core.js:241-289`)
   - Listens to `scroll` event with 150ms debounce timer
   - Uses **Intersection Ratio** to find most visible paragraph (not scroll percentage)
   - Blocks saves during TTS reading, screen wake sync, and within 1000ms of initial scroll

2. **Paragraph-Based Tracking** (`core.js:375-388`)
   - Iterates through all readable elements (p, div, h1-h6)
   - Finds paragraph with max visible height in viewport: `Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)`
   - Calculates progress: `Math.round(((paragraphIndex + 1) / totalParagraphs) * 100)`

3. **Save Triggers** (`core.js:241, 375`)
   - Scroll events (debounced 150ms)
   - TTS paragraph completion (immediate)
   - Page reader mode page changes
   - **Important**: Scroll-based saves are blocked when TTS is reading

---

### 2. Progress Saving Flow (Paragraph vs Percentage)

**Primary Storage**: Paragraph index in MMKV (`chapter_progress_${chapterId}`)  
**Secondary**: Percentage (0-100) in SQLite database

**Save Event Structure** (WebViewReader.tsx:520-542):
```typescript
reader.post({
  type: 'save',
  data: percentage,           // Calculated from paragraph index
  paragraphIndex: number,     // Primary source of truth
  chapterId: number,          // Validates against stale events
  source?: string            // Debug: 'tts-stop', 'scroll', etc.
});
```

**Flow**:
1. WebView core.js calculates paragraph index via Intersection Ratio
2. Posts `save` message with both percentage AND paragraph index
3. React Native saves paragraph index to MMKV (instant access for restore)
4. Saves percentage to SQLite (database record)
5. On chapter load, MMKV paragraph index is used for initial scroll

**Why Paragraph Index?**: More accurate for TTS synchronization and handles dynamic content better than percentage.

---

### 3. Detecting Non-Scrollable Short Chapters

**Key Variables** (`core.js:36-43`):
```javascript
this.chapterHeight = this.chapterElement.scrollHeight + this.paddingTop;
this.layoutHeight = window.screen.height;
```

**Detection Logic**:
```javascript
// Chapter is non-scrollable if content height <= screen height
const isShortChapter = reader.chapterHeight <= reader.layoutHeight;

// Alternative: check if scroll is possible
const isNonScrollable = (
  reader.chapterElement.scrollHeight <= window.innerHeight
);
```

**Practical Implementation** (where to add):
- `core.js:calculatePages()` (line 1803) - called on layout changes
- Or on chapter load after `window.load` event (line 2170)

**Edge Cases to Handle**:
- Images loading after initial measurement
- Font loading delays
- Dynamic content expansion
- Use `document.fonts.ready` promise (line 2171)

---

### 4. TTS Chapter Progress & Navigation

**TTS Progress Tracking** (3 mechanisms):

1. **WebView Side** (`core.js:932-950`)
   ```javascript
   // TTS speaks each paragraph sequentially
   this.speak = () => {
     const paragraphIndex = readableElements.indexOf(this.currentElement);
     reader.post({
       type: 'save',
       data: progress,           // Calculated percentage
       paragraphIndex,           // Current TTS paragraph
       chapterId: reader.chapter.id
     });
   }
   ```

2. **Native Side** (`useTTSController.ts`)
   - Listens to `onSpeechDone` events from native TTS engine
   - Updates `currentParagraphIndexRef` on each paragraph completion
   - Saves progress on pause/stop

3. **Background Playback** (`core.js:959-983`)
   - Uses `highlightParagraph()` to sync WebView with native position
   - Native TTS engine continues in background (Android)
   - WebView scrolls to match native position when app returns to foreground

**Chapter Navigation** (`core.js:523-540`):
```javascript
this.next = () => {
  if (this.findNextTextNode()) {
    this.speak();  // Continue to next paragraph
  } else {
    // End of chapter reached
    this.reading = false;
    this.stop();
    if (reader.nextChapter) {
      // Post 'next' with autoStartTTS flag
      reader.post({ type: 'next', autoStartTTS: true });
    }
  }
}
```

**Auto-Navigation Trigger** (`TTSAudioManager.ts:680-717`):
```typescript
onQueueEmpty(callback: () => void) {
  const subscription = ttsEmitter.addListener('onQueueEmpty', () => {
    // Guard: ignore if restart/refill in progress
    if (this.restartInProgress || this.refillInProgress) return;
    
    // Guard: ignore if still have items to queue
    if (this.hasRemainingItems()) return;
    
    // Trigger chapter navigation
    callback();  // navigateChapter('NEXT')
  });
}
```

---

### 5. Chapter Navigation Mechanism (User Presses Bottom)

**User Tap Navigation** (`core.js:2240-2277`):
```javascript
document.onclick = e => {
  const position = detectTapPosition(x, y, false);
  
  if (position === 'bottom') {
    if (reader.generalSettings.val.tapToScroll) {
      // Scroll down 75% of screen height
      window.scrollBy({
        top: reader.layoutHeight * 0.75,
        behavior: 'smooth',
      });
    } else {
      // Toggle reader settings menu
      reader.post({ type: 'hide' });
    }
  }
}
```

**Swipe Navigation** (`core.js:2295-2322`):
```javascript
reader.chapterElement.addEventListener('touchend', e => {
  const diffX = e.changedTouches[0].screenX - this.initialX;
  
  if (reader.generalSettings.val.swipeGestures && 
      Math.abs(diffX) > 180) {
    if (diffX < 0 && this.initialX >= window.innerWidth / 2) {
      reader.post({ type: 'next' });  // Swipe left from right side
    } else if (diffX > 0 && this.initialX <= window.innerWidth / 2) {
      reader.post({ type: 'prev' });  // Swipe right from left side
    }
  }
});
```

**Page Reader Navigation** (`core.js:1640-1667`):
```javascript
this.movePage = destPage => {
  if (destPage >= this.totalPages.val) {
    // Show chapter ending transition
    this.showChapterEnding(true);
    setTimeout(() => {
      reader.post({ type: 'next' });
    }, 200);
  }
}
```

**React Native Handler** (`WebViewReader.tsx:421-435`):
```typescript
case 'next':
  if (event.autoStartTTS) {
    // TTS auto-navigation: check ttsContinueToNextChapter setting
    const continueMode = chapterGeneralSettingsRef.current
      .ttsContinueToNextChapter || 'none';
    
    if (continueMode === 'continuous') {
      tts.autoStartTTSRef.current = true;
    } else if (continueMode === '3' || continueMode === '5') {
      // Auto-play limited chapters
      if (tts.chaptersAutoPlayedRef.current < parseInt(continueMode)) {
        tts.autoStartTTSRef.current = true;
      }
    }
  }
  navigateChapter('NEXT');
  break;
```

---

### 6. Key Files for Implementation

**WebView (JavaScript)**:
- `android/app/src/main/assets/js/core.js` - Core scroll/TTS logic
  - Lines 36-66: Layout measurements (`chapterHeight`, `layoutHeight`)
  - Lines 241-289: Scroll event handler with debounce
  - Lines 375-388: Progress save helper
  - Lines 523-540: TTS `next()` paragraph navigation
  - Lines 1803-2022: `calculatePages()` layout refresh

**React Native (TypeScript)**:
- `src/screens/reader/components/WebViewReader.tsx` - Message handler
  - Lines 345-542: `handleMessage()` processes WebView events
  - Lines 421-442: Chapter navigation logic

- `src/screens/reader/hooks/useTTSController.ts` - TTS state management
  - Lines 1-300: Hook setup, refs, state
  - Lines 680-717: `onQueueEmpty` handler for auto-navigation

- `src/services/TTSAudioManager.ts` - Native TTS integration
  - Lines 680-717: Queue empty detection
  - Lines 91-128: Restart/refill guards

---

### 7. Message Types (WebView ↔ React Native)

**WebView → React Native** (posted via `reader.post()`):

| Message Type | Data | Purpose |
|-------------|------|---------|
| `save` | `{ data: percentage, paragraphIndex: number, chapterId: number }` | Save reading progress |
| `next` | `{ autoStartTTS?: boolean }` | Navigate to next chapter |
| `prev` | `{}` | Navigate to previous chapter |
| `hide` | `{}` | Toggle reader settings UI |
| `speak` | `{ data: text, paragraphIndex?: number }` | Speak paragraph (TTS) |
| `stop-speak` | `{}` | Stop TTS playback |
| `tts-state` | `{ isReading: boolean, paragraphIndex: number }` | Update TTS state |
| `tts-queue` | `{ data: string[], startIndex: number }` | Queue upcoming paragraphs |
| `show-toast` | `{ data: string }` | Display toast message |
| `initial-scroll-complete` | `{ paragraphIndex: number, chapterId: number }` | Notify scroll position restored |

**React Native → WebView** (injected via `webViewRef.current.injectJavaScript()`):

| Injection | Purpose |
|-----------|---------|
| `reader.generalSettings.val = {...}` | Update reader settings |
| `reader.readerSettings.val = {...}` | Update theme/font settings |
| `window.tts.highlightParagraph(index, chapterId)` | Sync WebView to native TTS position |
| `window.tts.updateState(index, chapterId)` | Update TTS internal state |
| `window.tts.handleManualModeDialog('continue'\|'stop')` | User response to scroll detection |

---

## Risk Analysis: Proposed Features

### Feature 1: Auto-Mark 100% for Non-Scrollable Short Chapters

**Implementation Point**: After chapter loads and layout is stable

**Risks**:

1. **False Positives** (HIGH RISK)
   - **Issue**: Images/fonts loading after initial measurement
   - **Mitigation**: 
     - Wait for `document.fonts.ready` promise
     - Add 500ms delay after load for image loading
     - Re-check `scrollHeight` after `window.load` event
   
2. **TTS Interference** (MEDIUM RISK)
   - **Issue**: Auto-mark might trigger before TTS starts reading
   - **Mitigation**: 
     - Only auto-mark if TTS is NOT active (`!window.tts.reading`)
     - Check `chapterGeneralSettings.TTSEnable` setting
     - Add flag `tts.hasAutoMarkedShortChapter` to prevent re-trigger

3. **User Experience** (LOW RISK)
   - **Issue**: User might want to manually mark as read
   - **Mitigation**: 
     - Add setting: "Auto-mark short chapters as read" (default: false)
     - Show toast: "Short chapter marked as read"

**Code Snippet** (add to `core.js` after `window.load`):
```javascript
// Detect short non-scrollable chapters
window.addEventListener('load', () => {
  document.fonts.ready.then(() => {
    setTimeout(() => {
      // Refresh measurements after fonts/images load
      reader.refresh();
      
      const isShortChapter = reader.chapterHeight <= reader.layoutHeight;
      const ttsNotActive = !window.tts || !window.tts.reading;
      const autoMarkEnabled = reader.generalSettings.val.autoMarkShortChapters;
      
      if (isShortChapter && ttsNotActive && autoMarkEnabled) {
        console.log('Short non-scrollable chapter detected, auto-marking 100%');
        reader.post({
          type: 'save',
          data: 100,
          paragraphIndex: reader.getReadableElements().length - 1,
          chapterId: reader.chapter.id,
          source: 'auto-mark-short-chapter'
        });
        reader.post({ type: 'show-toast', data: 'Short chapter marked as read' });
      }
    }, 500);  // Wait for images to load
  });
});
```

---

### Feature 2: Continuous Scrolling (Auto-Load Next Chapter)

**Implementation Point**: Detect when user scrolls near bottom (e.g., 95%)

**Risks**:

1. **TTS Conflict** (CRITICAL RISK)
   - **Issue**: Auto-load might interfere with TTS chapter navigation
   - **Current TTS Flow**: 
     - TTS calls `reader.post({ type: 'next', autoStartTTS: true })`
     - React Native checks `ttsContinueToNextChapter` setting
     - TTS auto-starts if setting allows
   - **Mitigation**:
     - **NEVER** trigger continuous scroll when `window.tts.reading === true`
     - Check `tts.autoStartTTSRef.current` before triggering scroll-based navigation
     - Add flag `reader.continuousScrollTriggered` to prevent duplicate navigation

2. **Progress Save Race Condition** (HIGH RISK)
   - **Issue**: Navigating before final paragraph is saved
   - **Current Behavior**: 
     - Scroll event saves current visible paragraph
     - TTS saves 100% before navigation (`onQueueEmpty`)
   - **Mitigation**:
     - Force save 100% progress BEFORE posting 'next' message
     - Wait for save confirmation (need to add callback)
     - Use paragraph index `totalParagraphs - 1` (last paragraph)

3. **User Control** (MEDIUM RISK)
   - **Issue**: User might not want auto-navigation
   - **Mitigation**:
     - Add setting: "Continuous scrolling" with options:
       - "Disabled" (default)
       - "Always" (load immediately at 95%)
       - "Ask" (show confirmation dialog)
     - Show visual indicator: "Loading next chapter..." toast

4. **Scroll Event Spam** (LOW RISK)
   - **Issue**: Multiple scroll events near bottom might trigger multiple navigations
   - **Mitigation**:
     - Use debounce (already exists: 150ms)
     - Add flag `reader.isNavigating` to prevent duplicate calls
     - Clear flag after chapter transition completes

**Code Snippet** (add to `core.js:processScroll()`):
```javascript
this.processScroll = currentScrollY => {
  // ... existing scroll logic ...
  
  // CONTINUOUS SCROLLING FEATURE (disabled by default)
  const continuousScrollEnabled = reader.generalSettings.val.continuousScrolling;
  
  if (continuousScrollEnabled && !reader.isNavigating && !window.tts.reading) {
    // Calculate scroll percentage
    const scrollPercentage = 
      (window.scrollY + reader.layoutHeight) / reader.chapterHeight;
    
    // Trigger at 95% scroll (near bottom)
    if (scrollPercentage >= 0.95 && reader.nextChapter) {
      console.log('Continuous scroll: Near bottom, loading next chapter');
      
      // Prevent duplicate navigation
      reader.isNavigating = true;
      
      // Save 100% progress FIRST
      const readableElements = reader.getReadableElements();
      const finalIndex = readableElements.length - 1;
      reader.post({
        type: 'save',
        data: 100,
        paragraphIndex: finalIndex,
        chapterId: reader.chapter.id,
        source: 'continuous-scroll'
      });
      
      // Then navigate
      setTimeout(() => {
        reader.post({ 
          type: 'next',
          autoStartTTS: false  // Don't auto-start TTS for scroll navigation
        });
      }, 100);  // Brief delay to ensure save completes
    }
  }
};
```

**React Native Changes** (`WebViewReader.tsx`):
```typescript
// Add to chapter context
const [isNavigating, setIsNavigating] = useState(false);

// In handleMessage 'next' case
case 'next':
  if (isNavigating) {
    console.log('Navigation already in progress, ignoring');
    return;
  }
  setIsNavigating(true);
  
  // ... existing navigation logic ...
  
  // Clear flag after navigation completes (in navigateChapter callback)
  setTimeout(() => setIsNavigating(false), 1000);
  break;
```

---

## Implementation Recommendations

### Priority 1: Auto-Mark Short Chapters (Lower Risk)

**Steps**:
1. Add setting to `CHAPTER_GENERAL_SETTINGS`: `autoMarkShortChapters: boolean`
2. Add measurement code to `core.js` after `window.load` event
3. Post `save` message with 100% and final paragraph index
4. Test with chapters that have:
   - Only images (no text)
   - Large fonts (short text fills screen)
   - Web fonts loading delay

**Testing Checklist**:
- [ ] Chapter with 1 short paragraph
- [ ] Chapter with images loading after text
- [ ] Chapter with custom fonts
- [ ] TTS active when short chapter loads
- [ ] User manually marks chapter before auto-mark triggers

---

### Priority 2: Continuous Scrolling (Higher Risk)

**Steps**:
1. Add setting with 3 modes: Disabled, Always, Ask
2. Add scroll percentage check to `processScroll()`
3. Add `isNavigating` flag to prevent duplicates
4. Force save 100% before navigation
5. Add visual feedback (toast or loading indicator)
6. Extensive testing with TTS enabled

**Testing Checklist**:
- [ ] Scroll to bottom with TTS OFF
- [ ] Scroll to bottom with TTS ON (should NOT trigger)
- [ ] TTS auto-navigation to next chapter (should NOT double-navigate)
- [ ] Rapid scroll to bottom (should only trigger once)
- [ ] No next chapter available (should not crash)
- [ ] Background app during navigation
- [ ] Network chapter loading (non-downloaded)

---

## Critical Protection Patterns

### Pattern 1: TTS State Checks (ALWAYS REQUIRED)

```javascript
// Before ANY scroll-based navigation or save
if (window.tts && window.tts.reading) {
  console.log('Blocked: TTS is reading');
  return;  // TTS handles its own navigation
}

// Before ANY TTS operation
if (window.ttsOperationActive) {
  console.log('Blocked: TTS operation in progress');
  return;
}
```

### Pattern 2: Progress Save Before Navigation

```javascript
// Before posting 'next' or 'prev'
const readableElements = reader.getReadableElements();
const finalIndex = readableElements.length - 1;
const percentage = 100;

reader.post({
  type: 'save',
  data: percentage,
  paragraphIndex: finalIndex,
  chapterId: reader.chapter.id
});

// THEN navigate (with delay to ensure save completes)
setTimeout(() => {
  reader.post({ type: 'next' });
}, 100);
```

### Pattern 3: Duplicate Navigation Prevention

```javascript
// Set flag BEFORE navigation
if (reader.isNavigating) return;
reader.isNavigating = true;

// Navigate
reader.post({ type: 'next' });

// Clear flag in React Native after navigation completes
// (WebViewReader.tsx)
useEffect(() => {
  if (chapter.id !== previousChapterId) {
    webViewRef.current?.injectJavaScript(
      'reader.isNavigating = false;'
    );
  }
}, [chapter.id]);
```

---

## Conclusion

Both proposed features are **implementable** but require careful handling of TTS state and progress saving.

**Key Takeaways**:
1. **Paragraph index is source of truth** (not percentage)
2. **TTS has priority** over scroll-based navigation
3. **Always save 100% before navigating** to next chapter
4. **Use flags to prevent duplicate triggers** (`isNavigating`, `hasAutoMarked`)
5. **Test extensively with TTS enabled** (most common failure point)

**Next Steps**:
1. Implement auto-mark short chapters first (lower risk, less TTS interaction)
2. Add comprehensive unit tests for edge cases
3. Beta test with real users before implementing continuous scrolling
4. Consider adding analytics to measure feature usage and issues

---

**Document Version**: 1.0  
**Last Updated**: December 20, 2025  
**Reviewed By**: GitHub Copilot (Claude Sonnet 4.5)
