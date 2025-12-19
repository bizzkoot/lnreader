# Implementation Plan: Reader Enhancements

**Feature**: Auto-Mark Short Chapters & Continuous Scrolling  
**Status**: Planning Phase  
**Estimated Duration**: 8-12 days  
**Risk Level**: Medium-High (TTS integration complexity)

---

## Phase Breakdown

### Phase 1: Foundation & Settings (Days 1-2)

**Goal**: Infrastructure setup without functional changes

#### Tasks

- [ ] **1.1**: Add settings to `useChapterGeneralSettings.ts`
  - Files: `src/hooks/persisted/useChapterGeneralSettings.ts`
  - Add properties:
    - `autoMarkShortChapters: boolean` (default: `true`)
    - `continuousScrolling: 'disabled' | 'always' | 'ask'` (default: `'disabled'`)
    - `continuousScrollBoundary: 'stitched' | 'bordered'` (default: `'bordered'`)
  - Update TypeScript types
  - Ensure persistence via MMKV

- [ ] **1.2**: Add UI controls in Reader Settings
  - Files: `src/screens/settings/SettingsReaderScreen/tabs/*` (determine correct tab)
  - Add toggle: "Auto-mark short chapters as read"
    - Label: "Auto-mark short chapters as read"
    - Description: "Automatically mark chapters that fit on one screen as 100% read when navigating"
  - Add dropdown: "Continuous scrolling"
    - Options: "Disabled", "Always", "Ask before loading"
    - Description: "Automatically load next chapter when scrolling near the end"
  - Add dropdown: "Chapter boundary" (visible only when continuous scrolling enabled)
    - Options: "Bordered" (default), "Stitched"
    - Description: "Bordered shows chapter markers; Stitched provides seamless flow"
  - Ensure settings are reactive (change immediately applies)

- [ ] **1.3**: Add core.js flags and helper function stubs
  - Files: `android/app/src/main/assets/js/core.js`
  - Add to Reader class initialization:
    ```javascript
    this.hasAutoMarkedShortChapter = false;
    this.isNavigating = false;
    ```
  - Add empty helper functions:
    ```javascript
    this.checkShortChapterAutoMark = function() { /* TODO Phase 2 */ };
    this.checkContinuousScroll = function() { /* TODO Phase 3 */ };
    this.performContinuousNavigation = function() { /* TODO Phase 3 */ };
    ```
  - Inject settings from React Native:
    ```javascript
    // In initialReaderConfig
    continuousScrolling: 'disabled',
    autoMarkShortChapters: true,
    continuousScrollBoundary: 'bordered'
    ```

- [ ] **1.4**: Validation Tests
  - Settings UI visible and toggleable
  - Settings persist after app restart
  - Settings injected into WebView (check initialReaderConfig)
  - No crashes or TypeScript errors

**Deliverable**: Settings infrastructure ready, no functional changes

---

### Phase 2: Auto-Mark Short Chapters (Days 3-5)

**Goal**: Detect and mark short chapters automatically

#### Tasks

- [ ] **2.1**: Implement short chapter detection
  - Files: `android/app/src/main/assets/js/core.js`
  - Implement `reader.checkShortChapterAutoMark()`:
    ```javascript
    this.checkShortChapterAutoMark = function() {
      // Skip if already marked
      if (this.hasAutoMarkedShortChapter) return;
      
      // Skip if TTS is active (CRITICAL)
      if (window.tts && window.tts.reading) {
        console.log('[AUTO_MARK] Blocked: TTS is reading');
        return;
      }
      
      // Skip if setting is disabled
      if (!this.generalSettings.val.autoMarkShortChapters) return;
      
      // Refresh measurements
      this.refresh();
      
      // Check if chapter is short
      const isShortChapter = this.chapterHeight <= this.layoutHeight;
      
      if (isShortChapter) {
        console.log('[AUTO_MARK] Short chapter detected:', this.chapterHeight, '<=', this.layoutHeight);
        
        const readableElements = this.getReadableElements();
        const finalIndex = readableElements.length - 1;
        
        // Save 100% progress
        this.post({
          type: 'save',
          data: 100,
          paragraphIndex: finalIndex,
          chapterId: this.chapter.id,
          source: 'auto-mark-short-chapter'
        });
        
        // Show toast
        this.post({ 
          type: 'show-toast', 
          data: 'Short chapter marked as read' 
        });
        
        this.hasAutoMarkedShortChapter = true;
      }
    };
    ```

- [ ] **2.2**: Hook into window.load event
  - Files: `android/app/src/main/assets/js/core.js`
  - Add listener (find existing `window.addEventListener('load', ...)` around line 2170):
    ```javascript
    window.addEventListener('load', () => {
      // Wait for fonts to load
      document.fonts.ready.then(() => {
        // Wait additional 500ms for images
        setTimeout(() => {
          console.log('[AUTO_MARK] Checking after load + fonts + images');
          reader.refresh(); // Recalculate chapterHeight
          reader.checkShortChapterAutoMark();
        }, 500);
      });
    });
    ```

- [ ] **2.3**: Handle reset on chapter change
  - Files: `android/app/src/main/assets/js/core.js`
  - In `reader.post({ type: 'next' })` or chapter transition logic:
    ```javascript
    // Reset flag when navigating
    this.hasAutoMarkedShortChapter = false;
    ```
  - Or inject from React Native on chapter change:
    ```typescript
    // In WebViewReader.tsx useEffect
    useEffect(() => {
      webViewRef.current?.injectJavaScript(
        'reader.hasAutoMarkedShortChapter = false; true;'
      );
    }, [chapter.id]);
    ```

- [ ] **2.4**: Handle save event in React Native
  - Files: `src/screens/reader/components/WebViewReader.tsx`
  - In `handleMessage` switch case `'save'`:
    ```typescript
    case 'save':
      // ... existing validation ...
      
      // Log source for debugging
      if (event.source === 'auto-mark-short-chapter') {
        console.log('[AUTO_MARK] Short chapter marked:', chapter.id);
      }
      
      // ... existing save logic ...
      break;
    ```

- [ ] **2.5**: Testing
  - **SUB-AGENT**: Delegate comprehensive testing
    ```
    Task: Test auto-mark short chapters feature
    Context: Feature marks chapters that fit on screen as 100% read
    Requirements:
      - Create test chapters with various content types
      - Test with TTS enabled/disabled
      - Test with settings enabled/disabled
      - Test font loading delays
      - Test image loading delays
      - Verify no interference with TTS
    Expected Output:
      - Test report with pass/fail for each scenario
      - List of bugs found (if any)
      - Recommendations for fixes
    ```

**Deliverable**: Short chapters auto-marked when setting enabled

---

### Phase 3: Continuous Scrolling (Days 6-9)

**Goal**: Auto-load next chapter when scrolling near bottom

#### Tasks

- [ ] **3.1**: Implement scroll threshold detection
  - Files: `android/app/src/main/assets/js/core.js`
  - Implement `reader.checkContinuousScroll()`:
    ```javascript
    this.checkContinuousScroll = function() {
      const mode = this.generalSettings.val.continuousScrolling;
      
      // Skip if disabled
      if (mode === 'disabled') return;
      
      // Skip if already navigating (CRITICAL)
      if (this.isNavigating) {
        console.log('[CONTINUOUS_SCROLL] Blocked: already navigating');
        return;
      }
      
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
        console.log('[CONTINUOUS_SCROLL] Trigger at', 
                    (scrollPercentage * 100).toFixed(1), '%');
        
        if (mode === 'ask') {
          // Show confirmation dialog
          this.post({
            type: 'continuous-scroll-prompt',
            data: { 
              nextChapterName: this.nextChapter.name,
              scrollPercentage: scrollPercentage 
            }
          });
        } else if (mode === 'always') {
          // Auto-navigate
          this.performContinuousNavigation();
        }
      }
    };
    ```

- [ ] **3.2**: Hook into existing processScroll
  - Files: `android/app/src/main/assets/js/core.js`
  - Find `this.processScroll = function(currentScrollY)` (around line 241-289)
  - Add call at end of function:
    ```javascript
    this.processScroll = function(currentScrollY) {
      // ... existing scroll handling ...
      
      // Check continuous scroll (at end)
      this.checkContinuousScroll();
    };
    ```

- [ ] **3.3**: Implement navigation function
  - Files: `android/app/src/main/assets/js/core.js`
  - Implement `reader.performContinuousNavigation()`:
    ```javascript
    this.performContinuousNavigation = function() {
      console.log('[CONTINUOUS_SCROLL] Performing navigation');
      
      // Prevent duplicate navigation
      this.isNavigating = true;
      
      // Save 100% progress FIRST (CRITICAL)
      const readableElements = this.getReadableElements();
      const finalIndex = readableElements.length - 1;
      
      this.post({
        type: 'save',
        data: 100,
        paragraphIndex: finalIndex,
        chapterId: this.chapter.id,
        source: 'continuous-scroll'
      });
      
      // Show loading feedback
      this.post({ 
        type: 'show-toast', 
        data: 'Loading next chapter...' 
      });
      
      // Navigate after brief delay to ensure save completes
      setTimeout(() => {
        this.post({ 
          type: 'next',
          autoStartTTS: false  // Don't auto-start TTS
        });
      }, 100);
    };
    ```

- [ ] **3.4**: Add React Native state management
  - Files: `src/screens/reader/components/WebViewReader.tsx`
  - Add state:
    ```typescript
    const [isNavigating, setIsNavigating] = useState(false);
    const previousChapterIdRef = useRef(chapter.id);
    ```
  - In `handleMessage` switch:
    ```typescript
    case 'next':
      if (isNavigating) {
        console.log('[NAVIGATION] Already in progress, ignoring');
        return;
      }
      setIsNavigating(true);
      
      // ... existing navigation logic ...
      break;
    ```
  - Clear flag after chapter change:
    ```typescript
    useEffect(() => {
      if (chapter.id !== previousChapterIdRef.current) {
        console.log('[NAVIGATION] Chapter changed, clearing flag');
        setIsNavigating(false);
        
        // Inject into WebView
        webViewRef.current?.injectJavaScript(
          'if (reader) reader.isNavigating = false; true;'
        );
        
        previousChapterIdRef.current = chapter.id;
      }
    }, [chapter.id]);
    ```

- [ ] **3.5**: Implement confirmation dialog (ask mode)
  - Files: `src/screens/reader/components/WebViewReader.tsx`
  - Add state:
    ```typescript
    const [showContinuousScrollPrompt, setShowContinuousScrollPrompt] = useState(false);
    const [pendingNextChapter, setPendingNextChapter] = useState<string | null>(null);
    ```
  - Handle prompt message:
    ```typescript
    case 'continuous-scroll-prompt':
      setPendingNextChapter(event.data.nextChapterName);
      setShowContinuousScrollPrompt(true);
      break;
    ```
  - Add dialog component:
    ```typescript
    // After WebView component
    {showContinuousScrollPrompt && (
      <Portal>
        <Dialog
          visible={showContinuousScrollPrompt}
          onDismiss={() => {
            setShowContinuousScrollPrompt(false);
            setPendingNextChapter(null);
          }}
        >
          <Dialog.Title>Continue Reading?</Dialog.Title>
          <Dialog.Content>
            <Text>Load next chapter: {pendingNextChapter}?</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button
              onPress={() => {
                setShowContinuousScrollPrompt(false);
                setPendingNextChapter(null);
              }}
            >
              No
            </Button>
            <Button
              onPress={() => {
                setShowContinuousScrollPrompt(false);
                setPendingNextChapter(null);
                
                // Trigger navigation
                webViewRef.current?.injectJavaScript(
                  'reader.performContinuousNavigation(); true;'
                );
              }}
            >
              Yes
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    )}
    ```

- [ ] **3.6**: Testing
  - **SUB-AGENT**: Delegate comprehensive testing
    ```
    Task: Test continuous scrolling feature
    Context: Feature auto-loads next chapter when scrolling near bottom
    Requirements:
      - Test all 3 modes: disabled, always, ask
      - Test TTS active + continuous scroll (must NOT trigger)
      - Test rapid scroll to bottom (prevent duplicate navigation)
      - Test scroll up after triggering (cancel if possible)
      - Test no next chapter available
      - Test background app during navigation
      - Test network chapters (not downloaded)
      - Verify progress saved before navigation
    Expected Output:
      - Test report with pass/fail for each scenario
      - List of bugs found (if any)
      - Recommendations for fixes
    ```

**Deliverable**: Continuous scrolling functional with all modes

---

### Phase 4: Polish & Quality Assurance (Days 10-12)

**Goal**: Comprehensive testing and bug fixes

#### Tasks

- [ ] **4.1**: Add unit tests
  - **SUB-AGENT**: Delegate test file creation
    ```
    Task: Create unit tests for reader enhancements
    Context: Need Jest tests for auto-mark and continuous scroll
    Requirements:
      - Follow existing test patterns in __tests__ folder
      - Test WebViewReader message handling
      - Test settings persistence
      - Test edge cases from specs
      - Mock useChapterContext
    Expected Output:
      - Complete test file ready to run
      - All tests passing
    ```

- [ ] **4.2**: Integration testing
  - Manual testing on physical devices:
    - [ ] Low-end Android (< 2GB RAM)
    - [ ] High-end Android (> 4GB RAM)
    - [ ] Small screen (< 5 inches)
    - [ ] Large screen (> 6 inches)
    - [ ] Various novel plugins
    - [ ] Downloaded vs network chapters

- [ ] **4.3**: TTS conflict testing (CRITICAL)
  - **SUB-AGENT**: Delegate TTS integration testing
    ```
    Task: Test TTS + new features integration
    Context: Ensure no conflicts between TTS and auto-mark/continuous scroll
    Requirements:
      - Test TTS auto-navigation vs continuous scroll
      - Test TTS background playback + continuous scroll
      - Test TTS foreground playback + auto-mark
      - Test screen wake during TTS + auto-mark
      - Verify progress saved correctly in all scenarios
    Expected Output:
      - Test report with detailed findings
      - Any race conditions or conflicts detected
      - Verification that TTS always wins priority
    ```

- [ ] **4.4**: Performance profiling
  - Measure scroll event FPS:
    - [ ] Baseline: Continuous scroll disabled
    - [ ] Test: Continuous scroll enabled
    - [ ] Target: < 5% FPS drop
  - Measure chapter load time:
    - [ ] Baseline: Manual navigation
    - [ ] Test: Continuous scroll navigation
    - [ ] Target: Same as baseline (< 2 seconds)
  - Measure memory usage:
    - [ ] Baseline: 10 manual navigations
    - [ ] Test: 10 continuous scroll navigations
    - [ ] Target: No memory leak

- [ ] **4.5**: Lint and type-check
  - Run: `pnpm run lint`
  - Run: `pnpm run type-check`
  - Fix all errors and warnings

- [ ] **4.6**: Update documentation
  - Update: `AGENTS.md` (add new features to recent changes)
  - Update: `.agents/memory.instruction.md` (add patterns learned)
  - Update: `README.md` or user docs (if applicable)
  - Create: `specs/feature-request/CHANGELOG.md` (version history)

**Deliverable**: Production-ready features with comprehensive tests

---

## Validation Checklist (Before Final Commit)

### Functionality
- [ ] Auto-mark short chapters works with setting enabled
- [ ] Auto-mark respects setting when disabled
- [ ] Auto-mark does NOT trigger when TTS is active
- [ ] Auto-mark waits for fonts and images to load
- [ ] Continuous scroll triggers at 95% in "always" mode
- [ ] Continuous scroll shows dialog in "ask" mode
- [ ] Continuous scroll does NOT trigger in "disabled" mode
- [ ] Continuous scroll does NOT trigger when TTS is active
- [ ] Navigation flag prevents duplicate navigation
- [ ] Progress saved to 100% before continuous scroll navigation

### Edge Cases
- [ ] Short chapter + TTS active: No auto-mark
- [ ] Rapid scroll to 95% multiple times: Single navigation
- [ ] Scroll to 95%, no next chapter: No crash
- [ ] TTS auto-navigates before 95% scroll: No conflict
- [ ] Background app during continuous scroll: Graceful handling
- [ ] Network chapter loading: No timeout or crash

### Code Quality
- [ ] No TypeScript errors
- [ ] No ESLint errors or warnings
- [ ] All tests passing
- [ ] No console.log in production code
- [ ] Settings persist after app restart
- [ ] Memory usage stable after 10+ navigations

### User Experience
- [ ] Toast messages appear and disappear correctly
- [ ] Confirmation dialog readable and responsive
- [ ] Settings UI clear and intuitive
- [ ] No unexpected progress jumps
- [ ] No lag or stutter during scroll
- [ ] No crashes during normal usage

---

## Risk Mitigation Strategy

### High-Priority Risks

1. **TTS Conflict (CRITICAL)**
   - **Risk**: Continuous scroll triggers while TTS is navigating
   - **Impact**: Duplicate navigation, lost progress, crash
   - **Mitigation**:
     - Guard EVERY navigation trigger with `!tts.reading` check
     - Add comprehensive tests for TTS + scroll combinations
     - Manual testing on real devices with TTS enabled
   - **Fallback**: Disable continuous scroll if TTS is active (show toast)

2. **Progress Save Race Condition**
   - **Risk**: Navigation starts before 100% progress saved
   - **Impact**: Lost progress, user frustration
   - **Mitigation**:
     - Force save 100% BEFORE posting `next` message
     - Add 100ms delay after save to ensure completion
     - Log save events with source for debugging
   - **Fallback**: Re-save progress on chapter load if mismatch detected

3. **Duplicate Navigation**
   - **Risk**: Multiple scroll events trigger multiple navigations
   - **Impact**: Skip chapters, confusing UI, crash
   - **Mitigation**:
     - Use `isNavigating` flag (WebView + React Native)
     - Clear flag only after chapter change completes
     - Debounce already exists (150ms), no additional needed
   - **Fallback**: Add counter, limit to 1 navigation per 2 seconds

### Medium-Priority Risks

4. **False Positive Short Chapters**
   - **Risk**: Chapter marked as short before images/fonts load
   - **Impact**: User sees incomplete chapter marked as read
   - **Mitigation**:
     - Wait for `document.fonts.ready` promise
     - Add 500ms delay after `window.load` for images
     - Re-check `scrollHeight` after delay
   - **Fallback**: Allow user to manually reset progress

5. **User Confusion**
   - **Risk**: Unexpected auto-mark or navigation confuses users
   - **Impact**: Negative reviews, feature disabled
   - **Mitigation**:
     - Default continuous scroll to `disabled`
     - Show toast notifications for auto-mark
     - Add "ask" mode for continuous scroll
     - Clear setting descriptions
   - **Fallback**: Add "Undo" button in toast (if possible)

---

## Rollback Plan

If critical bugs discovered post-release:

1. **Emergency Rollback** (same day):
   - Revert commit: `git revert <commit-hash>`
   - Set default settings:
     - `autoMarkShortChapters: false`
     - `continuousScrolling: 'disabled'`
   - Push hotfix release

2. **Targeted Disable** (1-2 days):
   - Add server-side feature flag
   - Disable features remotely without app update
   - Investigate and fix bugs
   - Re-enable via server flag

3. **Full Revert** (1 week):
   - Remove all feature code
   - Keep settings infrastructure for future use
   - Document lessons learned
   - Plan v2 with fixes

---

## Success Criteria

### Phase 1: Foundation
- [ ] Settings UI visible and functional
- [ ] Settings persist after app restart
- [ ] No TypeScript or lint errors
- [ ] No crashes or UI glitches

### Phase 2: Auto-Mark
- [ ] Short chapters marked as 100% when navigating
- [ ] Toast notification visible
- [ ] No TTS interference
- [ ] All edge case tests passing

### Phase 3: Continuous Scroll
- [ ] Navigation triggers at 95% scroll in "always" mode
- [ ] Confirmation dialog works in "ask" mode
- [ ] No TTS conflicts
- [ ] No duplicate navigation
- [ ] All edge case tests passing

### Phase 4: Polish
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] No performance regressions
- [ ] Documentation complete
- [ ] Code reviewed and approved

---

## Next Steps After Implementation

1. **Beta Release**:
   - Release to small group of beta testers
   - Monitor crash reports and user feedback
   - Fix critical bugs within 48 hours

2. **Gradual Rollout**:
   - Enable for 10% of users (week 1)
   - Monitor metrics: adoption, crashes, TTS conflicts
   - Enable for 50% of users (week 2)
   - Enable for 100% of users (week 3)

3. **Post-Launch Monitoring**:
   - Track feature adoption rates
   - Monitor crash reports for new feature tags
   - Collect user feedback via reviews
   - Plan v2 enhancements based on data

---

## Important Note: Chapter Boundary Feature Deferred

**What Was Deferred**: The "Chapter boundary" setting (bordered vs stitched display modes) was included in Phase 1 UI but **NOT implemented functionally**.

**Current Behavior**: Continuous scrolling uses **instant navigation** (WebView reload) at 95% scroll. There is NO multi-chapter DOM or visual boundary display.

**Why Deferred**:
1. **High Technical Complexity**: Requires DOM manipulation, multi-chapter scroll tracking, memory management
2. **Critical TTS Risks**: TTS paragraph tracking breaks with multi-chapter DOM (untested, high crash risk)
3. **Progress Tracking Complexity**: Requires schema changes, migration logic, extensive testing
4. **Estimated Effort**: 25-35 days (5-7 weeks) vs 8-12 days for core features
5. **Low User Demand**: Feature nice-to-have, not critical for core value

**Future Implementation Path** (if user demand exists):
- See detailed analysis in [READER_ENHANCEMENTS.md](./READER_ENHANCEMENTS.md#chapter-boundary-feature-deferred---major-feature)
- Includes 5-phase implementation plan
- Testing strategy with 50+ test scenarios
- Risk mitigation countermeasures
- Beta release with crash rate monitoring

**Current Recommendation**:
- **Keep UI setting** as placeholder (doesn't break anything)
- **Monitor user feedback** for requests about "seamless scrolling"
- **Only implement if 100+ users request it** (indicates real demand)
- Current "instant navigation" approach provides 90% of value with 10% of risk

**User Communication**:
- Settings description should clarify: "Note: Chapter boundary setting is a placeholder for future enhancement. Currently, all modes use instant navigation."
- Or: Remove setting entirely to avoid user confusion

---

**Document Version**: 1.1  
**Last Updated**: December 20, 2025 (Post-Phase 3 Update)  
**Author**: AI Agent (Claudette RPI v6.1)  
**Status**: Ready for Phase 1 Execution
