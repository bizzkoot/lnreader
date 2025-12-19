# Task Tracking: Reader Enhancements

**Feature**: Auto-Mark Short Chapters & Continuous Scrolling  
**Start Date**: December 20, 2025  
**Target Completion**: December 31, 2025 (12 days)

---

## Phase 1: Foundation & Settings ⏳

**Status**: Not Started  
**Duration**: 2 days  
**Risk**: Low

### Tasks

- [ ] **Task 1.1**: Add settings to `useChapterGeneralSettings.ts`
  - **Assignee**: Main Agent
  - **File**: `src/hooks/persisted/useChapterGeneralSettings.ts`
  - **Actions**:
    - Add `autoMarkShortChapters: boolean` (default: `true`)
    - Add `continuousScrolling: 'disabled' | 'always' | 'ask'` (default: `'disabled'`)
    - Add `continuousScrollBoundary: 'stitched' | 'bordered'` (default: `'bordered'`)
    - Update TypeScript types
  - **Validation**: Settings persist after app restart

- [ ] **Task 1.2**: Add UI controls in Reader Settings
  - **Assignee**: Main Agent
  - **Files**: `src/screens/settings/SettingsReaderScreen/tabs/*`
  - **Actions**:
    - Add toggle for auto-mark short chapters
    - Add dropdown for continuous scrolling (Disabled / Always / Ask)
    - Add dropdown for chapter boundary (Bordered / Stitched)
      - Conditionally visible when continuous scrolling is enabled
    - Add clear descriptions for each setting
  - **Validation**: Settings UI visible and reactive

- [ ] **Task 1.3**: Add core.js infrastructure
  - **Assignee**: Main Agent
  - **File**: `android/app/src/main/assets/js/core.js`
  - **Actions**:
    - Add flags: `hasAutoMarkedShortChapter`, `isNavigating`
    - Add function stubs
    - Inject settings from initialReaderConfig
  - **Validation**: Settings available in WebView

- [ ] **Task 1.4**: Validation tests
  - **Assignee**: Main Agent
  - **Actions**:
    - Manual test: Toggle settings
    - Manual test: Restart app, verify persistence
    - Run: `pnpm run type-check`
    - Run: `pnpm run lint`
  - **Validation**: No errors, settings work

**Completion Criteria**:
- [ ] Settings persist across app restarts
- [ ] Settings injected into WebView correctly
- [ ] No TypeScript or lint errors
- [ ] No crashes or UI bugs

---

## Phase 2: Auto-Mark Short Chapters ⏸️

**Status**: Blocked (Waiting for Phase 1)  
**Duration**: 3 days  
**Risk**: Medium

### Tasks

- [ ] **Task 2.1**: Implement short chapter detection
  - **Assignee**: Main Agent
  - **File**: `android/app/src/main/assets/js/core.js`
  - **Actions**:
    - Implement `checkShortChapterAutoMark()` function
    - Add TTS guard check
    - Add setting check
    - Calculate isShortChapter
    - Post save message with 100%
  - **Validation**: Function logs correctly

- [ ] **Task 2.2**: Hook into window.load event
  - **Assignee**: Main Agent
  - **File**: `android/app/src/main/assets/js/core.js`
  - **Actions**:
    - Add listener after existing window.load
    - Wait for `document.fonts.ready`
    - Add 500ms delay for images
    - Call `checkShortChapterAutoMark()`
  - **Validation**: Function called after chapter loads

- [ ] **Task 2.3**: Reset flag on chapter change
  - **Assignee**: Main Agent
  - **Files**: `core.js`, `WebViewReader.tsx`
  - **Actions**:
    - Reset `hasAutoMarkedShortChapter` on navigation
    - Inject reset from React Native on chapter change
  - **Validation**: Flag resets for each new chapter

- [ ] **Task 2.4**: Handle save event in React Native
  - **Assignee**: Main Agent
  - **File**: `src/screens/reader/components/WebViewReader.tsx`
  - **Actions**:
    - Log source in handleMessage
    - No functional changes (existing save logic works)
  - **Validation**: Logs show auto-mark source

- [ ] **Task 2.5**: Comprehensive testing
  - **Assignee**: Sub-Agent
  - **Actions**:
    - Test short text-only chapter
    - Test short chapter with images
    - Test short chapter with custom fonts
    - Test TTS active on short chapter
    - Test setting disabled
  - **Validation**: All edge cases pass

**Completion Criteria**:
- [ ] Short chapters marked as 100% when navigating
- [ ] Toast notification visible
- [ ] No TTS interference (verified via tests)
- [ ] All edge case tests passing
- [ ] No performance impact

---

## Phase 3: Continuous Scrolling ⏸️

**Status**: Blocked (Waiting for Phase 2)  
**Duration**: 4 days  
**Risk**: High (TTS integration complexity)

### Tasks

- [ ] **Task 3.1**: Implement scroll threshold detection
  - **Assignee**: Main Agent
  - **File**: `android/app/src/main/assets/js/core.js`
  - **Actions**:
    - Implement `checkContinuousScroll()` function
    - Calculate scroll percentage
    - Check mode (disabled/always/ask)
    - Guard: TTS active check (CRITICAL)
    - Guard: isNavigating check (CRITICAL)
    - Trigger at 95% threshold
  - **Validation**: Function logs at correct threshold

- [ ] **Task 3.2**: Hook into processScroll
  - **Assignee**: Main Agent
  - **File**: `android/app/src/main/assets/js/core.js`
  - **Actions**:
    - Add call to `checkContinuousScroll()` at end of `processScroll()`
    - No other changes to existing logic
  - **Validation**: Function called on every scroll

- [ ] **Task 3.3**: Implement navigation function
  - **Assignee**: Main Agent
  - **File**: `android/app/src/main/assets/js/core.js`
  - **Actions**:
    - Implement `performContinuousNavigation()` function
    - Set `isNavigating` flag
    - Save 100% progress FIRST (CRITICAL)
    - Show loading toast
    - Post `next` message after 100ms delay
  - **Validation**: Progress saved before navigation

- [ ] **Task 3.4**: Add React Native state management
  - **Assignee**: Main Agent
  - **File**: `src/screens/reader/components/WebViewReader.tsx`
  - **Actions**:
    - Add `isNavigating` state
    - Block duplicate `next` messages
    - Clear flag after chapter change
    - Inject flag clear into WebView
  - **Validation**: Duplicate navigation prevented

- [ ] **Task 3.5**: Implement confirmation dialog
  - **Assignee**: Main Agent
  - **File**: `src/screens/reader/components/WebViewReader.tsx`
  - **Actions**:
    - Add dialog state
    - Handle `continuous-scroll-prompt` message
    - Create Dialog component
    - Handle Yes/No responses
  - **Validation**: Dialog appears and responds correctly

- [ ] **Task 3.6**: Comprehensive testing
  - **Assignee**: Sub-Agent
  - **Actions**:
    - Test all 3 modes (disabled, always, ask)
    - Test TTS active + scroll (CRITICAL)
    - Test rapid scroll to bottom
    - Test scroll up after trigger
    - Test no next chapter
    - Test background app during navigation
    - Test network chapters
  - **Validation**: All edge cases pass, no TTS conflicts

**Completion Criteria**:
- [ ] Continuous scroll triggers at 95% in "always" mode
- [ ] Confirmation dialog works in "ask" mode
- [ ] No TTS conflicts (verified via extensive tests)
- [ ] No duplicate navigation
- [ ] Progress saved correctly before navigation
- [ ] All edge case tests passing

---

## Phase 4: Polish & Quality Assurance ⏸️

**Status**: Blocked (Waiting for Phase 3)  
**Duration**: 3 days  
**Risk**: Low

### Tasks

- [ ] **Task 4.1**: Create unit tests
  - **Assignee**: Sub-Agent
  - **Files**: `src/screens/reader/components/__tests__/*`
  - **Actions**:
    - Create `WebViewReader.automark.test.tsx`
    - Create `WebViewReader.continuousscroll.test.tsx`
    - Test all message handlers
    - Test edge cases
    - Mock dependencies
  - **Validation**: All tests passing

- [ ] **Task 4.2**: Integration testing
  - **Assignee**: Main Agent
  - **Actions**:
    - Test on low-end Android device
    - Test on high-end Android device
    - Test on small screen
    - Test on large screen
    - Test with various novel plugins
    - Test downloaded vs network chapters
  - **Validation**: No crashes, consistent behavior

- [ ] **Task 4.3**: TTS conflict testing
  - **Assignee**: Sub-Agent
  - **Actions**:
    - Test TTS auto-navigation vs continuous scroll
    - Test TTS background playback + continuous scroll
    - Test TTS foreground playback + auto-mark
    - Test screen wake during TTS + auto-mark
    - Verify progress saved correctly
  - **Validation**: No conflicts, TTS always wins priority

- [ ] **Task 4.4**: Performance profiling
  - **Assignee**: Main Agent
  - **Actions**:
    - Measure scroll FPS (baseline vs enabled)
    - Measure chapter load time (manual vs continuous)
    - Measure memory usage (10 navigations)
  - **Validation**: < 5% FPS drop, no memory leak

- [ ] **Task 4.5**: Code quality checks
  - **Assignee**: Main Agent
  - **Actions**:
    - Run: `pnpm run lint`
    - Run: `pnpm run type-check`
    - Fix all errors and warnings
    - Remove debug console.logs
  - **Validation**: Clean lint and type-check

- [ ] **Task 4.6**: Update documentation
  - **Assignee**: Main Agent
  - **Files**: `AGENTS.md`, `.agents/memory.instruction.md`, `README.md`
  - **Actions**:
    - Add features to AGENTS.md recent changes
    - Add patterns to memory.instruction.md
    - Update user documentation
    - Create CHANGELOG.md
  - **Validation**: Documentation complete and accurate

**Completion Criteria**:
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] TTS conflict tests passing
- [ ] Performance metrics within targets
- [ ] Lint and type-check clean
- [ ] Documentation complete

---

## Final Validation Checklist

**Before Final Commit**: All items must be checked

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

## Progress Summary

**Overall Progress**: 0% (0/4 phases complete)

| Phase | Status | Tasks Complete | Estimated Days | Actual Days |
|-------|--------|----------------|----------------|-------------|
| Phase 1: Foundation | ⏳ Not Started | 0/4 | 2 | - |
| Phase 2: Auto-Mark | ⏸️ Blocked | 0/5 | 3 | - |
| Phase 3: Continuous Scroll | ⏸️ Blocked | 0/6 | 4 | - |
| Phase 4: Polish & QA | ⏸️ Blocked | 0/6 | 3 | - |
| **Total** | **Not Started** | **0/21** | **12** | **0** |

---

## Risk Register

| Risk | Phase | Impact | Probability | Mitigation Status |
|------|-------|--------|------------|-------------------|
| TTS conflict | 3 | Critical | High | Guarded with checks |
| Progress save race | 3 | High | Medium | Force save before nav |
| Duplicate navigation | 3 | High | Medium | isNavigating flag |
| False positive short | 2 | Medium | Medium | Wait fonts + images |
| User confusion | 2-3 | Medium | Low | Toasts + defaults |

---

## Notes & Decisions

### 2025-12-20: Initial Planning

**Decisions Made**:
1. Implement auto-mark short chapters first (lower risk)
2. Default continuous scrolling to `disabled` (opt-in)
3. Use existing 150ms scroll debounce (no new listeners)
4. TTS always has priority over scroll-based navigation
5. Save 100% progress BEFORE any navigation

**Deferred for V2**:
1. Stitched chapter display (seamless flow between chapters)
2. Preload next chapter at 80% scroll
3. Smart short chapter detection (ML-based)
4. Reading session analytics

**Questions for User**:
1. Should continuous scroll be enabled by default? (Currently: No)
2. What threshold feels right? (Currently: 95%)
3. Should we add visual indicator approaching threshold?

---

**Last Updated**: December 20, 2025  
**Document Version**: 1.0  
**Maintained By**: AI Agent (Claudette RPI v6.1)
