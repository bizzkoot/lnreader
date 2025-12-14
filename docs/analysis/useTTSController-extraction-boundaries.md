# useTTSController Hook - Extraction Boundary Analysis

**File:** `src/screens/reader/hooks/useTTSController.ts`  
**Current Size:** 2797 lines  
**Analysis Date:** 2025-12-14  
**Context:** Phase 1-2 complete (extracted from WebViewReader), zero regressions achieved

---

## Executive Summary

The useTTSController hook has **8 distinct extraction candidates**, ranging from LOW to HIGH risk. The hook is well-structured with clear separation of concerns, making it suitable for further modularization.

**Recommended Extraction Order (LOW → MEDIUM → HIGH):**
1. ✅ **Utility Functions** (LOW risk) - Pure functions, no dependencies
2. ✅ **Exit Dialog Handlers** (LOW risk) - Isolated logic
3. ✅ **Sync Dialog Handlers** (LOW risk) - Minimal dependencies
4. ⚠️ **Resume/Chapter Selection Dialog Handlers** (MEDIUM risk) - Cross-dependencies with state
5. ⚠️ **Scroll Sync & Manual Mode Handlers** (MEDIUM risk) - WebView injection dependencies
6. ⚠️ **Total Paragraphs Effect** (MEDIUM risk) - Side effect coupling
7. 🔴 **Native Event Listeners** (HIGH risk) - Complex cross-dependencies, mutates many refs
8. 🔴 **AppState Wake Handling** (HIGH risk) - Most complex, touches everything

---

## Section 1: TTS State Refs Initialization

**Lines:** 237-302  
**Description:** All ref declarations for TTS state management  

### Dependencies
- **Refs Used:** ALL refs (45+ refs declared here)
- **State Dependencies:** None (declaration only)
- **Props Dependencies:** `savedParagraphIndex`
- **Callback Dependencies:** None
- **Called By:** Entire hook

### Risk Assessment
**Risk Level:** 🔴 **HIGH**  
**Extraction Complexity:** VERY HIGH - These are the foundation of the entire hook

**Why HIGH:**
- Every section depends on these refs
- Moving these would require passing 45+ refs as parameters
- Not a realistic extraction candidate
- Should remain in parent hook

**Recommendation:** ❌ **DO NOT EXTRACT** - Keep as foundation

---

## Section 2: Dialog State (useBoolean hooks)

**Lines:** 304-336  
**Description:** Dialog visibility state management using useBoolean hooks

### Dependencies
- **Refs Used:** None
- **State Dependencies:** None (self-contained useState via useBoolean)
- **Props Dependencies:** None
- **Callback Dependencies:** None
- **Called By:** Dialog handlers, event listeners, return value

### Risk Assessment
**Risk Level:** 🟢 **LOW**  
**Extraction Complexity:** LOW - Straightforward state declarations

**Why LOW:**
- Pure state management
- No cross-dependencies
- Self-contained logic

**Recommendation:** ✅ **CAN EXTRACT** to `useDialogState.ts`

**Extraction Pattern:**
```typescript
// hooks/useDialogState.ts
export function useDialogState() {
  const {
    value: resumeDialogVisible,
    setTrue: showResumeDialog,
    setFalse: hideResumeDialog,
  } = useBoolean();
  
  // ... other dialogs
  
  return {
    resumeDialogVisible,
    showResumeDialog,
    hideResumeDialog,
    // ... others
  };
}
```

---

## Section 3: Keep Refs Synced Effects

**Lines:** 338-354  
**Description:** useEffect hooks that sync refs with prop/state changes

### Dependencies
- **Refs Used:** 
  - `progressRef`
  - `saveProgressRef`
  - `nextChapterRef`
  - `navigateChapterRef`
- **State Dependencies:** None
- **Props Dependencies:** 
  - `chapter.progress`
  - `saveProgress`
  - `nextChapter`
  - `navigateChapter`
- **Callback Dependencies:** None
- **Called By:** Automatic (useEffect)

### Risk Assessment
**Risk Level:** 🟢 **LOW**  
**Extraction Complexity:** LOW - Simple ref synchronization

**Why LOW:**
- No side effects
- Simple assignment operations
- Clear dependencies

**Recommendation:** ✅ **CAN EXTRACT** to `useRefSync.ts`

**Extraction Pattern:**
```typescript
// hooks/useRefSync.ts
export function useRefSync(params: {
  progress: number;
  saveProgress: Function;
  nextChapter: any;
  navigateChapter: Function;
  refs: {
    progressRef: RefObject<number>;
    saveProgressRef: RefObject<Function>;
    nextChapterRef: RefObject<any>;
    navigateChapterRef: RefObject<Function>;
  };
}) {
  useEffect(() => {
    params.refs.progressRef.current = params.progress;
  }, [params.progress]);
  
  // ... other sync effects
}
```

---

## Section 4: Utility Functions (updateTtsMediaNotificationState, updateLastTTSChapter, restartTtsFromParagraphIndex, resumeTTS)

**Lines:** 356-479  
**Description:** Reusable utility functions for TTS operations

### Dependencies

#### `updateTtsMediaNotificationState` (Lines 359-387)
- **Refs Used:** `currentParagraphIndexRef`, `totalParagraphsRef`
- **Props Dependencies:** `novel.name`, `chapter.id`, `chapter.name`
- **Callback Dependencies:** `TTSHighlight.updateMediaState`
- **Called By:** Multiple event listeners, media actions, effects

#### `updateLastTTSChapter` (Lines 481-484)
- **Refs Used:** `lastTTSChapterIdRef`
- **Props Dependencies:** None
- **Callback Dependencies:** `MMKVStorage.set`
- **Called By:** Dialog handlers, chapter selection

#### `restartTtsFromParagraphIndex` (Lines 486-543)
- **Refs Used:** 
  - `currentParagraphIndexRef`
  - `latestParagraphIndexRef`
  - `isTTSPausedRef`
  - `isTTSPlayingRef`
  - `hasUserScrolledRef`
  - `ttsQueueRef`
  - `isTTSReadingRef`
- **Props Dependencies:** `html`, `chapter.id`, `readerSettingsRef`
- **Callback Dependencies:** 
  - `extractParagraphs`
  - `validateAndClampParagraphIndex`
  - `TTSHighlight.pause/speakBatch/setRestartInProgress`
  - `updateTtsMediaNotificationState`
- **Called By:** Media action handler (PLAY_PAUSE, SEEK_FORWARD, SEEK_BACK)

#### `resumeTTS` (Lines 545-557)
- **Refs Used:** None
- **Props Dependencies:** `webViewRef`
- **Callback Dependencies:** WebView injection
- **Called By:** Resume dialog handler

### Risk Assessment
**Risk Level:** 🟢 **LOW**  
**Extraction Complexity:** LOW - Well-defined boundaries

**Why LOW:**
- Pure utility functions with clear inputs/outputs
- Can be extracted with dependency injection
- Minimal coupling

**Recommendation:** ✅ **EXTRACT** to `useTTSUtilities.ts`

**Extraction Pattern:**
```typescript
// hooks/useTTSUtilities.ts
export function useTTSUtilities(params: {
  novel: NovelInfo;
  chapter: ChapterInfo;
  html: string;
  webViewRef: RefObject<WebView>;
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  refs: {
    currentParagraphIndexRef: RefObject<number>;
    totalParagraphsRef: RefObject<number>;
    // ... other refs
  };
}) {
  const updateTtsMediaNotificationState = useCallback(...);
  const updateLastTTSChapter = useCallback(...);
  const restartTtsFromParagraphIndex = useCallback(...);
  const resumeTTS = useCallback(...);
  
  return {
    updateTtsMediaNotificationState,
    updateLastTTSChapter,
    restartTtsFromParagraphIndex,
    resumeTTS,
  };
}
```

---

## Section 5: Chapter Change Effect

**Lines:** 389-422  
**Description:** Effect that manages chapter ID transitions, WebView sync state, and grace periods

### Dependencies
- **Refs Used:**
  - `prevChapterIdRef` ✍️ WRITES
  - `chapterTransitionTimeRef` ✍️ WRITES
  - `isWebViewSyncedRef` ✍️ WRITES
  - `mediaNavSourceChapterIdRef` ✍️ WRITES
  - `mediaNavDirectionRef` ✍️ WRITES
- **State Dependencies:** None
- **Props Dependencies:** `chapter.id`
- **Callback Dependencies:** None (timer-based)
- **Called By:** Automatic (useEffect on chapter.id)

### Risk Assessment
**Risk Level:** 🟡 **MEDIUM**  
**Extraction Complexity:** MEDIUM - Critical for chapter transition stability

**Why MEDIUM:**
- Manages critical chapter transition state
- Sets grace period for save event filtering
- Controls WebView sync state
- Clearing media nav tracking has timing dependencies

**Recommendation:** ⚠️ **EXTRACT WITH CAUTION** to `useChapterTransition.ts`

**Extraction Pattern:**
```typescript
// hooks/useChapterTransition.ts
export function useChapterTransition(params: {
  chapterId: number;
  refs: {
    prevChapterIdRef: RefObject<number>;
    chapterTransitionTimeRef: RefObject<number>;
    isWebViewSyncedRef: RefObject<boolean>;
    mediaNavSourceChapterIdRef: RefObject<number | null>;
    mediaNavDirectionRef: RefObject<MediaNavDirection>;
  };
}) {
  useEffect(() => {
    // Chapter transition logic
    // ...
  }, [params.chapterId]);
}
```

---

## Section 6: Background TTS Chapter Navigation Effect

**Lines:** 424-598  
**Description:** Effect that handles background TTS when chapter navigation happens via media controls

### Dependencies
- **Refs Used:**
  - `backgroundTTSPendingRef` ✅ READS (primary trigger)
  - `isWebViewSyncedRef` ✍️ WRITES (marks synced immediately)
  - `forceStartFromParagraphZeroRef` ✅ READS + ✍️ WRITES
  - `currentParagraphIndexRef` ✅ READS + ✍️ WRITES
  - `latestParagraphIndexRef` ✍️ WRITES
  - `ttsQueueRef` ✍️ WRITES
  - `isTTSReadingRef` ✍️ WRITES
  - `isTTSPlayingRef` ✍️ WRITES
  - `hasUserScrolledRef` ✍️ WRITES
- **State Dependencies:** None
- **Props Dependencies:** 
  - `chapter.id`
  - `html`
  - `readerSettingsRef`
  - `showToastMessage`
- **Callback Dependencies:**
  - `extractParagraphs`
  - `validateAndClampParagraphIndex`
  - `TTSHighlight.speakBatch`
  - `updateTtsMediaNotificationState`
- **Called By:** Automatic (useEffect on chapter.id, html)

### Risk Assessment
**Risk Level:** 🔴 **HIGH**  
**Extraction Complexity:** HIGH - Critical for background playback

**Why HIGH:**
- Complex interaction with media controls
- Critical BUGFIX logic (marking WebView synced without onLoadEnd)
- Mutates 9+ refs
- Tightly coupled with chapter navigation flow
- Error handling for background TTS failures

**Recommendation:** ⚠️ **DEFER EXTRACTION** - Too critical, keep for now

**If extracted later:**
```typescript
// hooks/useBackgroundTTS.ts
export function useBackgroundTTS(params: {
  chapterId: number;
  html: string;
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  showToastMessage: Function;
  updateTtsMediaNotificationState: Function;
  refs: {
    backgroundTTSPendingRef: RefObject<boolean>;
    isWebViewSyncedRef: RefObject<boolean>;
    // ... 7 more refs
  };
}) {
  useEffect(() => {
    if (!params.refs.backgroundTTSPendingRef.current || !params.html) {
      return;
    }
    // ... complex background TTS logic
  }, [params.chapterId, params.html]);
}
```

---

## Section 7: Dialog Handlers

**Lines:** 559-894  
**Description:** All dialog-related handler functions

### Sub-sections:

#### 7A: Resume Dialog Handlers (Lines 559-624)
- **Functions:** `handleResumeConfirm`, `handleResumeCancel`, `handleRestartChapter`
- **Refs Used:** 
  - `pendingResumeIndexRef` (R/W)
  - `latestParagraphIndexRef` (R/W)
- **Props Dependencies:** `chapter.id`, `chapter.ttsState`, `webViewRef`
- **Callback Dependencies:** `MMKVStorage.getNumber`, `resumeTTS`, `hideResumeDialog`
- **Called By:** Resume dialog UI

#### 7B: Scroll Sync Handlers (Lines 626-675)
- **Functions:** `handleTTSScrollSyncConfirm`, `handleTTSScrollSyncCancel`
- **Refs Used:** `ttsScrollPromptDataRef` (R/W)
- **Props Dependencies:** `webViewRef`
- **Callback Dependencies:** WebView injection, `hideScrollSyncDialog`
- **Called By:** Scroll sync dialog UI

#### 7C: Manual Mode Handlers (Lines 677-719)
- **Functions:** `handleStopTTS`, `handleContinueFollowing`
- **Refs Used:** 
  - `isTTSReadingRef` (W)
  - `isTTSPlayingRef` (W)
  - `hasUserScrolledRef` (W)
- **Props Dependencies:** `webViewRef`, `showToastMessage`
- **Callback Dependencies:** `TTSHighlight.stop`, `hideManualModeDialog`
- **Called By:** Manual mode dialog UI

#### 7D: TTS Confirmation Handler (Lines 721-790)
- **Function:** `handleRequestTTSConfirmation`
- **Refs Used:** 
  - `latestParagraphIndexRef` (R)
  - `lastTTSPauseTimeRef` (R)
  - `pendingResumeIndexRef` (W)
  - `lastTTSChapterIdRef` (R/W via updateLastTTSChapter)
- **Props Dependencies:** `novel.id`, `chapter.id`
- **Callback Dependencies:** 
  - `getRecentReadingChapters`
  - `updateLastTTSChapter`
  - `showResumeDialog`
  - `handleResumeCancel`
- **Called By:** WebView message handler ('request-tts-confirmation')

#### 7E: Chapter Selection Handler (Lines 792-858)
- **Function:** `handleSelectChapter`
- **Refs Used:** 
  - `pendingResumeIndexRef` (R)
  - `lastTTSChapterIdRef` (W via updateLastTTSChapter)
- **Props Dependencies:** 
  - `novel.id`
  - `chapter.id`
  - `chapter.position`
  - `chapterGeneralSettingsRef`
  - `showToastMessage`
  - `getChapter`
- **Callback Dependencies:**
  - `markChaptersBeforePositionRead`
  - `resetFutureChaptersProgress`
  - `getChapterFromDb`
  - `updateLastTTSChapter`
  - `showResumeDialog`
  - `setShowChapterSelectionDialog`
- **Called By:** Chapter selection dialog UI

### Risk Assessment
**Risk Level:** 🟡 **MEDIUM**  
**Extraction Complexity:** MEDIUM - Moderate cross-dependencies

**Why MEDIUM:**
- Multiple handler functions with some shared ref access
- Some handlers are isolated (scroll sync, manual mode)
- Others have cross-dependencies (chapter selection, resume)
- Can be grouped by dialog type

**Recommendation:** ⚠️ **EXTRACT IN PHASES**

**Phase 1 (LOW risk):**
- Extract scroll sync handlers (minimal dependencies)
- Extract manual mode handlers (simple, isolated)

**Phase 2 (MEDIUM risk):**
- Extract resume handlers (moderate dependencies)
- Extract chapter selection handler (more complex)

**Extraction Pattern:**
```typescript
// hooks/useResumeDialogHandlers.ts
export function useResumeDialogHandlers(params: {
  chapter: ChapterInfo;
  webViewRef: RefObject<WebView>;
  refs: {
    pendingResumeIndexRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
  };
  callbacks: {
    resumeTTS: Function;
    hideResumeDialog: Function;
  };
}) {
  const handleResumeConfirm = useCallback(...);
  const handleResumeCancel = useCallback(...);
  const handleRestartChapter = useCallback(...);
  
  return {
    handleResumeConfirm,
    handleResumeCancel,
    handleRestartChapter,
  };
}
```

---

## Section 8: Exit Dialog Handlers

**Lines:** 860-885  
**Description:** Handlers for exit dialog (save TTS vs reader position)

### Dependencies
- **Refs Used:** None
- **State Dependencies:** `exitDialogData`
- **Props Dependencies:** `saveProgress`, `navigation`
- **Callback Dependencies:** 
  - `handleStopTTS`
  - `setShowExitDialog`
  - `navigation.goBack`
- **Called By:** Exit dialog UI

### Risk Assessment
**Risk Level:** 🟢 **LOW**  
**Extraction Complexity:** LOW - Minimal dependencies

**Why LOW:**
- Simple, isolated handlers
- No ref mutations
- Clear boundaries
- Only uses state and props

**Recommendation:** ✅ **EXTRACT** to `useExitDialogHandlers.ts`

**Extraction Pattern:**
```typescript
// hooks/useExitDialogHandlers.ts
export function useExitDialogHandlers(params: {
  exitDialogData: ExitDialogData;
  saveProgress: Function;
  navigation: any;
  callbacks: {
    handleStopTTS: Function;
    setShowExitDialog: Function;
  };
}) {
  const handleExitTTS = useCallback(...);
  const handleExitReader = useCallback(...);
  
  return {
    handleExitTTS,
    handleExitReader,
  };
}
```

---

## Section 9: Sync Dialog Handlers

**Lines:** 887-915  
**Description:** Handlers for wake sync error recovery dialog

### Dependencies
- **Refs Used:** 
  - `syncRetryCountRef` (R/W)
  - `wakeChapterIdRef` (R)
  - `pendingScreenWakeSyncRef` (W)
- **State Dependencies:** None
- **Props Dependencies:** `getChapter`
- **Callback Dependencies:** 
  - `setSyncDialogStatus`
  - `setSyncDialogVisible`
  - `getChapterFromDb`
- **Called By:** Sync dialog UI

### Risk Assessment
**Risk Level:** 🟢 **LOW**  
**Extraction Complexity:** LOW - Self-contained retry logic

**Why LOW:**
- Single handler function
- Clear purpose (retry wake sync)
- Minimal ref usage
- No complex dependencies

**Recommendation:** ✅ **EXTRACT** to `useSyncDialogHandlers.ts`

**Extraction Pattern:**
```typescript
// hooks/useSyncDialogHandlers.ts
export function useSyncDialogHandlers(params: {
  getChapter: Function;
  refs: {
    syncRetryCountRef: RefObject<number>;
    wakeChapterIdRef: RefObject<number | null>;
    pendingScreenWakeSyncRef: RefObject<boolean>;
  };
  callbacks: {
    setSyncDialogStatus: Function;
    setSyncDialogVisible: Function;
  };
}) {
  const handleSyncRetry = useCallback(...);
  
  return { handleSyncRetry };
}
```

---

## Section 10: Back Handler

**Lines:** 917-1011  
**Description:** Handles Android back button press with TTS-aware logic

### Dependencies
- **Refs Used:**
  - `isTTSReadingRef` (R)
  - `currentParagraphIndexRef` (R)
  - `latestParagraphIndexRef` (R)
- **State Dependencies:** 
  - `showExitDialog`
  - `showChapterSelectionDialog`
- **Props Dependencies:** 
  - `webViewRef`
  - `chapter.id`
  - `saveProgress`
  - `navigation`
- **Callback Dependencies:** 
  - `handleStopTTS`
  - `navigation.goBack`
- **Called By:** WebViewReader's back handler

### Risk Assessment
**Risk Level:** 🟡 **MEDIUM**  
**Extraction Complexity:** MEDIUM - Complex decision tree

**Why MEDIUM:**
- Complex conditional logic based on TTS state
- WebView injection with multi-line JavaScript
- Compares TTS position vs visible position
- Triggers different flows (save, exit, show dialog)

**Recommendation:** ⚠️ **CAN EXTRACT** but requires careful testing

**Extraction Pattern:**
```typescript
// hooks/useBackHandler.ts
export function useBackHandler(params: {
  chapterId: number;
  webViewRef: RefObject<WebView>;
  saveProgress: Function;
  navigation: any;
  showExitDialog: boolean;
  showChapterSelectionDialog: boolean;
  refs: {
    isTTSReadingRef: RefObject<boolean>;
    currentParagraphIndexRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
  };
  callbacks: {
    handleStopTTS: Function;
  };
}) {
  const handleBackPress = useCallback((): boolean => {
    // Complex back press logic
    // ...
  }, [...dependencies]);
  
  return { handleBackPress };
}
```

---

## Section 11: WebView Message Handler

**Lines:** 1013-1354  
**Description:** Main WebView message routing for all TTS-related events from JavaScript

### Dependencies
- **Refs Used:**
  - `wakeTransitionInProgressRef` (R)
  - `isTTSReadingRef` (R/W)
  - `hasUserScrolledRef` (W)
  - `currentParagraphIndexRef` (R/W)
  - `ttsQueueRef` (R/W)
  - `ttsStateRef` (W)
  - `wakeResumeGracePeriodRef` (R)
  - `chapterGeneralSettingsRef` (R)
- **State Dependencies:** None
- **Props Dependencies:**
  - `chapter.id`
  - `html`
  - `webViewRef`
  - `readerSettingsRef`
  - `navigation`
- **Callback Dependencies:**
  - `extractParagraphs`
  - `TTSHighlight.speak/speakBatch/fullStop/addToBatch`
  - `handleRequestTTSConfirmation`
  - `showScrollSyncDialog`
  - `showManualModeDialog`
  - `setExitDialogData`
  - `setShowExitDialog`
  - `navigation.goBack`
- **Called By:** WebViewReader's message handler (via handleTTSMessage)

### Message Types Handled:
1. `speak` - Start/continue TTS playback (Lines 1020-1111)
2. `stop-speak` - Stop TTS (Lines 1113-1117)
3. `tts-state` - Update TTS state (Lines 1119-1131)
4. `request-tts-exit` - Show exit confirmation dialog (Lines 1133-1143)
5. `exit-allowed` - Proceed with navigation (Lines 1145-1147)
6. `request-tts-confirmation` - Show resume confirmation (Lines 1149-1153)
7. `tts-scroll-prompt` - Show scroll sync dialog (Lines 1155-1169)
8. `tts-manual-mode-prompt` - Show manual mode dialog (Lines 1171-1173)
9. `tts-resume-location-prompt` - Show resume location dialog (Lines 1175-1189)
10. `tts-queue` - Add paragraphs to queue for background playback (Lines 1191-1353)

### Risk Assessment
**Risk Level:** 🔴 **HIGH**  
**Extraction Complexity:** VERY HIGH - Central message routing hub

**Why HIGH:**
- Handles 10 different message types
- Complex state mutations across multiple refs
- Critical for WebView ↔ Native communication
- Wake transition guards
- Batch TTS coordination
- Error handling for all message types

**Recommendation:** ❌ **DO NOT EXTRACT** - Too central, too complex

**Alternative:** Break into sub-handlers by message type (if needed):
```typescript
// handlers/handleSpeakMessage.ts
export function handleSpeakMessage(event: WebViewPostEvent, context: TTSContext) {
  // Lines 1020-1111
}

// handlers/handleTTSQueueMessage.ts
export function handleTTSQueueMessage(event: WebViewPostEvent, context: TTSContext) {
  // Lines 1191-1353
}

// Then in main handler:
const handleTTSMessage = useCallback((event: WebViewPostEvent): boolean => {
  switch (event.type) {
    case 'speak':
      return handleSpeakMessage(event, context);
    case 'tts-queue':
      return handleTTSQueueMessage(event, context);
    // ...
  }
}, [context]);
```

---

## Section 12: WebView Load End Handler

**Lines:** 1356-1691  
**Description:** Handles WebView load completion with wake sync, chapter verification, and auto-start logic

### Dependencies
- **Refs Used:**
  - `pendingScreenWakeSyncRef` (R/W)
  - `wakeChapterIdRef` (R/W)
  - `wakeParagraphIndexRef` (R/W)
  - `autoResumeAfterWakeRef` (R/W)
  - `wasReadingBeforeWakeRef` (R/W)
  - `syncRetryCountRef` (R/W)
  - `isWebViewSyncedRef` (W)
  - `isTTSPausedRef` (R)
  - `currentParagraphIndexRef` (R/W)
  - `backgroundTTSPendingRef` (R/W)
  - `autoStartTTSRef` (R/W)
  - `forceStartFromParagraphZeroRef` (R/W)
  - `latestParagraphIndexRef` (W)
  - `ttsQueueRef` (W)
  - `isTTSReadingRef` (W)
  - `isTTSPlayingRef` (W)
  - `wakeResumeGracePeriodRef` (W)
- **State Dependencies:** 
  - `syncDialogVisible`
- **Props Dependencies:**
  - `chapter.id`
  - `html`
  - `webViewRef`
  - `readerSettingsRef`
  - `getChapter`
- **Callback Dependencies:**
  - `extractParagraphs`
  - `getChapterFromDb`
  - `setSyncDialogStatus`
  - `setSyncDialogVisible`
  - `setSyncDialogInfo`
  - `TTSHighlight.speakBatch`
  - `updateTtsMediaNotificationState`
- **Called By:** WebViewReader's onLoadEnd

### Major Flows:
1. **Pending Screen Wake Sync** (Lines 1362-1575):
   - Chapter mismatch detection
   - Retry logic with MAX_SYNC_RETRIES
   - Sync dialog management
   - Navigation to correct chapter
   - Resume TTS after successful sync

2. **Normal onLoadEnd Logic** (Lines 1577-1691):
   - Mark WebView as synced
   - Wake resume blocking flags injection (CRITICAL BUGFIX)
   - Paused TTS position correction
   - Background TTS pending handling
   - Auto-start TTS logic

### Risk Assessment
**Risk Level:** 🔴 **EXTREMELY HIGH**  
**Extraction Complexity:** EXTREMELY HIGH - Most complex handler

**Why EXTREMELY HIGH:**
- TWO major distinct flows (wake sync vs normal)
- Mutates 17+ refs
- Complex retry logic with state machine
- Chapter verification and auto-navigation
- CRITICAL BUGFIX for Smart Resume (lines 1584-1603)
- Timing-dependent operations (multiple setTimeout calls)
- Error handling with fallback dialogs
- Coordinates WebView reload, native TTS, and UI state

**Recommendation:** ❌ **DO NOT EXTRACT** - Core orchestration logic

**If extraction is absolutely necessary (NOT recommended):**
```typescript
// hooks/useWebViewLoadEnd.ts
export function useWebViewLoadEnd(params: {
  chapter: ChapterInfo;
  html: string;
  webViewRef: RefObject<WebView>;
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  syncDialogVisible: boolean;
  getChapter: Function;
  updateTtsMediaNotificationState: Function;
  refs: {
    pendingScreenWakeSyncRef: RefObject<boolean>;
    wakeChapterIdRef: RefObject<number | null>;
    // ... 15 more refs
  };
  setters: {
    setSyncDialogStatus: Function;
    setSyncDialogVisible: Function;
    setSyncDialogInfo: Function;
  };
}) {
  const handleWebViewLoadEnd = useCallback(() => {
    // Lines 1356-1691 - EXTREMELY COMPLEX
  }, [...many dependencies]);
  
  return { handleWebViewLoadEnd };
}
```

---

## Section 13: Total Paragraphs Effect

**Lines:** 1693-1700  
**Description:** Updates total paragraphs ref when HTML changes

### Dependencies
- **Refs Used:** 
  - `totalParagraphsRef` (W)
  - `isTTSReadingRef` (R)
- **State Dependencies:** None
- **Props Dependencies:** `html`
- **Callback Dependencies:** 
  - `extractParagraphs`
  - `updateTtsMediaNotificationState`
- **Called By:** Automatic (useEffect on html)

### Risk Assessment
**Risk Level:** 🟡 **MEDIUM**  
**Extraction Complexity:** LOW - Simple effect, but couples notification update

**Why MEDIUM:**
- Simple paragraph extraction
- BUT: Triggers notification update as side effect
- Notification update depends on isTTSReadingRef
- Could cause desync if extracted incorrectly

**Recommendation:** ⚠️ **CAN EXTRACT** but include notification update

**Extraction Pattern:**
```typescript
// hooks/useTotalParagraphs.ts
export function useTotalParagraphs(params: {
  html: string;
  updateTtsMediaNotificationState: Function;
  refs: {
    totalParagraphsRef: RefObject<number>;
    isTTSReadingRef: RefObject<boolean>;
  };
}) {
  useEffect(() => {
    if (params.html) {
      const paragraphs = extractParagraphs(params.html);
      params.refs.totalParagraphsRef.current = paragraphs?.length || 0;
      params.updateTtsMediaNotificationState(params.refs.isTTSReadingRef.current);
    }
  }, [params.html, params.updateTtsMediaNotificationState]);
}
```

---

## Section 14: Native TTS Event Listeners Effect

**Lines:** 1702-2629  
**Description:** Massive effect that sets up all native TTS event subscriptions

### Dependencies
- **Refs Used:** (ALL OF THEM - 30+ refs accessed)
  - Reading state: `isTTSReadingRef`, `isTTSPlayingRef`, `isTTSPausedRef`
  - Position tracking: `currentParagraphIndexRef`, `latestParagraphIndexRef`, `totalParagraphsRef`
  - Wake handling: `wakeTransitionInProgressRef`, `capturedWakeParagraphIndexRef`, `wakeChapterIdRef`, `wakeParagraphIndexRef`, `autoResumeAfterWakeRef`, `wasReadingBeforeWakeRef`, `wakeResumeGracePeriodRef`, `pendingScreenWakeSyncRef`
  - WebView sync: `isWebViewSyncedRef`
  - Queue: `ttsQueueRef`
  - Session: `ttsSessionRef`
  - Chapter tracking: `prevChapterIdRef`, `mediaNavSourceChapterIdRef`, `mediaNavDirectionRef`, `lastTTSChapterIdRef`, `chaptersAutoPlayedRef`
  - Timing: `lastMediaActionTimeRef`, `lastTTSPauseTimeRef`, `lastStaleLogTimeRef`
  - User state: `hasUserScrolledRef`, `nextChapterScreenVisibleRef`
  - Settings: `readerSettingsRef`, `chapterGeneralSettingsRef`
  - Context: `saveProgressRef`, `progressRef`, `nextChapterRef`, `navigateChapterRef`
  - State: `ttsStateRef`

- **State Dependencies:** None
- **Props Dependencies:**
  - `chapter.id`
  - `html`
  - `webViewRef`
  - `showToastMessage`
  - `navigateChapter`
  - `nextChapter`
  - `prevChapter`
- **Callback Dependencies:**
  - `TTSHighlight.*` (all native TTS methods)
  - `restartTtsFromParagraphIndex`
  - `updateTtsMediaNotificationState`
  - `extractParagraphs`
  - `validateAndClampParagraphIndex`
  - `updateChapterProgressDb`
  - `markChapterRead/Unread`
  - `MMKVStorage.*`
- **Called By:** Automatic (useEffect on mount)

### Event Handlers:

#### 14A: onSpeechDone (Lines 1704-1857)
- Handles paragraph completion
- Queue management and next paragraph logic
- Media navigation confirmation (5 paragraphs threshold)
- WebView state sync
- Fallback to WebView-driven TTS if queue exhausted

#### 14B: onWordRange (Lines 1859-1925)
- Word-level highlighting
- Stale chapter detection
- WebView injection for highlight range

#### 14C: onSpeechStart (Lines 1927-2008)
- Utterance start handling
- Stale chapter detection
- Position update
- WebView state sync

#### 14D: onMediaAction (Lines 2010-2341)
- **PLAY_PAUSE** (Lines 2028-2102): Pause/resume logic with native position restore
- **SEEK_FORWARD** (Lines 2104-2110): Skip 5 paragraphs forward
- **SEEK_BACK** (Lines 2112-2135): Skip 5 paragraphs backward with retry
- **PREV_CHAPTER** (Lines 2137-2210): Navigate to previous chapter with progress update
- **NEXT_CHAPTER** (Lines 2212-2277): Navigate to next chapter with progress update

#### 14E: onQueueEmpty (Lines 2343-2417)
- Chapter continuation logic based on settings
- Auto-play limit enforcement
- Navigation to next chapter
- Novel completion detection

#### 14F: onVoiceFallback (Lines 2419-2427)
- Voice unavailable notification

#### 14G: AppState (Lines 2429-2615)
- **Background** (Lines 2430-2450): Save TTS state, stop if background playback disabled
- **Active (Wake)** (Lines 2451-2612): 
  - MOST COMPLEX HANDLER
  - Captures paragraph index before async operations
  - Sets wake transition flag
  - Injects blocking flags immediately
  - Pauses native TTS
  - WebView sync check and out-of-sync handling
  - Chapter mismatch detection and STOP logic
  - In-place wake sync with multi-source index resolution
  - Resume TTS batch playback after sync

#### Cleanup (Lines 2617-2629)
- Remove all subscriptions
- Stop TTS
- Save final state

### Risk Assessment
**Risk Level:** 🔴 **EXTREMELY HIGH**  
**Extraction Complexity:** EXTREMELY HIGH - Nuclear option

**Why EXTREMELY HIGH:**
- 927 lines in a single useEffect (33% of entire hook!)
- 7 distinct event handlers (8 including AppState)
- Mutates 30+ refs across all handlers
- AppState 'active' handler alone is 160+ lines (most complex section in entire hook)
- Cross-dependencies between event handlers (queue state affects onSpeechDone, wake state affects everything)
- Cleanup logic depends on all handlers
- Critical for TTS functionality - any bug here breaks everything

**Recommendation:** ❌ **ABSOLUTELY DO NOT EXTRACT** - This is the heart of the TTS system

**If modularization is needed (ADVANCED REFACTORING ONLY):**
1. Extract individual event handlers to separate functions WITHIN the same effect
2. Use a shared context object to pass refs
3. Keep all handlers in the same useEffect to maintain cleanup coordination

```typescript
// ADVANCED PATTERN (not recommended unless absolutely necessary)
// handlers/onSpeechDoneHandler.ts
export function createOnSpeechDoneHandler(context: TTSEventContext) {
  return () => {
    // Lines 1704-1857
  };
}

// hooks/useTTSController.ts
useEffect(() => {
  const context: TTSEventContext = {
    refs: { /* all refs */ },
    props: { /* all props */ },
    callbacks: { /* all callbacks */ },
  };
  
  const onSpeechDoneHandler = createOnSpeechDoneHandler(context);
  const onWordRangeHandler = createOnWordRangeHandler(context);
  // ... other handlers
  
  const onSpeechDoneSubscription = TTSHighlight.addListener('onSpeechDone', onSpeechDoneHandler);
  // ... other subscriptions
  
  return () => {
    // Cleanup all subscriptions
  };
}, [/* dependencies */]);
```

---

## Section 15: Return Value Memoization

**Lines:** 2631-2727  
**Description:** useMemo and return statement

### Dependencies
- **Refs Used:** ALL refs (returned for external access)
- **State Dependencies:** ALL dialog state
- **Props Dependencies:** None
- **Callback Dependencies:** ALL handlers
- **Called By:** Hook consumer (WebViewReader)

### Risk Assessment
**Risk Level:** 🟢 **LOW** (for memoization), 🔴 **CRITICAL** (for return value)  
**Extraction Complexity:** N/A - Cannot be extracted

**Why:**
- This IS the hook's public API
- Cannot exist independently
- Defines the contract between hook and consumer

**Recommendation:** ❌ **CANNOT EXTRACT** - This is the interface

---

## Summary Table: Extraction Candidates

| Section | Lines | Risk | Complexity | Recommendation | Priority |
|---------|-------|------|------------|----------------|----------|
| 1. TTS State Refs | 237-302 | 🔴 HIGH | VERY HIGH | ❌ DO NOT EXTRACT | N/A |
| 2. Dialog State | 304-336 | 🟢 LOW | LOW | ✅ CAN EXTRACT | P1 |
| 3. Ref Sync Effects | 338-354 | 🟢 LOW | LOW | ✅ CAN EXTRACT | P1 |
| 4. Utility Functions | 356-543 | 🟢 LOW | LOW | ✅ EXTRACT | P1 |
| 5. Chapter Change Effect | 389-422 | 🟡 MEDIUM | MEDIUM | ⚠️ EXTRACT WITH CAUTION | P2 |
| 6. Background TTS Effect | 424-598 | 🔴 HIGH | HIGH | ⚠️ DEFER | P4 |
| 7A. Resume Dialog Handlers | 559-624 | 🟡 MEDIUM | MEDIUM | ⚠️ EXTRACT PHASE 2 | P3 |
| 7B. Scroll Sync Handlers | 626-675 | 🟢 LOW | LOW | ✅ EXTRACT PHASE 1 | P1 |
| 7C. Manual Mode Handlers | 677-719 | 🟢 LOW | LOW | ✅ EXTRACT PHASE 1 | P1 |
| 7D. TTS Confirmation | 721-790 | 🟡 MEDIUM | MEDIUM | ⚠️ EXTRACT PHASE 2 | P3 |
| 7E. Chapter Selection | 792-858 | 🟡 MEDIUM | MEDIUM | ⚠️ EXTRACT PHASE 2 | P3 |
| 8. Exit Dialog Handlers | 860-885 | 🟢 LOW | LOW | ✅ EXTRACT | P1 |
| 9. Sync Dialog Handlers | 887-915 | 🟢 LOW | LOW | ✅ EXTRACT | P1 |
| 10. Back Handler | 917-1011 | 🟡 MEDIUM | MEDIUM | ⚠️ CAN EXTRACT | P2 |
| 11. WebView Message Handler | 1013-1354 | 🔴 HIGH | VERY HIGH | ❌ DO NOT EXTRACT | N/A |
| 12. WebView Load End | 1356-1691 | 🔴 EXTREMELY HIGH | EXTREMELY HIGH | ❌ DO NOT EXTRACT | N/A |
| 13. Total Paragraphs Effect | 1693-1700 | 🟡 MEDIUM | LOW | ⚠️ CAN EXTRACT | P2 |
| 14. Native Event Listeners | 1702-2629 | 🔴 EXTREMELY HIGH | EXTREMELY HIGH | ❌ DO NOT EXTRACT | N/A |
| 15. Return Value | 2631-2727 | CRITICAL | N/A | ❌ CANNOT EXTRACT | N/A |

---

## Recommended Extraction Plan

### Phase 1: LOW Risk Extractions (Immediate)
**Goal:** Reduce line count by ~15% (420 lines) with ZERO regression risk

1. **Extract Dialog State** (Lines 304-336) → `useDialogState.ts` (~30 lines)
2. **Extract Ref Sync** (Lines 338-354) → `useRefSync.ts` (~20 lines)
3. **Extract Utility Functions** (Lines 356-543) → `useTTSUtilities.ts` (~190 lines)
4. **Extract Exit Dialog Handlers** (Lines 860-885) → `useExitDialogHandlers.ts` (~30 lines)
5. **Extract Sync Dialog Handlers** (Lines 887-915) → `useSyncDialogHandlers.ts` (~30 lines)
6. **Extract Scroll Sync Handlers** (Lines 626-675) → `useScrollSyncHandlers.ts` (~50 lines)
7. **Extract Manual Mode Handlers** (Lines 677-719) → `useManualModeHandlers.ts` (~45 lines)

**Testing Required:** Unit tests for extracted functions + integration test to verify no regressions

---

### Phase 2: MEDIUM Risk Extractions (After Phase 1 stable)
**Goal:** Further reduce by ~12% (330 lines) with careful testing

1. **Extract Chapter Change Effect** (Lines 389-422) → `useChapterTransition.ts` (~35 lines)
2. **Extract Total Paragraphs Effect** (Lines 1693-1700) → `useTotalParagraphs.ts` (~10 lines)
3. **Extract Back Handler** (Lines 917-1011) → `useBackHandler.ts` (~95 lines)
4. **Extract Resume Dialog Handlers** (Lines 559-624) → `useResumeDialogHandlers.ts` (~70 lines)
5. **Extract TTS Confirmation Handler** (Lines 721-790) → `useTTSConfirmationHandler.ts` (~70 lines)
6. **Extract Chapter Selection Handler** (Lines 792-858) → `useChapterSelectionHandler.ts` (~70 lines)

**Testing Required:** Full TTS flow testing + device testing for media controls

---

### Phase 3: HIGH Risk - DO NOT EXTRACT (Keep as-is)
**These sections are TOO COMPLEX and TOO CRITICAL:**

1. **Background TTS Effect** (Lines 424-598) - 175 lines
   - Reason: Critical for background chapter navigation, complex state management
   
2. **WebView Message Handler** (Lines 1013-1354) - 342 lines
   - Reason: Central message routing, 10 message types, complex state mutations
   
3. **WebView Load End Handler** (Lines 1356-1691) - 336 lines
   - Reason: Orchestrates wake sync, chapter verification, auto-start, has CRITICAL BUGFIX
   
4. **Native Event Listeners Effect** (Lines 1702-2629) - 927 lines
   - Reason: Heart of TTS system, 8 event handlers, 30+ refs mutated, AppState wake handling is most complex code in entire hook

**Total "DO NOT EXTRACT" Lines:** 1,780 lines (64% of hook)

**Rationale:** These sections are the CORE TTS orchestration logic. Extracting them would:
- Require passing 30+ refs as parameters
- Create circular dependencies between extracted hooks
- Increase complexity rather than reduce it
- High risk of introducing regressions
- Violate single responsibility (these ARE the responsibilities)

---

## Cross-Dependency Matrix

| Section | Depends On | Depended By |
|---------|------------|-------------|
| Dialog State | None | All handlers, return value |
| Ref Sync | Props | Native event listeners |
| Utility Functions | Refs, props | Dialog handlers, event listeners |
| Chapter Change | None | Native event listeners (reads prevChapterIdRef) |
| Background TTS | Utility functions | None |
| Resume Handlers | Utility functions, Dialog state | WebView message handler |
| Scroll Sync Handlers | Dialog state | WebView message handler |
| Manual Mode Handlers | Dialog state, Utility functions | Back handler |
| TTS Confirmation | Dialog state, Utility functions | WebView message handler |
| Chapter Selection | Dialog state, Utility functions | WebView message handler |
| Exit Handlers | Dialog state, Manual handlers | Back handler |
| Sync Handlers | Dialog state | WebView load end |
| Back Handler | All handlers | Return value |
| WebView Message | ALL ABOVE | Return value |
| WebView Load End | ALL ABOVE | Return value |
| Total Paragraphs | Utility functions | Native event listeners |
| Native Event Listeners | ALL REFS, ALL UTILITIES | Return value |

**Critical Insight:** Sections 11-14 (WebView Message, WebView Load End, Native Event Listeners) are the **orchestration core** that coordinates everything else. They cannot be extracted without breaking the architecture.

---

## Final Recommendations

### ✅ DO EXTRACT (Phase 1 - Priority 1)
Total: ~395 lines (~14% reduction)

1. Dialog State
2. Ref Sync
3. Utility Functions
4. Exit Dialog Handlers
5. Sync Dialog Handlers
6. Scroll Sync Handlers
7. Manual Mode Handlers

**Expected Outcome:** Hook reduces from 2797 → 2402 lines, maintainability improved, ZERO regressions

---

### ⚠️ EXTRACT WITH CAUTION (Phase 2 - Priority 2-3)
Total: ~330 lines (~12% reduction)

1. Chapter Change Effect
2. Total Paragraphs Effect
3. Back Handler
4. Resume Dialog Handlers
5. TTS Confirmation Handler
6. Chapter Selection Handler

**Expected Outcome:** Hook reduces from 2402 → 2072 lines, good maintainability, MEDIUM regression risk

**Testing Required:**
- Full TTS flow (start, pause, resume, stop)
- Media controls (play/pause, seek, prev/next chapter)
- Wake handling
- Chapter navigation
- Dialog flows

---

### ❌ DO NOT EXTRACT (Priority N/A)
Total: ~1780 lines (~64% of hook)

1. TTS State Refs (foundation)
2. Background TTS Effect (critical)
3. WebView Message Handler (central hub)
4. WebView Load End Handler (orchestration)
5. Native Event Listeners Effect (heart of system)
6. Return Value (interface)

**Rationale:** These sections ARE the hook's core responsibilities. Extracting them would create an anti-pattern where the complexity is redistributed without improving maintainability.

---

## Conclusion

**Realistic Extraction Potential:** 26% line reduction (725 lines)
- Phase 1: 14% (395 lines) - LOW risk ✅
- Phase 2: 12% (330 lines) - MEDIUM risk ⚠️

**Keep as-is:** 64% (1780 lines) - Core orchestration logic ❌

**Key Insight:** The useTTSController hook has TWO distinct parts:
1. **Extractable periphery** (~26%): Dialog handlers, utilities, simple effects
2. **Non-extractable core** (~64%): Event orchestration, WebView coordination, wake handling

**The core is ALREADY well-separated** - it's doing exactly what a TTS controller should do: orchestrate complex asynchronous events from multiple sources (native TTS, WebView, AppState, media controls) and coordinate state across the entire system.

**Recommendation:** 
- ✅ Proceed with Phase 1 extractions (LOW risk, good value)
- ⚠️ Consider Phase 2 extractions carefully (MEDIUM risk, diminishing returns)
- ❌ Accept that the remaining 64% is THE TTS CONTROLLER and should stay together

**Alternative to Phase 2:** Instead of extracting more code, consider:
1. Adding inline documentation to the 4 complex sections
2. Creating architectural diagrams showing event flow
3. Writing comprehensive integration tests
4. Accepting that complex systems have complex coordination logic

The hook is already well-structured. Further extraction beyond Phase 1 may create more problems than it solves.

---

## Appendix: Dependency Injection Pattern

For extracted hooks, use this pattern:

```typescript
// Example: Extracted utility hook
export function useTTSUtilities(params: {
  novel: NovelInfo;
  chapter: ChapterInfo;
  html: string;
  webViewRef: RefObject<WebView>;
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  refs: {
    currentParagraphIndexRef: RefObject<number>;
    totalParagraphsRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
    isTTSPausedRef: RefObject<boolean>;
    isTTSPlayingRef: RefObject<boolean>;
    hasUserScrolledRef: RefObject<boolean>;
    ttsQueueRef: RefObject<TTSQueueState>;
    isTTSReadingRef: RefObject<boolean>;
    lastTTSChapterIdRef: RefObject<number | null>;
  };
}) {
  // Extracted utility functions
  const updateTtsMediaNotificationState = useCallback(...);
  const updateLastTTSChapter = useCallback(...);
  const restartTtsFromParagraphIndex = useCallback(...);
  const resumeTTS = useCallback(...);
  
  return {
    updateTtsMediaNotificationState,
    updateLastTTSChapter,
    restartTtsFromParagraphIndex,
    resumeTTS,
  };
}

// Usage in useTTSController:
const utilities = useTTSUtilities({
  novel,
  chapter,
  html,
  webViewRef,
  readerSettingsRef,
  refs: {
    currentParagraphIndexRef,
    totalParagraphsRef,
    // ... other refs
  },
});

// Then use utilities.updateTtsMediaNotificationState(), etc.
```

This pattern:
- ✅ Maintains clear dependencies
- ✅ Allows unit testing of extracted logic
- ✅ Avoids prop drilling
- ✅ Type-safe
- ✅ Easy to refactor back if needed
