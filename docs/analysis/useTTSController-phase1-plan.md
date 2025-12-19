# useTTSController - Phase 1 Extraction Plan

**Risk Level:** 🟢 LOW  
**Expected Line Reduction:** ~395 lines (14% reduction)  
**Regression Risk:** ZERO (if followed precisely)  
**Estimated Time:** 2-3 hours  

---

## Phase 1 Scope: Extract 7 LOW-Risk Sections

1. **Dialog State** (`useDialogState.ts`) - 30 lines
2. **Ref Sync** (`useRefSync.ts`) - 20 lines  
3. **Utility Functions** (`useTTSUtilities.ts`) - 190 lines
4. **Exit Dialog Handlers** (`useExitDialogHandlers.ts`) - 30 lines
5. **Sync Dialog Handlers** (`useSyncDialogHandlers.ts`) - 30 lines
6. **Scroll Sync Handlers** (`useScrollSyncHandlers.ts`) - 50 lines
7. **Manual Mode Handlers** (`useManualModeHandlers.ts`) - 45 lines

**Total Extraction:** ~395 lines

---

## Implementation Order

### Step 1: Extract Dialog State (Lines 304-336)
**File:** `src/screens/reader/hooks/useDialogState.ts`

**What to Extract:**
```typescript
// Lines 304-336 from useTTSController.ts
const {
  value: resumeDialogVisible,
  setTrue: showResumeDialog,
  setFalse: hideResumeDialog,
} = useBoolean();

const {
  value: scrollSyncDialogVisible,
  setTrue: showScrollSyncDialog,
  setFalse: hideScrollSyncDialog,
} = useBoolean();

const {
  value: manualModeDialogVisible,
  setTrue: showManualModeDialog,
  setFalse: hideManualModeDialog,
} = useBoolean();

const [showExitDialog, setShowExitDialog] = useState(false);
const [exitDialogData, setExitDialogData] = useState<ExitDialogData>({
  ttsParagraph: 0,
  readerParagraph: 0,
});

const [showChapterSelectionDialog, setShowChapterSelectionDialog] = useState(false);
const [conflictingChapters, setConflictingChapters] = useState<ConflictingChapter[]>([]);

const [syncDialogVisible, setSyncDialogVisible] = useState(false);
const [syncDialogStatus, setSyncDialogStatus] = useState<SyncDialogStatus>('syncing');
const [syncDialogInfo, setSyncDialogInfo] = useState<SyncDialogInfo | undefined>(undefined);
```

**New Hook Interface:**
```typescript
export interface DialogState {
  // Resume Dialog
  resumeDialogVisible: boolean;
  showResumeDialog: () => void;
  hideResumeDialog: () => void;
  
  // Scroll Sync Dialog
  scrollSyncDialogVisible: boolean;
  showScrollSyncDialog: () => void;
  hideScrollSyncDialog: () => void;
  
  // Manual Mode Dialog
  manualModeDialogVisible: boolean;
  showManualModeDialog: () => void;
  hideManualModeDialog: () => void;
  
  // Exit Dialog
  showExitDialog: boolean;
  setShowExitDialog: (show: boolean) => void;
  exitDialogData: ExitDialogData;
  setExitDialogData: (data: ExitDialogData) => void;
  
  // Chapter Selection Dialog
  showChapterSelectionDialog: boolean;
  setShowChapterSelectionDialog: (show: boolean) => void;
  conflictingChapters: ConflictingChapter[];
  setConflictingChapters: (chapters: ConflictingChapter[]) => void;
  
  // Sync Dialog
  syncDialogVisible: boolean;
  setSyncDialogVisible: (visible: boolean) => void;
  syncDialogStatus: SyncDialogStatus;
  setSyncDialogStatus: (status: SyncDialogStatus) => void;
  syncDialogInfo?: SyncDialogInfo;
  setSyncDialogInfo: (info: SyncDialogInfo | undefined) => void;
}

export function useDialogState(): DialogState {
  // Implementation
}
```

**Dependencies:** `useBoolean` from `@hooks`, types from `../types/tts`

**Changes in useTTSController.ts:**
```typescript
// Add import
import { useDialogState } from './useDialogState';

// Replace lines 304-336 with:
const dialogState = useDialogState();

// Update all usages:
// dialogState.resumeDialogVisible
// dialogState.showResumeDialog()
// etc.
```

---

### Step 2: Extract Ref Sync (Lines 338-354)
**File:** `src/screens/reader/hooks/useRefSync.ts`

**What to Extract:**
```typescript
// Keep refs synced with props
useEffect(() => {
  progressRef.current = chapter.progress ?? 0;
}, [chapter.progress]);

useEffect(() => {
  saveProgressRef.current = saveProgress;
}, [saveProgress]);

useEffect(() => {
  nextChapterRef.current = nextChapter;
  navigateChapterRef.current = navigateChapter;
}, [nextChapter, navigateChapter]);
```

**New Hook Interface:**
```typescript
export interface RefSyncParams {
  progress: number;
  saveProgress: (progress: number, paragraphIndex?: number, ttsState?: string) => void;
  nextChapter: ChapterInfo | null | undefined;
  navigateChapter: (direction: 'NEXT' | 'PREV') => void;
  refs: {
    progressRef: RefObject<number>;
    saveProgressRef: RefObject<(progress: number, paragraphIndex?: number, ttsState?: string) => void>;
    nextChapterRef: RefObject<ChapterInfo | null | undefined>;
    navigateChapterRef: RefObject<(direction: 'NEXT' | 'PREV') => void>;
  };
}

export function useRefSync(params: RefSyncParams): void {
  // Implementation
}
```

**Dependencies:** React hooks, ChapterInfo type

**Changes in useTTSController.ts:**
```typescript
// Add import
import { useRefSync } from './useRefSync';

// Replace lines 338-354 with:
useRefSync({
  progress: chapter.progress ?? 0,
  saveProgress,
  nextChapter,
  navigateChapter,
  refs: {
    progressRef,
    saveProgressRef,
    nextChapterRef,
    navigateChapterRef,
  },
});
```

---

### Step 3: Extract Utility Functions (Lines 359-557)
**File:** `src/screens/reader/hooks/useTTSUtilities.ts`

**What to Extract:**
```typescript
// updateTtsMediaNotificationState (Lines 359-387)
const updateTtsMediaNotificationState = useCallback((nextIsPlaying: boolean) => {
  // ... implementation
}, [chapter.id, chapter.name, novel?.name]);

// updateLastTTSChapter (Lines 481-484)
const updateLastTTSChapter = useCallback((id: number) => {
  // ... implementation
}, []);

// restartTtsFromParagraphIndex (Lines 486-543)
const restartTtsFromParagraphIndex = useCallback(async (targetIndex: number) => {
  // ... implementation
}, [chapter.id, html, readerSettingsRef, updateTtsMediaNotificationState]);

// resumeTTS (Lines 545-557)
const resumeTTS = useCallback((storedState: TTSPersistenceState) => {
  // ... implementation
}, [webViewRef]);
```

**New Hook Interface:**
```typescript
export interface TTSUtilitiesParams {
  novel: NovelInfo;
  chapter: ChapterInfo;
  html: string;
  webViewRef: RefObject<WebView | null>;
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
}

export interface TTSUtilities {
  updateTtsMediaNotificationState: (nextIsPlaying: boolean) => void;
  updateLastTTSChapter: (id: number) => void;
  restartTtsFromParagraphIndex: (targetIndex: number) => Promise<void>;
  resumeTTS: (storedState: TTSPersistenceState) => void;
}

export function useTTSUtilities(params: TTSUtilitiesParams): TTSUtilities {
  // Implementation
}
```

**Dependencies:** All TTS types, TTSHighlight service, extractParagraphs, validateAndClampParagraphIndex

**Changes in useTTSController.ts:**
```typescript
// Add import
import { useTTSUtilities } from './useTTSUtilities';

// Replace lines 359-557 with:
const utilities = useTTSUtilities({
  novel,
  chapter,
  html,
  webViewRef,
  readerSettingsRef,
  refs: {
    currentParagraphIndexRef,
    totalParagraphsRef,
    latestParagraphIndexRef,
    isTTSPausedRef,
    isTTSPlayingRef,
    hasUserScrolledRef,
    ttsQueueRef,
    isTTSReadingRef,
    lastTTSChapterIdRef,
  },
});

// Update all usages:
// utilities.updateTtsMediaNotificationState(true)
// utilities.restartTtsFromParagraphIndex(idx)
// utilities.resumeTTS(state)
// utilities.updateLastTTSChapter(id)
```

---

### Step 4: Extract Exit Dialog Handlers (Lines 860-885)
**File:** `src/screens/reader/hooks/useExitDialogHandlers.ts`

**What to Extract:**
```typescript
const handleExitTTS = useCallback(() => {
  setShowExitDialog(false);
  handleStopTTS();
  saveProgress(exitDialogData.ttsParagraph);
  navigation.goBack();
}, [handleStopTTS, saveProgress, exitDialogData.ttsParagraph, navigation]);

const handleExitReader = useCallback(() => {
  setShowExitDialog(false);
  handleStopTTS();
  saveProgress(exitDialogData.readerParagraph);
  navigation.goBack();
}, [handleStopTTS, saveProgress, exitDialogData.readerParagraph, navigation]);
```

**New Hook Interface:**
```typescript
export interface ExitDialogHandlersParams {
  exitDialogData: ExitDialogData;
  saveProgress: (progress: number) => void;
  navigation: any; // NavigationProp type
  callbacks: {
    handleStopTTS: () => void;
    setShowExitDialog: (show: boolean) => void;
  };
}

export interface ExitDialogHandlers {
  handleExitTTS: () => void;
  handleExitReader: () => void;
}

export function useExitDialogHandlers(params: ExitDialogHandlersParams): ExitDialogHandlers {
  // Implementation
}
```

**Dependencies:** React hooks, ExitDialogData type

**Changes in useTTSController.ts:**
```typescript
// Add import
import { useExitDialogHandlers } from './useExitDialogHandlers';

// Replace lines 860-885 with:
const exitDialogHandlers = useExitDialogHandlers({
  exitDialogData: dialogState.exitDialogData,
  saveProgress,
  navigation,
  callbacks: {
    handleStopTTS,
    setShowExitDialog: dialogState.setShowExitDialog,
  },
});

// Update return value:
// exitDialogHandlers.handleExitTTS
// exitDialogHandlers.handleExitReader
```

---

### Step 5: Extract Sync Dialog Handlers (Lines 887-915)
**File:** `src/screens/reader/hooks/useSyncDialogHandlers.ts`

**What to Extract:**
```typescript
const handleSyncRetry = useCallback(() => {
  syncRetryCountRef.current = 0;
  if (wakeChapterIdRef.current) {
    pendingScreenWakeSyncRef.current = true;
    setSyncDialogStatus('syncing');
    getChapterFromDb(wakeChapterIdRef.current)
      .then(savedChapter => {
        if (savedChapter) {
          getChapter(savedChapter);
        } else {
          setSyncDialogStatus('failed');
        }
      })
      .catch(() => {
        setSyncDialogStatus('failed');
      });
  } else {
    setSyncDialogVisible(false);
  }
}, [getChapter]);
```

**New Hook Interface:**
```typescript
export interface SyncDialogHandlersParams {
  getChapter: (chapter: ChapterInfo) => void;
  refs: {
    syncRetryCountRef: RefObject<number>;
    wakeChapterIdRef: RefObject<number | null>;
    pendingScreenWakeSyncRef: RefObject<boolean>;
  };
  callbacks: {
    setSyncDialogStatus: (status: SyncDialogStatus) => void;
    setSyncDialogVisible: (visible: boolean) => void;
  };
}

export interface SyncDialogHandlers {
  handleSyncRetry: () => void;
}

export function useSyncDialogHandlers(params: SyncDialogHandlersParams): SyncDialogHandlers {
  // Implementation
}
```

**Dependencies:** getChapterFromDb, ChapterInfo type, SyncDialogStatus type

**Changes in useTTSController.ts:**
```typescript
// Add import
import { useSyncDialogHandlers } from './useSyncDialogHandlers';

// Replace lines 887-915 with:
const syncDialogHandlers = useSyncDialogHandlers({
  getChapter,
  refs: {
    syncRetryCountRef,
    wakeChapterIdRef,
    pendingScreenWakeSyncRef,
  },
  callbacks: {
    setSyncDialogStatus: dialogState.setSyncDialogStatus,
    setSyncDialogVisible: dialogState.setSyncDialogVisible,
  },
});

// Update return value:
// syncDialogHandlers.handleSyncRetry
```

---

### Step 6: Extract Scroll Sync Handlers (Lines 626-675)
**File:** `src/screens/reader/hooks/useScrollSyncHandlers.ts`

**What to Extract:**
```typescript
const handleTTSScrollSyncConfirm = useCallback(() => {
  if (ttsScrollPromptDataRef.current) {
    const { visibleIndex, isResume } = ttsScrollPromptDataRef.current;
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.changeParagraphPosition) {
        window.tts.changeParagraphPosition(${visibleIndex});
        ${isResume ? 'window.tts.resume(true);' : ''}
      }
      true;
    `);
  }
  ttsScrollPromptDataRef.current = null;
}, [webViewRef]);

const handleTTSScrollSyncCancel = useCallback(() => {
  if (ttsScrollPromptDataRef.current) {
    const { isResume } = ttsScrollPromptDataRef.current;
    if (isResume) {
      webViewRef.current?.injectJavaScript(`
        if (window.tts && window.tts.resume) {
          window.tts.resume(true);
        }
        true;
      `);
    }
  }
  ttsScrollPromptDataRef.current = null;
}, [webViewRef]);
```

**New Hook Interface:**
```typescript
export interface ScrollSyncHandlersParams {
  webViewRef: RefObject<WebView | null>;
  refs: {
    ttsScrollPromptDataRef: RefObject<TTSScrollPromptData | null>;
  };
  callbacks: {
    hideScrollSyncDialog: () => void;
  };
}

export interface ScrollSyncHandlers {
  handleTTSScrollSyncConfirm: () => void;
  handleTTSScrollSyncCancel: () => void;
}

export function useScrollSyncHandlers(params: ScrollSyncHandlersParams): ScrollSyncHandlers {
  // Implementation
}
```

**Dependencies:** WebView, TTSScrollPromptData type

**Changes in useTTSController.ts:**
```typescript
// Add import
import { useScrollSyncHandlers } from './useScrollSyncHandlers';

// Replace lines 626-675 with:
const scrollSyncHandlers = useScrollSyncHandlers({
  webViewRef,
  refs: {
    ttsScrollPromptDataRef,
  },
  callbacks: {
    hideScrollSyncDialog: dialogState.hideScrollSyncDialog,
  },
});

// Update return value:
// scrollSyncHandlers.handleTTSScrollSyncConfirm
// scrollSyncHandlers.handleTTSScrollSyncCancel
```

---

### Step 7: Extract Manual Mode Handlers (Lines 677-719)
**File:** `src/screens/reader/hooks/useManualModeHandlers.ts`

**What to Extract:**
```typescript
const handleStopTTS = useCallback(() => {
  webViewRef.current?.injectJavaScript(`
    if (window.tts && window.tts.handleManualModeDialog) {
      window.tts.handleManualModeDialog('stop');
    }
    true;
  `);
  isTTSReadingRef.current = false;
  isTTSPlayingRef.current = false;
  hasUserScrolledRef.current = false;
  TTSHighlight.stop();
  showToastMessage('Switched to manual reading mode');
  hideManualModeDialog();
}, [webViewRef, showToastMessage, hideManualModeDialog]);

const handleContinueFollowing = useCallback(() => {
  webViewRef.current?.injectJavaScript(`
    if (window.tts && window.tts.handleManualModeDialog) {
      window.tts.handleManualModeDialog('continue');
    }
    true;
  `);
  hideManualModeDialog();
}, [webViewRef, hideManualModeDialog]);
```

**New Hook Interface:**
```typescript
export interface ManualModeHandlersParams {
  webViewRef: RefObject<WebView | null>;
  showToastMessage: (message: string) => void;
  refs: {
    isTTSReadingRef: RefObject<boolean>;
    isTTSPlayingRef: RefObject<boolean>;
    hasUserScrolledRef: RefObject<boolean>;
  };
  callbacks: {
    hideManualModeDialog: () => void;
  };
}

export interface ManualModeHandlers {
  handleStopTTS: () => void;
  handleContinueFollowing: () => void;
}

export function useManualModeHandlers(params: ManualModeHandlersParams): ManualModeHandlers {
  // Implementation
}
```

**Dependencies:** WebView, TTSHighlight service

**Changes in useTTSController.ts:**
```typescript
// Add import
import { useManualModeHandlers } from './useManualModeHandlers';

// Replace lines 677-719 with:
const manualModeHandlers = useManualModeHandlers({
  webViewRef,
  showToastMessage,
  refs: {
    isTTSReadingRef,
    isTTSPlayingRef,
    hasUserScrolledRef,
  },
  callbacks: {
    hideManualModeDialog: dialogState.hideManualModeDialog,
  },
});

// Update return value:
// manualModeHandlers.handleStopTTS
// manualModeHandlers.handleContinueFollowing
```

---

## Post-Extraction Changes in useTTSController.ts

### Updated Imports
```typescript
// Add these imports at the top
import { useDialogState } from './useDialogState';
import { useRefSync } from './useRefSync';
import { useTTSUtilities } from './useTTSUtilities';
import { useExitDialogHandlers } from './useExitDialogHandlers';
import { useSyncDialogHandlers } from './useSyncDialogHandlers';
import { useScrollSyncHandlers } from './useScrollSyncHandlers';
import { useManualModeHandlers } from './useManualModeHandlers';
```

### Usage Pattern
```typescript
export function useTTSController(params: UseTTSControllerParams): UseTTSControllerReturn {
  // ... existing refs (Lines 237-302) - UNCHANGED
  
  // ✅ NEW: Replace lines 304-336 with dialog state hook
  const dialogState = useDialogState();
  
  // ✅ NEW: Replace lines 338-354 with ref sync hook
  useRefSync({
    progress: chapter.progress ?? 0,
    saveProgress,
    nextChapter,
    navigateChapter,
    refs: { progressRef, saveProgressRef, nextChapterRef, navigateChapterRef },
  });
  
  // ... Chapter Change Effect (Lines 389-422) - UNCHANGED
  // ... Background TTS Effect (Lines 424-598) - UNCHANGED
  
  // ✅ NEW: Replace lines 359-557 with utilities hook
  const utilities = useTTSUtilities({
    novel,
    chapter,
    html,
    webViewRef,
    readerSettingsRef,
    refs: {
      currentParagraphIndexRef,
      totalParagraphsRef,
      latestParagraphIndexRef,
      isTTSPausedRef,
      isTTSPlayingRef,
      hasUserScrolledRef,
      ttsQueueRef,
      isTTSReadingRef,
      lastTTSChapterIdRef,
    },
  });
  
  // ... Dialog Handlers (Lines 559-858) - UNCHANGED for now (Phase 2)
  
  // ✅ NEW: Replace lines 860-885 with exit dialog handlers
  const exitDialogHandlers = useExitDialogHandlers({
    exitDialogData: dialogState.exitDialogData,
    saveProgress,
    navigation,
    callbacks: {
      handleStopTTS: manualModeHandlers.handleStopTTS, // Will be available after manual mode extraction
      setShowExitDialog: dialogState.setShowExitDialog,
    },
  });
  
  // ✅ NEW: Replace lines 887-915 with sync dialog handlers
  const syncDialogHandlers = useSyncDialogHandlers({
    getChapter,
    refs: { syncRetryCountRef, wakeChapterIdRef, pendingScreenWakeSyncRef },
    callbacks: {
      setSyncDialogStatus: dialogState.setSyncDialogStatus,
      setSyncDialogVisible: dialogState.setSyncDialogVisible,
    },
  });
  
  // ✅ NEW: Replace lines 626-675 with scroll sync handlers
  const scrollSyncHandlers = useScrollSyncHandlers({
    webViewRef,
    refs: { ttsScrollPromptDataRef },
    callbacks: { hideScrollSyncDialog: dialogState.hideScrollSyncDialog },
  });
  
  // ✅ NEW: Replace lines 677-719 with manual mode handlers
  const manualModeHandlers = useManualModeHandlers({
    webViewRef,
    showToastMessage,
    refs: { isTTSReadingRef, isTTSPlayingRef, hasUserScrolledRef },
    callbacks: { hideManualModeDialog: dialogState.hideManualModeDialog },
  });
  
  // ... Back Handler (Lines 917-1011) - UNCHANGED
  // ... WebView Message Handler (Lines 1013-1354) - UNCHANGED
  // ... WebView Load End Handler (Lines 1356-1691) - UNCHANGED
  // ... Total Paragraphs Effect (Lines 1693-1700) - UNCHANGED
  // ... Native Event Listeners (Lines 1702-2629) - UNCHANGED
  
  // ✅ UPDATED: Return value uses extracted hooks
  return {
    // Dialog State from dialogState hook
    ...dialogState,
    
    // Utilities exposed directly (no namespace needed since they were standalone)
    updateTtsMediaNotificationState: utilities.updateTtsMediaNotificationState,
    updateLastTTSChapter: utilities.updateLastTTSChapter,
    restartTtsFromParagraphIndex: utilities.restartTtsFromParagraphIndex,
    resumeTTS: utilities.resumeTTS,
    
    // Exit handlers
    handleExitTTS: exitDialogHandlers.handleExitTTS,
    handleExitReader: exitDialogHandlers.handleExitReader,
    
    // Sync handlers
    handleSyncRetry: syncDialogHandlers.handleSyncRetry,
    
    // Scroll sync handlers
    handleTTSScrollSyncConfirm: scrollSyncHandlers.handleTTSScrollSyncConfirm,
    handleTTSScrollSyncCancel: scrollSyncHandlers.handleTTSScrollSyncCancel,
    
    // Manual mode handlers
    handleStopTTS: manualModeHandlers.handleStopTTS,
    handleContinueFollowing: manualModeHandlers.handleContinueFollowing,
    
    // ... rest of return value UNCHANGED
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
**Expected:** No new lint errors (existing warnings OK)

### 3. Unit Tests
```bash
pnpm test
```
**Expected:** All existing tests pass (241/241)

### 4. Integration Test Checklist

#### Dialog State
- [ ] Resume dialog shows/hides correctly
- [ ] Scroll sync dialog shows/hides correctly
- [ ] Manual mode dialog shows/hides correctly
- [ ] Exit dialog shows/hides correctly
- [ ] Chapter selection dialog shows/hides correctly
- [ ] Sync dialog shows/hides correctly

#### Utilities
- [ ] TTS media notification updates correctly
- [ ] Restart TTS from paragraph index works
- [ ] Resume TTS restores state correctly
- [ ] Last TTS chapter ID persists to MMKV

#### Exit Handlers
- [ ] Exit TTS saves TTS position and navigates back
- [ ] Exit Reader saves reader position and navigates back

#### Sync Handlers
- [ ] Sync retry navigates to correct chapter
- [ ] Sync failure shows error dialog

#### Scroll Sync Handlers
- [ ] Scroll sync confirm moves to visible position
- [ ] Scroll sync cancel resumes from current position

#### Manual Mode Handlers
- [ ] Stop TTS stops playback and shows toast
- [ ] Continue following resumes TTS

### 5. Device Testing (If possible)
- [ ] Play/pause TTS
- [ ] Chapter navigation (PREV/NEXT)
- [ ] Screen wake during TTS
- [ ] Background playback
- [ ] Media controls

---

## Rollback Plan

If ANY regression is detected:

1. **Identify the problematic extraction**
2. **Revert the specific hook file**
3. **Restore original code in useTTSController.ts**
4. **Run tests again to confirm**
5. **Document the issue**

Git commands:
```bash
# Revert specific file
git checkout HEAD -- src/screens/reader/hooks/useDialogState.ts

# Revert useTTSController.ts changes
git checkout HEAD -- src/screens/reader/hooks/useTTSController.ts

# Run tests
pnpm test
```

---

## Success Criteria

✅ All 7 hooks created and imported  
✅ useTTSController.ts reduced by ~395 lines  
✅ Zero TypeScript errors  
✅ Zero new lint errors  
✅ All 241 tests passing  
✅ Manual testing shows no behavioral changes  
✅ Code is more maintainable and testable  

---

## Notes

- **Extract in order** (1 → 7) to avoid circular dependencies
- **Test after each extraction** to catch regressions early
- **Update return value incrementally** as hooks are added
- **Preserve all comments** during extraction
- **Maintain exact behavior** - no logic changes

**Estimated Completion:** 2-3 hours for careful extraction + testing
