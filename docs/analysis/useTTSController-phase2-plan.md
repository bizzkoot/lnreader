# useTTSController - Phase 2 Extraction Plan

**Risk Level:** 🟡 MEDIUM  
**Expected Line Reduction:** ~330 lines (12% reduction after Phase 1)  
**Regression Risk:** MEDIUM (requires comprehensive testing)  
**Estimated Time:** 3-4 hours  
**Prerequisites:** Phase 1 complete with ALL tests passing

---

## Phase 2 Scope: Extract 6 MEDIUM-Risk Sections

1. **Chapter Change Effect** (`useChapterTransition.ts`) - 35 lines
2. **Total Paragraphs Effect** (`useTotalParagraphs.ts`) - 10 lines
3. **Back Handler** (`useBackHandler.ts`) - 95 lines
4. **Resume Dialog Handlers** (`useResumeDialogHandlers.ts`) - 70 lines
5. **TTS Confirmation Handler** (`useTTSConfirmationHandler.ts`) - 70 lines
6. **Chapter Selection Handler** (`useChapterSelectionHandler.ts`) - 70 lines

**Total Extraction:** ~350 lines

---

## Implementation Order

### Step 1: Extract Chapter Change Effect (Lines 389-422)
**File:** `src/screens/reader/hooks/useChapterTransition.ts`

**What to Extract:**
```typescript
useEffect(() => {
  console.log(
    `useTTSController: Chapter changed to ${chapter.id} (prev: ${prevChapterIdRef.current})`,
  );

  // Update chapter ID ref IMMEDIATELY
  prevChapterIdRef.current = chapter.id;

  // Set grace period timestamp to ignore stale save events from old chapter
  chapterTransitionTimeRef.current = Date.now();

  // Mark WebView as unsynced initially (new WebView loading)
  isWebViewSyncedRef.current = false;

  // Short delay to allow WebView to stabilize, then mark as synced
  const syncTimer = setTimeout(() => {
    isWebViewSyncedRef.current = true;
    console.log(
      `useTTSController: WebView marked as synced for chapter ${chapter.id}`,
    );

    // Clear media navigation tracking after successful transition
    if (mediaNavSourceChapterIdRef.current) {
      console.log(
        `useTTSController: Clearing media nav tracking (source: ${mediaNavSourceChapterIdRef.current})`,
      );
      // Small delay before clearing to allow confirmation logic to run
      setTimeout(() => {
        mediaNavSourceChapterIdRef.current = null;
        mediaNavDirectionRef.current = null;
      }, 2000);
    }
  }, 300);

  return () => clearTimeout(syncTimer);
}, [chapter.id]);
```

**New Hook Interface:**
```typescript
export interface ChapterTransitionParams {
  chapterId: number;
  refs: {
    prevChapterIdRef: RefObject<number>;
    chapterTransitionTimeRef: RefObject<number>;
    isWebViewSyncedRef: RefObject<boolean>;
    mediaNavSourceChapterIdRef: RefObject<number | null>;
    mediaNavDirectionRef: RefObject<MediaNavDirection>;
  };
}

export function useChapterTransition(params: ChapterTransitionParams): void {
  // Implementation with exact timing logic
}
```

**Why MEDIUM Risk:**
- Critical for chapter transition stability
- Grace period timing affects save event filtering
- Media nav tracking has dependent logic in onSpeechDone handler
- Timing-sensitive (300ms + 2000ms delays)

**Testing Focus:**
- Chapter navigation works correctly
- Media nav confirmation still triggers after 5 paragraphs
- Save events don't trigger during grace period
- WebView sync state transitions properly

---

### Step 2: Extract Total Paragraphs Effect (Lines 1693-1700)
**File:** `src/screens/reader/hooks/useTotalParagraphs.ts`

**What to Extract:**
```typescript
useEffect(() => {
  if (html) {
    const paragraphs = extractParagraphs(html);
    totalParagraphsRef.current = paragraphs?.length || 0;
    updateTtsMediaNotificationState(isTTSReadingRef.current);
  }
}, [html, updateTtsMediaNotificationState]);
```

**New Hook Interface:**
```typescript
export interface TotalParagraphsParams {
  html: string;
  updateTtsMediaNotificationState: (isPlaying: boolean) => void;
  refs: {
    totalParagraphsRef: RefObject<number>;
    isTTSReadingRef: RefObject<boolean>;
  };
}

export function useTotalParagraphs(params: TotalParagraphsParams): void {
  // Implementation
}
```

**Why MEDIUM Risk:**
- Couples paragraph extraction with notification update
- Notification depends on isTTSReadingRef
- Could cause desync if ordering is wrong

**Testing Focus:**
- Paragraph count updates when HTML changes
- Media notification updates after paragraph extraction
- No notification spam during chapter transitions

---

### Step 3: Extract Back Handler (Lines 917-1011)
**File:** `src/screens/reader/hooks/useBackHandler.ts`

**What to Extract:**
```typescript
const handleBackPress = useCallback((): boolean => {
  if (showExitDialog || showChapterSelectionDialog) {
    return false;
  }

  if (isTTSReadingRef.current) {
    const ttsPosition = currentParagraphIndexRef.current ?? 0;
    console.log(
      `useTTSController: Back pressed while TTS playing. Saving TTS position: ${ttsPosition}`,
    );

    handleStopTTS();
    saveProgress(ttsPosition);
    navigation.goBack();
    return true;
  }

  const lastTTSPosition = latestParagraphIndexRef.current ?? -1;

  if (lastTTSPosition > 0) {
    webViewRef.current?.injectJavaScript(`
      (function() {
        const visible = window.reader.getVisibleElementIndex ? window.reader.getVisibleElementIndex() : 0;
        const ttsIndex = ${lastTTSPosition};
        const GAP_THRESHOLD = 5;
        const nonce = window.__LNREADER_NONCE__;
        
        if (Math.abs(visible - ttsIndex) > GAP_THRESHOLD) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
             type: 'request-tts-exit', 
             data: { visible, ttsIndex },
             nonce,
          }));
        } else {
          window.ReactNativeWebView.postMessage(JSON.stringify({
             type: 'save',
             data: Math.round((ttsIndex / (reader.getReadableElements()?.length || 1)) * 100),
             paragraphIndex: ttsIndex,
             chapterId: ${chapter.id},
             nonce,
          }));
          window.ReactNativeWebView.postMessage(JSON.stringify({
             type: 'exit-allowed',
             nonce,
          }));
        }
      })();
      true;
    `);
    return true;
  }

  return false;
}, [
  showExitDialog,
  showChapterSelectionDialog,
  handleStopTTS,
  saveProgress,
  navigation,
  webViewRef,
  chapter.id,
]);
```

**New Hook Interface:**
```typescript
export interface BackHandlerParams {
  chapterId: number;
  webViewRef: RefObject<WebView | null>;
  saveProgress: (progress: number) => void;
  navigation: any;
  showExitDialog: boolean;
  showChapterSelectionDialog: boolean;
  refs: {
    isTTSReadingRef: RefObject<boolean>;
    currentParagraphIndexRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
  };
  callbacks: {
    handleStopTTS: () => void;
  };
}

export interface BackHandler {
  handleBackPress: () => boolean;
}

export function useBackHandler(params: BackHandlerParams): BackHandler {
  // Implementation
}
```

**Why MEDIUM Risk:**
- Complex conditional logic
- Multi-line WebView JavaScript injection
- TTS vs reader position comparison
- Triggers different flows (save/exit/show dialog)
- Uses GAP_THRESHOLD constant

**Testing Focus:**
- Back press while TTS playing saves TTS position
- Back press with gap > 5 shows exit dialog
- Back press with gap ≤ 5 saves and exits directly
- Back press while dialogs open doesn't handle

---

### Step 4: Extract Resume Dialog Handlers (Lines 559-624)
**File:** `src/screens/reader/hooks/useResumeDialogHandlers.ts`

**What to Extract:**
```typescript
const handleResumeConfirm = useCallback(() => {
  const mmkvValue =
    MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
  const refValue = latestParagraphIndexRef.current ?? -1;
  const savedIndex = pendingResumeIndexRef.current;
  const lastReadParagraph = Math.max(refValue, mmkvValue, savedIndex);

  pendingResumeIndexRef.current = lastReadParagraph;
  latestParagraphIndexRef.current = lastReadParagraph;

  const ttsState = chapter.ttsState ? JSON.parse(chapter.ttsState) : {};
  if (__DEV__) {
    console.log(
      'useTTSController: Resuming TTS. Resolved index:',
      lastReadParagraph,
      '(Ref:',
      refValue,
      'MMKV:',
      mmkvValue,
      'Prop:',
      savedIndex,
      ')',
    );
  }
  resumeTTS({
    ...ttsState,
    paragraphIndex: lastReadParagraph,
    timestamp: Date.now(),
  });
}, [chapter.id, chapter.ttsState, resumeTTS]);

const handleResumeCancel = useCallback(() => {
  webViewRef.current?.injectJavaScript(`
    window.tts.hasAutoResumed = true;
    window.tts.start();
  `);
}, [webViewRef]);

const handleRestartChapter = useCallback(() => {
  if (webViewRef.current) {
    webViewRef.current.injectJavaScript(`
      (function() {
        const elements = window.reader.getReadableElements();
        if (elements && elements.length > 0) {
          window.tts.start(elements[0]);
        } else {
          window.tts.start();
        }
      })();
    `);
  }
  hideResumeDialog();
}, [webViewRef, hideResumeDialog]);
```

**New Hook Interface:**
```typescript
export interface ResumeDialogHandlersParams {
  chapterId: number;
  chapterTtsState: string | null | undefined;
  webViewRef: RefObject<WebView | null>;
  refs: {
    pendingResumeIndexRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
  };
  callbacks: {
    resumeTTS: (state: TTSPersistenceState) => void;
    hideResumeDialog: () => void;
  };
}

export interface ResumeDialogHandlers {
  handleResumeConfirm: () => void;
  handleResumeCancel: () => void;
  handleRestartChapter: () => void;
}

export function useResumeDialogHandlers(params: ResumeDialogHandlersParams): ResumeDialogHandlers {
  // Implementation
}
```

**Why MEDIUM Risk:**
- Multi-source position resolution (MMKV, ref, prop)
- WebView JavaScript injection
- Mutates refs (pendingResumeIndexRef, latestParagraphIndexRef)
- Depends on resumeTTS utility

**Testing Focus:**
- Resume confirm resolves correct paragraph index from 3 sources
- Resume cancel starts from beginning
- Restart chapter starts from first readable element
- Position persists correctly

---

### Step 5: Extract TTS Confirmation Handler (Lines 721-790)
**File:** `src/screens/reader/hooks/useTTSConfirmationHandler.ts`

**What to Extract:**
```typescript
const handleRequestTTSConfirmation = useCallback(
  async (savedIndex: number) => {
    const currentRef = latestParagraphIndexRef.current;
    const timeSinceLastPause =
      Date.now() - (lastTTSPauseTimeRef.current || 0);
    const inGracePeriod = timeSinceLastPause < 3000;

    if (
      !inGracePeriod &&
      currentRef !== undefined &&
      currentRef >= 0 &&
      Math.abs(currentRef - savedIndex) > 5
    ) {
      console.log(
        `useTTSController: Smart Resume - User manually scrolled to ${currentRef}. Ignoring saved index ${savedIndex}.`,
      );
      handleResumeCancel();
      return;
    }

    try {
      const conflicts = await getRecentReadingChapters(novel.id, 4);
      const relevantConflicts = conflicts.filter(c => c.id !== chapter.id);

      if (relevantConflicts.length > 0) {
        const conflictsData = relevantConflicts.map(c => ({
          id: c.id,
          name: c.name || `Chapter ${c.chapterNumber}`,
          paragraph: MMKVStorage.getNumber(`chapter_progress_${c.id}`) || 0,
        }));

        setConflictingChapters(conflictsData);
        pendingResumeIndexRef.current = savedIndex;
        setShowChapterSelectionDialog(true);
        return;
      }
    } catch {
      // Ignore errors, proceed to start TTS
    }

    updateLastTTSChapter(chapter.id);
    pendingResumeIndexRef.current = savedIndex;
    showResumeDialog();
  },
  [
    novel.id,
    chapter.id,
    handleResumeCancel,
    updateLastTTSChapter,
    showResumeDialog,
  ],
);
```

**New Hook Interface:**
```typescript
export interface TTSConfirmationHandlerParams {
  novelId: number;
  chapterId: number;
  refs: {
    latestParagraphIndexRef: RefObject<number>;
    lastTTSPauseTimeRef: RefObject<number>;
    pendingResumeIndexRef: RefObject<number>;
  };
  callbacks: {
    handleResumeCancel: () => void;
    updateLastTTSChapter: (id: number) => void;
    showResumeDialog: () => void;
    setConflictingChapters: (chapters: ConflictingChapter[]) => void;
    setShowChapterSelectionDialog: (show: boolean) => void;
  };
}

export interface TTSConfirmationHandler {
  handleRequestTTSConfirmation: (savedIndex: number) => Promise<void>;
}

export function useTTSConfirmationHandler(params: TTSConfirmationHandlerParams): TTSConfirmationHandler {
  // Implementation
}
```

**Why MEDIUM Risk:**
- Smart Resume logic with grace period (3000ms)
- Gap threshold check (> 5 paragraphs)
- Async database query
- Conflict detection and dialog coordination
- Mutates pendingResumeIndexRef

**Testing Focus:**
- Smart Resume detects manual scrolling (> 5 gap, outside grace period)
- Conflict detection works when multiple chapters have progress
- No conflicts → shows resume dialog directly
- Conflicts → shows chapter selection dialog
- Grace period (< 3s after pause) skips Smart Resume check

---

### Step 6: Extract Chapter Selection Handler (Lines 792-858)
**File:** `src/screens/reader/hooks/useChapterSelectionHandler.ts`

**What to Extract:**
```typescript
const handleSelectChapter = useCallback(
  async (targetChapterId: number) => {
    setShowChapterSelectionDialog(false);

    if (targetChapterId === chapter.id) {
      if (chapter.position !== undefined) {
        await markChaptersBeforePositionRead(novel.id, chapter.position);
      }
      const resetMode =
        chapterGeneralSettingsRef.current.ttsForwardChapterReset || 'none';
      if (resetMode !== 'none') {
        await resetFutureChaptersProgress(novel.id, chapter.id, resetMode);
        showToastMessage(`Future progress reset: ${resetMode}`);
      }

      updateLastTTSChapter(chapter.id);

      if (pendingResumeIndexRef.current >= 0) {
        showResumeDialog();
      }
    } else {
      const targetChapter = await getChapterFromDb(targetChapterId);
      if (targetChapter) {
        if (targetChapter.position !== undefined) {
          await markChaptersBeforePositionRead(
            novel.id,
            targetChapter.position,
          );
        }
        const resetMode =
          chapterGeneralSettingsRef.current.ttsForwardChapterReset || 'none';
        if (resetMode !== 'none') {
          await resetFutureChaptersProgress(
            novel.id,
            targetChapter.id,
            resetMode,
          );
        }

        updateLastTTSChapter(targetChapter.id);
        getChapter(targetChapter);
      }
    }
  },
  [
    novel.id,
    chapter.id,
    chapter.position,
    chapterGeneralSettingsRef,
    showToastMessage,
    updateLastTTSChapter,
    showResumeDialog,
    getChapter,
  ],
);
```

**New Hook Interface:**
```typescript
export interface ChapterSelectionHandlerParams {
  novelId: number;
  chapter: ChapterInfo;
  chapterGeneralSettingsRef: RefObject<ChapterGeneralSettings>;
  showToastMessage: (message: string) => void;
  getChapter: (chapter: ChapterInfo) => void;
  refs: {
    pendingResumeIndexRef: RefObject<number>;
  };
  callbacks: {
    updateLastTTSChapter: (id: number) => void;
    showResumeDialog: () => void;
    setShowChapterSelectionDialog: (show: boolean) => void;
  };
}

export interface ChapterSelectionHandler {
  handleSelectChapter: (targetChapterId: number) => Promise<void>;
}

export function useChapterSelectionHandler(params: ChapterSelectionHandlerParams): ChapterSelectionHandler {
  // Implementation
}
```

**Why MEDIUM Risk:**
- Complex async flow with multiple database operations
- Two distinct branches (current chapter vs different chapter)
- Progress reset logic based on settings
- Triggers navigation to different chapter
- Error handling for missing chapters

**Testing Focus:**
- Selecting current chapter marks previous chapters read
- Selecting different chapter navigates correctly
- Future chapter reset works (none, unread, all)
- Resume dialog shows after selecting current chapter (if pending index ≥ 0)
- Missing target chapter handled gracefully

---

## Post-Extraction Changes in useTTSController.ts

### Updated Imports
```typescript
// Add Phase 2 imports
import { useChapterTransition } from './useChapterTransition';
import { useTotalParagraphs } from './useTotalParagraphs';
import { useBackHandler } from './useBackHandler';
import { useResumeDialogHandlers } from './useResumeDialogHandlers';
import { useTTSConfirmationHandler } from './useTTSConfirmationHandler';
import { useChapterSelectionHandler } from './useChapterSelectionHandler';
```

### Usage Pattern
```typescript
export function useTTSController(params: UseTTSControllerParams): UseTTSControllerReturn {
  // ... Phase 1 hooks (dialogState, utilities, etc.)
  
  // ✅ NEW: Replace lines 389-422 with chapter transition hook
  useChapterTransition({
    chapterId: chapter.id,
    refs: {
      prevChapterIdRef,
      chapterTransitionTimeRef,
      isWebViewSyncedRef,
      mediaNavSourceChapterIdRef,
      mediaNavDirectionRef,
    },
  });
  
  // ... Background TTS Effect (Lines 424-598) - UNCHANGED
  
  // ✅ NEW: Replace lines 559-624 with resume dialog handlers
  const resumeDialogHandlers = useResumeDialogHandlers({
    chapterId: chapter.id,
    chapterTtsState: chapter.ttsState,
    webViewRef,
    refs: {
      pendingResumeIndexRef,
      latestParagraphIndexRef,
    },
    callbacks: {
      resumeTTS: utilities.resumeTTS,
      hideResumeDialog: dialogState.hideResumeDialog,
    },
  });
  
  // ✅ NEW: Replace lines 721-790 with TTS confirmation handler
  const ttsConfirmationHandler = useTTSConfirmationHandler({
    novelId: novel.id,
    chapterId: chapter.id,
    refs: {
      latestParagraphIndexRef,
      lastTTSPauseTimeRef,
      pendingResumeIndexRef,
    },
    callbacks: {
      handleResumeCancel: resumeDialogHandlers.handleResumeCancel,
      updateLastTTSChapter: utilities.updateLastTTSChapter,
      showResumeDialog: dialogState.showResumeDialog,
      setConflictingChapters: dialogState.setConflictingChapters,
      setShowChapterSelectionDialog: dialogState.setShowChapterSelectionDialog,
    },
  });
  
  // ✅ NEW: Replace lines 792-858 with chapter selection handler
  const chapterSelectionHandler = useChapterSelectionHandler({
    novelId: novel.id,
    chapter,
    chapterGeneralSettingsRef,
    showToastMessage,
    getChapter,
    refs: {
      pendingResumeIndexRef,
    },
    callbacks: {
      updateLastTTSChapter: utilities.updateLastTTSChapter,
      showResumeDialog: dialogState.showResumeDialog,
      setShowChapterSelectionDialog: dialogState.setShowChapterSelectionDialog,
    },
  });
  
  // ✅ NEW: Replace lines 917-1011 with back handler
  const backHandler = useBackHandler({
    chapterId: chapter.id,
    webViewRef,
    saveProgress,
    navigation,
    showExitDialog: dialogState.showExitDialog,
    showChapterSelectionDialog: dialogState.showChapterSelectionDialog,
    refs: {
      isTTSReadingRef,
      currentParagraphIndexRef,
      latestParagraphIndexRef,
    },
    callbacks: {
      handleStopTTS: manualModeHandlers.handleStopTTS,
    },
  });
  
  // ... WebView Message Handler (Lines 1013-1354) - UNCHANGED
  // ... WebView Load End Handler (Lines 1356-1691) - UNCHANGED
  
  // ✅ NEW: Replace lines 1693-1700 with total paragraphs hook
  useTotalParagraphs({
    html,
    updateTtsMediaNotificationState: utilities.updateTtsMediaNotificationState,
    refs: {
      totalParagraphsRef,
      isTTSReadingRef,
    },
  });
  
  // ... Native Event Listeners (Lines 1702-2629) - UNCHANGED
  
  // ✅ UPDATED: Return value uses Phase 2 extracted hooks
  return {
    // ... Phase 1 returns
    
    // Resume dialog handlers
    handleResumeConfirm: resumeDialogHandlers.handleResumeConfirm,
    handleResumeCancel: resumeDialogHandlers.handleResumeCancel,
    handleRestartChapter: resumeDialogHandlers.handleRestartChapter,
    
    // TTS confirmation
    handleRequestTTSConfirmation: ttsConfirmationHandler.handleRequestTTSConfirmation,
    
    // Chapter selection
    handleSelectChapter: chapterSelectionHandler.handleSelectChapter,
    
    // Back handler
    handleBackPress: backHandler.handleBackPress,
    
    // ... rest unchanged
  };
}
```

---

## Testing Strategy

### 1. Type Safety Check
```bash
pnpm run type-check
```
**Expected:** Zero TypeScript errors

### 2. Linting
```bash
pnpm run lint
```
**Expected:** No new lint errors

### 3. Unit Tests
```bash
pnpm test
```
**Expected:** All tests pass (241/241)

### 4. Integration Test Checklist

#### Chapter Transition
- [ ] Chapter ID ref updates immediately on chapter change
- [ ] Grace period prevents stale save events (< 1s after transition)
- [ ] WebView sync state transitions (unsynced → synced after 300ms)
- [ ] Media nav tracking clears after successful transition (after 2000ms delay)

#### Total Paragraphs
- [ ] Paragraph count updates when HTML changes
- [ ] Media notification updates after extraction
- [ ] No notification spam during chapter loads

#### Back Handler
- [ ] Back while TTS playing saves TTS position and exits
- [ ] Back with TTS/reader gap > 5 shows exit dialog
- [ ] Back with TTS/reader gap ≤ 5 saves directly and exits
- [ ] Back with dialogs open doesn't handle (returns false)

#### Resume Dialog
- [ ] Resume confirm resolves max(ref, MMKV, prop) correctly
- [ ] Resume cancel starts from paragraph 0
- [ ] Restart chapter starts from first readable element

#### TTS Confirmation
- [ ] Smart Resume detects manual scrolling (gap > 5, no grace period)
- [ ] Grace period (< 3s after pause) bypasses Smart Resume
- [ ] Conflict detection shows chapter selection dialog
- [ ] No conflicts shows resume dialog directly

#### Chapter Selection
- [ ] Select current chapter marks previous chapters read
- [ ] Select different chapter navigates correctly
- [ ] Future chapter reset works (none, unread, all)
- [ ] Resume dialog shows after selecting current chapter (if pending)

### 5. Full TTS Flow Test

**Test Scenario 1: Fresh TTS Start**
1. Open chapter with no previous TTS state
2. Start TTS → should show chapter selection if conflicts exist
3. Select chapter → should show resume dialog (or start from 0)
4. Confirm resume → TTS starts from resolved position

**Test Scenario 2: Resume with Manual Scroll**
1. Start TTS, pause at paragraph 50
2. Manually scroll to paragraph 80
3. Wait > 3s (outside grace period)
4. Resume TTS → should start from paragraph 80 (Smart Resume bypassed)

**Test Scenario 3: Resume within Grace Period**
1. Start TTS, pause at paragraph 50
2. Manually scroll to paragraph 80
3. Within 3s, resume TTS
4. Should show Smart Resume detection (gap = 30 > 5)

**Test Scenario 4: Chapter Navigation During TTS**
1. Start TTS in Chapter 1
2. NEXT chapter via media controls
3. Verify grace period active (no stale saves)
4. Verify WebView sync state transitions
5. Verify media nav confirmation after 5 paragraphs

**Test Scenario 5: Back Press Scenarios**
- Back while TTS playing → saves TTS position
- Back with gap > 5 → shows exit dialog
- Back with gap ≤ 5 → saves and exits
- Back with exit dialog open → doesn't handle

---

## Rollback Plan

Same as Phase 1:

1. **Identify the problematic extraction**
2. **Revert the specific hook file**
3. **Restore original code in useTTSController.ts**
4. **Run tests to confirm**

```bash
# Revert specific Phase 2 file
git checkout HEAD -- src/screens/reader/hooks/useChapterTransition.ts

# Revert useTTSController.ts if needed
git checkout HEAD -- src/screens/reader/hooks/useTTSController.ts

# Run tests
pnpm test
```

---

## Success Criteria

✅ All 6 Phase 2 hooks created and imported  
✅ useTTSController.ts reduced by additional ~330 lines  
✅ Total reduction: ~725 lines (26% from original 2797)  
✅ Zero TypeScript errors  
✅ Zero new lint errors  
✅ All 241 tests passing  
✅ Full TTS flow test passes (5 scenarios)  
✅ Device testing shows no behavioral changes  

---

## Risk Mitigation

### Medium Risk Sections - Extra Validation

1. **Chapter Transition Effect**
   - Validate timing: 300ms sync + 2000ms clear
   - Test grace period filtering in native event listeners
   - Verify media nav confirmation still works

2. **Back Handler**
   - Test all 4 code paths (TTS playing, gap > 5, gap ≤ 5, dialogs open)
   - Verify WebView JavaScript injection syntax
   - Check GAP_THRESHOLD constant usage

3. **Resume Dialog Handlers**
   - Test 3-way max resolution (ref, MMKV, prop)
   - Verify pendingResumeIndexRef mutations don't break
   - Check WebView injection syntax

4. **TTS Confirmation Handler**
   - Test Smart Resume logic (grace period + gap threshold)
   - Verify conflict detection async flow
   - Check pendingResumeIndexRef mutations

5. **Chapter Selection Handler**
   - Test both branches (current vs different chapter)
   - Verify async database operations
   - Check progress reset modes (none, unread, all)

### Dependency Order

Phase 2 extractions have dependencies:

1. **Extract Resume Dialog Handlers FIRST**
   - Required by: TTS Confirmation Handler

2. **Extract TTS Confirmation Handler SECOND**
   - Depends on: Resume Dialog Handlers
   - Required by: WebView Message Handler

3. **Extract Chapter Selection Handler THIRD**
   - Depends on: Resume Dialog Handlers, TTS Confirmation Handler

4. **Extract Back Handler FOURTH**
   - Depends on: Manual Mode Handlers (Phase 1)

5. **Extract Chapter Transition & Total Paragraphs LAST**
   - Independent effects, can be done in any order

---

## Notes for Phase 2

- **Extract in dependency order** (1 → 6)
- **Test comprehensively after each extraction**
- **Phase 2 is MEDIUM risk** - regressions are possible
- **Device testing is CRITICAL** for Phase 2
- **If ANY regression occurs, STOP and rollback**
- **Document any issues for future reference**

**Phase 2 is optional** - Phase 1 alone provides good value (14% reduction, LOW risk). Only proceed with Phase 2 if:
- Phase 1 was successful
- All tests passing
- Team has capacity for thorough testing
- Device testing is available

---

## Post-Phase 2 State

After Phase 2 completion:

**useTTSController.ts Size:**
- Original: 2797 lines
- After Phase 1: ~2402 lines (14% reduction)
- After Phase 2: ~2072 lines (26% total reduction)

**Remaining in useTTSController.ts (64%):**
- TTS State Refs (foundation)
- Background TTS Effect (critical)
- WebView Message Handler (central hub)
- WebView Load End Handler (orchestration)
- Native Event Listeners Effect (heart of system)
- Return value (interface)

**These sections SHOULD NOT be extracted** - they are the core TTS controller logic and belong together.

---

## Recommendation

Phase 2 provides diminishing returns:
- **Phase 1:** 14% reduction, LOW risk ✅ HIGH VALUE
- **Phase 2:** 12% additional reduction, MEDIUM risk ⚠️ MEDIUM VALUE

**Alternative to Phase 2:**
Instead of extracting more code, consider:
1. Adding comprehensive inline documentation to remaining sections
2. Creating architectural diagrams for event flow
3. Writing integration tests for complex flows
4. Accepting that ~64% is the irreducible core

**Proceed with Phase 2 ONLY if:**
- Phase 1 is stable and all tests pass
- Team agrees the value justifies the risk
- Comprehensive testing resources are available
- Device testing can be performed

**Estimated Completion:** 3-4 hours for extraction + comprehensive testing
