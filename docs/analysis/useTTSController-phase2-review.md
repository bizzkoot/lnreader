# Phase 2 Plan Review - Based on Phase 1 Learnings

**Date**: 2025-01-XX  
**Phase 1 Status**: ✅ Complete - Zero Regressions, 241/241 tests passing  
**Phase 2 Status**: 📋 Under Review

---

## Phase 1 Success Factors

### What Worked Well:
1. ✅ **Dependency Injection Pattern** - Clean interfaces, testable in isolation
2. ✅ **Systematic References Updates** - Found all `dialogState.*` references via grep
3. ✅ **Import Error Resolution** - Fixed `ChapterReaderSettings` import quickly
4. ✅ **Progressive Testing** - Type-check → Lint → Tests (caught issues early)
5. ✅ **Ref Passing Strategy** - Avoided circular dependencies by passing refs via params
6. ✅ **Callback Abstraction** - `callbacks: { hideScrollSyncDialog: dialogState.hideScrollSyncDialog }` pattern worked perfectly

### Challenges Encountered:
1. ⚠️ **Scattered State References** - Had to update 10+ locations for `dialogState`
2. ⚠️ **Import Dependencies** - `ChapterReaderSettings` was in wrong module
3. ⚠️ **Dependency Arrays** - Many callbacks needed dialogState in dependencies (expected warnings)

---

## Phase 2 Plan Analysis

### 🔴 CRITICAL CONCERNS:

#### 1. **Circular Dependency Risk in Step 4-5-6**

**Issue**: The plan shows circular dependencies:
```typescript
// Step 4: useResumeDialogHandlers
callbacks: {
  resumeTTS: utilities.resumeTTS,
  hideResumeDialog: dialogState.hideResumeDialog,
}

// Step 5: useTTSConfirmationHandler  
callbacks: {
  handleResumeCancel: resumeDialogHandlers.handleResumeCancel, // ❌ CIRCULAR!
  ...
}

// Step 6: useChapterSelectionHandler
callbacks: {
  showResumeDialog: dialogState.showResumeDialog, // ✅ OK
  ...
}
```

**Problem**: Step 5 depends on Step 4's output (`handleResumeCancel`), but they're extracted independently.

**Solution**: Extract in correct order with dependency awareness:
1. Extract `useResumeDialogHandlers` FIRST (no dependencies on other extractions)
2. Extract `useTTSConfirmationHandler` SECOND (depends on Step 1)
3. Extract `useChapterSelectionHandler` THIRD (depends on Steps 1-2)

#### 2. **Missing Interfaces Documentation**

The plan shows interfaces but doesn't document which refs/callbacks come from:
- ❌ Missing: Source of each callback (which Phase 1 hook?)
- ❌ Missing: Which refs are created in main controller vs extracted hooks
- ❌ Missing: Cross-dependencies between Phase 2 hooks

#### 3. **Incomplete Back Handler Dependencies**

```typescript
// useBackHandler depends on:
callbacks: {
  handleStopTTS: () => void; // ✅ From manualModeHandlers (Phase 1)
}

// ❌ MISSING: What about exitDialog state?
// The code references: showExitDialog, showChapterSelectionDialog
```

**Issue**: The plan passes `showExitDialog` and `showChapterSelectionDialog` as props, but they're part of `dialogState` (Phase 1). Need to clarify if we pass the whole object or individual booleans.

---

## 🟡 RECOMMENDATIONS FOR PHASE 2:

### Recommendation 1: Reorder Extraction Sequence

**Current Plan Order** (from doc):
1. Chapter Transition Effect
2. Total Paragraphs Effect
3. Back Handler
4. Resume Dialog Handlers
5. TTS Confirmation Handler
6. Chapter Selection Handler

**❌ Problem**: Steps 4-5-6 have circular dependencies if done in this order.

**✅ Revised Order** (Dependency-First):
1. **Chapter Transition Effect** (Independent, no dependencies)
2. **Total Paragraphs Effect** (Independent, no dependencies)
3. **Resume Dialog Handlers** (Depends on: Phase 1 utilities + dialogState)
4. **TTS Confirmation Handler** (Depends on: Step 3 + Phase 1 dialogState)
5. **Chapter Selection Handler** (Depends on: Step 3-4 + Phase 1 dialogState)
6. **Back Handler** (Depends on: Phase 1 manualModeHandlers + dialogState)

**Rationale**: Extract independent effects first, then build dependency chain 3→4→5→6.

---

### Recommendation 2: Enhanced Interface Documentation

For each extraction, document:

```typescript
/**
 * @hook useResumeDialogHandlers
 * @dependencies
 *   - Phase 1: utilities.resumeTTS
 *   - Phase 1: dialogState.hideResumeDialog
 *   - Local: webViewRef, chapter props
 * @provides
 *   - handleResumeConfirm (used by: useTTSController return, useTTSConfirmationHandler)
 *   - handleResumeCancel (used by: useTTSConfirmationHandler)
 *   - handleRestartChapter (used by: useTTSController return)
 */
export interface ResumeDialogHandlersParams {
  // ... params with source annotations
  chapterId: number; // from: useTTSController props
  webViewRef: RefObject<WebView | null>; // from: useTTSController local
  callbacks: {
    resumeTTS: (state: TTSPersistenceState) => void; // from: Phase 1 useTTSUtilities
    hideResumeDialog: () => void; // from: Phase 1 useDialogState
  };
}
```

**Why**: Makes it explicit where each dependency comes from and who consumes the output.

---

### Recommendation 3: Clarify Dialog State Prop Passing

**Current Plan** (Back Handler):
```typescript
export interface BackHandlerParams {
  showExitDialog: boolean;
  showChapterSelectionDialog: boolean;
  // ...
}
```

**Issue**: These are part of `dialogState` object. Do we pass individual booleans or the whole object?

**✅ Recommended Approach** (Consistency with Phase 1):
```typescript
export interface BackHandlerParams {
  // Pass individual booleans (read-only state)
  showExitDialog: boolean;
  showChapterSelectionDialog: boolean;
  
  // If we need to mutate, pass setters via callbacks
  callbacks: {
    handleStopTTS: () => void;
    // No need for dialog setters here since we don't call them
  };
}
```

**Rationale**: Back handler only READS dialog state, doesn't mutate it. Individual boolean props are cleaner than passing whole `dialogState` object.

---

### Recommendation 4: Add Pre-Extraction Validation Checklist

Before extracting each Phase 2 hook:

```markdown
## Pre-Extraction Checklist (Per Hook)

- [ ] **Identify all input dependencies**
  - [ ] Props from useTTSController
  - [ ] Refs created in useTTSController
  - [ ] Callbacks from Phase 1 hooks
  - [ ] Callbacks from previously extracted Phase 2 hooks
  
- [ ] **Identify all output consumers**
  - [ ] Which functions are returned to useTTSController?
  - [ ] Which functions are used by other Phase 2 hooks?
  - [ ] Which refs are mutated (document side effects)?
  
- [ ] **Check for timing dependencies**
  - [ ] Does this hook use setTimeout/setInterval?
  - [ ] Does this hook depend on timing of other hooks?
  - [ ] Does this hook have cleanup (return function)?
  
- [ ] **Verify no circular dependencies**
  - [ ] Map dependency graph: A → B → C (no cycles)
  - [ ] If cycle exists, refactor before extracting
```

**Why**: Phase 1 success was partly due to extracting LOW-risk sections with clear boundaries. Phase 2 has more interdependencies, so explicit validation is critical.

---

### Recommendation 5: Enhanced Testing Strategy

**Current Plan Testing**:
- Type-check
- Lint
- Unit tests (241/241)
- Integration tests (5 scenarios)

**✅ Additional Testing for Phase 2**:

#### A. **Incremental Testing After Each Extraction**
```markdown
After extracting EACH hook (not just at the end):
1. Run type-check → Fix errors immediately
2. Run lint → Fix issues immediately
3. Run tests → If any fail, stop and debug
4. Commit extraction (git) → Allows easy rollback

**Why**: Phase 2 has 6 extractions. If we wait until the end to test, we won't know which extraction caused the failure.
```

#### B. **Dependency Graph Testing**
```markdown
After extracting hooks 3-4-5-6 (the dependency chain):
- Test that handleResumeCancel is accessible from useTTSConfirmationHandler
- Test that handleSelectChapter correctly calls updateLastTTSChapter
- Test that circular dependencies don't exist (TypeScript should catch this)
```

#### C. **Ref Mutation Testing**
```markdown
Several Phase 2 hooks mutate refs:
- useResumeDialogHandlers: mutates pendingResumeIndexRef, latestParagraphIndexRef
- useTTSConfirmationHandler: mutates pendingResumeIndexRef
- useChapterTransition: mutates prevChapterIdRef, chapterTransitionTimeRef, isWebViewSyncedRef

**Test**: Verify these ref mutations don't cause stale closure bugs.

Example test:
1. Start TTS from paragraph 50
2. Trigger handleResumeConfirm
3. Verify pendingResumeIndexRef updated correctly
4. Verify subsequent reads see updated value
```

---

### Recommendation 6: Simplify useTotalParagraphs

**Current Plan**:
```typescript
export interface TotalParagraphsParams {
  html: string;
  updateTtsMediaNotificationState: (isPlaying: boolean) => void;
  refs: {
    totalParagraphsRef: RefObject<number>;
    isTTSReadingRef: RefObject<boolean>;
  };
}
```

**Issue**: Only 10 lines of code being extracted. Is this extraction valuable?

**✅ Recommendation**: 
- **Option A**: Skip this extraction (too small, not worth overhead)
- **Option B**: Merge with utilities hook (add `useTotalParagraphsEffect` as a method)

**Rationale**: Phase 1 extracted 30-190 lines per hook. A 10-line extraction may not justify the abstraction overhead.

**Updated Phase 2 Scope**: 5 extractions instead of 6 (skip Total Paragraphs or merge with utilities).

---

### Recommendation 7: Document WebView JavaScript Injection Risks

Several Phase 2 hooks inject JavaScript:
- `useBackHandler`: Multi-line injection with GAP_THRESHOLD logic
- `useResumeDialogHandlers`: Injection to start TTS from elements[0]

**Risk**: JavaScript syntax errors in template literals won't be caught by TypeScript.

**✅ Mitigation**:
1. **Extract WebView injection strings to constants** (easier to test)
2. **Add unit tests for injection string generation**
3. **Consider using a helper function** for common injection patterns

**Example**:
```typescript
// Before (in hook)
webViewRef.current?.injectJavaScript(`
  window.tts.hasAutoResumed = true;
  window.tts.start();
`);

// After (with helper)
import { injectTTSCommand } from '../utils/webViewInjection';

webViewRef.current?.injectJavaScript(
  injectTTSCommand({ hasAutoResumed: true, action: 'start' })
);
```

**Why**: Safer, testable, avoids injection syntax errors.

---

## 🟢 REVISED PHASE 2 PLAN SUMMARY

### Updated Extraction Order:
1. ✅ **useChapterTransition** (Independent, 35 lines)
2. ✅ **useResumeDialogHandlers** (Independent, 70 lines) - No Phase 2 dependencies
3. ✅ **useTTSConfirmationHandler** (Depends on #2, 70 lines)
4. ✅ **useChapterSelectionHandler** (Depends on #2-3, 70 lines)
5. ✅ **useBackHandler** (Depends on Phase 1 manualModeHandlers, 95 lines)
6. ⚠️ **useTotalParagraphs** (10 lines) - RECOMMEND SKIP or MERGE with utilities

**Total Extraction**: ~340 lines (if include Total Paragraphs) or ~330 lines (if skip it)

### Enhanced Testing Per Extraction:
```bash
# After EACH extraction (not just at end):
pnpm run type-check    # Fix errors before continuing
pnpm run lint          # Fix warnings before continuing
pnpm test              # Verify no regressions before continuing
git add . && git commit -m "Extract useXXX hook"  # Commit after each success
```

### Risk Mitigation:
1. ✅ **Extract in dependency order** (independent first, then chain)
2. ✅ **Test incrementally** (after each extraction, not at end)
3. ✅ **Document dependencies** (interface annotations with sources)
4. ✅ **Validate no circular deps** (pre-extraction checklist)
5. ✅ **Simplify small extractions** (skip or merge Total Paragraphs)

---

## 📊 UPDATED PHASE 2 ESTIMATE

| Metric | Original Plan | Revised Plan |
|--------|--------------|-------------|
| **Extractions** | 6 hooks | 5 hooks (skip Total Paragraphs) |
| **Lines Reduced** | ~350 lines | ~330 lines (12% after Phase 1) |
| **Risk Level** | 🟡 MEDIUM | 🟡 MEDIUM (unchanged) |
| **Testing Strategy** | End-to-end | Incremental (per extraction) |
| **Dependency Handling** | Unclear order | Explicit order (#1→2→3→4→5) |
| **Estimated Time** | 3-4 hours | 4-5 hours (due to incremental testing) |

---

## ✅ FINAL RECOMMENDATIONS

### Proceed with Phase 2 if:
1. ✅ Phase 1 is stable (currently: YES, 241/241 tests passing)
2. ✅ Team agrees the 12% additional reduction justifies MEDIUM risk
3. ✅ Resources available for 4-5 hours of focused work
4. ✅ Device testing can be performed post-extraction

### Use Revised Plan:
1. ✅ **Extract in dependency order**: 1→2→3→4→5 (skip #6 or merge)
2. ✅ **Test incrementally**: Type-check, lint, tests after EACH extraction
3. ✅ **Document interfaces**: Annotate source of each callback/ref
4. ✅ **Validate no circular deps**: Pre-extraction checklist
5. ✅ **Commit after each success**: Allows easy rollback if needed

### Expected Outcome:
- **useTTSController.ts**: 2797 → 2402 (Phase 1) → **~2072 lines (Phase 2)**
- **Total Reduction**: 725 lines (26% of original)
- **Remaining**: ~2072 lines (64% of original, core orchestration logic)

### If Any Regression Occurs:
```bash
# Rollback last extraction
git revert HEAD

# Or rollback to Phase 1 complete state
git checkout <phase1-complete-commit-hash>

# Re-run tests
pnpm test
```

---

## 🎯 RECOMMENDATION: PROCEED WITH REVISED PHASE 2

**Confidence**: 🟢 HIGH (based on Phase 1 success)  
**Risk**: 🟡 MEDIUM (mitigated by revised plan)  
**Value**: 🟢 GOOD (12% additional reduction, clearer code)

**Proceed with:**
- Revised extraction order (1→2→3→4→5)
- Incremental testing after each extraction
- Enhanced interface documentation
- Pre-extraction validation checklist

**Skip or defer:**
- `useTotalParagraphs` extraction (too small, 10 lines)
  - Alternative: Document inline with comments

---

**Next Action**: If approved, begin Phase 2 implementation with revised plan.
