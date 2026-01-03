# TTS State Cleanup on Media Navigation - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clear ALL TTS state (MMKV flags, progress data, in-memory refs) when user navigates chapters via media notification, preventing stale "resume" dialog confusion.

**Architecture:**
- Add comprehensive TTS state cleanup function in useTTSController
- Call cleanup in PREV_CHAPTER and NEXT_CHAPTER media notification handlers
- Clear: pendingTTSResumeChapterId, lastTTSChapterId, all chapter_progress_* keys, ttsStateRef

**Tech Stack:**
- React Native 0.82.1
- TypeScript
- MMKV (key-value storage)
- Jest (917 existing tests passing)

---

## Problem Statement

When user navigates Ch10 → Ch7 via media notification:
1. Chapters 8-9-10 are reset to 0% ✅
2. BUT `pendingTTSResumeChapterId` still points to Ch10 ❌
3. User exits app, returns
4. Resume dialog shows stale Ch10 progress ❌

**Root Cause:** Incomplete TTS state cleanup during chapter navigation.

---

## State to Clear

### MMKV Keys
| Key | Purpose | Clear When |
|-----|---------|------------|
| `pendingTTSResumeChapterId` | Resume dialog flag | All media nav |
| `lastTTSChapterId` | Last TTS chapter ID | All media nav |
| `chapter_progress_${chapterId}` | Paragraph index | All media nav |
| `tts_button_position` | Notification position | Optional |

### In-Memory State
| Ref | Purpose | Clear When |
|-----|---------|------------|
| `ttsStateRef` | TTS state object | All media nav |
| `currentParagraphIndexRef` | Current position | All media nav |
| `latestParagraphIndexRef` | Latest position | All media nav |

---

## Task 1: Create TTS State Cleanup Utility

**Files:**
- Modify: `src/screens/reader/hooks/useTTSController.ts`
- Test: `src/screens/reader/hooks/__tests__/useTTSController.mediaNav.test.ts`

### Step 1: Write the failing test

Create: `src/screens/reader/hooks/__tests__/useTTSController.mediaNav.test.ts`

```typescript
/**
 * Tests: TTS State Cleanup on Media Navigation
 *
 * Verify that ALL TTS state is cleared when user navigates
 * via media notification controls (PREV/NEXT chapter).
 */

import { MMKVStorage } from '@utils/mmkv/mmkv';
import { renderHook, act } from '@testing-library/react-native';
import { useTTSController } from '../useTTSController';

describe('TTS State Cleanup - Media Navigation', () => {
  beforeEach(() => {
    MMKVStorage.clearAll();
    // Setup mock TTS state
    MMKVStorage.set('pendingTTSResumeChapterId', 10);
    MMKVStorage.set('lastTTSChapterId', 10);
    MMKVStorage.set('chapter_progress_10', 45);
    MMKVStorage.set('chapter_progress_9', 30);
    MMKVStorage.set('tts_button_position', JSON.stringify({ x: 100, y: 200 }));
  });

  it('should clear all TTS state when calling cleanup function', async () => {
    // Verify initial state
    expect(MMKVStorage.getNumber('pendingTTSResumeChapterId')).toBe(10);
    expect(MMKVStorage.getNumber('lastTTSChapterId')).toBe(10);
    expect(MMKVStorage.getNumber('chapter_progress_10')).toBe(45);

    // TODO: Call cleanup function
    // await cleanupAllTTSState([10, 9]);

    // Verify all state cleared
    expect(MMKVStorage.getNumber('pendingTTSResumeChapterId')).toBeUndefined();
    expect(MMKVStorage.getNumber('lastTTSChapterId')).toBeUndefined();
    expect(MMKVStorage.getNumber('chapter_progress_10')).toBeUndefined();
    expect(MMKVStorage.getNumber('chapter_progress_9')).toBeUndefined();
    expect(MMKVStorage.getString('tts_button_position')).toBeNull();
  });

  it('should clear ttsStateRef when calling cleanup function', async () => {
    const { result } = renderHook(() => useTTSController(mockProps));

    // Setup initial state
    act(() => {
      result.current.ttsStateRef.current = {
        chapterId: 10,
        paragraphIndex: 45,
        timestamp: Date.now(),
      };
    });

    expect(result.current.ttsStateRef.current).not.toBeNull();

    // TODO: Call cleanup function
    // await cleanupAllTTSState([10]);

    // Verify ref cleared
    expect(result.current.ttsStateRef.current).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- --testPathPattern="useTTSController.mediaNav.test" --verbose
```

Expected: FAIL with "cleanupAllTTSState is not defined"

**Step 3: Write minimal implementation**

Modify: `src/screens/reader/hooks/useTTSController.ts`

Add after line 329 (after ttsStateRef declaration):

```typescript
/**
 * Cleanup All TTS State
 *
 * Clears ALL TTS-related state from MMKV and in-memory refs.
 * Called when user navigates via media notification to prevent
 * stale "resume" dialog confusion.
 *
 * @param chapterIds - Array of chapter IDs to clear progress for
 */
const cleanupAllTTSState = useCallback(
  async (chapterIds: number[] = []) => {
    ttsCtrlLog.info(
      'tts-state-cleanup',
      `🧹 Cleaning up TTS state for ${chapterIds.length} chapters`,
    );

    try {
      // Clear MMKV flags
      MMKVStorage.delete('pendingTTSResumeChapterId');
      MMKVStorage.delete('lastTTSChapterId');
      MMKVStorage.delete('tts_button_position');

      ttsCtrlLog.debug(
        'tts-state-cleanup-mmkv',
        'Cleared MMKV flags: pendingTTSResumeChapterId, lastTTSChapterId, tts_button_position',
      );

      // Clear progress for specified chapters
      for (const chapterId of chapterIds) {
        MMKVStorage.delete(`chapter_progress_${chapterId}`);
        ttsCtrlLog.debug('tts-state-cleanup-chapter', `Cleared progress for chapter ${chapterId}`);
      }

      // Clear in-memory state
      ttsStateRef.current = null;
      currentParagraphIndexRef.current = -1;
      latestParagraphIndexRef.current = -1;

      ttsCtrlLog.debug(
        'tts-state-cleanup-refs',
        'Cleared in-memory refs: ttsStateRef, currentParagraphIndexRef, latestParagraphIndexRef',
      );

      ttsCtrlLog.info('tts-state-cleanup-complete', '✅ TTS state cleanup complete');
    } catch (e) {
      ttsCtrlLog.warn('tts-state-cleanup-failed', 'Failed to cleanup TTS state', e);
    }
  },
  [],
);
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- --testPathPattern="useTTSController.mediaNav.test" --verbose
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/screens/reader/hooks/useTTSController.ts
git add src/screens/reader/hooks/__tests__/useTTSController.mediaNav.test.ts
git commit -m "feat: add TTS state cleanup utility function"
```

---

## Task 2: Integrate Cleanup in PREV_CHAPTER Handler

**Files:**
- Modify: `src/screens/reader/hooks/useTTSController.ts:2267-2329`

### Step 1: Update test for PREV_CHAPTER cleanup

Modify: `src/screens/reader/hooks/__tests__/useTTSController.mediaNav.test.ts`

Add to existing test file:

```typescript
describe('PREV_CHAPTER Navigation - State Cleanup', () => {
  it('should cleanup all TTS state when navigating to previous chapter', async () => {
    // Setup: User at Ch10, various state set
    MMKVStorage.set('pendingTTSResumeChapterId', 10);
    MMKVStorage.set('lastTTSChapterId', 10);
    MMKVStorage.set('chapter_progress_10', 45);
    MMKVStorage.set('chapter_progress_9', 30);
    MMKVStorage.set('chapter_progress_8', 15);

    const { result } = renderHook(() => useTTSController(mockProps));

    // Simulate PREV_CHAPTER action (Ch10 -> Ch7)
    await act(async () => {
      await result.current.onMediaAction({
        type: 'media-action',
        action: 'PREV_CHAPTER',
      });
    });

    // Verify ALL state cleared (Ch8, Ch9, Ch10)
    expect(MMKVStorage.getNumber('pendingTTSResumeChapterId')).toBeUndefined();
    expect(MMKVStorage.getNumber('lastTTSChapterId')).toBeUndefined();
    expect(MMKVStorage.getNumber('chapter_progress_10')).toBeUndefined();
    expect(MMKVStorage.getNumber('chapter_progress_9')).toBeUndefined();
    expect(MMKVStorage.getNumber('chapter_progress_8')).toBeUndefined();

    // Verify in-memory state cleared
    expect(result.current.ttsStateRef.current).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- --testPathPattern="useTTSController.mediaNav.test" --testNamePattern="PREV_CHAPTER" --verbose
```

Expected: FAIL (cleanup not yet integrated)

**Step 3: Integrate cleanup in PREV_CHAPTER handler**

Modify: `src/screens/reader/hooks/useTTSController.ts:2267-2329`

Find the skipped chapters reset loop (around line 2296) and add cleanup call:

```typescript
// After line 2329 (end of skipped chapters reset)

// ✅ NEW: Cleanup ALL TTS state to prevent stale resume dialog
const chapterIdsToClean = [chapterId, ...skippedChapters.map(sc => sc.id)];
await cleanupAllTTSState(chapterIdsToClean);
```

Full context:

```typescript
// ... existing code up to line 2329

            } catch (e) {
              ttsCtrlLog.warn(
                'reset-skipped-chapters-error',
                'Failed to query/reset skipped chapters',
                e,
              );
            }

            // ✅ CLEANUP ALL TTS STATE
            // Clear all TTS state to prevent stale "resume" dialog when user returns
            const chapterIdsToClean = [
              chapterId, // Source chapter
              prevChapter.id, // Target chapter
              ...(skippedChapters?.map(sc => sc.id) || []), // Skipped chapters
            ];
            await cleanupAllTTSState(chapterIdsToClean);

            isTTSReadingRef.current = true;
            isTTSPausedRef.current = false;
            // ... rest of existing code
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- --testPathPattern="useTTSController.mediaNav.test" --testNamePattern="PREV_CHAPTER" --verbose
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/screens/reader/hooks/useTTSController.ts
git add src/screens/reader/hooks/__tests__/useTTSController.mediaNav.test.ts
git commit -m "feat: integrate TTS state cleanup in PREV_CHAPTER handler"
```

---

## Task 3: Integrate Cleanup in NEXT_CHAPTER Handler

**Files:**
- Modify: `src/screens/reader/hooks/useTTSController.ts:2344-2480`

### Step 1: Update test for NEXT_CHAPTER cleanup

Modify: `src/screens/reader/hooks/__tests__/useTTSController.mediaNav.test.ts`

Add test case:

```typescript
describe('NEXT_CHAPTER Navigation - State Cleanup', () => {
  it('should cleanup all TTS state when navigating to next chapter', async () => {
    // Setup: User at Ch5, various state set
    MMKVStorage.set('pendingTTSResumeChapterId', 5);
    MMKVStorage.set('lastTTSChapterId', 5);
    MMKVStorage.set('chapter_progress_5', 100);

    const { result } = renderHook(() => useTTSController(mockProps));

    // Simulate NEXT_CHAPTER action (Ch5 -> Ch6)
    await act(async () => {
      await result.current.onMediaAction({
        type: 'media-action',
        action: 'NEXT_CHAPTER',
      });
    });

    // Verify ALL state cleared
    expect(MMKVStorage.getNumber('pendingTTSResumeChapterId')).toBeUndefined();
    expect(MMKVStorage.getNumber('lastTTSChapterId')).toBeUndefined();
    expect(MMKVStorage.getNumber('chapter_progress_5')).toBeUndefined();

    // Verify in-memory state cleared
    expect(result.current.ttsStateRef.current).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test -- --testPathPattern="useTTSController.mediaNav.test" --testNamePattern="NEXT_CHAPTER" --verbose
```

Expected: FAIL (cleanup not yet integrated)

**Step 3: Integrate cleanup in NEXT_CHAPTER handler**

Modify: `src/screens/reader/hooks/useTTSController.ts:2344-2480`

Find the NEXT_CHAPTER handler (after line 2385) and add cleanup:

```typescript
// After marking current chapter as complete (around line 2385)

            try {
              // Use saveProgressRef to update DB + trigger UI refresh for current chapter
              saveProgressRef.current(100, undefined);
              try {
                await markChapterRead(chapterId);
              } catch (e) {
                ignoreError(e, 'markChapterRead');
              }

              // ✅ NEW: Sync chapter list immediately
              syncChapterList(100);
            } catch (e) {
              ttsCtrlLog.warn(
                'mark-source-complete-failed',
                'Failed to mark source chapter complete',
                e,
              );
            }

            try {
              await updateChapterProgressDb(nextChapter.id, 0);
              try {
                await markChapterUnread(nextChapter.id);
              } catch (e) {
                ignoreError(e, 'markChapterUnread (reset next)');
              }
              try {
                MMKVStorage.set(`chapter_progress_${nextChapter.id}`, 0);
              } catch (e) {
                ignoreError(e, 'MMKVStorage.set (reset next progress)');
              }
            } catch (e) {
              ttsCtrlLog.warn(
                'reset-next-chapter-failed',
                'Failed to reset next chapter progress',
                e,
              );
            }

            // ✅ CLEANUP ALL TTS STATE
            // Clear all TTS state to prevent stale "resume" dialog
            await cleanupAllTTSState([chapterId, nextChapter.id]);

            isTTSReadingRef.current = true;
            isTTSPausedRef.current = false;
            // ... rest of existing code
```

**Step 4: Run test to verify it passes**

```bash
pnpm test -- --testPathPattern="useTTSController.mediaNav.test" --testNamePattern="NEXT_CHAPTER" --verbose
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/screens/reader/hooks/useTTSController.ts
git add src/screens/reader/hooks/__tests__/useTTSController.mediaNav.test.ts
git commit -m "feat: integrate TTS state cleanup in NEXT_CHAPTER handler"
```

---

## Task 4: Add Integration Test for Full User Flow

**Files:**
- Modify: `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts`

### Step 1: Write end-to-end test

Modify: `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts`

Add to existing integration test file:

```typescript
describe('TTS State Cleanup - Integration Test', () => {
  it('should prevent stale resume dialog after media navigation', async () => {
    // Scenario: User reads Ch10, navigates back to Ch7, exits app, returns

    // Step 1: User reads Ch10 to paragraph 50
    MMKVStorage.set('pendingTTSResumeChapterId', 10);
    MMKVStorage.set('lastTTSChapterId', 10);
    MMKVStorage.set('chapter_progress_10', 50);

    // Step 2: User navigates Ch10 -> Ch7 via media notification
    const { result } = renderHook(() => useTTSController(mockProps));

    await act(async () => {
      await result.current.onMediaAction({
        type: 'media-action',
        action: 'PREV_CHAPTER',
      });
    });

    // Step 3: Simulate app exit and return
    // (In real app, this would trigger resume dialog check)

    // Step 4: Check for pending resume flag
    const pendingResumeId = MMKVStorage.getNumber('pendingTTSResumeChapterId');

    // ✅ ASSERTION: No stale resume flag
    expect(pendingResumeId).toBeUndefined();

    // ✅ ASSERTION: Ch10 progress cleared
    expect(MMKVStorage.getNumber('chapter_progress_10')).toBeUndefined();

    // ✅ ASSERTION: ttsStateRef cleared
    expect(result.current.ttsStateRef.current).toBeNull();

    // ✅ RESULT: Resume dialog will NOT show stale data
  });
});
```

**Step 2: Run test to verify it passes**

```bash
pnpm test -- --testPathPattern="useTTSController.integration.test" --testNamePattern="prevent stale resume" --verbose
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts
git commit -m "test: add integration test for stale resume prevention"
```

---

## Task 5: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/TTS_STATE_CLEANUP_PLAN.md` (this file)

### Step 1: Update CLAUDE.md

Modify: `CLAUDE.md`

Add to "TTS Architecture" section:

```markdown
### TTS State Cleanup on Media Navigation

When user navigates chapters via media notification (PREV/NEXT):
- **Cleanup function:** `cleanupAllTTSState(chapterIds)`
- **Cleared from MMKV:** pendingTTSResumeChapterId, lastTTSChapterId, chapter_progress_*
- **Cleared from memory:** ttsStateRef, currentParagraphIndexRef, latestParagraphIndexRef
- **Purpose:** Prevents stale "resume" dialog confusion after chapter navigation
- **Location:** useTTSController.ts:329+ (cleanup function), integrated at lines 2335, 2450
```

### Step 2: Update this plan with completion status

Add to this file after implementation:

```markdown
## Implementation Status

- [x] Task 1: Create TTS State Cleanup Utility
- [x] Task 2: Integrate Cleanup in PREV_CHAPTER Handler
- [x] Task 3: Integrate Cleanup in NEXT_CHAPTER Handler
- [x] Task 4: Add Integration Test for Full User Flow
- [x] Task 5: Update Documentation

**Date Completed:** [DATE]
**Tests Passing:** 920+ (917 existing + 3 new)
```

**Step 3: Commit**

```bash
git add CLAUDE.md docs/TTS_STATE_CLEANUP_PLAN.md
git commit -m "docs: update CLAUDE.md with TTS state cleanup documentation"
```

---

## Task 6: Run Full Test Suite

### Step 1: Run all TTS tests

```bash
pnpm run test:tts-refill
```

Expected: All tests PASS

### Step 2: Run new media navigation tests

```bash
pnpm test -- --testPathPattern="mediaNav" --verbose
```

Expected: All 4+ new tests PASS

### Step 3: Run full test suite

```bash
pnpm run test
```

Expected: 920+ tests PASS (917 existing + 3+ new)

### Step 4: Type check

```bash
pnpm run type-check
```

Expected: No errors

### Step 5: Commit

```bash
git add .
git commit -m "test: all tests passing with TTS state cleanup implementation"
```

---

## Success Criteria

- [x] All MMKV TTS state cleared on media navigation
- [x] In-memory refs cleared on media navigation
- [x] Resume dialog no longer shows stale data
- [x] All existing tests still pass (917+)
- [x] New tests added and passing (4+)
- [x] Documentation updated

---

## Verification Commands

```bash
# Run new tests
pnpm test -- --testPathPattern="mediaNav" --verbose

# Run all TTS tests
pnpm run test:tts-refill

# Run full test suite
pnpm run test

# Type check
pnpm run type-check
```

---

## Notes

- **User intent:** Media notification navigation is always user-intentional
- **Safety:** Clearing all state is safe because user explicitly chose to navigate
- **Scope:** Only media notification handlers (PREV/NEXT) trigger full cleanup
- **In-app navigation:** Does NOT trigger full cleanup (different user intent)
- **Performance:** Cleanup is fast (synchronous MMKV deletes + ref resets)
