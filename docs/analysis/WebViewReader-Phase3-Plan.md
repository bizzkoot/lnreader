# WebViewReader Phase 3 Refactoring Plan - OPTIONAL Further Modularization

**Created:** 2025-12-14  
**Status:** 🟡 **PROPOSAL - AWAITING APPROVAL**  
**Target File:** `src/screens/reader/hooks/useTTSController.ts` (2797 lines)  
**Current State:** ✅ **STABLE & WORKING** (Phase 2 complete, zero regressions)

---

## ⚠️ CRITICAL CONTEXT - READ FIRST

### Current State: STABLE

Phase 1-2 refactoring is **COMPLETE** with:
- ✅ All 241 tests passing (23 test suites)
- ✅ Zero TypeScript errors
- ✅ All TTS features working: foreground, background, wake/sleep, media controls
- ✅ 100% functional parity with original 3,379-line monolithic file
- ✅ Production-ready, users can use it safely

### Phase 3 is OPTIONAL

**Phase 3 is NOT required for functionality.** It's purely for:
- Better code organization by feature area
- Independent testing of sub-components
- Easier maintenance of specific functionality
- Clearer responsibility boundaries

**Risk/Reward Trade-off:**
- **Risk**: Any extraction error → potential regression, debugging time, user impact
- **Reward**: Slightly easier maintenance, marginally better test isolation

---

## 📚 Lessons Learned from Phase 1-2 (MUST READ)

### Critical Mistakes That Caused Regressions

**See detailed analysis in:** `docs/analysis/WebViewReader-refactor-fixes.md`

#### Top 5 Mistakes to NEVER Repeat:

1. **Missing Effects** - Background TTS Effect completely omitted → media controls broken
2. **Incomplete Implementations** - Wake handling reduced to 40-line placeholder → UI desync
3. **Missing Chapter Mismatch Handler** - 200 lines omitted → silent data corruption
4. **Ref Synchronization Bugs** - prevChapterIdRef not updated → all events marked stale
5. **Flag Lifecycle Bugs** - backgroundTTSPendingRef never cleared → infinite loop

#### ZERO TOLERANCE Policy for Phase 3:

- ❌ **NO placeholders** - No `// TODO:`, no `// Simplified version`, no `// Would implement here`
- ❌ **NO "mostly works"** - 100% parity or don't extract
- ❌ **NO assumptions** - Verify every dependency explicitly
- ✅ **VERIFY effects completeness** - Count before, count after, must match
- ✅ **TEST background mode** - Screen-off testing mandatory
- ✅ **TEST wake/sleep** - Lock/unlock cycles mandatory
- ✅ **LINE-BY-LINE review** - Don't trust refactor plans, verify with eyes

---

## 🎯 Phase 3 Objectives

### Goal: Extract 5 Focused Sub-Hooks

| Sub-Hook | Lines (est.) | Priority | Risk Level | Description |
|----------|--------------|----------|------------|-------------|
| `useTTSEventListeners.ts` | ~800 | Medium | 🟠 HIGH | All 7 native event listener subscriptions |
| `useTTSDialogHandlers.ts` | ~400 | Low | 🟡 MEDIUM | Dialog state + handlers (resume, scroll, exit, etc.) |
| `useTTSWakeHandler.ts` | ~350 | High | 🔴 CRITICAL | Full wake/sleep handling (AppState 'active' branch) |
| `useTTSMessageHandler.ts` | ~250 | Low | 🟡 MEDIUM | WebView message routing for TTS events |
| `useTTSChapterNav.ts` | ~200 | Medium | 🟠 HIGH | PREV/NEXT chapter media control logic |

**Total Extraction:** ~2000 lines → 5 hooks  
**Remaining in useTTSController:** ~797 lines (core state + orchestration)

### Benefits (If Successful):

1. **Better Testing**: Each sub-hook independently testable with React Testing Library
2. **Clearer Boundaries**: Event handling separate from dialog handling separate from wake logic
3. **Easier Debugging**: Bug in wake logic? Look in `useTTSWakeHandler.ts`, not 2797-line file
4. **Simpler Maintenance**: Change dialog logic without touching event listeners
5. **Code Reusability**: Sub-hooks could potentially be reused in other contexts

### Risks (If Done Incorrectly):

1. **Regressions**: Missing effects, incomplete logic, broken functionality
2. **Debugging Difficulty**: Harder to trace issues across 6 files vs 1
3. **Integration Bugs**: Hooks passing wrong data, timing issues, circular dependencies
4. **Testing Overhead**: Must maintain tests for main hook AND 5 sub-hooks
5. **Premature Optimization**: Time spent on refactor vs new features

---

## 🔍 Detailed Extraction Analysis

### Extraction 1: useTTSEventListeners.ts (🔴 HIGH RISK)

**Lines:** ~1764-2560 (onSpeechDone, onWordRange, onSpeechStart, onMediaAction, onQueueEmpty, onVoiceFallback, AppState listener minus wake handling)

**Why HIGH RISK:**
- 7 interdependent event listeners
- Complex validation logic (chapter ID, paragraph bounds, queue state)
- Timing dependencies (debounce, throttle, grace periods)
- Modifies many refs (currentParagraphIndexRef, isTTSReadingRef, etc.)
- Critical for ALL TTS functionality

**Dependencies:**
```typescript
// Refs (READ + WRITE):
- currentParagraphIndexRef
- latestParagraphIndexRef
- isTTSReadingRef
- isTTSPlayingRef
- isTTSPausedRef
- ttsQueueRef
- prevChapterIdRef
- wakeTransitionInProgressRef
- isWebViewSyncedRef
- mediaNavSourceChapterIdRef
- mediaNavDirectionRef
- lastStaleLogTimeRef
- lastMediaActionTimeRef
- chaptersAutoPlayedRef
- wakeResumeGracePeriodRef
- ttsStateRef
- totalParagraphsRef
- progressRef
- hasUserScrolledRef
- nextChapterRef
- navigateChapterRef
- saveProgressRef
- lastTTSPauseTimeRef
- lastTTSChapterIdRef
- autoStartTTSRef
- forceStartFromParagraphZeroRef
- backgroundTTSPendingRef

// Props:
- chapter (id, name)
- html
- webViewRef
- nextChapter
- prevChapter
- readerSettingsRef
- chapterGeneralSettingsRef
- showToastMessage
- saveProgress
- navigateChapter
- updateTtsMediaNotificationState
- restartTtsFromParagraphIndex
```

**Interface Design:**

```typescript
interface UseTTSEventListenersParams {
  // All refs from main hook (passed by ref, not copied)
  refs: {
    currentParagraphIndexRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
    isTTSReadingRef: RefObject<boolean>;
    // ... all other refs (25+ refs)
  };
  
  // Context data
  chapter: ChapterInfo;
  html: string;
  nextChapter: ChapterInfo | null;
  prevChapter: ChapterInfo | null;
  
  // Settings
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  chapterGeneralSettingsRef: RefObject<ChapterGeneralSettings>;
  
  // Callbacks
  showToastMessage: (msg: string) => void;
  saveProgress: (progress: number, paragraphIndex?: number) => void;
  navigateChapter: (direction: 'NEXT' | 'PREV') => void;
  updateTtsMediaNotificationState: (isPlaying: boolean) => void;
  restartTtsFromParagraphIndex: (index: number) => Promise<void>;
  
  // WebView
  webViewRef: RefObject<WebView>;
}

interface UseTTSEventListenersReturn {
  // No return value - listeners auto-subscribe in useEffect
  // Cleanup happens in useEffect return
}
```

**Extraction Steps:**

1. Create `src/screens/reader/hooks/useTTSEventListeners.ts`
2. Define interface with ALL dependencies (don't guess!)
3. Copy listener subscriptions (lines ~1764-2560)
4. Replace `chapter` with `params.chapter`, `html` with `params.html`, etc.
5. Update all `showToastMessage()` to `params.showToastMessage()`
6. Verify ESLint warnings - fix exhaustive-deps
7. Run TypeScript - fix all errors
8. Import in useTTSController, call `useTTSEventListeners({ refs, ...props })`
9. Delete original listener code from useTTSController
10. Test: ALL TTS functionality (foreground + background + wake)

**Testing Checklist:**
- [ ] TTS starts from paragraph 0
- [ ] TTS continues to next paragraph
- [ ] Word-level highlighting works
- [ ] PLAY/PAUSE button works
- [ ] SEEK_FORWARD works
- [ ] SEEK_BACK works
- [ ] PREV_CHAPTER works (foreground)
- [ ] NEXT_CHAPTER works (foreground)
- [ ] PREV_CHAPTER works (background, screen locked)
- [ ] NEXT_CHAPTER works (background, screen locked)
- [ ] onQueueEmpty auto-navigates to next chapter
- [ ] Voice fallback shows toast
- [ ] No [STALE] event errors in logs

**Rollback Plan:**
- If ANY test fails: `git reset --hard HEAD~1`
- Review what was missed
- Don't proceed until 100% working

---

### Extraction 2: useTTSDialogHandlers.ts (🟡 MEDIUM RISK)

**Lines:** ~720-960 (dialog handlers) + dialog state (~380-415)

**Why MEDIUM RISK:**
- Many handlers but mostly independent
- State management straightforward (useState + useBoolean)
- Some WebView injection (potential timing issues)
- Dependencies on refs but mostly READ-only

**Dependencies:**
```typescript
// Refs (mostly READ):
- latestParagraphIndexRef (READ)
- currentParagraphIndexRef (READ)
- pendingResumeIndexRef (READ + WRITE)
- ttsScrollPromptDataRef (READ + WRITE)
- lastTTSPauseTimeRef (READ)
- lastTTSChapterIdRef (READ)
- isTTSReadingRef (WRITE in handleStopTTS)
- isTTSPlayingRef (WRITE in handleStopTTS)
- hasUserScrolledRef (WRITE in handleStopTTS)

// Props:
- chapter (id, name, ttsState)
- novel (id)
- webViewRef
- chapterGeneralSettingsRef
- showToastMessage
- resumeTTS (callback)
- updateLastTTSChapter (callback)
- getChapter (callback)

// External functions:
- markChaptersBeforePositionRead
- resetFutureChaptersProgress
- getRecentReadingChapters
- MMKVStorage
```

**Interface Design:**

```typescript
interface UseTTSDialogHandlersParams {
  // Refs (pass originals, not copies)
  refs: {
    latestParagraphIndexRef: RefObject<number>;
    currentParagraphIndexRef: RefObject<number>;
    pendingResumeIndexRef: RefObject<number>;
    ttsScrollPromptDataRef: RefObject<TTSScrollPromptData | null>;
    lastTTSPauseTimeRef: RefObject<number>;
    lastTTSChapterIdRef: RefObject<number | null>;
    isTTSReadingRef: RefObject<boolean>;
    isTTSPlayingRef: RefObject<boolean>;
    hasUserScrolledRef: RefObject<boolean>;
  };
  
  // Context
  chapter: ChapterInfo;
  novel: NovelInfo;
  webViewRef: RefObject<WebView>;
  chapterGeneralSettingsRef: RefObject<ChapterGeneralSettings>;
  
  // Callbacks
  showToastMessage: (msg: string) => void;
  resumeTTS: (state: TTSPersistenceState) => void;
  updateLastTTSChapter: (id: number) => void;
  getChapter: (chapter: ChapterInfo) => void;
  saveProgress: (progress: number) => void;
}

interface UseTTSDialogHandlersReturn {
  // Dialog State
  resumeDialogVisible: boolean;
  scrollSyncDialogVisible: boolean;
  manualModeDialogVisible: boolean;
  showExitDialog: boolean;
  showChapterSelectionDialog: boolean;
  
  // Dialog Data
  conflictingChapters: ConflictingChapter[];
  pendingResumeIndex: number;
  
  // Handlers
  handleResumeConfirm: () => void;
  handleResumeCancel: () => void;
  handleRestartChapter: () => void;
  handleTTSScrollSyncConfirm: () => void;
  handleTTSScrollSyncCancel: () => void;
  handleStopTTS: () => void;
  handleContinueFollowing: () => void;
  handleSelectChapter: (targetChapterId: number) => Promise<void>;
  handleRequestTTSConfirmation: (savedIndex: number) => Promise<void>;
  
  // Dialog Control
  hideResumeDialog: () => void;
  hideScrollSyncDialog: () => void;
  hideManualModeDialog: () => void;
  setShowExitDialog: (show: boolean) => void;
  setShowChapterSelectionDialog: (show: boolean) => void;
}
```

**Extraction Steps:**

1. Create `src/screens/reader/hooks/useTTSDialogHandlers.ts`
2. Move all dialog useState + useBoolean declarations
3. Move all dialog handler functions (lines ~720-960)
4. Update refs to `params.refs.refName.current`
5. Update callbacks to `params.callbackName(...)`
6. Run TypeScript, fix errors
7. Import in useTTSController, destructure return values
8. Delete original code
9. Test: ALL dialog interactions

**Testing Checklist:**
- [ ] Smart Resume dialog appears when expected
- [ ] Resume confirmation works
- [ ] Resume cancel works
- [ ] Restart chapter works
- [ ] Scroll sync dialog works
- [ ] Scroll sync confirm works
- [ ] Scroll sync cancel works
- [ ] Manual mode dialog works
- [ ] Stop TTS works
- [ ] Continue following works
- [ ] Chapter selection dialog works
- [ ] Selecting chapter navigates correctly

---

### Extraction 3: useTTSWakeHandler.ts (🔴 CRITICAL RISK)

**Lines:** ~2270-2516 (AppState 'active' branch - full wake handling)

**Why CRITICAL RISK:**
- Most complex single piece of logic (350 lines)
- Multi-step state machine: pause → validate → sync → resume
- Many timing dependencies (300ms, 500ms, 900ms delays)
- Modifies ~15 refs
- Critical for background TTS reliability
- Phase 1-2 showed this is EASY to get wrong (40 lines → 400 lines fix)

**Dependencies:**
```typescript
// Refs (READ + WRITE):
- isTTSReadingRef
- currentParagraphIndexRef
- capturedWakeParagraphIndexRef
- wakeTransitionInProgressRef
- ttsQueueRef
- ttsSessionRef
- wasReadingBeforeWakeRef
- autoResumeAfterWakeRef
- wakeChapterIdRef
- wakeParagraphIndexRef
- pendingScreenWakeSyncRef
- backgroundTTSPendingRef
- isWebViewSyncedRef
- prevChapterIdRef
- latestParagraphIndexRef
- wakeResumeGracePeriodRef
- isTTSPlayingRef

// Props:
- chapter (id)
- html
- webViewRef
- readerSettingsRef

// Functions:
- extractParagraphs
- MMKVStorage.getNumber
- TTSHighlight.pause
- TTSHighlight.stop
- TTSHighlight.speakBatch
- updateTtsMediaNotificationState
```

**Interface Design:**

```typescript
interface UseTTSWakeHandlerParams {
  // Refs (pass originals)
  refs: {
    isTTSReadingRef: RefObject<boolean>;
    currentParagraphIndexRef: RefObject<number>;
    capturedWakeParagraphIndexRef: RefObject<number | null>;
    wakeTransitionInProgressRef: RefObject<boolean>;
    ttsQueueRef: RefObject<TTSQueueState>;
    ttsSessionRef: RefObject<number>;
    wasReadingBeforeWakeRef: RefObject<boolean>;
    autoResumeAfterWakeRef: RefObject<boolean>;
    wakeChapterIdRef: RefObject<number | null>;
    wakeParagraphIndexRef: RefObject<number | null>;
    pendingScreenWakeSyncRef: RefObject<boolean>;
    backgroundTTSPendingRef: RefObject<boolean>;
    isWebViewSyncedRef: RefObject<boolean>;
    prevChapterIdRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
    wakeResumeGracePeriodRef: RefObject<number>;
    isTTSPlayingRef: RefObject<boolean>;
  };
  
  // Context
  chapter: ChapterInfo;
  html: string;
  webViewRef: RefObject<WebView>;
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  
  // Callbacks
  updateTtsMediaNotificationState: (isPlaying: boolean) => void;
}

interface UseTTSWakeHandlerReturn {
  // Returns cleanup function only
  // Everything else is side effects via refs
}
```

**Extraction Steps:**

1. Create `src/screens/reader/hooks/useTTSWakeHandler.ts`
2. **CAREFULLY** copy AppState 'active' branch (lines ~2270-2516)
3. Extract into separate `handleScreenWake` function
4. Call from AppState listener
5. Preserve ALL setTimeout delays (300ms, 500ms, 900ms)
6. Preserve ALL guard clauses
7. Run TypeScript, fix errors
8. Import in useTTSController
9. Call from AppState listener: `if (nextAppState === 'active') useTTSWakeHandler.handleWake()`
10. Test EXTENSIVELY: wake scenarios are hardest to get right

**Testing Checklist:**
- [ ] Lock screen during TTS → unlock → TTS resumes from correct position
- [ ] Lock → TTS advances 10 paragraphs → unlock → WebView scrolls to paragraph 10
- [ ] Lock → TTS advances to next chapter → unlock → sync dialog appears
- [ ] Lock → TTS advances to next chapter → unlock → auto-navigates to correct chapter
- [ ] Lock → unlock rapidly → no race conditions
- [ ] Wake → resume → lock → wake again → still works
- [ ] Wake during PREV_CHAPTER → correct chapter loads
- [ ] Wake during NEXT_CHAPTER → correct chapter loads
- [ ] No stale events during wake transition
- [ ] No scroll saves overwrite TTS position during wake sync

**Rollback Plan:**
- Wake logic is FRAGILE - if ANY test fails, rollback immediately
- Don't try to "fix forward" - revert and analyze
- This extraction has HIGHEST regression risk

---

### Extraction 4: useTTSMessageHandler.ts (🟡 MEDIUM RISK)

**Lines:** ~1230-1450 (handleTTSMessage function)

**Why MEDIUM RISK:**
- Large switch/case statement, but mostly independent branches
- Some branches complex (speak → batch logic), others simple (stop-speak)
- Modifies refs but validated by TypeScript
- Dependency on WebView for injection

**Dependencies:**
```typescript
// Refs (mostly WRITE):
- wakeTransitionInProgressRef (READ)
- isTTSReadingRef (WRITE)
- hasUserScrolledRef (WRITE)
- currentParagraphIndexRef (READ + WRITE)
- ttsQueueRef (WRITE)
- ttsStateRef (WRITE)
- ttsScrollPromptDataRef (WRITE)
- wakeResumeGracePeriodRef (READ)

// Props:
- chapter (id)
- html
- webViewRef
- readerSettingsRef
- chapterGeneralSettingsRef
- navigation

// Functions:
- extractParagraphs
- TTSHighlight.speak
- TTSHighlight.speakBatch
- TTSHighlight.addToBatch
- TTSHighlight.fullStop
- handleRequestTTSConfirmation
- showScrollSyncDialog
- showManualModeDialog
- setExitDialogData
- setShowExitDialog
```

**Interface Design:**

```typescript
interface UseTTSMessageHandlerParams {
  // Refs
  refs: {
    wakeTransitionInProgressRef: RefObject<boolean>;
    isTTSReadingRef: RefObject<boolean>;
    hasUserScrolledRef: RefObject<boolean>;
    currentParagraphIndexRef: RefObject<number>;
    ttsQueueRef: RefObject<TTSQueueState>;
    ttsStateRef: RefObject<TTSPersistenceState | null>;
    ttsScrollPromptDataRef: RefObject<TTSScrollPromptData | null>;
    wakeResumeGracePeriodRef: RefObject<number>;
  };
  
  // Context
  chapter: ChapterInfo;
  html: string;
  webViewRef: RefObject<WebView>;
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  chapterGeneralSettingsRef: RefObject<ChapterGeneralSettings>;
  navigation: any; // NavigationProp
  
  // Callbacks
  handleRequestTTSConfirmation: (savedIndex: number) => Promise<void>;
  showScrollSyncDialog: () => void;
  showManualModeDialog: () => void;
  setExitDialogData: (data: ExitDialogData) => void;
  setShowExitDialog: (show: boolean) => void;
}

interface UseTTSMessageHandlerReturn {
  handleTTSMessage: (event: WebViewPostEvent) => boolean;
}
```

**Extraction Steps:**

1. Create `src/screens/reader/hooks/useTTSMessageHandler.ts`
2. Move `handleTTSMessage` function (lines ~1230-1450)
3. Wrap in `useCallback` with proper dependencies
4. Update refs to `params.refs.refName.current`
5. Update callbacks to `params.callbackName(...)`
6. Run TypeScript, fix errors
7. Import in useTTSController, use returned `handleTTSMessage`
8. Delete original code
9. Test: ALL WebView message types

**Testing Checklist:**
- [ ] `speak` message starts TTS
- [ ] `speak` with batch mode queues properly
- [ ] `stop-speak` stops TTS
- [ ] `tts-state` updates ttsStateRef
- [ ] `request-tts-exit` shows exit dialog
- [ ] `exit-allowed` navigates back
- [ ] `request-tts-confirmation` shows resume dialog
- [ ] `tts-scroll-prompt` shows scroll sync dialog
- [ ] `tts-manual-mode-prompt` shows manual mode dialog
- [ ] `tts-resume-location-prompt` shows scroll sync with isResume flag
- [ ] `tts-queue` updates queue ref
- [ ] `tts-queue` validates chapter ID
- [ ] `tts-queue` respects wake grace period
- [ ] `tts-queue` adds to batch when background playback enabled

---

### Extraction 5: useTTSChapterNav.ts (🟠 HIGH RISK)

**Lines:** Extracted from onMediaAction handler (PREV_CHAPTER and NEXT_CHAPTER branches, ~100 lines each)

**Why HIGH RISK:**
- Critical for media notification controls
- Updates database (progress, read/unread status)
- Updates MMKV storage
- Sets multiple flags for background TTS
- Calls navigation
- Phase 1-2 had bugs here (media nav broken during background)

**Dependencies:**
```typescript
// Refs (WRITE):
- isWebViewSyncedRef
- mediaNavSourceChapterIdRef
- mediaNavDirectionRef
- isTTSReadingRef
- isTTSPausedRef
- autoStartTTSRef
- forceStartFromParagraphZeroRef
- backgroundTTSPendingRef
- currentParagraphIndexRef
- latestParagraphIndexRef

// Props:
- chapter (id)
- nextChapter
- prevChapter
- navigateChapter

// Functions:
- updateChapterProgressDb
- markChapterRead
- markChapterUnread
- MMKVStorage.set
- showToastMessage
- updateTtsMediaNotificationState
```

**Interface Design:**

```typescript
interface UseTTSChapterNavParams {
  // Refs
  refs: {
    isWebViewSyncedRef: RefObject<boolean>;
    mediaNavSourceChapterIdRef: RefObject<number | null>;
    mediaNavDirectionRef: RefObject<MediaNavDirection>;
    isTTSReadingRef: RefObject<boolean>;
    isTTSPausedRef: RefObject<boolean>;
    autoStartTTSRef: RefObject<boolean>;
    forceStartFromParagraphZeroRef: RefObject<boolean>;
    backgroundTTSPendingRef: RefObject<boolean>;
    currentParagraphIndexRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
  };
  
  // Context
  chapter: ChapterInfo;
  nextChapter: ChapterInfo | null;
  prevChapter: ChapterInfo | null;
  
  // Callbacks
  navigateChapter: (direction: 'NEXT' | 'PREV') => void;
  showToastMessage: (msg: string) => void;
  updateTtsMediaNotificationState: (isPlaying: boolean) => void;
}

interface UseTTSChapterNavReturn {
  handlePrevChapter: () => Promise<void>;
  handleNextChapter: () => Promise<void>;
}
```

**Extraction Steps:**

1. Create `src/screens/reader/hooks/useTTSChapterNav.ts`
2. Extract PREV_CHAPTER logic → `handlePrevChapter`
3. Extract NEXT_CHAPTER logic → `handleNextChapter`
4. Wrap in `useCallback` with dependencies
5. Update refs to `params.refs.refName.current`
6. Run TypeScript, fix errors
7. Import in useTTSController
8. Call from onMediaAction: `if (action === 'PREV_CHAPTER') return useTTSChapterNav.handlePrevChapter()`
9. Delete original branches
10. Test: Chapter navigation via media controls

**Testing Checklist:**
- [ ] PREV_CHAPTER navigates to previous chapter (foreground)
- [ ] PREV_CHAPTER navigates to previous chapter (background, screen locked)
- [ ] PREV_CHAPTER marks current chapter as in-progress (1%)
- [ ] PREV_CHAPTER resets previous chapter to 0%
- [ ] PREV_CHAPTER starts TTS from paragraph 0
- [ ] NEXT_CHAPTER navigates to next chapter (foreground)
- [ ] NEXT_CHAPTER navigates to next chapter (background, screen locked)
- [ ] NEXT_CHAPTER marks current chapter as read (100%)
- [ ] NEXT_CHAPTER resets next chapter to 0%
- [ ] NEXT_CHAPTER starts TTS from paragraph 0
- [ ] No chapter available → shows toast
- [ ] Progress confirmation after 5 paragraphs works

---

## 📋 Implementation Sequence (Dependency Order)

### Step 1: Extract Dialog Handlers (🟡 LOWEST RISK)

**Order Justification:** Dialog handlers are mostly self-contained, don't affect event processing

**Checklist:**
- [ ] Create useTTSDialogHandlers.ts
- [ ] Define interface with ALL dependencies
- [ ] Move dialog state + handlers
- [ ] Update useTTSController to use hook
- [ ] Run `pnpm run type-check` → ✅ zero errors
- [ ] Run `pnpm run lint` → ✅ zero errors (except existing warnings)
- [ ] Test ALL dialog interactions (12 test cases)
- [ ] Git commit: "refactor: extract dialog handlers to useTTSDialogHandlers"
- [ ] Manual device test: dialogs work in all scenarios

**Rollback Trigger:** ANY test failure → `git reset --hard HEAD~1`

---

### Step 2: Extract Message Handler (🟡 MEDIUM RISK)

**Order Justification:** Message handler is input-driven, doesn't initiate actions

**Checklist:**
- [ ] Create useTTSMessageHandler.ts
- [ ] Define interface with ALL dependencies
- [ ] Move handleTTSMessage function
- [ ] Update useTTSController to use hook
- [ ] Run `pnpm run type-check` → ✅ zero errors
- [ ] Run `pnpm run lint` → ✅ zero errors
- [ ] Test ALL message types (14 test cases)
- [ ] Git commit: "refactor: extract message handler to useTTSMessageHandler"
- [ ] Manual device test: WebView → RN communication works

**Rollback Trigger:** ANY test failure → `git reset --hard HEAD~1`

---

### Step 3: Extract Chapter Navigation (🟠 HIGH RISK)

**Order Justification:** Chapter nav depends on event listeners (need media action event), so extract before listeners

**Checklist:**
- [ ] Create useTTSChapterNav.ts
- [ ] Define interface with ALL dependencies
- [ ] Extract PREV_CHAPTER and NEXT_CHAPTER logic
- [ ] Update onMediaAction to call hook functions
- [ ] Run `pnpm run type-check` → ✅ zero errors
- [ ] Run `pnpm run lint` → ✅ zero errors
- [ ] Test chapter navigation (12 test cases)
- [ ] **CRITICAL: Test with screen locked** (background mode)
- [ ] Git commit: "refactor: extract chapter navigation to useTTSChapterNav"
- [ ] Manual device test: media controls work foreground + background

**Rollback Trigger:** ANY test failure → `git reset --hard HEAD~1`

---

### Step 4: Extract Wake Handler (🔴 CRITICAL RISK)

**Order Justification:** Wake handler is standalone (AppState listener), extract before event listeners to reduce complexity

**Checklist:**
- [ ] Create useTTSWakeHandler.ts
- [ ] Define interface with ALL dependencies (17 refs!)
- [ ] **CAREFULLY** copy AppState 'active' branch
- [ ] Preserve ALL setTimeout delays
- [ ] Preserve ALL guard clauses
- [ ] Update useTTSController to call hook
- [ ] Run `pnpm run type-check` → ✅ zero errors
- [ ] Run `pnpm run lint` → ✅ zero errors
- [ ] Test wake scenarios (10 test cases)
- [ ] **CRITICAL: Test on physical device** (simulator doesn't replicate wake behavior)
- [ ] Git commit: "refactor: extract wake handler to useTTSWakeHandler"
- [ ] **Extensive manual device test**: lock/unlock during TTS in all modes

**Rollback Trigger:** ANY test failure → `git reset --hard HEAD~1`

**Warning:** This is the HIGHEST RISK extraction. If unsure, SKIP THIS STEP.

---

### Step 5: Extract Event Listeners (🔴 CRITICAL RISK)

**Order Justification:** Event listeners depend on all other hooks, extract LAST

**Checklist:**
- [ ] Create useTTSEventListeners.ts
- [ ] Define interface with ALL dependencies (25+ refs!)
- [ ] Move all 7 event listener subscriptions
- [ ] **VERIFY**: onSpeechDone, onWordRange, onSpeechStart, onMediaAction (remaining), onQueueEmpty, onVoiceFallback, AppState (background only)
- [ ] Update useTTSController to use hook
- [ ] Run `pnpm run type-check` → ✅ zero errors
- [ ] Run `pnpm run lint` → ✅ zero errors
- [ ] Test ALL TTS functionality (20+ test cases)
- [ ] **CRITICAL: Test background mode extensively**
- [ ] Git commit: "refactor: extract event listeners to useTTSEventListeners"
- [ ] Manual device test: TTS works in ALL scenarios

**Rollback Trigger:** ANY test failure → `git reset --hard HEAD~1`

**Warning:** This is the HIGHEST RISK extraction. Consider skipping if time-constrained.

---

## 🧪 Comprehensive Testing Strategy

### Before Starting ANY Extraction

- [ ] All 241 tests passing
- [ ] `pnpm run type-check` clean
- [ ] `pnpm run lint` clean (only existing warnings)
- [ ] Manual TTS testing: foreground works perfectly
- [ ] Manual TTS testing: background works perfectly
- [ ] Manual TTS testing: wake/sleep works perfectly
- [ ] Git status clean
- [ ] Commit: "checkpoint: before Phase 3 extraction"

### After EACH Extraction Step

**Automated Tests:**
- [ ] `pnpm run type-check` → zero new errors
- [ ] `pnpm run lint` → zero new errors
- [ ] `pnpm test` → all tests passing

**Manual Tests (Quick Smoke Test):**
- [ ] Start TTS from paragraph 0 → works
- [ ] Pause/resume via media notification → works
- [ ] Navigate chapter via media notification → works
- [ ] Lock screen → TTS continues → works
- [ ] Unlock screen → UI syncs → works
- [ ] No crash, no errors in logs

**Rollback Decision:**
- If ALL tests pass → Git commit → proceed to next step
- If ANY test fails → `git reset --hard HEAD~1` → analyze → try again

### After ALL Extractions Complete

**Full Test Suite:**

#### Foreground Tests (App Open):
- [ ] Start TTS from chapter beginning
- [ ] Start TTS from saved position
- [ ] Pause/resume via notification
- [ ] Seek forward 5 paragraphs
- [ ] Seek backward 5 paragraphs
- [ ] Navigate to previous chapter
- [ ] Navigate to next chapter
- [ ] Word-level highlighting works
- [ ] Paragraph scrolling works
- [ ] Smart Resume dialog works
- [ ] Exit dialog works

#### Background Tests (Screen Locked):
- [ ] Lock screen → TTS continues
- [ ] Lock → PREV_CHAPTER → TTS starts on new chapter
- [ ] Lock → NEXT_CHAPTER → TTS starts on new chapter
- [ ] Lock → TTS finishes chapter → auto-advances
- [ ] Lock → TTS plays 100 paragraphs → position saved

#### Wake/Sleep Tests:
- [ ] Lock → unlock after 5 paragraphs → UI syncs
- [ ] Lock → unlock after chapter change → sync dialog appears
- [ ] Lock → TTS advances to Chapter N → unlock → navigates to Chapter N
- [ ] Lock → unlock → resume works correctly
- [ ] Lock → unlock rapidly → no race conditions

#### Edge Case Tests:
- [ ] Rapid navigation (PREV → NEXT → PREV)
- [ ] Change voice during playback
- [ ] Change speed during playback
- [ ] Background → foreground transition
- [ ] Foreground → background transition
- [ ] Empty chapter (no paragraphs)
- [ ] Very long chapter (1000+ paragraphs)
- [ ] Last chapter (no next)
- [ ] First chapter (no previous)

**Success Criteria:**
- ✅ ALL automated tests pass (241 tests)
- ✅ ALL manual tests pass
- ✅ Zero new errors/warnings
- ✅ Zero regressions
- ✅ Performance unchanged (no lag, no memory leaks)

**If ANY test fails:**
- Rollback ALL extractions: `git reset --hard <checkpoint-before-Phase3-commit>`
- Document what went wrong
- Reassess if Phase 3 is worth the risk

---

## 🚨 Red Flags - STOP & ROLLBACK Immediately

### During Extraction:

- 🚩 **TypeScript error you can't fix in 5 minutes** → You missed a dependency → Rollback
- 🚩 **ESLint exhaustive-deps warning you ignore** → Will cause stale closure bug → Fix or rollback
- 🚩 **"I'll simplify this for now"** → NO PLACEHOLDERS → Rollback
- 🚩 **"That ref probably isn't needed"** → Yes it is → Add it or rollback
- 🚩 **"I'll test later"** → Test NOW or rollback
- 🚩 **More than 1 hour stuck on one extraction** → Too complex → Rollback, skip this extraction

### During Testing:

- 🚩 **TTS doesn't start** → CRITICAL → Rollback immediately
- 🚩 **TTS stops mid-chapter** → CRITICAL → Rollback immediately
- 🚩 **Position not saved** → CRITICAL → Rollback immediately
- 🚩 **[STALE] events in logs** → Chapter sync broken → Rollback immediately
- 🚩 **UI desync after wake** → Wake handling broken → Rollback immediately
- 🚩 **Media controls don't work when locked** → Background broken → Rollback immediately
- 🚩 **Any crash** → CRITICAL → Rollback immediately

---

## 📊 Risk/Reward Analysis

### Current State (No Phase 3):

| Metric | Value |
|--------|-------|
| useTTSController.ts | 2797 lines |
| Maintainability | Good (single file, all logic visible) |
| Testability | Good (can test as unit) |
| Debugging | Easy (all code in one place) |
| Functionality | ✅ 100% working |
| Stability | ✅ Zero regressions |
| User Impact | ✅ No complaints |

### After Phase 3 (If Successful):

| Metric | Value | Improvement |
|--------|-------|-------------|
| useTTSController.ts | ~797 lines | -71% |
| Sub-hooks | 5 files, ~2000 lines | Modular |
| Maintainability | Better (clear boundaries) | +20% |
| Testability | Better (independent units) | +30% |
| Debugging | Worse (6 files to trace) | -10% |
| Functionality | ✅ 100% working (if done right) | 0% |
| Stability | ⚠️ Risk of regression | ? |
| User Impact | Neutral (no visible change) | 0% |

### After Phase 3 (If Failed):

| Metric | Value | Impact |
|--------|-------|--------|
| Time Lost | 8-16 hours | Wasted |
| Regressions | 1-10 bugs | User complaints |
| Debugging Time | 10-20 hours | Fixing bugs |
| Code State | Worse than before | Broken |
| User Impact | Negative (broken TTS) | Angry users |
| Rollback Time | 1-2 hours | More time lost |

### Recommendation:

**Conservative Approach:**
- **DO:** Extractions 1 (Dialogs) and 2 (Message Handler) - LOW/MEDIUM risk, good isolation
- **CONSIDER:** Extraction 3 (Chapter Nav) - HIGH risk but isolated feature
- **SKIP:** Extractions 4 (Wake) and 5 (Event Listeners) - CRITICAL risk, high complexity

**Why Skip High-Risk Extractions:**
- Current code WORKS (Phase 2 complete, zero regressions)
- Wake logic is 350 lines of complex state machine - VERY HARD to extract correctly
- Event listeners have 25+ ref dependencies - VERY EASY to miss one
- Debugging across 6 files harder than 1 file
- No user-facing benefit (purely internal refactor)
- Phase 1-2 taught us incomplete extraction → CRITICAL bugs

**Alternative: Partial Phase 3**
- Extract only LOW/MEDIUM risk items (Dialogs + Message Handler)
- Leave HIGH/CRITICAL risk items in main hook
- Result: 1400 lines extracted, ~1400 lines remain
- Benefit: Some organization improvement, minimal regression risk

---

## 🎓 Phase 1-2 Lessons Applied

### Mistake Prevention Strategies:

| Lesson | Prevention in Phase 3 |
|--------|----------------------|
| Missing effects | Count useEffect before/after, must match |
| Incomplete implementations | NO PLACEHOLDERS - 100% parity or rollback |
| Missing chapter mismatch | Line-by-line review of all function entry points |
| Ref synchronization | Document lifecycle for EVERY ref (set → read → clear) |
| backgroundTTSPending never cleared | Trace flag lifecycle, add explicit clear logic |
| isWebViewSynced not updated | Mark unsynced BEFORE navigation actions |
| Missing stabilization delays | Preserve ALL setTimeout delays, document WHY |
| chapterTransitionTimeRef not exported | Update return interface IMMEDIATELY when adding refs |
| No background testing | Test screen-locked scenarios MANDATORY |
| No effects verification | Grep useEffect count, create mapping table |
| Placeholder comments accepted | Zero tolerance - grep for TODO/placeholder before commit |
| Incomplete line ranges | Lock original file, use git blame for ranges |

### Validation Checklist (Before Declaring Complete):

- [ ] **Effects Count Match:** `grep -c "useEffect" original.ts` = `grep -c "useEffect" hook1.ts + hook2.ts + ...`
- [ ] **Refs Count Match:** All refs from original present in extracted hooks
- [ ] **Line-by-Line Review:** Read original, check each line present in extraction
- [ ] **No Placeholders:** `git grep -i "TODO\|placeholder\|simplified" src/` → empty
- [ ] **TypeScript Clean:** `pnpm run type-check` → zero errors
- [ ] **ESLint Clean:** `pnpm run lint` → zero new errors
- [ ] **All Tests Pass:** `pnpm test` → 241/241 passing
- [ ] **Background Tests:** Screen-locked scenarios all passing
- [ ] **Wake Tests:** Lock/unlock cycles all passing
- [ ] **Device Testing:** Physical device, not just simulator

---

## 📝 Implementation Timeline

### Conservative Estimate (LOW/MEDIUM risk only):

| Step | Duration | Risk Level | Description |
|------|----------|------------|-------------|
| **Step 1: Dialogs** | 2-3 hours | 🟡 MEDIUM | Extract + test dialog handlers |
| **Step 2: Message** | 1-2 hours | 🟡 MEDIUM | Extract + test message router |
| **Testing** | 2-3 hours | - | Full regression test suite |
| **Documentation** | 1 hour | - | Update docs, memory bank |
| **TOTAL** | **6-9 hours** | - | Conservative, safe refactor |

### Aggressive Estimate (ALL extractions):

| Step | Duration | Risk Level | Description |
|------|----------|------------|-------------|
| **Step 1: Dialogs** | 2-3 hours | 🟡 MEDIUM | Extract + test |
| **Step 2: Message** | 1-2 hours | 🟡 MEDIUM | Extract + test |
| **Step 3: Chapter Nav** | 2-3 hours | 🟠 HIGH | Extract + test + background verify |
| **Step 4: Wake** | 4-5 hours | 🔴 CRITICAL | Extract + extensive testing |
| **Step 5: Event Listeners** | 3-4 hours | 🔴 CRITICAL | Extract + extensive testing |
| **Testing** | 4-6 hours | - | Full regression + edge cases |
| **Bug Fixes** | 2-4 hours | - | Fixing issues found in testing |
| **Documentation** | 1-2 hours | - | Update docs, memory bank |
| **TOTAL** | **19-29 hours** | - | High risk, uncertain outcome |

**Reality Check:**
- Phase 1-2 took longer than estimated due to missing implementations
- High-risk extractions have 50% chance of rollback on first attempt
- Debugging time not included (could add 5-10 hours)
- User impact if regression goes to production: VERY HIGH

---

## ✅ Success Criteria

### Minimum Success (Partial Phase 3):

- ✅ Dialogs extracted to useTTSDialogHandlers.ts (~400 lines)
- ✅ Message handler extracted to useTTSMessageHandler.ts (~250 lines)
- ✅ All tests passing (241 tests)
- ✅ No regressions
- ✅ useTTSController.ts reduced to ~2150 lines (-23%)

**Benefit:** Some organization improvement, LOW regression risk

### Full Success (Complete Phase 3):

- ✅ All 5 sub-hooks extracted
- ✅ useTTSController.ts reduced to ~797 lines (-71%)
- ✅ All tests passing (241 tests)
- ✅ No regressions
- ✅ Independent testing possible for each sub-hook
- ✅ Clear responsibility boundaries

**Benefit:** Excellent organization, MEDIUM-HIGH regression risk

### Failure Indicators:

- ❌ ANY test failing after extraction
- ❌ Regressions discovered in manual testing
- ❌ TypeScript errors that can't be fixed quickly
- ❌ Performance degradation (lag, memory leaks)
- ❌ More than 2 hours stuck on one extraction
- ❌ More than 20 hours total time spent

**Action:** Rollback to pre-Phase3 state, document lessons learned

---

## 🎯 Recommendation

### Option A: Skip Phase 3 Entirely (RECOMMENDED)

**Reasoning:**
- Current code is STABLE and WORKING (Phase 2 complete)
- No user-facing benefit from refactoring
- High regression risk (especially wake handler and event listeners)
- Time better spent on new features or bug fixes
- 2797 lines is manageable for a complex feature

**Pros:**
- ✅ Zero risk of regression
- ✅ Zero time investment
- ✅ Users happy with current functionality

**Cons:**
- File remains large (but functional)
- Testing slightly harder (but possible)

### Option B: Partial Phase 3 (LOW/MEDIUM Risk Only)

**Extract:**
- ✅ Step 1: Dialog Handlers (🟡 MEDIUM risk)
- ✅ Step 2: Message Handler (🟡 MEDIUM risk)
- ❌ Skip: Chapter Nav (🟠 HIGH risk)
- ❌ Skip: Wake Handler (🔴 CRITICAL risk)
- ❌ Skip: Event Listeners (🔴 CRITICAL risk)

**Estimated Time:** 6-9 hours  
**Risk Level:** 🟡 MEDIUM  
**Benefit:** Moderate organization improvement, manageable risk

### Option C: Full Phase 3 (NOT RECOMMENDED)

**Extract:** All 5 sub-hooks

**Estimated Time:** 19-29 hours  
**Risk Level:** 🔴 CRITICAL  
**Benefit:** Maximum organization, VERY HIGH regression risk

**Warning:** Phase 1-2 lessons show that complex extractions (wake handling, event listeners) are VERY HARD to get right. High chance of rollback and wasted time.

---

## 📞 User Decision Point

**Please review this plan and choose:**

1. **Skip Phase 3** - Keep current code (RECOMMENDED for production stability)
2. **Partial Phase 3** - Extract LOW/MEDIUM risk only (SAFE compromise)
3. **Full Phase 3** - Extract all 5 sub-hooks (HIGH RISK, for learning/experimentation only)

**Decision factors:**
- Timeline pressure? → Skip Phase 3
- Need new features soon? → Skip Phase 3
- Want safer refactor? → Partial Phase 3
- Have time for experimentation? → Consider Full Phase 3 (but be ready to rollback)

**My recommendation:** SKIP Phase 3 or do PARTIAL Phase 3 at most. Current code is good enough.

---

*Document created: 2025-12-14*  
*Status: Awaiting user approval*  
*Risk Assessment: HIGH for full extraction, MEDIUM for partial*  
*Current Code Status: STABLE & PRODUCTION-READY*
