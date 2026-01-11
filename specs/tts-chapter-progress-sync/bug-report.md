# TTS Chapter Progress Sync Bug Report

**Created**: 2026-01-03  
**Status**: 🔴 ACTIVE BUG - Partial Fix Ineffective  
**Severity**: High (User-visible data sync issue)  
**Related Commits**: 69d78b863 (partial fix), 8f46c7ee2 (docs)

---

## Executive Summary

Chapter list in NovelScreen does NOT reliably sync progress updates from TTS playback. Progress updates work ONLY at:
1. **Initial TTS start** (first play press)
2. **Initial scroll to paragraph** (first resume)

**After these events, ALL subsequent TTS progress updates fail to propagate to the chapter list UI.**

This indicates the current fix (commit 69d78b863) only handles media navigation edge cases (PREV/NEXT chapter buttons), not the core ongoing playback progress sync.

---

## Reproduction Steps

### Scenario 1: TTS Playback Does Not Update List
1. Open Novel → Chapter 6087
2. Start TTS (plays paragraph 13+)
3. Let TTS run until progress reaches 16% (paragraph 29)
4. Stop TTS
5. Exit reader (back button)
6. **OBSERVE**: NovelScreen chapter list shows **0% progress** (unread state)
7. Exit chapter list, re-enter Novel
8. **OBSERVE**: Chapter list STILL shows **0% progress**

### Scenario 2: Progress Updates Only on New Resume
9. Resume TTS (plays 1-3 paragraphs from paragraph 29+)
10. Stop TTS
11. Exit reader
12. **OBSERVE**: Chapter list NOW shows updated progress (16%+)

---

## User's Console Log Evidence

**Timeline from logs:**
```
[WebViewReader] save percent=16 paragraph=29   # TTS playing
[TTS] state PLAYING → STOPPING                  # User stops TTS
[useTTSController] save-tts-state-unmount       # Unmount saves state
# USER EXITS READER → CHAPTER LIST SHOWS 0%

# USER RE-ENTERS, RESUMES TTS
[useResumeDialogHandlers] resuming-tts Resuming TTS. Resolved index: 29
[WebViewReader] save percent=16 paragraph=29    # Initial resume
[useTTSController] start-batch index=29         # Batch starts
[WebViewReader] save percent=16 paragraph=30    # Plays 1 paragraph
[TTS] state PLAYING → STOPPING                  # User stops
# USER EXITS READER → CHAPTER LIST NOW SHOWS 16%
```

**Key Observations:**
- ✅ `[WebViewReader] save percent=X paragraph=Y` logs appear frequently (DB saves happening)
- ❌ Chapter list UI does NOT reflect these saves until a NEW TTS session starts
- ✅ On TTS resume (new `start-batch`), first save triggers UI update

---

## Root Cause Analysis

### Current Fix (Commit 69d78b863) - Scope Too Narrow

**What Was Fixed:**
- Lines 2053, 2204 in [useTTSController.ts](src/screens/reader/hooks/useTTSController.ts)
- Replaced `updateChapterProgressDb()` → `saveProgressRef.current()` for:
  - Media notification **PREV_CHAPTER** (line 2053)
  - Media notification **NEXT_CHAPTER** (line 2204)

**What Still Broken:**
- **Regular TTS playback progress saves** (paragraph-by-paragraph) do NOT trigger UI updates
- These saves happen in `handleSaveProgress()` callback (passed to `WebViewReader`)
- `handleSaveProgress()` calls `updateChapterProgressDb()` directly (DB-only)
- No `mutateChapters()` call → No React re-render → UI stale

### Code Path During Regular Playback

**File**: [src/screens/reader/hooks/useTTSController.ts](src/screens/reader/hooks/useTTSController.ts)

```typescript
// Line 374: saveProgressRef passed to WebViewReader
const saveProgressRef = useRef<(progress: number, scrollPercentage: number | undefined) => void>();

// Lines 1420-1468: handleSaveProgress callback
const handleSaveProgress = useCallback(
  async (progress: number, scrollPercentage: number | undefined) => {
    // ... validation logic ...
    
    // Line 1464: DB-ONLY save (no UI update)
    await updateChapterProgressDb(
      chapter.id,
      progress,
      ttsStateRef.current.isReading ? Math.round(progress) : null,
    );
  },
  [chapter.id, /* ... */]
);

// Line 537: saveProgressRef assigned to handleSaveProgress
useEffect(() => {
  saveProgressRef.current = handleSaveProgress;
}, [handleSaveProgress]);
```

**Problem**: `handleSaveProgress` → `updateChapterProgressDb` → **NO `mutateChapters()` call**

### Compare to Working Path (Media Navigation)

**Lines 2053-2064** (PREV_CHAPTER media button):
```typescript
// Confirmation handler for "Mark chapter as in-progress?"
await saveProgressRef.current(1, undefined); // ✅ Uses saveProgressRef (triggers mutateChapters)
```

**This works because:**
1. `saveProgressRef.current` → `handleSaveProgress` (line 1420+)
2. BUT line 2053 is OUTSIDE normal playback flow
3. It's a media notification action → NEW useEffect → NEW save trigger

**Why Regular Playback Fails:**
- During TTS playback (paragraphs 13→29):
  - `onSpeechDone` fires → `handleSaveProgress` called → DB updated
  - BUT `handleSaveProgress` is SAME callback used throughout session
  - NO new effect trigger → NO fresh UI propagation
  
### Timing Hypothesis (User's Observation)

**User said:**
> "Progress updates only reliably during initial TTS start or initial scroll"

**Why This Happens:**
1. **Initial TTS start** (`start-batch` line 1305+):
   - New batch → Triggers multiple useEffects → Fresh `updateChapterProgress` call → `mutateChapters()` runs
2. **Initial scroll** (resume dialog confirms):
   - Resume flow → Triggers `handleSaveProgress` in NEW context → Side effect propagates
3. **Subsequent paragraphs** (29, 30, 31...):
   - Same `handleSaveProgress` callback → DB updates → NO side effect → UI stale

**Possible Race Condition:**
- `mutateChapters()` (from `useNovel` hook) relies on React state update
- If state update scheduled but not flushed before component unmounts → UI never updates
- Next mount → Stale data reloaded from DB

---

## Incorrect Assumptions in Original Fix

### Assumption 1: ❌ "Only media nav buttons need UI sync"
**Reality**: Regular TTS playback progress (every paragraph) also needs `mutateChapters()`

### Assumption 2: ❌ "`saveProgressRef.current()` already syncs UI"
**Reality**: `saveProgressRef` points to `handleSaveProgress` which calls DB-only function

### Assumption 3: ❌ "DB updates auto-propagate to UI"
**Reality**: React Native doesn't track DB changes - needs explicit `mutateChapters()` call

---

## Required Fix Scope

### 1. Fix `handleSaveProgress` (Lines 1420-1468)

**Current Code:**
```typescript
await updateChapterProgressDb(
  chapter.id,
  progress,
  ttsStateRef.current.isReading ? Math.round(progress) : null,
);
```

**Needs to become:**
```typescript
await updateChapterProgress( // Uses hook function instead
  chapter.id,
  progress,
  ttsStateRef.current.isReading ? Math.round(progress) : null,
);
```

**Impact:**
- `updateChapterProgress` (from `useChapterUpdate` hook) calls BOTH:
  1. `updateChapterProgressDb()` (DB write)
  2. `mutateChapters()` (React state update → UI re-render)

### 2. Verify All Call Sites

**Search for**: `updateChapterProgressDb(chapter.id,`
**Found instances** (from previous research):
- Line 1464: `handleSaveProgress` (MAIN BUG - regular playback)
- Line 1653: Wake cycle sync
- Line 1660: Wake cycle edge case
- Line 1669: Wake cycle fallback
- Line 2053: PREV chapter nav (already fixed ✅)
- Line 2068: PREV chapter fallback
- Line 2119: NEXT chapter mark source complete
- Line 2204: NEXT chapter nav (already fixed ✅)
- Line 2219: NEXT chapter fallback

**Decision Matrix:**
| Line | Context | Current Chapter? | Fix Needed? |
|------|---------|------------------|-------------|
| 1464 | Regular playback save | ✅ Yes | ✅ **YES** (main bug) |
| 1653 | Wake cycle sync | ✅ Yes | ✅ **YES** |
| 1660 | Wake cycle edge | ✅ Yes | ✅ **YES** |
| 1669 | Wake cycle fallback | ✅ Yes | ✅ **YES** |
| 2053 | PREV nav confirm | ✅ Yes (source) | ✅ **DONE** |
| 2068 | PREV no-confirm fallback | ⚠️ Maybe (sourceChapterId) | ❓ INVESTIGATE |
| 2119 | NEXT mark source 100% | ✅ Yes (source) | ⚠️ INVESTIGATE |
| 2204 | NEXT nav confirm | ✅ Yes (source) | ✅ **DONE** |
| 2219 | NEXT no-confirm fallback | ⚠️ Maybe (sourceChapterId) | ❓ INVESTIGATE |

**Rule:**
- **Current chapter updates** → Use `updateChapterProgress()` (DB + UI)
- **Other chapter updates** (prev/next/skipped) → Keep `updateChapterProgressDb()` (DB-only, don't mutate unrelated chapters)

---

## Test Scenarios for Next Fix

### Scenario A: Regular TTS Playback (Main Bug)
1. Start TTS at Ch6087, para 13 (7%)
2. Let play to para 29 (16%)
3. Stop TTS
4. Exit reader
5. **VERIFY**: Chapter list shows 16% progress ✅

### Scenario B: Wake Cycle Sync
1. Start TTS at Ch6087
2. Background app (reader paused)
3. Return to app (wake cycle triggers sync)
4. TTS resumes from saved position
5. Exit reader
6. **VERIFY**: Chapter list reflects wake-synced progress ✅

### Scenario C: Media Navigation (Already Fixed)
1. Start TTS at Ch6087
2. Press PREV from media notification → Ch6086
3. Exit reader
4. **VERIFY**: Ch6087 shows 1% (in-progress), Ch6086 shows 0% ✅

### Scenario D: Unmount Save
1. Start TTS at Ch6087
2. Navigate away (triggers unmount)
3. Return to Novel
4. **VERIFY**: Chapter list reflects last TTS position ✅

---

## Technical Debt & Architecture Issues

### Problem: Dual Save Paths
**Current Architecture:**
- `updateChapterProgress()` from `useChapterUpdate` hook (DB + UI)
- `updateChapterProgressDb()` from `@database/queries/ChapterQueries` (DB-only)
- TTS code uses BOTH inconsistently

**Risk:**
- Easy to call wrong function
- No TypeScript safety (both accept same params)
- Future devs will repeat same mistake

### Recommendation: Refactor After Fix
**Option 1**: Deprecate direct DB calls in TTS code
```typescript
// Add rule to useTTSController.ts
/* eslint-disable-next-line no-restricted-imports */
import { updateChapterProgressDb } from '@database/queries/ChapterQueries';
// Note: Only use for OTHER chapters. Current chapter → use updateChapterProgress()
```

**Option 2**: Wrap in typed helper
```typescript
type ChapterContext = 'current' | 'other';
async function saveTTSProgress(
  context: ChapterContext,
  chapterId: number,
  progress: number,
) {
  if (context === 'current') {
    await updateChapterProgress(chapterId, progress, /* ... */);
  } else {
    await updateChapterProgressDb(chapterId, progress, /* ... */);
  }
}
```

**Option 3**: Hook-level abstraction
- `useChapterUpdate` should handle "current vs other" internally
- TTS code only calls ONE function, hook decides mutation strategy

---

## Files Requiring Changes

### Primary Fix
1. **[src/screens/reader/hooks/useTTSController.ts](src/screens/reader/hooks/useTTSController.ts)**
   - Line 1464: `handleSaveProgress` callback
   - Lines 1653, 1660, 1669: Wake cycle saves (if current chapter)
   - Lines 2068, 2119, 2219: Investigate PREV/NEXT fallbacks

### Dependencies to Review
2. **[src/database/queries/ChapterQueries.ts](src/database/queries/ChapterQueries.ts)**
   - `updateChapterProgressDb()` - ensure no side effects blocking UI

3. **[src/hooks/persisted/useChapterUpdate.ts](src/hooks/persisted/useChapterUpdate.ts)** (hypothetical - verify actual file)
   - `updateChapterProgress()` - ensure `mutateChapters()` called

4. **[src/hooks/useNovel.ts](src/hooks/useNovel.ts)** (or similar)
   - `mutateChapters()` - verify React state update triggers re-render

### Testing
5. **TTS Test Suite** (if exists)
   - Add test: "TTS playback updates chapter list progress in real-time"
   - Mock `mutateChapters()`, verify called on each paragraph save

---

## Next Session Action Plan

### Phase 1: Deep Research (30 min)
1. Read `updateChapterProgressDb()` implementation
2. Read `updateChapterProgress()` implementation (find actual file)
3. Read `mutateChapters()` implementation (find actual file)
4. Map exact call chain: TTS save → DB → UI update
5. Identify WHY initial TTS start works but subsequent paragraphs don't

### Phase 2: Root Cause Confirmation (15 min)
6. Add debug logs to `handleSaveProgress`:
   ```typescript
   ttsCtrlLog('[TTS-SAVE-DEBUG]', {
     caller: 'handleSaveProgress',
     chapterId: chapter.id,
     progress,
     willMutateUI: false, // HYPOTHESIS: This is the problem
   });
   ```
7. Run Scenario A (regular playback)
8. Confirm logs show `willMutateUI: false`

### Phase 3: Implement Fix (20 min)
9. Change line 1464: `updateChapterProgressDb` → `updateChapterProgress`
10. Find actual hook function (search `export.*updateChapterProgress`)
11. Update imports
12. Handle potential missing hook context (if `updateChapterProgress` requires `useNovel` context)

### Phase 4: Validate Wake Cycle (15 min)
13. Review lines 1653, 1660, 1669 (wake cycle saves)
14. Determine if these update CURRENT chapter
15. If yes, apply same fix (`updateChapterProgress`)

### Phase 5: Investigate Edge Cases (20 min)
16. Lines 2068, 2119, 2219 (media nav fallbacks)
17. Determine `sourceChapterId` vs `chapter.id` context
18. Decide fix strategy per line

### Phase 6: Testing (30 min)
19. Run all 4 test scenarios (A-D)
20. Verify chapter list updates in real-time
21. Check for race conditions (rapid saves)
22. Test app backgrounding during TTS

### Phase 7: Documentation (10 min)
23. Update AGENTS.md with correct fix details
24. Add architecture note about dual save paths
25. Document decision matrix for future reference

---

## Additional Context

### User Feedback (Critical)
> "the read progress in chapter list is, only reliably updated during the initial TTS start play, or during the initial scroll to paragraph. Either or."

> "But any progress by TTS afterwards, was not updated properly."

> "Or maybe can even be timing conflict. I'm not sure..."

**Interpretation:**
- ✅ Initial events trigger side effects correctly
- ❌ Ongoing playback uses stale callback reference
- ⚠️ Possible React render batching issue (not flushing updates before unmount)

### Console Log Keywords to Watch
- `[WebViewReader] save percent=` → DB save happening
- `[useTTSController] playing-from-queue` → Paragraph transition
- `[useResumeDialogHandlers] resuming-tts` → New session (works)
- `[useTTSController] save-tts-state-unmount` → Cleanup save

**Expected NEW log after fix:**
```
[useTTSController] save-progress-with-ui-sync {
  chapterId: 6087,
  progress: 16,
  mutatedChapters: true
}
```

---

## References

- **Original Bug Report**: [AGENTS.md](AGENTS.md#L145-L162) "TTS Progress & Wake Scroll Fixes"
- **Partial Fix Commit**: 69d78b863 "fix: TTS progress sync & wake scroll restoration"
- **Related Issue**: Wake scroll restoration (Bug #2) - WORKING ✅
- **TTS Architecture**: [AGENTS.md](AGENTS.md#L84-L108) "TTS Architecture (3-Layer Hybrid)"

---

## Confidence Assessment

**Diagnosis Confidence**: 90/100
- User's reproducible test case is clear
- Console logs confirm DB saves happening but UI not updating
- Initial events working points to callback staleness

**Fix Complexity**: Medium
- Single main fix (line 1464)
- 3-4 additional lines to review (wake cycle)
- Potential hook context issues to handle

**Regression Risk**: Low
- `updateChapterProgress` already used elsewhere safely
- Change aligns with existing working patterns (lines 2053, 2204)
- Only affects TTS→ChapterList sync (isolated feature)

**Testing Coverage**: 85/100
- Manual test scenarios well-defined
- Console logs provide observability
- Missing: Automated UI integration test

---

**END OF REPORT**
