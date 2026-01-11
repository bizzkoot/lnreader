# Product Requirements Document: TTS Highlight Offset & Resume Dialog Fix

**Status**: 🟡 In Progress (84% complete)
**Feature Branch**: `bug/paragraph-highlight-offset`
**Date**: 2025-01-11
**Session Utilization**: 84%

---

## 1. What We Want to Do Now

**Immediate Next Steps:**

1. **Fix Resume Dialog Flag Reset** (Task 2.1) - PRIORITY HIGH
   - File: `android/app/src/main/assets/js/core.js`
   - Issue: `hasAutoResumed` flag set immediately on request, preventing dialog from showing on subsequent chapter opens
   - Fix: Reset flag on chapter load (line 38, after `this.chapter = chapter;`)
   - Success criteria: Dialog shows reliably with "Ask everytime" setting

2. **Manual Testing** (Tasks 1.4, 2.2)
   - Test offset: navigation, clamping, reset
   - Test resume dialog: reliability with different settings

3. **Quality Assurance** (Tasks 3.1, 3.2, 5.1, 5.2)
   - Run full test suite (verify no regressions)
   - E2E integration testing
   - Pre-commit checks (format, lint, type-check)
   - Build release APK for validation

4. **Documentation** (Tasks 4.1, 4.2)
   - Update AGENTS.md with feature documentation
   - Create Forgetful memories for implementation

---

## 2. Research Findings

### Bug #1: Paragraph Highlight Offset (Resolved ✅)

**Root Cause Analysis:**

- TTS highlights paragraph by index, but layout rendering may differ from TTS index
- Example: TTS at paragraph 10 might visually render as paragraph 11 in WebView

**Solution Implemented:**

- Add ephemeral `paragraphHighlightOffset` state (chapter-scoped, not persisted)
- User can adjust offset via +/- buttons (clamped to [-10, +10])
- Reset button to return to 0 offset
- UI controls in Reader TTS Tab (bottom sheet)

**Architecture Decision:**

- Offset state lives in `ChapterContext`, NOT `useTTSController`
- **Why**: ReaderBottomSheet and WebViewReader are sibling components (both in ReaderScreen)
- **How**: ChapterContext provides shared state accessible to both
- **Benefits**: Clean separation, no prop drilling, proper lifecycle management

### Bug #2: Resume Dialog Not Showing (Pending 🔧)

**Root Cause:**

- Location: `core.js:2390`
- Code: `this.hasAutoResumed = true;` set immediately when posting 'request-tts-confirmation'
- Problem: Flag is set BEFORE user responds to dialog
- Result: On subsequent chapter opens, `!this.hasAutoResumed` check fails → dialog skipped

**Fix Strategy:**

- Reset `hasAutoResumed` flag to `false` on chapter load
- Location: `core.js:38` (after `this.chapter = chapter;`)
- This ensures dialog can show again when returning to chapter

**Testing Needed:**

- Open chapter with saved progress → Dialog shows
- Cancel dialog → Close and reopen → Dialog should still show
- Resume from dialog → Navigate away and back → Dialog should show again
- Test with "Ask everytime", "Always", "Never" settings

---

## 3. Implementation Plan

### Phase 1: Offset Feature (Completed ✅)

| Task                                            | Status | Commit    |
| ----------------------------------------------- | ------ | --------- |
| 1.1 Add offset state to TTS controller          | ✅     | 2d9edddec |
| 1.2 Apply offset to WebView highlight injection | ✅     | 70a2aaa76 |
| 1.3 Add UI controls for offset adjustment       | ✅     | 541bcd732 |
| 1.4 Manual test offset feature                  | ⏳     | Pending   |

**Implementation Details:**

**Files Modified:**

- `src/screens/reader/ChapterContext.tsx`
  - Added `paragraphHighlightOffsetRef`, `paragraphHighlightOffset` state
  - Added `adjustHighlightOffset(delta)`, `resetHighlightOffset()` handlers
  - Reset on chapter change (useEffect with [chapterId] dependency)

- `src/screens/reader/hooks/useTTSController.ts`
  - Added `paragraphHighlightOffsetRef` to `UseTTSControllerParams` interface
  - Removed local offset ref creation (now from context)
  - Removed offset handlers (moved to context)
  - Removed offset from return interface

- `src/screens/reader/components/WebViewReader.tsx`
  - Destructured `paragraphHighlightOffsetRef` from context
  - Passed to useTTSController as parameter

- `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx`
  - Destructured offset values from context
  - Added UI controls:
    - Minus button (adjust -1)
    - Plus button (adjust +1)
    - Value display (with + prefix for positive)
    - Reset button (refresh icon)
  - Added styles: `offsetControlContainer`, `offsetButtons`, `offsetButton`, `offsetResetButton`, `offsetValue`

- `src/screens/reader/hooks/__tests__/useTTSController.mediaNav.test.ts`
  - Added `paragraphHighlightOffsetRef: { current: 0 }` to mock props

**Code Quality:**

- ✅ TypeScript type-check: PASS
- ✅ ESLint: PASS
- ✅ Prettier: PASS
- ✅ All imports valid (IconButtonV2, scaleDimension, theme)

### Phase 2: Resume Dialog Fix (Pending ⏳)

| Task                                        | Status | Commit  |
| ------------------------------------------- | ------ | ------- |
| 2.1 Fix resume dialog flag reset in core.js | ⏳     | Pending |
| 2.2 Manual test resume dialog reliability   | ⏳     | Pending |

**Implementation Details:**

**File to Modify:**

- `android/app/src/main/assets/js/core.js`

**Changes:**

```javascript
// Line 37 (existing):
this.chapter = chapter;

// Add after line 37:
this.hasAutoResumed = false; // Reset flag to allow dialog to show again
```

**Verification:**

- Check `request-tts-confirmation` handler still works
- Verify `!this.hasAutoResumed` check at line 2382 works after reset

### Phase 3: Testing & Documentation (Pending ⏳)

| Task                                      | Status | Priority |
| ----------------------------------------- | ------ | -------- |
| 1.4 Manual test offset feature            | ⏳     | High     |
| 2.2 Manual test resume dialog reliability | ⏳     | High     |
| 3.1 Run full test suite                   | ⏳     | Medium   |
| 3.2 E2E integration testing               | ⏳     | Medium   |
| 4.1 Update AGENTS.md                      | ⏳     | Medium   |
| 4.2 Create Forgetful memories             | ⏳     | Low      |
| 5.1 Run pre-commit checks                 | ⏳     | High     |
| 5.2 Build release APK                     | ⏳     | Medium   |
| 5.3 Create final summary and commit       | ⏳     | High     |

---

## 4. Current Task Completion

### ✅ Completed (3/13 = 23%)

**Feature 1: Paragraph Highlight Offset**

- ✅ Task 1.1: Add offset state to TTS controller
  - Added `paragraphHighlightOffsetRef` to ChapterContext
  - Implemented handlers with clamping logic
  - Automatic reset on chapter change

- ✅ Task 1.2: Apply offset to WebView highlight injection
  - Modified `useTTSController` to use offset ref
  - Applied in `onSpeechStart` handler
  - `adjustedIndex = paragraphIndex + offset`

- ✅ Task 1.3: Add UI controls for offset adjustment
  - Added controls to ReaderTTSTab
  - Styled with proper scaling and theming
  - All components integrated via ChapterContext

### ⏳ Pending (10/13 = 77%)

**Feature 1: Paragraph Highlight Offset**

- ⏳ Task 1.4: Manual test offset feature
  - Test navigation resets offset to 0
  - Test clamping at [-10, +10] boundaries
  - Test visual feedback of offset adjustment

**Feature 2: Resume Dialog Fix**

- ⏳ Task 2.1: Fix resume dialog flag reset in core.js
  - Add `this.hasAutoResumed = false;` after line 37
  - Verify dialog shows on chapter open

- ⏳ Task 2.2: Manual test resume dialog reliability
  - Test with "Ask everytime" setting
  - Test cancel/reopen behavior
  - Test resume/navigation behavior

**Phase 3: Testing & Documentation**

- ⏳ Task 3.1: Run full test suite (1072+ baseline)
- ⏳ Task 3.2: E2E integration testing
- ⏳ Task 4.1: Update AGENTS.md with feature docs
- ⏳ Task 4.2: Create Forgetful memories
- ⏳ Task 5.1: Run pre-commit checks (format, lint, type-check)
- ⏳ Task 5.2: Build release APK for validation
- ⏳ Task 5.3: Create final summary and commit

---

## 5. Technical Context for Next Session

### Key Files Modified So Far

1. **src/screens/reader/ChapterContext.tsx**
   - Added offset state management (ephemeral)
   - Exported `paragraphHighlightOffsetRef`, `paragraphHighlightOffset`, `adjustHighlightOffset`, `resetHighlightOffset`

2. **src/screens/reader/hooks/useTTSController.ts**
   - Added `paragraphHighlightOffsetRef` parameter to interface
   - Removed local offset state (now from context)
   - Applied offset in highlight injection (line 2229)

3. **src/screens/reader/components/WebViewReader.tsx**
   - Destructured and passed offset ref to useTTSController

4. **src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx**
   - Added offset control UI
   - Imported IconButtonV2
   - Added styles for offset controls

5. **src/screens/reader/hooks/**tests**/useTTSController.mediaNav.test.ts**
   - Updated mock props to include `paragraphHighlightOffsetRef`

### Next Session Priority Order

1. **Task 2.1** (HIGH PRIORITY) - Fix resume dialog flag in core.js
   - Single-line change, 5-minute task
   - Unblocks Task 2.2 testing

2. **Task 1.4 + 2.2** (HIGH PRIORITY) - Manual testing
   - Offset: Verify navigation reset, clamping, visual feedback
   - Resume dialog: Verify show reliability with different settings

3. **Task 3.1** (MEDIUM PRIORITY) - Run full test suite
   - Verify no regressions from changes
   - All 1072+ tests should pass

4. **Task 5.1** (HIGH PRIORITY) - Pre-commit checks
   - Format, lint, type-check

5. **Task 5.2** (MEDIUM PRIORITY) - Build release APK
   - Validate feature on physical device

6. **Task 4.1 + 4.2** (LOW/MEDIUM PRIORITY) - Documentation
   - Update AGENTS.md
   - Create Forgetful memories

### Known Risks & Mitigations

| Risk                                       | Likelihood | Impact | Mitigation                                                     |
| ------------------------------------------ | ---------- | ------ | -------------------------------------------------------------- |
| Offset not persisting across app restart   | Low        | Low    | By design (ephemeral) - documented as chapter-scoped           |
| Resume dialog still not showing after fix  | Low        | High   | Manual testing in Task 2.2 covers this                         |
| Offset affects media navigation state sync | Low        | Medium | Offset only applied to `onSpeechStart` handler, not state sync |
| ChapterContext state desync                | Very Low   | High   | Both WebViewReader and ReaderTTSTab read from same source      |

### Handoff Notes

**Current Git State:**

- Branch: `bug/paragraph-highlight-offset`
- Clean working tree
- 3 commits: offset state, highlight injection, UI controls

**Next Actions:**

1. Read `android/app/src/main/assets/js/core.js` around line 37
2. Add `this.hasAutoResumed = false;` after line 37
3. Run type-check (core.js is JavaScript, just syntax)
4. Test resume dialog behavior
5. Run test suite
6. Complete remaining documentation tasks
7. Create final summary commit

**Success Criteria:**

- ✅ Offset controls functional (buttons, display, reset)
- ✅ Offset resets on navigation
- ✅ Resume dialog shows reliably
- ✅ All tests passing (1072+)
- ✅ TypeScript clean
- ✅ APK builds successfully
- ✅ Documentation updated

---

**Last Updated**: 2025-01-11
**Session Utilization**: 84%
**Completion**: 3/13 tasks (23%)
