# Reader Enhancements: Short Chapter Auto-Mark & Continuous Scrolling

**Feature Request Date**: December 20, 2025  
**Status**: Research Complete → Planning  
**Priority**: Medium  
**Complexity**: Medium-High (TTS integration risks)

---

## Overview

Two related enhancements to improve reader navigation experience:

1. **Auto-Mark 100% for Short Chapters**: When a chapter is too short to scroll (content height < screen height) and user navigates to next chapter, automatically mark the short chapter as 100% read.

2. **Continuous Scrolling Mode**: Allow users to scroll seamlessly from one chapter to the next without pressing buttons. Auto-load next chapter when user approaches the bottom.

---

## Business Value

### User Pain Points Addressed

1. **Short Chapter Friction**: Users reading webnovels with very short chapters (< 1 screen) must manually scroll or wait for TTS to mark progress. Manual navigation leaves chapters unread.

2. **Navigation Fatigue**: Long reading sessions require frequent button presses to advance chapters. Continuous scrolling reduces this friction.

### Expected Benefits

- Improved reading flow for short-chapter content (e.g., Twitter novels, chat-format stories)
- Reduced hand strain during long reading sessions
- More intuitive experience matching modern web reading platforms

---

## Feature 1: Auto-Mark Short Chapters as Read

### User Story

> As a reader, when I read a chapter that fits entirely on my screen and I press "Next Chapter", I want that short chapter to be automatically marked as 100% read, so I don't have to worry about losing my progress.

### Detailed Requirements

#### Functional Requirements

1. **Short Chapter Detection**
   - Chapter is "short" if: `chapter.scrollHeight + paddingTop <= window.screen.height`
   - Detection runs after chapter load + fonts/images ready
   - Re-check after `document.fonts.ready` promise resolves

2. **Auto-Mark Trigger**
   - Trigger: User navigates to next chapter (tap, swipe, or page reader navigation)
   - Condition: Chapter is short AND TTS is NOT active
   - Action: Post `save` message with:
     - `data: 100` (percentage)
     - `paragraphIndex: totalParagraphs - 1` (last paragraph)
     - `source: 'auto-mark-short-chapter'`

3. **User Settings**
   - Setting: "Auto-mark short chapters as read"
   - Default: `true` (enabled)
   - Location: Reader Settings → General

4. **User Feedback**
   - Show toast: "Short chapter marked as read" (only first time per chapter)
   - No feedback if TTS auto-marked it already

#### Non-Functional Requirements

1. **Performance**: Detection must not delay chapter load (< 50ms overhead)
2. **Accuracy**: Wait 500ms after `window.load` for images to load before final measurement
3. **TTS Safety**: NEVER trigger if `window.tts.reading === true`

### Technical Design

#### Implementation Files

1. **WebView (JavaScript)**
   - `android/app/src/main/assets/js/core.js`
     - Add flag: `reader.hasAutoMarkedShortChapter`
     - Add function: `reader.checkShortChapterAutoMark()`
     - Hook into: `window.load` event + `reader.refresh()`

2. **React Native (TypeScript)**
   - `src/hooks/persisted/useChapterGeneralSettings.ts`
     - Add setting: `autoMarkShortChapters: boolean`
   - `src/screens/reader/components/WebViewReader.tsx`
     - Handle `save` event with `source: 'auto-mark-short-chapter'`

#### Pseudocode (core.js)

```javascript
// Add to Reader class
this.hasAutoMarkedShortChapter = false;
this.autoMarkShortChaptersEnabled = true; // From settings

this.checkShortChapterAutoMark = function() {
  // Skip if already marked
  if (this.hasAutoMarkedShortChapter) return;
  
  // Skip if TTS is active
  if (window.tts && window.tts.reading) return;
  
  // Skip if setting is disabled
  if (!this.generalSettings.val.autoMarkShortChapters) return;
  
  // Check if chapter is short
  const isShortChapter = this.chapterHeight <= this.layoutHeight;
  
  if (isShortChapter) {
    const readableElements = this.getReadableElements();
    const finalIndex = readableElements.length - 1;
    
    this.post({
      type: 'save',
      data: 100,
      paragraphIndex: finalIndex,
      chapterId: this.chapter.id,
      source: 'auto-mark-short-chapter'
    });
    
    this.post({ 
      type: 'show-toast', 
      data: 'Short chapter marked as read' 
    });
    
    this.hasAutoMarkedShortChapter = true;
  }
};

// Hook into window.load (after fonts ready)
window.addEventListener('load', () => {
  document.fonts.ready.then(() => {
    setTimeout(() => {
      reader.refresh(); // Recalculate chapterHeight
      reader.checkShortChapterAutoMark();
    }, 500); // Wait for images
  });
});
```

### Edge Cases

| Scenario | Expected Behavior | Handling |
|----------|------------------|----------|
| Short chapter + TTS enabled | TTS reads and marks 100% naturally | Skip auto-mark if `tts.reading` |
| Short chapter + images loading | Wait 500ms after load | Use `setTimeout` after `window.load` |
| Short chapter + custom fonts | Wait for fonts to load | Use `document.fonts.ready` promise |
| User disables setting mid-session | Respect setting on next chapter | Check `generalSettings.val` |
| Chapter becomes short after zoom | Don't auto-mark (user triggered) | Only check on initial load |

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| False positive (images pending) | Chapter marked read before fully loaded | Medium | Wait 500ms + check fonts ready |
| TTS interference | Auto-mark conflicts with TTS save | Low | Guard with `!tts.reading` check |
| User confusion | Unexpected progress change | Low | Show toast notification |

---

## Feature 2: Continuous Scrolling Mode

### User Story

> As a reader, I want to continuously scroll from one chapter to the next without pressing buttons, so I can maintain my reading flow during long sessions.

### Detailed Requirements

#### Functional Requirements

1. **Scroll Detection**
   - Monitor scroll position in real-time (use existing 150ms debounced listener)
   - Calculate: `scrollPercentage = (scrollY + layoutHeight) / chapterHeight`
   - Trigger threshold: 95% scroll (near bottom)

2. **Auto-Load Next Chapter**
   - Condition: 
     - Scroll >= 95% AND
     - Next chapter exists AND
     - TTS is NOT active AND
     - Not already navigating
   - Action:
     1. Save 100% progress (last paragraph)
     2. Wait 100ms for save to complete
     3. Post `next` message with `autoStartTTS: false`

3. **User Settings**
   - Setting 1: "Continuous scrolling"
     - Options:
       - `disabled` (default)
       - `always` - Auto-load immediately at 95%
       - `ask` - Show confirmation dialog at 95%
   - Setting 2: "Chapter boundary" (visible only when continuous scrolling enabled)
     - Options:
       - `bordered` (default) - Small gap with chapter markers
       - `stitched` - Seamless flow, no visual gap
   - Location: Reader Settings → General

4. **Visual Feedback**
   - Mode: `always`
     - Show toast: "Loading next chapter..." (briefly)
     - Smooth scroll transition
   - Mode: `ask`
     - Show dialog: "Continue to next chapter?" [Yes] [No]
     - Remember choice for session (optional)

5. **Chapter Boundary Display**
   - **Bordered Mode** (default):
     - Small visual gap (32px) between chapters
     - Chapter marker elements:
       - Bottom marker: "― Chapter 5: The Journey Begins ―"
       - Gap: 32px with background matching reader theme
       - Top marker: "― Chapter 6: New Allies ―"
     - Styling:
       - Font size: 14px (slightly smaller than body)
       - Color: 50% opacity of text color
       - Text alignment: Center
       - Padding: 16px vertical
       - Optional: Subtle border-top and border-bottom (1px, 20% opacity)
     - User benefit: Clear chapter transitions, easy to navigate back
   
   - **Stitched Mode** (seamless):
     - No visual gap, direct continuation
     - Only a subtle chapter change indicator:
       - Small chapter number badge in top-right corner
       - Badge: "Ch. 6" with semi-transparent background
       - Fades in when scrolling past chapter boundary
       - Fades out after 2 seconds
     - Content flows naturally as if single document
     - User benefit: Uninterrupted reading experience
     - Implementation: Append next chapter HTML directly to current chapter DOM

#### Non-Functional Requirements

1. **Performance**: Chapter load must complete within 2 seconds (same as manual navigation)
2. **TTS Safety**: NEVER trigger if `window.tts.reading === true` (CRITICAL)
3. **Progress Safety**: ALWAYS save 100% before navigation to prevent data loss
4. **Responsiveness**: Debounce scroll events to prevent spam (150ms existing)

### Technical Design

#### Implementation Files

1. **WebView (JavaScript)**
   - `android/app/src/main/assets/js/core.js`
     - Add flag: `reader.isNavigating`
     - Add function: `reader.checkContinuousScroll()`
     - Hook into: existing `processScroll()` function

2. **React Native (TypeScript)**
   - `src/hooks/persisted/useChapterGeneralSettings.ts`
     - Add settings:
       - `continuousScrolling: 'disabled' | 'always' | 'ask'`
       - `continuousScrollSeparator: 'stitched' | 'separated'`
       - `continuousScrollBackground: 'white' | 'black' | 'auto'`
   - `src/screens/reader/components/WebViewReader.tsx`
     - Add state: `isNavigating`
     - Handle `next` message from continuous scroll
     - Show confirmation dialog for `ask` mode

3. **Styling**
   - `android/app/src/main/assets/css/reader.css` (or equivalent)
     - Add classes for chapter separators
     - Style chapter number indicators

#### Pseudocode (core.js)

```javascript
// Add to Reader class
this.isNavigating = false;
this.continuousScrollEnabled = false; // From settings
this.continuousScrollMode = 'disabled'; // disabled | always | ask

this.checkContinuousScroll = function() {
  // Skip if disabled
  if (this.continuousScrollMode === 'disabled') return;
  
  // Skip if already navigating
  if (this.isNavigating) return;
  
  // Skip if TTS is active (CRITICAL)
  if (window.tts && window.tts.reading) {
    console.log('[CONTINUOUS_SCROLL] Blocked: TTS is reading');
    return;
  }
  
  // Calculate scroll percentage
  const scrollPercentage = 
    (window.scrollY + this.layoutHeight) / this.chapterHeight;
  
  // Check if near bottom (95%)
  if (scrollPercentage >= 0.95 && this.nextChapter) {
    console.log('[CONTINUOUS_SCROLL] Trigger at', scrollPercentage);
    
    if (this.continuousScrollMode === 'ask') {
      // Show confirmation dialog
      this.post({
        type: 'continuous-scroll-prompt',
        data: { nextChapterName: this.nextChapter.name }
      });
    } else {
      // Auto-navigate
      this.performContinuousNavigation();
    }
  }
};

this.performContinuousNavigation = function() {
  // Prevent duplicate navigation
  this.isNavigating = true;
  
  // Save 100% progress FIRST
  const readableElements = this.getReadableElements();
  const finalIndex = readableElements.length - 1;
  
  this.post({
    type: 'save',
    data: 100,
    paragraphIndex: finalIndex,
    chapterId: this.chapter.id,
    source: 'continuous-scroll'
  });
  
  // Show loading toast
  this.post({ 
    type: 'show-toast', 
    data: 'Loading next chapter...' 
  });
  
  // Navigate after brief delay
  setTimeout(() => {
    this.post({ 
      type: 'next',
      autoStartTTS: false // Don't auto-start TTS
    });
  }, 100);
};

// Add to existing processScroll()
this.processScroll = function(currentScrollY) {
  // ... existing scroll logic ...
  
  // Check continuous scroll
  this.checkContinuousScroll();
};
```

#### React Native Changes (WebViewReader.tsx)

```typescript
// Add state
const [isNavigating, setIsNavigating] = useState(false);
const [showContinuousScrollPrompt, setShowContinuousScrollPrompt] = useState(false);
const [pendingNextChapter, setPendingNextChapter] = useState<string | null>(null);

// In handleMessage
case 'continuous-scroll-prompt':
  setPendingNextChapter(event.data.nextChapterName);
  setShowContinuousScrollPrompt(true);
  break;

case 'next':
  if (isNavigating) {
    console.log('[NAVIGATION] Already in progress, ignoring');
    return;
  }
  setIsNavigating(true);
  
  // ... existing navigation logic ...
  
  navigateChapter('NEXT');
  break;

// After chapter change completes
useEffect(() => {
  if (chapter.id !== previousChapterId) {
    // Clear navigation flag
    setIsNavigating(false);
    
    // Inject flag into WebView
    webViewRef.current?.injectJavaScript(
      'reader.isNavigating = false; true;'
    );
  }
}, [chapter.id]);

// Confirmation dialog component
{showContinuousScrollPrompt && (
  <Dialog
    visible={showContinuousScrollPrompt}
    title="Continue Reading?"
    message={`Load next chapter: ${pendingNextChapter}?`}
    actions={[
      {
        label: 'No',
        onPress: () => {
          setShowContinuousScrollPrompt(false);
          setPendingNextChapter(null);
        }
      },
      {
        label: 'Yes',
        onPress: () => {
          setShowContinuousScrollPrompt(false);
          // Trigger navigation via WebView
          webViewRef.current?.injectJavaScript(
            'reader.performContinuousNavigation(); true;'
          );
        }
      }
    ]}
  />
)}
```

### Edge Cases

| Scenario | Expected Behavior | Handling |
|----------|------------------|----------|
| Continuous scroll + TTS active | Block continuous scroll, let TTS navigate | Check `tts.reading` in `checkContinuousScroll()` |
| TTS auto-navigates before 95% scroll | TTS navigation wins | TTS posts `next` with `autoStartTTS: true` flag |
| Rapid scroll to 95% multiple times | Only trigger once | Use `isNavigating` flag |
| No next chapter available | No action, stay at end | Check `this.nextChapter` exists |
| User scrolls back up after trigger | Cancel if not already loading | Check scroll direction in `processScroll()` |
| Network chapter (not downloaded) | Show loading, fetch chapter | Use existing chapter fetch logic |
| Background app during navigation | Pause navigation, resume on wake | Use existing `AppState` listener |

### Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| TTS conflict (CRITICAL) | Double navigation, lost progress | High | Guard with `!tts.reading` check + comprehensive tests |
| Progress save race condition | Lost progress on fast navigation | Medium | Force 100% save BEFORE navigation + 100ms delay |
| Duplicate navigation | Multiple chapters load simultaneously | Medium | Use `isNavigating` flag + clear after chapter change |
| User confusion | Unexpected chapter change | Low | Default to `disabled`, show toast, add confirmation mode |
| Performance degradation | Scroll lag on low-end devices | Low | Use existing 150ms debounce, no additional listeners |

---

## Implementation Strategy

### Phase 1: Foundation (1-2 days)

**Goal**: Add settings and basic infrastructure

**Tasks**:
1. Add settings to `useChapterGeneralSettings.ts`:
   - `autoMarkShortChapters: boolean` (default: `true`)
   - `continuousScrolling: 'disabled' | 'always' | 'ask'` (default: `'disabled'`)
   - `continuousScrollSeparator: 'stitched' | 'separated'` (future use)
   - `continuousScrollBackground: 'white' | 'black' | 'auto'` (future use)

2. Add UI controls in Reader Settings:
   - Toggle: "Auto-mark short chapters as read"
   - Dropdown: "Continuous scrolling" with 3 options
   - (Future) Radio buttons for separator and background

3. Add flags and helper functions to `core.js`:
   - `reader.hasAutoMarkedShortChapter`
   - `reader.isNavigating`
   - `reader.checkShortChapterAutoMark()`
   - `reader.checkContinuousScroll()`
   - `reader.performContinuousNavigation()`

**Deliverables**:
- Settings UI functional (can toggle on/off)
- Core.js flags initialized
- No functional changes yet (settings do nothing)

---

### Phase 2: Auto-Mark Short Chapters (2-3 days)

**Goal**: Implement and test short chapter detection

**Tasks**:
1. Implement `reader.checkShortChapterAutoMark()` in core.js:
   - Hook into `window.load` event
   - Wait for `document.fonts.ready`
   - Add 500ms timeout for images
   - Check TTS status before marking
   - Post `save` message with 100% + final paragraph index

2. Handle save event in `WebViewReader.tsx`:
   - Recognize `source: 'auto-mark-short-chapter'`
   - Log for debugging
   - Show toast notification

3. Test edge cases:
   - Short text-only chapter
   - Short chapter with images
   - Short chapter with custom fonts
   - TTS active on short chapter
   - Setting disabled mid-session

**Deliverables**:
- Short chapters auto-marked when navigating
- Toast notification visible
- No interference with TTS
- Pass all edge case tests

---

### Phase 3: Continuous Scrolling (3-4 days)

**Goal**: Implement scroll-based navigation

**Tasks**:
1. Implement `reader.checkContinuousScroll()` in core.js:
   - Hook into existing `processScroll()`
   - Calculate scroll percentage
   - Check TTS status (CRITICAL)
   - Check `isNavigating` flag
   - Trigger at 95% scroll

2. Implement `reader.performContinuousNavigation()`:
   - Set `isNavigating` flag
   - Save 100% progress
   - Show loading toast
   - Post `next` message after 100ms delay

3. Handle navigation in `WebViewReader.tsx`:
   - Add `isNavigating` state
   - Block duplicate `next` messages
   - Clear flag after chapter change completes
   - Inject flag clear into WebView

4. Implement confirmation dialog for `ask` mode:
   - Show dialog at 95% scroll
   - Pass next chapter name
   - Handle user response (Yes/No)
   - Remember choice for session (optional)

5. Test edge cases:
   - All scenarios from edge case table above
   - Especially TTS conflict scenarios

**Deliverables**:
- Continuous scrolling functional in `always` mode
- Confirmation dialog functional in `ask` mode
- No TTS conflicts
- No duplicate navigation
- Pass all edge case tests

---

### Phase 4: Polish & Testing (2-3 days)

**Goal**: Comprehensive testing and bug fixes

**Tasks**:
1. Add unit tests:
   - `core.js` helper functions (if possible)
   - React Native message handling
   - Settings persistence

2. Add integration tests:
   - Short chapter scenarios
   - Continuous scroll scenarios
   - TTS + scroll combinations

3. Manual testing:
   - Test on multiple devices (low-end, high-end)
   - Test with different screen sizes
   - Test with different novel plugins
   - Test with background/foreground transitions
   - Test with network chapters (not downloaded)

4. Performance profiling:
   - Check scroll event overhead
   - Check chapter load times
   - Check memory usage

5. Documentation:
   - Update user documentation
   - Add feature demo GIFs/videos
   - Update changelog

**Deliverables**:
- All tests passing
- No performance regressions
- Documentation complete
- Ready for beta release

---

## Testing Strategy

### Unit Tests

**File**: `src/screens/reader/components/__tests__/WebViewReader.automark.test.tsx`

```typescript
describe('Auto-Mark Short Chapters', () => {
  test('should mark short chapter as 100% when navigating', async () => {
    // Setup: short chapter (content < screen height)
    // Action: navigate to next
    // Assert: saveProgress called with 100%
  });

  test('should NOT mark if TTS is active', async () => {
    // Setup: short chapter + TTS reading
    // Action: navigate to next
    // Assert: saveProgress NOT called
  });

  test('should NOT mark if setting is disabled', async () => {
    // Setup: setting disabled + short chapter
    // Action: navigate to next
    // Assert: saveProgress NOT called
  });
});
```

**File**: `src/screens/reader/components/__tests__/WebViewReader.continuousscroll.test.tsx`

```typescript
describe('Continuous Scrolling', () => {
  test('should load next chapter at 95% scroll', async () => {
    // Setup: setting enabled, scroll to 95%
    // Assert: navigateChapter called with 'NEXT'
  });

  test('should NOT trigger when TTS is active', async () => {
    // Setup: TTS reading + scroll to 95%
    // Assert: navigateChapter NOT called
  });

  test('should show confirmation in ask mode', async () => {
    // Setup: mode = 'ask', scroll to 95%
    // Assert: dialog visible
  });

  test('should prevent duplicate navigation', async () => {
    // Setup: rapid scroll to 95% multiple times
    // Assert: navigateChapter called only ONCE
  });
});
```

### Integration Tests

**Manual Test Scenarios**:

1. **Short Chapter Auto-Mark**
   - [ ] Chapter with 1 paragraph (text only)
   - [ ] Chapter with 2-3 short paragraphs
   - [ ] Chapter with 1 image (no text)
   - [ ] Chapter with large font (short text fills screen)
   - [ ] Chapter with custom web fonts
   - [ ] TTS active when navigating short chapter
   - [ ] Setting disabled, navigate short chapter
   - [ ] Setting enabled mid-session

2. **Continuous Scrolling - Always Mode**
   - [ ] Scroll to bottom of normal chapter
   - [ ] Scroll quickly to 95% (rapid scroll)
   - [ ] Scroll to 95%, then back up (cancel)
   - [ ] Scroll to 95%, no next chapter
   - [ ] TTS active, scroll to 95% (should NOT trigger)
   - [ ] Background app at 95% scroll
   - [ ] Network chapter (not downloaded)
   - [ ] Multiple rapid scrolls (spam)

3. **Continuous Scrolling - Ask Mode**
   - [ ] Scroll to 95%, dialog appears
   - [ ] Click "Yes", chapter loads
   - [ ] Click "No", stay on current chapter
   - [ ] Dialog appears, press back button (Android)

4. **TTS + Continuous Scroll Conflict**
   - [ ] TTS reading, user scrolls to 95%
   - [ ] TTS finishes chapter, auto-navigates
   - [ ] Continuous scroll triggers, TTS starts on same chapter
   - [ ] TTS background playback + scroll navigation

### Performance Tests

**Metrics to Monitor**:

1. **Scroll Event Overhead**
   - Measure: FPS during scroll with continuous scrolling enabled
   - Baseline: FPS without feature
   - Target: < 5% FPS drop

2. **Chapter Load Time**
   - Measure: Time from `next` message to new chapter rendered
   - Baseline: Manual navigation time
   - Target: Same as manual (< 2 seconds)

3. **Memory Usage**
   - Measure: Memory footprint after 10 continuous scrolls
   - Baseline: 10 manual navigations
   - Target: Same as manual (no memory leak)

---

## Success Metrics

### Adoption Metrics

- % of users who enable auto-mark short chapters (target: > 70%)
- % of users who enable continuous scrolling (target: > 30%)
- % of users who switch from `ask` to `always` mode (indicator of trust)

### Quality Metrics

- Crash rate related to new features (target: < 0.1%)
- TTS conflict reports (target: 0 critical bugs)
- False positive auto-marks (target: < 1% of chapters)

### User Satisfaction

- User feedback/reviews mentioning "smooth reading"
- Support tickets related to short chapter progress (target: decrease)
- Feature requests for similar enhancements (indicator of value)

---

## Future Enhancements

### Chapter Boundary Feature (DEFERRED - Major Feature)

**Status**: Deferred to Future Release  
**Reason**: High complexity, significant technical risks  
**Current Implementation**: Single-chapter WebView navigation (instant load on reaching 95%)

#### What Is Chapter Boundary?

The "Chapter boundary" setting from Phase 1 was intended to provide two display modes when continuous scrolling:

1. **Bordered Mode**: Show visual gap with chapter markers between chapters
2. **Stitched Mode**: Seamlessly append next chapter content (no visual gap)

**Example Bordered Display:**
```
[... Chapter 5 content ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━
   Chapter 5: The Journey Begins
━━━━━━━━━━━━━━━━━━━━━━━━━━

[ 32px gap with theme background ]

━━━━━━━━━━━━━━━━━━━━━━━━━━
   Chapter 6: New Allies
━━━━━━━━━━━━━━━━━━━━━━━━━━

[... Chapter 6 content ...]
```

**Example Stitched Display:**
```
[... Chapter 5 content ...]
[... Chapter 6 content starts immediately ...]
[Small "Ch. 6" badge in corner, fades after 2s]
```

#### Why Was It Deferred?

**Technical Complexity:**

1. **DOM Manipulation**
   - Requires appending next chapter HTML to current chapter's DOM
   - Must handle conflicting IDs/classes across chapters
   - Must manage CSS scope to prevent style bleeding
   - Risk of breaking existing features (TTS, highlight, scroll position)

2. **Scroll Position Management**
   - Multi-chapter DOM has variable heights
   - Saving progress needs to know "which chapter" user is in
   - Restoring position needs to find correct chapter + paragraph
   - Risk of scroll jump bugs (user "warps" when saving/loading)

3. **Memory Management**
   - Loading multiple chapters in single WebView increases memory usage
   - Need to implement chapter unloading (garbage collection)
   - Risk of memory leaks on long reading sessions
   - Low-end devices may struggle (crash risk)

4. **TTS Integration Risks (CRITICAL)**
   - TTS tracks position via paragraph indices in single chapter
   - Multi-chapter DOM breaks existing paragraph counting logic
   - TTS queue needs to know chapter boundaries for navigation
   - Risk of TTS "jumping" to wrong chapter or losing position
   - Background TTS + multi-chapter DOM = untested territory

5. **Progress Tracking Complexity**
   - Current: Save progress for single chapter (chapter ID + paragraph index)
   - Multi-chapter: Need to track (chapter ID + paragraph index + chapter boundary info)
   - Database schema may need changes
   - Risk of corrupting existing progress data

6. **Testing Burden**
   - Requires comprehensive testing of all reader features
   - TTS integration tests (foreground, background, media controls)
   - Progress save/restore tests (rotation, background, crash)
   - Memory profiling on low-end devices
   - Edge cases: Network chapters, large images, custom plugins
   - Estimated: 5-7 days of testing alone

**Potential Countermeasures (For Future Implementation):**

1. **Phase 1: Research & Prototyping (5-7 days)**
   - Create separate branch for experimental work
   - Build minimal prototype with single plugin (e.g., ReadLightNovel)
   - Test DOM append technique without affecting existing code
   - Measure memory impact with 10-chapter session
   - **Success Criteria**: No memory leaks, scroll position stable
   - **Decision Point**: If memory/scroll issues unsolved, abandon approach

2. **Phase 2: TTS Integration Planning (3-5 days)**
   - Map out TTS paragraph tracking in multi-chapter context
   - Design chapter boundary markers for TTS queue
   - Implement TTS position mapping (paragraph index → chapter + paragraph)
   - Test TTS navigation across chapter boundaries
   - **Success Criteria**: TTS can navigate prev/next chapter without losing position
   - **Decision Point**: If TTS conflicts unresolvable, consider alternative approach

3. **Phase 3: Progress Tracking Refactor (4-6 days)**
   - Design new progress schema: `{ chapterId, chapterIndex, paragraphIndex }`
   - Implement migration for existing progress data
   - Update save/restore logic for multi-chapter context
   - Test progress persistence across app lifecycle events
   - **Success Criteria**: Zero progress data corruption, backward compatible
   - **Decision Point**: If migration fails on any device, rollback required

4. **Phase 4: Implementation & Testing (7-10 days)**
   - Implement bordered/stitched display modes
   - Add chapter boundary markers (bordered mode)
   - Add chapter badge indicator (stitched mode)
   - Implement chapter garbage collection (unload old chapters)
   - Comprehensive testing (see Testing Strategy below)
   - **Success Criteria**: All tests pass, no regressions

5. **Phase 5: Beta Release (2-3 weeks)**
   - Release to beta testers only (opt-in)
   - Monitor crash reports, performance metrics
   - Collect user feedback on bordered vs stitched preference
   - Iterate based on feedback
   - **Success Criteria**: Crash rate < 0.1%, positive user feedback
   - **Decision Point**: If crash rate > 0.5%, pull feature and re-evaluate

**Testing Strategy (If Implemented):**

| Test Category | Scenarios | Priority |
|---------------|-----------|----------|
| **TTS Integration** | 15+ scenarios (foreground, background, media controls, position tracking) | CRITICAL |
| **Progress Tracking** | 10+ scenarios (save, restore, rotation, background, crash recovery) | CRITICAL |
| **Memory Management** | 5+ scenarios (long sessions, low-end devices, memory profiling) | HIGH |
| **Scroll Position** | 8+ scenarios (multi-chapter scroll, save/restore position, scroll jump bugs) | HIGH |
| **Visual Display** | 6+ scenarios (bordered/stitched modes, theme support, custom fonts) | MEDIUM |
| **Edge Cases** | 12+ scenarios (network chapters, custom plugins, large images, etc.) | MEDIUM |

**Estimated Total Effort**: 25-35 days (5-7 weeks)

**Risk Assessment**: HIGH (TTS conflicts, memory leaks, scroll bugs)

**Recommendation**: Only implement if significant user demand exists (e.g., 100+ feature requests). Current "instant navigation" approach is simpler, safer, and provides 90% of the value.

#### Current Workaround (Phase 3 Implementation)

Instead of stitched/bordered display, we use **instant chapter reload** at 95% scroll:

1. User scrolls to 95% of chapter
2. Save 100% progress for current chapter
3. Post `next` message to React Native
4. React Native navigates to next chapter (standard navigation)
5. WebView reloads with new chapter HTML
6. **Result**: Clean slate for each chapter (no DOM complexity)

**Benefits:**
- Zero TTS conflicts (each chapter is isolated)
- Simple progress tracking (one chapter at a time)
- Low memory usage (WebView cleared on navigation)
- Thoroughly tested (uses existing navigation code)
- Fast and reliable

**Drawbacks:**
- Brief load screen between chapters (~200-500ms)
- No seamless visual transition
- Users must adjust to "micro-load" experience

**User Feedback Strategy:**
- Monitor user complaints about "load flash"
- If < 5% of users complain: Keep current approach
- If > 20% of users complain: Re-evaluate stitched display
- Include question in user survey: "Would you prefer instant loading (current) or seamless scrolling (experimental)?"

---

### V2 Features (Post-Launch)

1. **Stitched Chapter Display**
   - Display next chapter below current with visual separator
   - Show chapter numbers at boundaries
   - Support custom background colors for separator

2. **Preload Next Chapter**
   - Preload HTML when user reaches 80% scroll
   - Reduce navigation delay for network chapters
   - Cache preloaded chapter in memory

3. **Smart Short Chapter Detection**
   - Machine learning to detect "intentionally short" chapters (e.g., author notes)
   - Don't auto-mark author notes or chapter titles
   - User feedback mechanism to train model

4. **Reading Session Analytics**
   - Track: Chapters read per session
   - Track: Average scroll speed
   - Track: Continuous scroll usage patterns
   - Use data to optimize threshold (95% vs 90% vs 98%)

5. **Gesture Controls**
   - Swipe down at top = previous chapter
   - Swipe up at bottom = next chapter
   - Double-tap bottom = enable continuous scroll for session

---

## Open Questions

### For User Research

1. What threshold feels right for continuous scroll? (90%, 95%, 98%?)
2. Should we show a subtle indicator when approaching threshold? (e.g., progress bar)
3. Should continuous scroll be enabled by default? (currently `disabled`)
4. Should we auto-mark short chapters by default? (currently `true`)

### For Technical Discussion

1. Should we add analytics to track feature usage?
2. Should we add A/B testing for threshold values?
3. Should we implement stitched display in V1 or V2?
4. Should we preload next chapter (memory trade-off)?

---

## Appendix

### Related Documentation

- [Unified Save Progress Spec](../unified-save-progress/IMPLEMENTATION.md)
- [TTS Integration Docs](../Enhanced-media-control/PRD.md)
- [WebViewReader Refactoring Plan](../../docs/analysis/WebViewReader-refactoring-plan.md)
- [Scroll Navigation TTS Research](../../docs/research/SCROLL_NAVIGATION_TTS_RESEARCH.md)

### Key Code References

- **Scroll Detection**: `android/app/src/main/assets/js/core.js:241-289`
- **Progress Save**: `android/app/src/main/assets/js/core.js:375-388`
- **Chapter Navigation**: `src/screens/reader/components/WebViewReader.tsx:421-442`
- **TTS Chapter Navigation**: `src/screens/reader/hooks/useTTSController.ts`
- **Settings**: `src/hooks/persisted/useChapterGeneralSettings.ts`

---

**Document Version**: 1.0  
**Last Updated**: December 20, 2025  
**Author**: AI Agent (Claudette RPI v6.1)  
**Status**: Awaiting Phase 1 Checkpoint Approval
