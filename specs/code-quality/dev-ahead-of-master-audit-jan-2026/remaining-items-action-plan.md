# Remaining Items Action Plan

**Created:** January 3, 2026  
**Source:** Post-production-readiness audit verification  
**Prerequisite:** Commit `e36ff0478` (Production readiness - critical security & performance fixes)

---

## Verification Summary

After verifying each unaddressed item against the actual codebase:

| Original Issue                    | Verification Status   | Conclusion                                                           |
| --------------------------------- | --------------------- | -------------------------------------------------------------------- |
| Cookies patch version mismatch    | ❌ **NOT VALID**       | Package `6.2.1` already uses `mavenCentral()` (no jcenter)           |
| User confirmation for app restart | ❌ **NOT VALID**       | Already implemented in `SettingsAdvancedScreen.tsx:136-174, 376-383` |
| Code duplication extraction       | ✅ **VALID**           | 8+ `setTimeout(() => refreshChaptersFromContext())` calls            |
| Date inaccuracy in AGENTS.md      | ✅ **VALID**           | Minor doc error (says 2026-01-03, actual commit 2026-01-02)          |
| Add integration tests             | ✅ **VALID**           | 18 test files exist, but gaps in TTS progress sync tests             |
| Add NaN guards                    | ⚠️ **PARTIALLY VALID** | Exists for `autoStopAmount` but not for utterance ID parsing         |

---

## Valid Remaining Items

### 1. Code Duplication: Extract `refreshChaptersFromContext` Calls

**Priority:** P2 (Medium)  
**Estimated Time:** 2-3 hours  
**File:** `src/screens/reader/hooks/useTTSController.ts`

**Current State:**
The following locations all use similar `setTimeout` + `refreshChaptersFromContext` patterns:
- Line 881: Auto-stop timer (manual start)
- Line 1524: Wake transition
- Line 1773: onSpeechDone (debounced)
- Line 2206: Media nav PREV_CHAPTER
- Line 2363: Media nav NEXT_CHAPTER
- Line 2598: onQueueEmpty (chapter navigation)
- Line 2620: onQueueEmpty (novel complete)
- Line 2699: Auto-stop timer (wake resume)
- Line 2981: Novel transition

**Proposed Fix:**
```typescript
// Create helper function (add near line 700)
const syncChapterList = useCallback(
  (delayMs: number = 100) => {
    setTimeout(() => {
      try {
        refreshChaptersFromContext?.();
      } catch (e) {
        ttsCtrlLog.warn('chapter-list-sync-failed', '', e);
      }
    }, delayMs);
  },
  [refreshChaptersFromContext],
);

// Replace all occurrences:
// BEFORE: setTimeout(() => { refreshChaptersFromContext(); }, 100);
// AFTER:  syncChapterList(100);
```

**Benefits:**
- Reduces code duplication
- Centralized error handling
- Easier to modify sync behavior globally

---

### 2. Date Inaccuracy in AGENTS.md

**Priority:** P3 (Low)  
**Estimated Time:** 1 minute  
**File:** `AGENTS.md`

**Current State (line 128):**
```markdown
### TTS Progress & Wake Scroll Fixes (2026-01-03)
```

**Actual commit date:** 2026-01-02 (commit `69d78b863`)

**Fix:**
Change `(2026-01-03)` → `(2026-01-02)` at line 128.

---

### 3. TTS Integration Test Gaps

**Priority:** P2 (Medium)  
**Estimated Time:** 4-6 hours  
**Location:** `src/screens/reader/hooks/__tests__/`

**Current State:**
18 test files exist with good coverage, but gaps remain:

| Test Area                         | Status    | Files                                  |
| --------------------------------- | --------- | -------------------------------------- |
| TTS Controller basics             | ✅ Covered | `useTTSController.integration.test.ts` |
| Chapter transitions               | ✅ Covered | `useChapterTransition.test.ts`         |
| Manual mode handlers              | ✅ Covered | `useManualModeHandlers.test.ts`        |
| Resume dialog handlers            | ✅ Covered | `useResumeDialogHandlers.test.ts`      |
| **TTS progress sync timing**      | ❌ Missing | None                                   |
| **Chapter list refresh debounce** | ❌ Missing | None                                   |
| **Wake cycle with refresh**       | ⚠️ Partial | `ttsWakeUtils.test.ts`                 |

**Proposed New Tests:**
```typescript
// File: src/screens/reader/hooks/__tests__/useTTSProgressSync.test.ts

describe('TTS Chapter List Progress Sync', () => {
  it('should debounce refresh calls (2000ms interval)', () => {
    // Fire 10 rapid onSpeechDone events
    // Verify refreshChaptersFromContext called only once
  });

  it('should refresh after media nav PREV_CHAPTER', () => {
    // Trigger PREV_CHAPTER action
    // Verify refreshChaptersFromContext called after 100ms
  });

  it('should refresh after media nav NEXT_CHAPTER', () => {
    // Trigger NEXT_CHAPTER action
    // Verify refreshChaptersFromContext called after 100ms
  });

  it('should refresh on queue empty (chapter navigation)', () => {
    // Simulate queue empty scenario
    // Verify refresh triggered
  });

  it('should NOT refresh if chapter changed during debounce', () => {
    // Start refresh timer on chapter 1
    // Navigate to chapter 2
    // Verify stale refresh cancelled
  });
});
```

---

### 4. NaN Guards for Utterance ID Parsing

**Priority:** P3 (Low)  
**Estimated Time:** 30 minutes  
**File:** `src/screens/reader/hooks/useTTSController.ts`

**Current State:**
`Number.isFinite()` guard exists for `autoStopAmount` (line 2495), but utterance ID parsing in `onSpeechDone` handler lacks NaN guards.

**Location:** Around line 1627-1650 (onSpeechDone handler)

**Current Code (approximate):**
```typescript
const chapterMatch = utteranceId.match(/chapter_(\d+)_utterance_(\d+)/);
if (!chapterMatch) {
  ttsCtrlLog.warn('speech-done-invalid-id', 'Invalid utterance ID format');
  return;
}

const eventChapterId = Number(chapterMatch[1]);
const doneParagraphIndex = Number(chapterMatch[2]);
// No NaN check!
```

**Proposed Fix:**
```typescript
const eventChapterId = Number(chapterMatch[1]);
const doneParagraphIndex = Number(chapterMatch[2]);

// Add NaN guard
if (!Number.isFinite(eventChapterId) || !Number.isFinite(doneParagraphIndex)) {
  ttsCtrlLog.warn('speech-done-invalid-id', 'Non-finite chapter/paragraph ID');
  return;
}
```

---

## Non-Issues (Verified as Already Fixed)

### 1. Cookies Patch Version Mismatch ❌

**Original Concern:** `patches/@react-native-cookies__cookies.patch` targets 8.0.1 but package is 6.2.1

**Verification:**
```bash
$ head -80 node_modules/@react-native-cookies/cookies/android/build.gradle
# Shows: mavenCentral() already used (no jcenter references)
```

**Conclusion:** Package `6.2.1` already migrated to `mavenCentral()`. The patch is technically orphaned but harmless since the build succeeds. Can optionally remove the patch.

**Action:** None required (optional cleanup in future)

---

### 2. User Confirmation for App Restart ❌

**Original Concern:** No warning before forced app restart after DoH change

**Verification:**
`SettingsAdvancedScreen.tsx` lines 136-174:
- `dohRestartDialog` state variable
- `showDohRestartDialog()` called when provider changes
- `cancelDoHProviderChange()` reverts selection

Lines 376-383:
```tsx
<ConfirmationDialog
  message={getString('advancedSettingsScreen.dohRestartWarning')}
  visible={dohRestartDialog}
  onSubmit={confirmDoHProviderChange}
  onDismiss={cancelDoHProviderChange}
  theme={theme}
/>
```

**Conclusion:** Already fully implemented.

---

## Implementation Order

| Order | Item                             | Priority | Est. Time | Blocking? |
| ----- | -------------------------------- | -------- | --------- | --------- |
| 1     | Date inaccuracy fix              | P3       | 1 min     | No        |
| 2     | NaN guards for utterance ID      | P3       | 30 min    | No        |
| 3     | Extract `syncChapterList` helper | P2       | 2-3 hrs   | No        |
| 4     | TTS progress sync tests          | P2       | 4-6 hrs   | No        |

**Total Estimated Time:** 7-10 hours

---

## Quick Start

```bash
# 1. Fix date inaccuracy (manual edit)
# Edit AGENTS.md line 128: (2026-01-03) → (2026-01-02)

# 2. Run existing tests before changes
pnpm test

# 3. Make code changes (NaN guards, syncChapterList helper)

# 4. Add new tests

# 5. Run tests again
pnpm test

# 6. Format and commit
pnpm run format && git add . && git commit -m "refactor: extract chapter list sync helper + add tests"
```

---

## Verification Commands

```bash
# Run all TTS-related tests
pnpm test -- --testPathPattern="TTS|tts|useTTSController"

# Run specific test file
pnpm test -- --testPathPattern="useTTSController.integration.test"

# Type check
pnpm run type-check

# Lint
pnpm run lint
```

---

*This action plan was generated after verifying each issue against the actual codebase on January 3, 2026.*
