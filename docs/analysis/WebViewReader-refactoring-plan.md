# WebViewReader Refactoring Plan - Phase 2

**Created:** 2025-12-14  
**Completed:** 2025-12-14  
**Status:** ✅ **COMPLETE**  
**Target File:** `src/screens/reader/components/WebViewReader.tsx`

---

## ✅ Final Refactoring Results

### Before/After Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| WebViewReader.tsx | 3,379 lines | ~800 lines | **-76%** |
| useTTSController.ts | N/A | 2,069 lines | (new hook) |
| Total TTS logic | Embedded | Extracted | Clean separation |
| Test Status | 23 suites / 241 tests | 23 suites / 241 tests | ✅ Zero regressions |
| Type Check | Pass | Pass | ✅ No errors |

### Final File Structure

```
src/screens/reader/
├── components/
│   ├── WebViewReader.tsx         (800 lines - clean, focused)
│   ├── ttsHelpers.ts             (helper functions)
│   └── ttsWakeUtils.js           (wake utilities)
├── hooks/
│   └── useTTSController.ts       (2,069 lines - all TTS logic)
├── types/
│   └── tts.ts                    (type definitions)
└── ReaderScreen.tsx              (unchanged interface)
```

---

## Implementation Progress

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Create Types File | ✅ Complete | Created `src/screens/reader/types/tts.ts` with 15+ type definitions |
| 2 | Create Hook Skeleton | ✅ Complete | Created `src/screens/reader/hooks/useTTSController.ts` (~700 lines) |
| 3 | Migrate Refs | ✅ Complete | All 25+ TTS refs migrated in Step 2 |
| 4 | Migrate Event Listeners | ✅ Complete | All 7 event listeners migrated (onSpeechDone, onWordRange, onSpeechStart, onMediaAction, onQueueEmpty, onVoiceFallback, AppState) |
| 5 | Migrate Helper Functions | ✅ Complete | `restartTtsFromParagraphIndex`, `resumeTTS`, `updateTtsMediaNotificationState` |
| 6 | Migrate Dialog Handlers | ✅ Complete | All 10+ dialog handlers migrated |
| 7 | Migrate Background TTS Effect | ✅ Complete | Integrated in hook |
| 8 | Create Message Handler | ✅ Complete | Implemented `handleTTSMessage` for all TTS message types |
| 9 | Update WebViewReader | ✅ Complete | Using refactored version, legacy file deleted |
| 10 | Update Tests | ✅ Complete | All 23 suites (241 tests) passing |

### Final Hook Stats
- **File:** `src/screens/reader/hooks/useTTSController.ts`
- **Lines:** 2,069
- **Refs:** 25+ (all TTS refs migrated)
- **Event Listeners:** 7 (complete)
- **Dialog Handlers:** 10+ (complete)
- **Message Types Handled:** 10 (`speak`, `stop-speak`, `tts-state`, `request-tts-exit`, `exit-allowed`, `request-tts-confirmation`, `tts-scroll-prompt`, `tts-manual-mode-prompt`, `tts-resume-location-prompt`, `tts-queue`)

---

## 🔮 Future Improvements (Phase 3)

### Recommended Next Steps

The `useTTSController.ts` hook at 2,069 lines could benefit from further modularization:

| Sub-extraction | Lines (est.) | Priority | Description |
|----------------|--------------|----------|-------------|
| `useTTSEventListeners.ts` | ~400 | Medium | Extract all event listener setup |
| `useTTSDialogHandlers.ts` | ~300 | Medium | Extract dialog-related handlers |
| `useTTSMessageHandler.ts` | ~200 | Low | Extract WebView message handling |
| `useTTSWakeHandler.ts` | ~250 | Medium | Extract wake/sleep handling logic |
| `useTTSChapterNavigation.ts` | ~200 | Low | Extract chapter navigation logic |

**Benefits of Phase 3:**
- Each sub-hook becomes independently testable
- Better code organization by feature
- Easier to maintain and debug specific functionality

**Prerequisites for Phase 3:**
- All current tests continue passing
- No new features added during refactoring
- Incremental extraction with validation after each step

---

## Table of Contents
1. [Objective](#1-objective)
2. [Current State Analysis](#2-current-state-analysis)
3. [Refactoring Strategy](#3-refactoring-strategy)
4. [Step-by-Step Implementation](#4-step-by-step-implementation)
5. [Hook Interface Design](#5-hook-interface-design)
6. [Types to Extract](#6-types-to-extract)
7. [Test Strategy](#7-test-strategy)
8. [Impact Assessment](#8-impact-assessment)
9. [Rollback Strategy](#9-rollback-strategy)
10. [Success Criteria](#10-success-criteria)

---

## 1. Objective

Extract TTS-related logic from WebViewReader.tsx (~3379 lines) into a dedicated custom hook (`useTTSController`) to improve:

| Goal | Benefit |
|------|---------|
| Code maintainability | Smaller, focused files easier to understand |
| Testability | Hook can be tested independently with React Testing Library |
| Separation of concerns | TTS logic isolated from rendering logic |
| Reduce component complexity | WebViewReader focuses on WebView rendering |
| Reusability | TTS hook could potentially be reused in other contexts |

---

## 2. Current State Analysis

### 2.1 File Metrics

| Metric | Value |
|--------|-------|
| Total lines | 3,379 |
| TTS-related lines | ~1,500 (estimated) |
| Refs count | 44+ |
| TTS-specific refs | 25+ |
| Event listeners | 7 |
| Dialog components | 6 |

### 2.2 Code Categories in WebViewReader

| Category | Lines (est.) | Extract? |
|----------|--------------|----------|
| TTS State Management | ~200 | ✅ Yes |
| TTS Event Listeners | ~600 | ✅ Yes |
| TTS Helper Functions | ~300 | ✅ Yes |
| TTS Dialog Handlers | ~200 | ✅ Yes |
| Background TTS Effect | ~150 | ✅ Yes |
| WebView HTML Generation | ~150 | ❌ No |
| Settings Management | ~100 | ❌ No |
| WebView Message Handler | ~400 | Partial |
| Rendering & Dialogs | ~300 | ❌ No |
| Other Effects | ~300 | ❌ No |

### 2.3 TTS Refs to Extract

```typescript
// State tracking
isTTSReadingRef: useRef<boolean>(false)
isTTSPlayingRef: useRef<boolean>(false)
isTTSPausedRef: useRef<boolean>(false)
currentParagraphIndexRef: useRef<number>(-1)
latestParagraphIndexRef: useRef<number>
totalParagraphsRef: useRef<number>(0)

// Queue management
ttsQueueRef: useRef<{ startIndex: number; texts: string[] } | null>(null)
ttsStateRef: useRef<any>(null)
ttsSessionRef: useRef<number>(0)

// Auto-start flags
autoStartTTSRef: useRef<boolean>(false)
forceStartFromParagraphZeroRef: useRef<boolean>(false)
backgroundTTSPendingRef: useRef<boolean>(false)

// Wake handling
isWebViewSyncedRef: useRef<boolean>(true)
pendingScreenWakeSyncRef: useRef<boolean>(false)
autoResumeAfterWakeRef: useRef<boolean>(false)
wasReadingBeforeWakeRef: useRef<boolean>(false)
wakeChapterIdRef: useRef<number | null>(null)
wakeParagraphIndexRef: useRef<number | null>(null)
wakeTransitionInProgressRef: useRef<boolean>(false)
capturedWakeParagraphIndexRef: useRef<number | null>(null)
wakeResumeGracePeriodRef: useRef<number>(0)

// Chapter tracking
lastTTSChapterIdRef: useRef<number | null>
chaptersAutoPlayedRef: useRef<number>(0)
mediaNavSourceChapterIdRef: useRef<number | null>(null)
mediaNavDirectionRef: useRef<'NEXT' | 'PREV' | null>(null)

// Sync/retry
syncRetryCountRef: useRef<number>(0)

// Dialog data
pendingResumeIndexRef: useRef<number>(-1)
ttsScrollPromptDataRef: useRef<TTSScrollPromptData | null>(null)

// Timing
lastTTSPauseTimeRef: useRef<number>(0)
lastMediaActionTimeRef: useRef<number>(0)
lastStaleLogTimeRef: useRef<number>(0)
chapterTransitionTimeRef: useRef<number>(0)
```

---

## 3. Refactoring Strategy

### 3.1 Approach: Extract Custom Hook

Create a new custom hook `useTTSController` that encapsulates all TTS-related logic:

```
Before:
┌─────────────────────────────────────┐
│         WebViewReader.tsx           │
│  ┌─────────────────────────────────┐│
│  │        TTS Logic (~1500 lines)  ││
│  │  • Refs (25+)                   ││
│  │  • Event listeners (7)          ││
│  │  • Helper functions             ││
│  │  • Dialog handlers              ││
│  │  • Effects                      ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │     WebView Logic (~1800 lines) ││
│  │  • HTML generation              ││
│  │  • Message handling             ││
│  │  • Settings sync                ││
│  │  • Rendering                    ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘

After:
┌───────────────────────┐     ┌─────────────────────────┐
│  useTTSController.ts  │     │   WebViewReader.tsx     │
│  (~1500 lines)        │     │   (~1800 lines)         │
│                       │     │                         │
│  • TTS state refs     │◄────│  const tts = useTTS...  │
│  • Event listeners    │     │                         │
│  • Helper functions   │     │  • HTML generation      │
│  • Dialog handlers    │     │  • WebView rendering    │
│  • Background effects │     │  • Message delegation   │
│                       │     │  • Dialog rendering     │
└───────────────────────┘     └─────────────────────────┘
```

### 3.2 Dependencies Between Hook and Component

**Hook receives from component:**
- `chapter`, `novel` - Current reading context
- `html` - Chapter HTML for paragraph extraction
- `webViewRef` - WebView reference for JS injection
- `saveProgress`, `navigateChapter`, `getChapter` - Context functions
- `nextChapter`, `prevChapter` - Adjacent chapter info
- `savedParagraphIndex` - Initial saved position
- `readerSettings`, `chapterGeneralSettings` - Settings

**Hook provides to component:**
- Dialog visibility states
- Dialog data (exit positions, conflicts, sync info)
- Handler functions for dialogs
- TTS message handler for WebView onMessage
- Current TTS state (reading, paragraph index)

---

## 4. Step-by-Step Implementation

### Step 1: Create Types File
**File:** `src/screens/reader/types/tts.ts`

Extract and define all TTS-related types:
- `WebViewPostEvent`
- `TTSScrollPromptData`
- `ConflictingChapter`
- `SyncDialogInfo`
- `TTSQueueState`
- Hook parameter and return types

### Step 2: Create Hook Skeleton
**File:** `src/screens/reader/hooks/useTTSController.ts`

Create the hook with:
- Parameter interface
- Return interface
- All refs (initially empty implementations)
- Placeholder functions

### Step 3: Migrate Refs
Move all TTS-related refs from WebViewReader to the hook:
- Copy ref declarations
- Update any internal references
- Export refs that WebViewReader needs access to

### Step 4: Migrate Event Listeners
Move TTS event listener subscriptions:
- `onSpeechDone`
- `onSpeechStart`
- `onWordRange`
- `onMediaAction`
- `onQueueEmpty`
- `onVoiceFallback`
- AppState listener (TTS-specific parts)

### Step 5: Migrate Helper Functions
Move TTS helper functions:
- `restartTtsFromParagraphIndex`
- `updateTtsMediaNotificationState`
- `resumeTTS`

### Step 6: Migrate Dialog Handlers
Move dialog-related handlers:
- `handleResumeConfirm`, `handleResumeCancel`, `handleRestartChapter`
- `handleTTSScrollSyncConfirm`, `handleTTSScrollSyncCancel`
- `handleStopTTS`, `handleContinueFollowing`
- `handleRequestTTSConfirmation`, `handleSelectChapter`

### Step 7: Migrate Background TTS Effect
Move the chapter change detection effect that handles background TTS.

### Step 8: Create Message Handler
Create `handleTTSMessage` function that processes TTS-related WebView messages:
- `speak`, `stop-speak`
- `tts-state`, `tts-queue`
- `request-tts-confirmation`
- `tts-scroll-prompt`, `tts-manual-mode-prompt`
- `show-toast` (TTS-related)

### Step 9: Update WebViewReader
- Import and use `useTTSController`
- Remove migrated code
- Update `onMessage` to delegate TTS messages
- Pass hook values to dialog components

### Step 10: Update Tests
- Create `useTTSController.test.ts`
- Update WebViewReader tests to mock the hook
- Ensure all existing tests pass

---

## 5. Hook Interface Design

### 5.1 Parameters

```typescript
interface UseTTSControllerParams {
  // Context data
  chapter: ChapterInfo;
  novel: NovelInfo;
  html: string;
  
  // Refs
  webViewRef: RefObject<WebView>;
  
  // Context functions
  saveProgress: (progress: number, paragraphIndex?: number, ttsState?: string) => void;
  navigateChapter: (direction: 'NEXT' | 'PREV') => void;
  getChapter: (chapter: ChapterInfo) => void;
  
  // Adjacent chapters
  nextChapter: ChapterInfo | null;
  prevChapter: ChapterInfo | null;
  
  // Initial state
  savedParagraphIndex?: number;
  
  // Settings (refs to avoid stale closures)
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  chapterGeneralSettingsRef: RefObject<ChapterGeneralSettings>;
}
```

### 5.2 Return Value

```typescript
interface UseTTSControllerReturn {
  // === Current State ===
  isTTSReading: boolean;
  currentParagraphIndex: number;
  totalParagraphs: number;
  
  // === Dialog Visibility ===
  resumeDialogVisible: boolean;
  scrollSyncDialogVisible: boolean;
  manualModeDialogVisible: boolean;
  showExitDialog: boolean;
  showChapterSelectionDialog: boolean;
  syncDialogVisible: boolean;
  
  // === Dialog Data ===
  exitDialogData: { ttsParagraph: number; readerParagraph: number };
  conflictingChapters: ConflictingChapter[];
  syncDialogStatus: 'syncing' | 'success' | 'failed';
  syncDialogInfo?: SyncDialogInfo;
  ttsScrollPromptData: TTSScrollPromptData | null;
  pendingResumeIndex: number;
  currentChapter: { id: number; name: string; paragraph: number };
  
  // === Dialog Handlers ===
  handleResumeConfirm: () => void;
  handleResumeCancel: () => void;
  handleRestartChapter: () => void;
  handleTTSScrollSyncConfirm: () => void;
  handleTTSScrollSyncCancel: () => void;
  handleStopTTS: () => void;
  handleContinueFollowing: () => void;
  handleSelectChapter: (targetChapterId: number) => Promise<void>;
  
  // === Dialog Dismiss ===
  hideResumeDialog: () => void;
  hideScrollSyncDialog: () => void;
  hideManualModeDialog: () => void;
  setShowExitDialog: (show: boolean) => void;
  setShowChapterSelectionDialog: (show: boolean) => void;
  setSyncDialogVisible: (visible: boolean) => void;
  
  // === Exit Dialog Handlers ===
  handleExitTTS: () => void;
  handleExitReader: () => void;
  
  // === Sync Dialog Handlers ===
  handleSyncRetry: () => void;
  
  // === WebView Integration ===
  handleTTSMessage: (event: WebViewPostEvent) => boolean; // returns true if handled
  handleBackPress: () => boolean; // returns true if handled
  
  // === Toast ===
  toastVisible: boolean;
  toastMessage: string;
  hideToast: () => void;
  
  // === Refs for WebView HTML ===
  initialSavedParagraphIndex: number;
  autoStartTTSRef: RefObject<boolean>;
  
  // === OnLoadEnd Handler ===
  handleWebViewLoadEnd: () => void;
}
```

---

## 6. Types to Extract

### 6.1 File: `src/screens/reader/types/tts.ts`

```typescript
// WebView message event
export type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number } | string[];
  startIndex?: number;
  autoStartTTS?: boolean;
  paragraphIndex?: number;
  ttsState?: any;
  chapterId?: number;
};

// TTS scroll prompt data
export type TTSScrollPromptData = {
  currentIndex: number;
  visibleIndex: number;
  isResume?: boolean;
};

// Conflicting chapter for selection dialog
export type ConflictingChapter = {
  id: number;
  name: string;
  paragraph: number;
};

// Sync dialog info
export type SyncDialogInfo = {
  chapterName: string;
  paragraphIndex: number;
  totalParagraphs: number;
  progress: number;
};

// TTS queue state
export type TTSQueueState = {
  startIndex: number;
  texts: string[];
} | null;

// Exit dialog data
export type ExitDialogData = {
  ttsParagraph: number;
  readerParagraph: number;
};
```

---

## 7. Test Strategy

### 7.1 New Test File: `useTTSController.test.ts`

**Test categories:**

1. **Initialization Tests**
   - Hook initializes with correct default state
   - Initial paragraph index calculation (DB vs MMKV vs native)

2. **Event Listener Tests**
   - `onSpeechDone` advances paragraph correctly
   - `onSpeechStart` updates current index
   - `onWordRange` triggers highlight injection
   - `onMediaAction` handles play/pause/seek/chapter
   - `onQueueEmpty` triggers chapter navigation when enabled

3. **Dialog Handler Tests**
   - Resume/cancel handlers work correctly
   - Scroll sync handlers update position
   - Exit handlers save correct position

4. **Message Handler Tests**
   - `speak` message starts TTS batch
   - `stop-speak` stops playback
   - `tts-queue` updates queue state
   - Chapter ID validation for stale messages

5. **Background TTS Tests**
   - Chapter change triggers background TTS start
   - Paragraph extraction works correctly
   - Queue builds from correct index

### 7.2 Update Existing Tests

**WebViewReader.integration.test.tsx:**
- Mock `useTTSController` hook
- Test WebView rendering independently
- Test message delegation to hook

**WebViewReader.eventHandlers.test.tsx:**
- Move TTS-specific tests to hook test file
- Keep WebView-specific tests

---

## 8. Impact Assessment

### 8.1 File Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `WebViewReader.tsx` | 3,379 lines | ~1,800 lines | -47% |
| `useTTSController.ts` | 0 | ~1,500 lines | new |
| `types/tts.ts` | 0 | ~50 lines | new |
| Tests | existing | +1 new file | update |

### 8.2 Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Broken TTS functionality | High | Comprehensive test coverage before/after |
| Stale closures in hooks | Medium | Use refs for values accessed in callbacks |
| Performance regression | Low | Hook memoization, same render patterns |
| Type errors | Medium | Strict TypeScript, thorough interface design |

### 8.3 Files Affected

| File | Impact |
|------|--------|
| `WebViewReader.tsx` | Major refactor |
| `ReaderScreen.tsx` | No change (same interface) |
| `ttsHelpers.ts` | No change |
| All dialog components | No change (same props) |
| Test files | Updates needed |

---

## 9. Rollback Strategy

If issues are discovered post-refactoring:

1. **Git revert** - All changes in single commit for easy revert
2. **Feature flag** - Could add flag to use old vs new implementation (optional)
3. **Incremental rollback** - Move functions back one at a time if partial issues

### Pre-refactoring Checklist
- [ ] All existing tests pass
- [ ] Manual TTS testing completed
- [ ] Git commit of current state

### Post-refactoring Checklist
- [ ] All existing tests pass
- [ ] New hook tests pass
- [ ] Manual TTS testing completed
- [ ] No TypeScript errors
- [ ] No console errors in dev mode

---

## 10. Success Criteria

### 10.1 Functional Requirements
- [ ] All TTS features work identically to before
- [ ] Background TTS continues working
- [ ] Screen wake/sleep handling works
- [ ] All dialog interactions work
- [ ] Media notification controls work
- [ ] Chapter navigation during TTS works

### 10.2 Code Quality Requirements
- [ ] WebViewReader.tsx < 2000 lines
- [ ] useTTSController.ts fully typed
- [ ] No `any` types (except where unavoidable)
- [ ] All functions documented with JSDoc
- [ ] Test coverage maintained or improved

### 10.3 Performance Requirements
- [ ] No additional re-renders
- [ ] Memory usage unchanged
- [ ] TTS latency unchanged

---

## Appendix: Code Movement Reference

### A.1 From WebViewReader → useTTSController

| Line Range (approx) | Content | Destination |
|---------------------|---------|-------------|
| 169-195 | Native TTS position fetch | Hook init |
| 197-220 | initialSavedParagraphIndex | Hook memo |
| 245-340 | TTS refs declarations | Hook refs |
| 363-445 | Live settings effect | Hook effect |
| 454-585 | Background TTS effect | Hook effect |
| 785-835 | restartTtsFromParagraphIndex | Hook function |
| 836-855 | totalParagraphs effect | Hook effect |
| 856-880 | handleResumeConfirm | Hook function |
| 882-895 | handleResumeCancel | Hook function |
| 897-910 | handleRestartChapter | Hook function |
| 912-945 | handleTTSScrollSync* | Hook functions |
| 947-980 | handleStopTTS, handleContinueFollowing | Hook functions |
| 960-2050 | All event listener subscriptions | Hook useEffect |
| 2130-2185 | useBackHandler TTS logic | Hook function |
| 2200-2310 | handleRequestTTSConfirmation, handleSelectChapter | Hook functions |

---

*Document created: 2025-12-14*  
*Ready for implementation*
