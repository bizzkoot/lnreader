# useTTSController - Phase 2 Extraction Plan (REVISED)

**Risk Level:** 🟡 MEDIUM  
**Expected Line Reduction:** ~330 lines (12% reduction after Phase 1)  
**Regression Risk:** MEDIUM (requires comprehensive testing)  
**Estimated Time:** 4-5 hours (includes incremental testing)  
**Prerequisites:** Phase 1 complete with ALL tests passing ✅

**Based on**: Phase 1 success + Phase 2 review document

---

## Phase 2 Scope: Extract 5 MEDIUM-Risk Sections

**REVISED EXTRACTION ORDER** (Dependency-First):

1. **Chapter Transition Effect** (`useChapterTransition.ts`) - 35 lines - **INDEPENDENT**
2. **Resume Dialog Handlers** (`useResumeDialogHandlers.ts`) - 70 lines - **DEPENDS ON: Phase 1 only**
3. **TTS Confirmation Handler** (`useTTSConfirmationHandler.ts`) - 70 lines - **DEPENDS ON: #2**
4. **Chapter Selection Handler** (`useChapterSelectionHandler.ts`) - 70 lines - **DEPENDS ON: #2, #3**
5. **Back Handler** (`useBackHandler.ts`) - 95 lines - **DEPENDS ON: Phase 1 manualModeHandlers**

~~6. **Total Paragraphs Effect** - SKIPPED (too small, 10 lines)~~

**Total Extraction:** ~340 lines

---

## 🔴 CRITICAL: Extraction Dependencies

```
INDEPENDENT:
├── useChapterTransition (Step 1)

DEPENDS ON PHASE 1 ONLY:
├── useResumeDialogHandlers (Step 2)
    ├── Needs: utilities.resumeTTS (Phase 1)
    ├── Needs: dialogState.hideResumeDialog (Phase 1)

DEPENDS ON PHASE 1 + STEP 2:
├── useTTSConfirmationHandler (Step 3)
    ├── Needs: resumeDialogHandlers.handleResumeCancel (Step 2) ← KEY DEPENDENCY
    ├── Needs: utilities.updateLastTTSChapter (Phase 1)
    ├── Needs: dialogState.* (Phase 1)

DEPENDS ON PHASE 1 + STEPS 2-3:
├── useChapterSelectionHandler (Step 4)
    ├── Needs: utilities.updateLastTTSChapter (Phase 1)
    ├── Needs: dialogState.showResumeDialog (Phase 1)
    ├── Needs: Indirectly uses Step 2-3 outputs

DEPENDS ON PHASE 1 ONLY:
└── useBackHandler (Step 5)
    ├── Needs: manualModeHandlers.handleStopTTS (Phase 1)
    ├── Needs: dialogState.showExitDialog (Phase 1)
```

**CRITICAL**: Extract in order 1 → 2 → 3 → 4 → 5. Do NOT change order.

---

## Step 1: Extract Chapter Transition Effect

**File:** `src/screens/reader/hooks/useChapterTransition.ts`  
**Lines:** 389-422 (35 lines)  
**Dependencies:** NONE (Independent effect)  
**Risk:** 🟡 MEDIUM (timing-sensitive)

### Code to Extract:

```typescript
/**
 * useChapterTransition Hook
 *
 * Manages chapter ID transitions, grace periods, and WebView sync state.
 * 
 * @module reader/hooks/useChapterTransition
 * @dependencies NONE (Independent effect)
 */

import { useEffect, RefObject } from 'react';

/**
 * Media navigation direction for confirmation logic
 */
export type MediaNavDirection = 'prev' | 'next' | null;

/**
 * Chapter transition parameters
 * 
 * @property chapterId - Current chapter ID (from: useTTSController props)
 * @property refs - Mutable refs for transition tracking
 *   - prevChapterIdRef: Previous chapter ID (from: useTTSController local)
 *   - chapterTransitionTimeRef: Grace period timestamp (from: useTTSController local)
 *   - isWebViewSyncedRef: WebView sync state (from: useTTSController local)
 *   - mediaNavSourceChapterIdRef: Media nav source chapter (from: useTTSController local)
 *   - mediaNavDirectionRef: Media nav direction (from: useTTSController local)
 */
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

/**
 * Hook to manage chapter transitions and WebView sync state.
 * 
 * **Timing Logic:**
 * - Immediately: Update prevChapterIdRef, set grace period timestamp, mark WebView unsynced
 * - After 300ms: Mark WebView as synced
 * - After 2300ms: Clear media nav tracking (300ms + 2000ms)
 * 
 * **Cleanup:** Clears sync timer on unmount or chapter change
 * 
 * @example
 * useChapterTransition({
 *   chapterId: chapter.id,
 *   refs: {
 *     prevChapterIdRef,
 *     chapterTransitionTimeRef,
 *     isWebViewSyncedRef,
 *     mediaNavSourceChapterIdRef,
 *     mediaNavDirectionRef,
 *   },
 * });
 */
export function useChapterTransition(params: ChapterTransitionParams): void {
  const { chapterId, refs } = params;

  useEffect(() => {
    console.log(
      `useTTSController: Chapter changed to ${chapterId} (prev: ${refs.prevChapterIdRef.current})`,
    );

    // Update chapter ID ref IMMEDIATELY
    refs.prevChapterIdRef.current = chapterId;

    // Set grace period timestamp to ignore stale save events from old chapter
    refs.chapterTransitionTimeRef.current = Date.now();

    // Mark WebView as unsynced initially (new WebView loading)
    refs.isWebViewSyncedRef.current = false;

    // Short delay to allow WebView to stabilize, then mark as synced
    const syncTimer = setTimeout(() => {
      refs.isWebViewSyncedRef.current = true;
      console.log(
        `useTTSController: WebView marked as synced for chapter ${chapterId}`,
      );

      // Clear media navigation tracking after successful transition
      if (refs.mediaNavSourceChapterIdRef.current) {
        console.log(
          `useTTSController: Clearing media nav tracking (source: ${refs.mediaNavSourceChapterIdRef.current})`,
        );
        // Small delay before clearing to allow confirmation logic to run
        setTimeout(() => {
          refs.mediaNavSourceChapterIdRef.current = null;
          refs.mediaNavDirectionRef.current = null;
        }, 2000);
      }
    }, 300);

    return () => clearTimeout(syncTimer);
  }, [chapterId, refs]);
}
```

### Integration in useTTSController.ts:

```typescript
// Import
import { useChapterTransition } from './useChapterTransition';

// Usage (replace lines 389-422)
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
```

### Testing Checklist:
- [ ] Chapter ID ref updates immediately on chapter change
- [ ] Grace period timestamp set on transition
- [ ] WebView sync state: unsynced → synced after 300ms
- [ ] Media nav tracking clears after 2300ms total (300ms + 2000ms)
- [ ] Cleanup cancels timer on unmount/chapter change

---

## Step 2: Extract Resume Dialog Handlers

**File:** `src/screens/reader/hooks/useResumeDialogHandlers.ts`  
**Lines:** 559-624 (70 lines)  
**Dependencies:** Phase 1 only (utilities, dialogState)  
**Risk:** 🟡 MEDIUM (ref mutations, 3-way resolution)

### Code to Extract:

```typescript
/**
 * useResumeDialogHandlers Hook
 *
 * Manages resume dialog actions: confirm, cancel, restart.
 * 
 * @module reader/hooks/useResumeDialogHandlers
 * @dependencies
 *   - Phase 1: utilities.resumeTTS
 *   - Phase 1: dialogState.hideResumeDialog
 * @provides
 *   - handleResumeConfirm (used by: useTTSController return, useTTSConfirmationHandler)
 *   - handleResumeCancel (used by: useTTSConfirmationHandler) ← KEY OUTPUT
 *   - handleRestartChapter (used by: useTTSController return)
 */

import { useCallback, RefObject } from 'react';
import WebView from 'react-native-webview';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { TTSPersistenceState } from '../types/tts';

/**
 * Resume dialog handlers parameters
 * 
 * @property chapterId - Current chapter ID (from: useTTSController props)
 * @property chapterTtsState - Persisted TTS state JSON (from: useTTSController props)
 * @property webViewRef - WebView reference (from: useTTSController local)
 * @property refs - Mutable refs for position tracking
 *   - pendingResumeIndexRef: Pending resume position (from: useTTSController local)
 *   - latestParagraphIndexRef: Latest known position (from: useTTSController local)
 * @property callbacks - Functions from other hooks
 *   - resumeTTS: Start TTS from given state (from: Phase 1 useTTSUtilities)
 *   - hideResumeDialog: Hide resume dialog (from: Phase 1 useDialogState)
 */
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

/**
 * Resume dialog handler functions
 */
export interface ResumeDialogHandlers {
  handleResumeConfirm: () => void;
  handleResumeCancel: () => void;
  handleRestartChapter: () => void;
}

/**
 * Hook providing resume dialog handlers.
 * 
 * **handleResumeConfirm**: Resolves position from 3 sources (max of ref, MMKV, prop), then calls resumeTTS
 * **handleResumeCancel**: Injects JS to start TTS from beginning (window.tts.hasAutoResumed = true)
 * **handleRestartChapter**: Injects JS to start from first readable element
 * 
 * @example
 * const resumeDialogHandlers = useResumeDialogHandlers({
 *   chapterId: chapter.id,
 *   chapterTtsState: chapter.ttsState,
 *   webViewRef,
 *   refs: {
 *     pendingResumeIndexRef,
 *     latestParagraphIndexRef,
 *   },
 *   callbacks: {
 *     resumeTTS: utilities.resumeTTS,
 *     hideResumeDialog: dialogState.hideResumeDialog,
 *   },
 * });
 */
export function useResumeDialogHandlers(
  params: ResumeDialogHandlersParams,
): ResumeDialogHandlers {
  const { chapterId, chapterTtsState, webViewRef, refs, callbacks } = params;

  const handleResumeConfirm = useCallback(() => {
    const mmkvValue =
      MMKVStorage.getNumber(`chapter_progress_${chapterId}`) ?? -1;
    const refValue = refs.latestParagraphIndexRef.current ?? -1;
    const savedIndex = refs.pendingResumeIndexRef.current;
    const lastReadParagraph = Math.max(refValue, mmkvValue, savedIndex);

    refs.pendingResumeIndexRef.current = lastReadParagraph;
    refs.latestParagraphIndexRef.current = lastReadParagraph;

    const ttsState = chapterTtsState ? JSON.parse(chapterTtsState) : {};
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
    callbacks.resumeTTS({
      ...ttsState,
      paragraphIndex: lastReadParagraph,
      timestamp: Date.now(),
    });
  }, [chapterId, chapterTtsState, refs, callbacks]);

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
    callbacks.hideResumeDialog();
  }, [webViewRef, callbacks]);

  return {
    handleResumeConfirm,
    handleResumeCancel,
    handleRestartChapter,
  };
}
```

### Integration in useTTSController.ts:

```typescript
// Import
import { useResumeDialogHandlers } from './useResumeDialogHandlers';

// Usage (replace lines 559-624)
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
```

### Testing Checklist:
- [ ] Resume confirm resolves max(ref, MMKV, prop) correctly
- [ ] Resume confirm mutates refs (pendingResumeIndexRef, latestParagraphIndexRef)
- [ ] Resume confirm calls resumeTTS with correct state
- [ ] Resume cancel injects JS and sets hasAutoResumed = true
- [ ] Restart chapter injects JS to start from elements[0]
- [ ] Restart chapter calls hideResumeDialog

---

## Step 3: Extract TTS Confirmation Handler

**File:** `src/screens/reader/hooks/useTTSConfirmationHandler.ts`  
**Lines:** 721-790 (70 lines)  
**Dependencies:** Phase 1 + Step 2 (handleResumeCancel)  
**Risk:** 🟡 MEDIUM (async, Smart Resume logic)

### Code to Extract:

```typescript
/**
 * useTTSConfirmationHandler Hook
 *
 * Handles TTS resume confirmation with Smart Resume logic and conflict detection.
 * 
 * @module reader/hooks/useTTSConfirmationHandler
 * @dependencies
 *   - Phase 2 Step 2: resumeDialogHandlers.handleResumeCancel ← KEY DEPENDENCY
 *   - Phase 1: utilities.updateLastTTSChapter
 *   - Phase 1: dialogState.* (showResumeDialog, setConflictingChapters, setShowChapterSelectionDialog)
 * @provides
 *   - handleRequestTTSConfirmation (used by: useTTSController WebView message handler)
 */

import { useCallback, RefObject } from 'react';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { getRecentReadingChapters } from '@database/queries/ChapterQueries';
import { ConflictingChapter } from '../types/tts';

/**
 * TTS confirmation handler parameters
 * 
 * @property novelId - Current novel ID (from: useTTSController props)
 * @property chapterId - Current chapter ID (from: useTTSController props)
 * @property refs - Mutable refs for position and pause tracking
 *   - latestParagraphIndexRef: Latest known position (from: useTTSController local)
 *   - lastTTSPauseTimeRef: Last pause timestamp for grace period (from: useTTSController local)
 *   - pendingResumeIndexRef: Pending resume position (from: useTTSController local)
 * @property callbacks - Functions from other hooks
 *   - handleResumeCancel: Cancel resume and start from beginning (from: Step 2 useResumeDialogHandlers)
 *   - updateLastTTSChapter: Update last TTS chapter in MMKV (from: Phase 1 useTTSUtilities)
 *   - showResumeDialog: Show resume dialog (from: Phase 1 useDialogState)
 *   - setConflictingChapters: Set conflicting chapters data (from: Phase 1 useDialogState)
 *   - setShowChapterSelectionDialog: Show chapter selection dialog (from: Phase 1 useDialogState)
 */
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

/**
 * TTS confirmation handler function
 */
export interface TTSConfirmationHandler {
  handleRequestTTSConfirmation: (savedIndex: number) => Promise<void>;
}

/**
 * Hook providing TTS confirmation handler with Smart Resume logic.
 * 
 * **Smart Resume Logic:**
 * - Grace period: < 3s after pause → bypass Smart Resume check
 * - Manual scroll detection: If gap > 5 and outside grace period → call handleResumeCancel (start from 0)
 * 
 * **Conflict Detection:**
 * - Queries recent reading chapters (limit 4)
 * - If conflicts exist → show chapter selection dialog
 * - No conflicts → show resume dialog directly
 * 
 * @example
 * const ttsConfirmationHandler = useTTSConfirmationHandler({
 *   novelId: novel.id,
 *   chapterId: chapter.id,
 *   refs: {
 *     latestParagraphIndexRef,
 *     lastTTSPauseTimeRef,
 *     pendingResumeIndexRef,
 *   },
 *   callbacks: {
 *     handleResumeCancel: resumeDialogHandlers.handleResumeCancel,
 *     updateLastTTSChapter: utilities.updateLastTTSChapter,
 *     showResumeDialog: dialogState.showResumeDialog,
 *     setConflictingChapters: dialogState.setConflictingChapters,
 *     setShowChapterSelectionDialog: dialogState.setShowChapterSelectionDialog,
 *   },
 * });
 */
export function useTTSConfirmationHandler(
  params: TTSConfirmationHandlerParams,
): TTSConfirmationHandler {
  const { novelId, chapterId, refs, callbacks } = params;

  const handleRequestTTSConfirmation = useCallback(
    async (savedIndex: number) => {
      const currentRef = refs.latestParagraphIndexRef.current;
      const timeSinceLastPause =
        Date.now() - (refs.lastTTSPauseTimeRef.current || 0);
      const inGracePeriod = timeSinceLastPause < 3000;

      // Smart Resume: Detect manual scrolling
      if (
        !inGracePeriod &&
        currentRef !== undefined &&
        currentRef >= 0 &&
        Math.abs(currentRef - savedIndex) > 5
      ) {
        console.log(
          `useTTSController: Smart Resume - User manually scrolled to ${currentRef}. Ignoring saved index ${savedIndex}.`,
        );
        callbacks.handleResumeCancel();
        return;
      }

      // Conflict Detection: Check recent reading chapters
      try {
        const conflicts = await getRecentReadingChapters(novelId, 4);
        const relevantConflicts = conflicts.filter(c => c.id !== chapterId);

        if (relevantConflicts.length > 0) {
          const conflictsData = relevantConflicts.map(c => ({
            id: c.id,
            name: c.name || `Chapter ${c.chapterNumber}`,
            paragraph: MMKVStorage.getNumber(`chapter_progress_${c.id}`) || 0,
          }));

          callbacks.setConflictingChapters(conflictsData);
          refs.pendingResumeIndexRef.current = savedIndex;
          callbacks.setShowChapterSelectionDialog(true);
          return;
        }
      } catch {
        // Ignore errors, proceed to start TTS
      }

      // No conflicts: Proceed to resume dialog
      callbacks.updateLastTTSChapter(chapterId);
      refs.pendingResumeIndexRef.current = savedIndex;
      callbacks.showResumeDialog();
    },
    [novelId, chapterId, refs, callbacks],
  );

  return {
    handleRequestTTSConfirmation,
  };
}
```

### Integration in useTTSController.ts:

```typescript
// Import
import { useTTSConfirmationHandler } from './useTTSConfirmationHandler';

// Usage (replace lines 721-790)
const ttsConfirmationHandler = useTTSConfirmationHandler({
  novelId: novel.id,
  chapterId: chapter.id,
  refs: {
    latestParagraphIndexRef,
    lastTTSPauseTimeRef,
    pendingResumeIndexRef,
  },
  callbacks: {
    handleResumeCancel: resumeDialogHandlers.handleResumeCancel, // ← From Step 2
    updateLastTTSChapter: utilities.updateLastTTSChapter,
    showResumeDialog: dialogState.showResumeDialog,
    setConflictingChapters: dialogState.setConflictingChapters,
    setShowChapterSelectionDialog: dialogState.setShowChapterSelectionDialog,
  },
});
```

### Testing Checklist:
- [ ] Smart Resume detects manual scrolling (gap > 5, no grace period)
- [ ] Grace period (< 3s) bypasses Smart Resume check
- [ ] Smart Resume calls handleResumeCancel when triggered
- [ ] Conflict detection queries recent chapters
- [ ] Conflicts → show chapter selection dialog
- [ ] No conflicts → show resume dialog directly
- [ ] Pending resume index set correctly

---

## Step 4: Extract Chapter Selection Handler

**File:** `src/screens/reader/hooks/useChapterSelectionHandler.ts`  
**Lines:** 792-858 (70 lines)  
**Dependencies:** Phase 1 + Steps 2-3 (indirectly)  
**Risk:** 🟡 MEDIUM (async, navigation, progress reset)

### Code to Extract:

```typescript
/**
 * useChapterSelectionHandler Hook
 *
 * Handles chapter selection from conflict dialog with progress management.
 * 
 * @module reader/hooks/useChapterSelectionHandler
 * @dependencies
 *   - Phase 1: utilities.updateLastTTSChapter
 *   - Phase 1: dialogState.* (setShowChapterSelectionDialog, showResumeDialog)
 * @provides
 *   - handleSelectChapter (used by: useTTSController return)
 */

import { useCallback, RefObject } from 'react';
import {
  getChapter as getChapterFromDb,
  markChaptersBeforePositionRead,
  resetFutureChaptersProgress,
} from '@database/queries/ChapterQueries';
import { ChapterInfo } from '@database/types';
import { ChapterGeneralSettings } from '@hooks/persisted/useSettings';

/**
 * Chapter selection handler parameters
 * 
 * @property novelId - Current novel ID (from: useTTSController props)
 * @property chapter - Current chapter info (from: useTTSController props)
 * @property chapterGeneralSettingsRef - Settings ref (from: useTTSController props)
 * @property showToastMessage - Toast notification function (from: useTTSController props)
 * @property getChapter - Navigate to chapter function (from: useTTSController props)
 * @property refs - Mutable refs for position tracking
 *   - pendingResumeIndexRef: Pending resume position (from: useTTSController local)
 * @property callbacks - Functions from other hooks
 *   - updateLastTTSChapter: Update last TTS chapter in MMKV (from: Phase 1 useTTSUtilities)
 *   - showResumeDialog: Show resume dialog (from: Phase 1 useDialogState)
 *   - setShowChapterSelectionDialog: Hide chapter selection dialog (from: Phase 1 useDialogState)
 */
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

/**
 * Chapter selection handler function
 */
export interface ChapterSelectionHandler {
  handleSelectChapter: (targetChapterId: number) => Promise<void>;
}

/**
 * Hook providing chapter selection handler from conflict dialog.
 * 
 * **Current Chapter Selected:**
 * - Mark previous chapters as read (if position available)
 * - Reset future chapters based on settings (none, unread, all)
 * - Show resume dialog if pending index ≥ 0
 * 
 * **Different Chapter Selected:**
 * - Fetch target chapter from DB
 * - Mark previous chapters as read (target chapter position)
 * - Reset future chapters based on settings
 * - Navigate to target chapter
 * 
 * @example
 * const chapterSelectionHandler = useChapterSelectionHandler({
 *   novelId: novel.id,
 *   chapter,
 *   chapterGeneralSettingsRef,
 *   showToastMessage,
 *   getChapter,
 *   refs: {
 *     pendingResumeIndexRef,
 *   },
 *   callbacks: {
 *     updateLastTTSChapter: utilities.updateLastTTSChapter,
 *     showResumeDialog: dialogState.showResumeDialog,
 *     setShowChapterSelectionDialog: dialogState.setShowChapterSelectionDialog,
 *   },
 * });
 */
export function useChapterSelectionHandler(
  params: ChapterSelectionHandlerParams,
): ChapterSelectionHandler {
  const {
    novelId,
    chapter,
    chapterGeneralSettingsRef,
    showToastMessage,
    getChapter,
    refs,
    callbacks,
  } = params;

  const handleSelectChapter = useCallback(
    async (targetChapterId: number) => {
      callbacks.setShowChapterSelectionDialog(false);

      if (targetChapterId === chapter.id) {
        // Current chapter selected
        if (chapter.position !== undefined) {
          await markChaptersBeforePositionRead(novelId, chapter.position);
        }
        const resetMode =
          chapterGeneralSettingsRef.current?.ttsForwardChapterReset || 'none';
        if (resetMode !== 'none') {
          await resetFutureChaptersProgress(novelId, chapter.id, resetMode);
          showToastMessage(`Future progress reset: ${resetMode}`);
        }

        callbacks.updateLastTTSChapter(chapter.id);

        if (refs.pendingResumeIndexRef.current >= 0) {
          callbacks.showResumeDialog();
        }
      } else {
        // Different chapter selected - navigate to it
        const targetChapter = await getChapterFromDb(targetChapterId);
        if (targetChapter) {
          if (targetChapter.position !== undefined) {
            await markChaptersBeforePositionRead(
              novelId,
              targetChapter.position,
            );
          }
          const resetMode =
            chapterGeneralSettingsRef.current?.ttsForwardChapterReset || 'none';
          if (resetMode !== 'none') {
            await resetFutureChaptersProgress(
              novelId,
              targetChapter.id,
              resetMode,
            );
          }

          callbacks.updateLastTTSChapter(targetChapter.id);
          getChapter(targetChapter);
        }
      }
    },
    [
      novelId,
      chapter,
      chapterGeneralSettingsRef,
      showToastMessage,
      getChapter,
      refs,
      callbacks,
    ],
  );

  return {
    handleSelectChapter,
  };
}
```

### Integration in useTTSController.ts:

```typescript
// Import
import { useChapterSelectionHandler } from './useChapterSelectionHandler';

// Usage (replace lines 792-858)
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
```

### Testing Checklist:
- [ ] Select current chapter marks previous chapters read
- [ ] Select current chapter resets future chapters (none, unread, all)
- [ ] Select current chapter shows resume dialog if pending index ≥ 0
- [ ] Select different chapter fetches from DB correctly
- [ ] Select different chapter navigates correctly
- [ ] Select different chapter marks previous chapters read (target position)
- [ ] Select different chapter resets future chapters
- [ ] Missing target chapter handled gracefully (no crash)

---

## Step 5: Extract Back Handler

**File:** `src/screens/reader/hooks/useBackHandler.ts`  
**Lines:** 917-1011 (95 lines)  
**Dependencies:** Phase 1 manualModeHandlers + dialogState  
**Risk:** 🟡 MEDIUM (complex logic, WebView injection)

### Code to Extract:

```typescript
/**
 * useBackHandler Hook
 *
 * Handles Android back button press during TTS.
 * 
 * @module reader/hooks/useBackHandler
 * @dependencies
 *   - Phase 1: manualModeHandlers.handleStopTTS
 *   - Phase 1: dialogState.showExitDialog, dialogState.showChapterSelectionDialog
 * @provides
 *   - handleBackPress (used by: useTTSController return, native back handler)
 */

import { useCallback, RefObject } from 'react';
import WebView from 'react-native-webview';

/**
 * Back handler parameters
 * 
 * @property chapterId - Current chapter ID (from: useTTSController props)
 * @property webViewRef - WebView reference (from: useTTSController local)
 * @property saveProgress - Save progress function (from: useTTSController props)
 * @property navigation - Navigation object (from: useTTSController)
 * @property showExitDialog - Exit dialog visible state (from: Phase 1 useDialogState)
 * @property showChapterSelectionDialog - Chapter selection dialog visible state (from: Phase 1 useDialogState)
 * @property refs - Mutable refs for TTS state
 *   - isTTSReadingRef: TTS playing state (from: useTTSController local)
 *   - currentParagraphIndexRef: Current paragraph index (from: useTTSController local)
 *   - latestParagraphIndexRef: Latest known position (from: useTTSController local)
 * @property callbacks - Functions from other hooks
 *   - handleStopTTS: Stop TTS and clear state (from: Phase 1 useManualModeHandlers)
 */
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

/**
 * Back handler function
 */
export interface BackHandler {
  handleBackPress: () => boolean;
}

/**
 * Hook providing back press handler for TTS.
 * 
 * **Logic:**
 * 1. If dialogs open → return false (don't handle, let dialog handle)
 * 2. If TTS playing → stop TTS, save position, go back
 * 3. If TTS paused with saved position:
 *    - GAP_THRESHOLD = 5 paragraphs
 *    - If gap > 5 → show exit dialog (request-tts-exit)
 *    - If gap ≤ 5 → save position, exit directly
 * 4. Otherwise → return false (don't handle)
 * 
 * @example
 * const backHandler = useBackHandler({
 *   chapterId: chapter.id,
 *   webViewRef,
 *   saveProgress,
 *   navigation,
 *   showExitDialog: dialogState.showExitDialog,
 *   showChapterSelectionDialog: dialogState.showChapterSelectionDialog,
 *   refs: {
 *     isTTSReadingRef,
 *     currentParagraphIndexRef,
 *     latestParagraphIndexRef,
 *   },
 *   callbacks: {
 *     handleStopTTS: manualModeHandlers.handleStopTTS,
 *   },
 * });
 */
export function useBackHandler(params: BackHandlerParams): BackHandler {
  const {
    chapterId,
    webViewRef,
    saveProgress,
    navigation,
    showExitDialog,
    showChapterSelectionDialog,
    refs,
    callbacks,
  } = params;

  const handleBackPress = useCallback((): boolean => {
    // If dialogs open, don't handle back (let dialog handle it)
    if (showExitDialog || showChapterSelectionDialog) {
      return false;
    }

    // If TTS currently playing, save position and exit
    if (refs.isTTSReadingRef.current) {
      const ttsPosition = refs.currentParagraphIndexRef.current ?? 0;
      console.log(
        `useTTSController: Back pressed while TTS playing. Saving TTS position: ${ttsPosition}`,
      );

      callbacks.handleStopTTS();
      saveProgress(ttsPosition);
      navigation.goBack();
      return true;
    }

    // If TTS paused with saved position, check gap
    const lastTTSPosition = refs.latestParagraphIndexRef.current ?? -1;

    if (lastTTSPosition > 0) {
      webViewRef.current?.injectJavaScript(`
        (function() {
          const visible = window.reader.getVisibleElementIndex ? window.reader.getVisibleElementIndex() : 0;
          const ttsIndex = ${lastTTSPosition};
          const GAP_THRESHOLD = 5;
          const nonce = window.__LNREADER_NONCE__;
          
          if (Math.abs(visible - ttsIndex) > GAP_THRESHOLD) {
            // Gap > 5: Show exit dialog
            window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'request-tts-exit', 
               data: { visible, ttsIndex },
               nonce,
            }));
          } else {
            // Gap ≤ 5: Save and exit directly
            window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'save',
               data: Math.round((ttsIndex / (reader.getReadableElements()?.length || 1)) * 100),
               paragraphIndex: ttsIndex,
               chapterId: ${chapterId},
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

    // No TTS state, don't handle
    return false;
  }, [
    showExitDialog,
    showChapterSelectionDialog,
    chapterId,
    webViewRef,
    saveProgress,
    navigation,
    refs,
    callbacks,
  ]);

  return {
    handleBackPress,
  };
}
```

### Integration in useTTSController.ts:

```typescript
// Import
import { useBackHandler } from './useBackHandler';

// Usage (replace lines 917-1011)
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
```

### Testing Checklist:
- [ ] Back with dialogs open returns false
- [ ] Back while TTS playing saves TTS position and exits
- [ ] Back with gap > 5 injects request-tts-exit (shows exit dialog)
- [ ] Back with gap ≤ 5 injects save + exit-allowed (exits directly)
- [ ] Back with no TTS position returns false
- [ ] WebView JavaScript injection syntax valid (no runtime errors)

---

## Updated Return Value in useTTSController.ts

```typescript
return {
  // ... Phase 1 returns (dialogState, utilities, etc.)
  
  // Phase 2 handlers
  handleResumeConfirm: resumeDialogHandlers.handleResumeConfirm,
  handleResumeCancel: resumeDialogHandlers.handleResumeCancel,
  handleRestartChapter: resumeDialogHandlers.handleRestartChapter,
  handleRequestTTSConfirmation: ttsConfirmationHandler.handleRequestTTSConfirmation,
  handleSelectChapter: chapterSelectionHandler.handleSelectChapter,
  handleBackPress: backHandler.handleBackPress,
  
  // ... rest unchanged
};
```

---

## Testing Strategy (REVISED - Incremental)

### 🔴 CRITICAL: Test After EACH Extraction

**DO NOT extract all 5 hooks then test. Test INCREMENTALLY.**

```bash
# After Step 1 (useChapterTransition):
pnpm run type-check  # Fix any errors before continuing
pnpm run lint        # Fix any warnings before continuing
pnpm test            # Ensure 241/241 still pass
git add . && git commit -m "Phase 2 Step 1: Extract useChapterTransition"

# After Step 2 (useResumeDialogHandlers):
pnpm run type-check
pnpm run lint
pnpm test
git add . && git commit -m "Phase 2 Step 2: Extract useResumeDialogHandlers"

# After Step 3 (useTTSConfirmationHandler):
pnpm run type-check
pnpm run lint
pnpm test
git add . && git commit -m "Phase 2 Step 3: Extract useTTSConfirmationHandler"

# After Step 4 (useChapterSelectionHandler):
pnpm run type-check
pnpm run lint
pnpm test
git add . && git commit -m "Phase 2 Step 4: Extract useChapterSelectionHandler"

# After Step 5 (useBackHandler):
pnpm run type-check
pnpm run lint
pnpm test
git add . && git commit -m "Phase 2 Step 5: Extract useBackHandler"

# Final verification:
pnpm test  # Ensure all 241/241 tests still pass
```

**Why**: If tests fail, we know exactly which extraction caused the failure.

---

## Success Criteria

✅ All 5 Phase 2 hooks created and imported  
✅ useTTSController.ts reduced by additional ~340 lines  
✅ Total reduction: ~735 lines (26% from original 2797)  
✅ Zero TypeScript errors  
✅ Zero new lint errors  
✅ All 241 tests passing after EACH extraction  
✅ Full TTS flow test passes (5 scenarios - see below)  

---

## Full TTS Flow Tests (After Phase 2 Complete)

### Test Scenario 1: Fresh TTS Start
1. Open chapter with no previous TTS state
2. Start TTS → should show chapter selection if conflicts exist
3. Select chapter → should show resume dialog (or start from 0)
4. Confirm resume → TTS starts from resolved position

**Expected**: handleSelectChapter → handleRequestTTSConfirmation → handleResumeConfirm

### Test Scenario 2: Resume with Manual Scroll (Smart Resume)
1. Start TTS, pause at paragraph 50
2. Manually scroll to paragraph 80
3. Wait > 3s (outside grace period)
4. Resume TTS → should start from paragraph 80 (Smart Resume bypass)

**Expected**: handleRequestTTSConfirmation detects gap, calls handleResumeCancel

### Test Scenario 3: Resume within Grace Period
1. Start TTS, pause at paragraph 50
2. Manually scroll to paragraph 80
3. Within 3s, resume TTS → should ignore Smart Resume check

**Expected**: handleRequestTTSConfirmation skips gap check, shows resume dialog

### Test Scenario 4: Chapter Navigation During TTS
1. Start TTS in Chapter 1
2. NEXT chapter via media controls
3. Verify grace period active (no stale saves)
4. Verify WebView sync state transitions (useChapterTransition)

**Expected**: useChapterTransition handles timing, grace period filters saves

### Test Scenario 5: Back Press Scenarios
- Back while TTS playing → saves TTS position, exits
- Back with gap > 5 → shows exit dialog
- Back with gap ≤ 5 → saves and exits
- Back with exit dialog open → doesn't handle (returns false)

**Expected**: handleBackPress logic branches correctly

---

## Rollback Plan

Same as Phase 1:

```bash
# Revert specific step (e.g., Step 3 failed)
git revert HEAD  # Reverts last commit (Step 3)

# Or revert to Phase 1 complete
git log  # Find Phase 1 complete commit hash
git checkout <phase1-complete-hash>

# Re-run tests
pnpm test
```

**Why git commits per step**: Easy to rollback to last known good state.

---

## Post-Phase 2 State

**useTTSController.ts Size:**
- Original: 2797 lines
- After Phase 1: ~2402 lines (14% reduction)
- After Phase 2: **~2062 lines (26% total reduction, 735 lines extracted)**

**Remaining in useTTSController.ts (74%, ~2062 lines):**
- TTS State Refs (~100 lines) - foundation
- Background TTS Effect (~170 lines) - critical orchestration
- WebView Message Handler (~340 lines) - central event hub
- WebView Load End Handler (~330 lines) - load orchestration
- Native Event Listeners Effect (~930 lines) - heart of TTS system
- Return value (~190 lines) - interface

**These sections SHOULD NOT be extracted** - they are the irreducible core TTS controller logic.

---

## Recommendation

**Proceed with Phase 2 using revised plan:**

✅ **Extract in dependency order**: 1 → 2 → 3 → 4 → 5  
✅ **Test incrementally**: After EACH extraction, not at the end  
✅ **Commit per step**: Allows easy rollback  
✅ **Document interfaces**: Source annotations in TSDoc  
✅ **Skip Total Paragraphs**: Too small (10 lines), not worth overhead  

**Estimated Time**: 4-5 hours (includes incremental testing)  
**Risk**: 🟡 MEDIUM (mitigated by incremental testing)  
**Value**: 🟢 GOOD (26% total reduction, clearer code)

**Next Action**: Begin Step 1 (useChapterTransition) extraction.
