# Comprehensive Test Implementation Plan
## Phase 1 & Phase 2 Hook Testing

**Created:** 2025-01-XX  
**Status:** 1/11 hooks tested (useDialogState ✅)  
**Library:** @testing-library/react-hooks@8.0.1 (Installed ✅)  
**Project:** LNReader TTS Refactoring (React Native + TypeScript)

---

## 🎯 OBJECTIVE

**Task:** Create comprehensive tests for 10 remaining hooks extracted during Phase 1 & Phase 2 refactoring of useTTSController.ts.

**Context:**
- **Phase 1:** Extracted 6 hooks (395 lines) from useTTSController.ts
- **Phase 2:** Extracted 5 hooks (340 lines) from useTTSController.ts
- **Current State:** Only useDialogState has comprehensive tests (20+ tests, all passing)
- **Goal:** Achieve 100% hook test coverage to detect regressions and document behavior

**Why This Matters:**
- TTS (Text-to-Speech) system is complex with many edge cases
- Hooks use refs, timers, async operations, and storage
- Zero regression guarantee requires comprehensive testing
- Tests serve as living documentation for future developers

---

## 📁 PROJECT STRUCTURE

```
src/screens/reader/hooks/
├── useDialogState.ts (Phase 1)          ✅ TESTED (20+ tests)
├── useTTSUtilities.ts (Phase 1)         ⏳ TODO (HIGH priority)
├── useManualModeHandlers.ts (Phase 1)   ⏳ TODO (HIGH priority)
├── useExitDialogHandlers.ts (Phase 1)   ⏳ TODO (MEDIUM priority)
├── useSyncDialogHandlers.ts (Phase 1)   ⏳ TODO (MEDIUM priority)
├── useScrollSyncHandlers.ts (Phase 1)   ⏳ TODO (LOW priority)
├── useChapterTransition.ts (Phase 2)    ⏳ TODO (HIGH priority)
├── useResumeDialogHandlers.ts (Phase 2) ⏳ TODO (HIGH priority)
├── useTTSConfirmationHandler.ts (Phase 2) ⏳ TODO (HIGH priority)
├── useChapterSelectionHandler.ts (Phase 2) ⏳ TODO (MEDIUM priority)
└── useBackHandler.ts (Phase 2)          ⏳ TODO (MEDIUM priority)

src/screens/reader/hooks/__tests__/
├── useDialogState.test.ts               ✅ DONE (20+ tests passing)
├── phase2-hooks.integration.test.ts     ✅ DONE (smoke tests only)
└── [10 more test files needed]          ⏳ TODO
```

---

## 🚀 QUICK START (For New Session)

### Step 1: Verify Setup
```bash
cd /Users/muhammadfaiz/Custom\ APP/LNreader
pnpm list @testing-library/react-hooks  # Should show v8.0.1
pnpm run test -- src/screens/reader/hooks/__tests__/useDialogState.test.ts  # Should pass
```

### Step 2: Review Template
- **Template File:** `src/screens/reader/hooks/__tests__/useDialogState.test.ts`
- **Read this file first** to understand test structure and patterns
- **Copy structure** for new tests

### Step 3: Choose Next Hook (Recommended Order)
1. useTTSUtilities (CRITICAL - resumeTTS logic)
2. useManualModeHandlers (CRITICAL - handleStopTTS)
3. useChapterTransition (HIGH - timer logic)

### Step 4: Read Hook Source
```bash
cat src/screens/reader/hooks/useTTSUtilities.ts
```

### Step 5: Create Test File
```bash
# Use useDialogState.test.ts as template
# File: src/screens/reader/hooks/__tests__/useTTSUtilities.test.ts
```

### Step 6: Run Test
```bash
pnpm run test -- src/screens/reader/hooks/__tests__/useTTSUtilities.test.ts
```

---

## ✅ Completed Tests

### Phase 1 Hook Tests

1. **useDialogState.test.ts** ✅ (20+ tests)
   - ✅ Initial state validation
   - ✅ Exit dialog toggle and data
   - ✅ Chapter selection dialog
   - ✅ Sync dialog (3 statuses: syncing, success, failed)
   - ✅ Multiple dialogs simultaneously
   - ✅ Re-render stability
   - **Status:** PASSING (all tests green)
   - **Type Safety:** Fixed SyncDialogStatus ('failed' not 'error'), SyncDialogInfo structure

---

## 🔄 Remaining Tests to Implement

### Phase 1 Hooks (5 remaining)

---

#### 2. **useTTSUtilities.test.ts** (HIGH PRIORITY) ⚠️ CRITICAL

**What This Hook Does:**
- Manages TTS resume logic (loads saved position from MMKV storage)
- Validates chapter progress (ensures position is within chapter bounds)
- Injects JavaScript to WebView for text selection and scrolling
- Tracks completed chapters and reading history

**Hook Location:** `src/screens/reader/hooks/useTTSUtilities.ts` (110 lines)

**Key Functions to Test:**
```typescript
const { resumeTTS } = useTTSUtilities({
  novelId, chapterId,
  webViewRef, chapterTextRef,
  /* ...other props */
});

// Main function: resumeTTS(selectedPosition?)
// - Loads position from MMKV or uses parameter
// - Validates position is within chapter bounds
// - Injects JS: highlightAndScrollToTextV2(paragraphIndex)
// - Updates lastReadPositions, ttsPosition storage
// - Marks chapter as completed if position at end
```

**Test Scenarios to Cover:**
1. **Resume from saved position (MMKV)**
   - Mock: `storage.getString('tts-position-123')` returns `"45"`
   - Expected: `webViewRef.injectJavaScript('highlightAndScrollToTextV2(45)')`
   
2. **Resume from provided position parameter**
   - Call: `resumeTTS(30)`
   - Expected: Position 30 used, not MMKV value
   
3. **Position validation (within bounds)**
   - Chapter has 100 paragraphs
   - Saved position: 150 (out of bounds)
   - Expected: Position clamped to 99 or reset to 0
   
4. **Chapter completion tracking**
   - Position at last paragraph (99 of 100 total)
   - Expected: `ChapterQueries.markComplete(chapterId)` called
   
5. **MMKV storage updates**
   - After resume
   - Expected: `storage.set('last-read-position-novelId', chapterId + ':' + position)`
   
6. **WebView ref null handling**
   - webViewRef.current = null
   - Expected: No crash, graceful return

**Mocking Strategy:**
```typescript
import { storage } from '@utils/mmkv';
jest.mock('@utils/mmkv', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

import * as ChapterQueries from '@database/queries/ChapterQueries';
jest.spyOn(ChapterQueries, 'markComplete').mockResolvedValue();
```

**Estimated tests:** 15-20 tests  
**Complexity:** HIGH (async operations, storage mocks, WebView injection)

---

#### 3. **useManualModeHandlers.test.ts** (HIGH PRIORITY) ⚠️ CRITICAL

**What This Hook Does:**
- Handles manual TTS stop/pause actions
- Manages continue-reading mode (stops TTS, enables manual scrolling)
- Mutates refs to track TTS reading/playing state
- Injects messages to WebView for UI updates

**Hook Location:** `src/screens/reader/hooks/useManualModeHandlers.ts` (89 lines)

**Key Functions to Test:**
```typescript
const { handleStopTTS, handleContinueFollowing } = useManualModeHandlers({
  ttsRef,
  isTTSReadingRef,
  isTTSPlayingRef,
  webViewRef,
  setIsTTSPlaying,
  setIsTTSReading,
});

// Function 1: handleStopTTS()
// - Stops TTS playback: ttsRef.current?.stop()
// - Resets refs: isTTSReadingRef.current = false, isTTSPlayingRef.current = false
// - Updates state: setIsTTSPlaying(false), setIsTTSReading(false)

// Function 2: handleContinueFollowing()
// - Calls handleStopTTS()
// - Injects JS: window.ReactNativeWebView.postMessage('continuefollowing')
```

**Test Scenarios to Cover:**
1. **handleStopTTS - normal stop**
   - Mock: `ttsRef.current = { stop: jest.fn() }`
   - Expected: `ttsRef.current.stop()` called
   - Expected: `isTTSReadingRef.current === false`
   - Expected: `setIsTTSPlaying(false)` called
   
2. **handleStopTTS - TTS null ref**
   - ttsRef.current = null
   - Expected: No crash, refs still reset
   
3. **handleContinueFollowing - WebView message**
   - Expected: `webViewRef.injectJavaScript('window.ReactNativeWebView.postMessage("continuefollowing")')`
   - Expected: handleStopTTS also called
   
4. **Ref mutation validation**
   - Before: isTTSReadingRef.current = true
   - After handleStopTTS: isTTSReadingRef.current = false
   
5. **State setter calls**
   - Verify setIsTTSPlaying(false) called once
   - Verify setIsTTSReading(false) called once

**Mocking Strategy:**
```typescript
const mockTTSStop = jest.fn();
const mockSetIsTTSPlaying = jest.fn();
const mockInjectJS = jest.fn();

const mockTTSRef = { current: { stop: mockTTSStop } };
const mockWebViewRef = { current: { injectJavaScript: mockInjectJS } };
```

**Estimated tests:** 12-15 tests  
**Complexity:** MEDIUM (ref mutations, message passing)

4. **useExitDialogHandlers.test.ts** (MEDIUM PRIORITY)
   - handleExitTTS (save progress, stop TTS, navigate)
   - handleExitReader (without saving)
   - Navigation integration
   - **Estimated tests:** 10-12 tests
   - **Complexity:** MEDIUM (navigation mocks, async operations)

5. **useSyncDialogHandlers.test.ts** (MEDIUM PRIORITY)
   - handleSyncRetry logic
   - Retry count management (syncRetryCountRef)
   - Wake chapter synchronization
   - **Estimated tests:** 8-10 tests
   - **Complexity:** MEDIUM (ref management, async operations)

6. **useScrollSyncHandlers.test.ts** (LOW PRIORITY)
   - handleTTSScrollSyncConfirm
   - handleTTSScrollSyncCancel
   - WebView JS injection for scroll sync
   - **Estimated tests:** 8-10 tests
   - **Complexity:** LOW (simple handlers)

---

### Phase 2 Hooks (5 hooks - current smoke tests → comprehensive tests)

---

#### 7. **useChapterTransition.test.ts** (HIGH PRIORITY) ⚠️ CRITICAL TIMERS

**What This Hook Does:**
- Tracks chapter transitions during TTS playback
- Implements grace period (3 seconds) for Smart Resume feature
- Sets timers for sync operations and navigation clearing
- Prevents false chapter conflicts when rapidly changing chapters

**Hook Location:** `src/screens/reader/hooks/useChapterTransition.ts` (101 lines)

**Key Functions to Test:**
```typescript
const { handleChapterChange } = useChapterTransition({
  prevChapterIdRef,
  chapterTransitionTimeRef,
  setSyncRetryCount,
  setMediaNavChapterInfo,
  isTTSReadingRef,
  setIsChapterTransitioning,
});

// Function: handleChapterChange(newChapterId)
// - Updates prevChapterIdRef.current = currentChapterId
// - Sets chapterTransitionTimeRef.current = Date.now()
// - Sets isChapterTransitioning = true
// - Timer 1: After 300ms → setSyncRetryCount(0)
// - Timer 2: After 2300ms → setMediaNavChapterInfo(null), setIsChapterTransitioning(false)
// - Only runs if isTTSReadingRef.current === true
```

**Test Scenarios to Cover:**
1. **Timer sequence validation (CRITICAL)**
   ```typescript
   jest.useFakeTimers();
   handleChapterChange(456);
   
   // T+0ms: Immediate effects
   expect(prevChapterIdRef.current).toBe(123); // old chapter
   expect(chapterTransitionTimeRef.current).toBeGreaterThan(0);
   expect(setIsChapterTransitioning).toHaveBeenCalledWith(true);
   
   // T+300ms: Sync retry reset
   jest.advanceTimersByTime(300);
   expect(setSyncRetryCount).toHaveBeenCalledWith(0);
   
   // T+2300ms: Navigation cleared
   jest.advanceTimersByTime(2000); // Total 2300ms
   expect(setMediaNavChapterInfo).toHaveBeenCalledWith(null);
   expect(setIsChapterTransitioning).toHaveBeenCalledWith(false);
   ```

2. **Grace period calculation (for Smart Resume)**
   - handleChapterChange at T=1000ms
   - chapterTransitionTimeRef.current = 1000
   - Later: if (Date.now() - 1000 < 3000) → within grace period
   
3. **TTS not reading - no timer side effects**
   - isTTSReadingRef.current = false
   - handleChapterChange(456)
   - Expected: Refs updated, but NO timers set
   - Expected: setSyncRetryCount NOT called
   
4. **Ref mutation tracking**
   - Before: prevChapterIdRef.current = 100
   - Call: handleChapterChange(200)
   - After: prevChapterIdRef.current = 100 (still old until next call)
   - Next call: handleChapterChange(300)
   - After: prevChapterIdRef.current = 200 (now updated)

5. **Multiple rapid chapter changes (timer cleanup)**
   - handleChapterChange(100) at T=0
   - handleChapterChange(200) at T=100ms
   - Expected: First timer cleared, only last timer executes

**Mocking Strategy:**
```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const mockSetSyncRetryCount = jest.fn();
const mockSetMediaNavChapterInfo = jest.fn();
const isTTSReadingRef = { current: true };
```

**Current:** Smoke tests only (4 tests)  
**Needs:** 15-20 comprehensive tests  
**Complexity:** HIGH (timers, side effects, grace period logic)

8. **useResumeDialogHandlers.test.ts** (HIGH PRIORITY)
   - handleResumeConfirm (3-source position resolution)
   - handleResumeCancel (JS injection)
   - handleRestartChapter (JS injection, highlight reset)
   - **Current:** Smoke tests only
   - **Needs:** 15-18 comprehensive tests
   - **Complexity:** MEDIUM (MMKV mocks, WebView injection)

---

#### 9. **useTTSConfirmationHandler.test.ts** (HIGH PRIORITY) ⚠️ MOST COMPLEX

**What This Hook Does:**
- Orchestrates Smart Resume confirmation flow (most complex logic)
- Detects 3 types of conflicts: scroll position, same chapter, different chapter
- Implements grace period (3 seconds) for rapid chapter changes
- Routes to appropriate dialogs based on conflict detection
- This is the "brain" of Smart Resume feature

**Hook Location:** `src/screens/reader/hooks/useTTSConfirmationHandler.ts` (113 lines)

**Key Functions to Test:**
```typescript
const { handleTTSConfirmation } = useTTSConfirmationHandler({
  novelId, chapterId, chapterTextRef,
  storage, chapterTransitionTimeRef,
  setShowTTSConfirmation,
  setConflictingChapters,
  setShowChapterSelect,
  resumeTTS,
});

// Function: handleTTSConfirmation()
// 
// FLOW:
// 1. Check grace period: if (Date.now() - chapterTransitionTime < 3000) → auto-resume
// 2. Get saved position: storage.getString('tts-position-{chapterId}')
// 3. Get scroll position: paragraphIndex from storage
// 4. If scroll gap > GAP_THRESHOLD (5 paragraphs) → show TTS confirmation dialog
// 5. Query database: ChapterQueries.getChaptersWithSavedTTSPosition(novelId)
// 6. If conflicts found:
//    - Same chapter conflict → show chapter select dialog
//    - Different chapter conflict → show chapter select dialog
// 7. If no conflicts → resumeTTS()
```

**Test Scenarios to Cover (CRITICAL):**

**Scenario 1: Grace Period Auto-Resume (3 seconds)**
```typescript
// Setup
chapterTransitionTimeRef.current = Date.now() - 2000; // 2 sec ago
mockStorage.getString.mockReturnValue('50'); // saved position

// Action
await handleTTSConfirmation();

// Expected
expect(setShowTTSConfirmation).toHaveBeenCalledWith(false);
expect(resumeTTS).toHaveBeenCalledWith(50);
// NO dialog shown - within grace period
```

**Scenario 2: Grace Period Expired (>3 seconds)**
```typescript
chapterTransitionTimeRef.current = Date.now() - 5000; // 5 sec ago
// Expected: Normal conflict detection flow proceeds
```

**Scenario 3: Scroll Conflict Detection (>5 paragraph gap)**
```typescript
// TTS saved at paragraph 10
mockStorage.getString.mockReturnValue('10');
// User scrolled to paragraph 20 (gap = 10 > GAP_THRESHOLD)
mockStorage.getString.mockReturnValueOnce('20'); // scroll position

// Expected
expect(setShowTTSConfirmation).toHaveBeenCalledWith(true);
// Resume dialog shown to user
```

**Scenario 4: No Scroll Conflict (within threshold)**
```typescript
mockStorage.getString.mockReturnValue('10'); // TTS at 10
mockStorage.getString.mockReturnValueOnce('12'); // Scroll at 12 (gap = 2)
// Expected: No resume dialog, continue to chapter conflict check
```

**Scenario 5: Same Chapter Conflict (database query)**
```typescript
const mockConflicts = [
  { chapterId: 123, novelId: 1, savedPosition: 30 },
  { chapterId: 123, novelId: 1, savedPosition: 50 }, // SAME chapter
];
mockChapterQueries.getChaptersWithSavedTTSPosition.mockResolvedValue(mockConflicts);

// Expected
expect(setConflictingChapters).toHaveBeenCalledWith(mockConflicts);
expect(setShowChapterSelect).toHaveBeenCalledWith(true);
```

**Scenario 6: Different Chapter Conflict**
```typescript
const mockConflicts = [
  { chapterId: 123, novelId: 1, savedPosition: 30 },
  { chapterId: 456, novelId: 1, savedPosition: 10 }, // DIFFERENT chapter
];
// Expected: Chapter select dialog shown
```

**Scenario 7: No Conflicts - Auto Resume**
```typescript
mockChapterQueries.getChaptersWithSavedTTSPosition.mockResolvedValue([]);
// Expected
expect(resumeTTS).toHaveBeenCalled();
expect(setShowChapterSelect).not.toHaveBeenCalled();
```

**Scenario 8: No Saved Position - Fresh Start**
```typescript
mockStorage.getString.mockReturnValue(null);
// Expected: resumeTTS(0) - start from beginning
```

**Mocking Strategy:**
```typescript
import { storage } from '@utils/mmkv';
jest.mock('@utils/mmkv');

import * as ChapterQueries from '@database/queries/ChapterQueries';
jest.spyOn(ChapterQueries, 'getChaptersWithSavedTTSPosition')
  .mockResolvedValue([]);

// Mock Date.now() for grace period tests
const mockNow = jest.spyOn(Date, 'now').mockReturnValue(1000000);
```

**Current:** Smoke tests only (4 tests)  
**Needs:** 18-20 comprehensive tests  
**Complexity:** HIGH (async database, grace periods, complex conditional logic)

10. **useChapterSelectionHandler.test.ts** (MEDIUM PRIORITY)
    - Same chapter selection
    - Different chapter selection
    - Progress reset modes (none, all, unread)
    - Chapter navigation
    - **Current:** Smoke tests only
    - **Needs:** 12-15 comprehensive tests
    - **Complexity:** MEDIUM (async database operations)

11. **useBackHandler.test.ts** (MEDIUM PRIORITY)
    - Dialog priority handling
    - TTS playing → stop and exit
    - Gap threshold logic (GAP_THRESHOLD = 5)
    - JS injection for gap checking
    - **Current:** Smoke tests only
    - **Needs:** 12-15 comprehensive tests
    - **Complexity:** MEDIUM (WebView JS injection, conditional logic)

---

## 🧪 Test Implementation Template

### Recommended Test Structure (Based on useDialogState.test.ts)

**📖 REFERENCE FILE:** `src/screens/reader/hooks/__tests__/useDialogState.test.ts`  
**READ THIS FIRST** before writing any new tests. It contains working examples of all patterns below.

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useHookName } from '../useHookName';

// Mock dependencies
jest.mock('@utils/mmkv', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  markComplete: jest.fn(),
  getChaptersWithSavedTTSPosition: jest.fn(),
}));

describe('HookName (Phase X - Step Y)', () => {
  // Setup mocks
  let mockWebViewRef: any;
  let mockTTSRef: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };
    
    mockTTSRef = {
      current: {
        stop: jest.fn(),
        play: jest.fn(),
      },
    };
  });

  describe('Initial State', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useHookName({
        /* props */
      }));
      
      expect(result.current.someState).toBe(expectedValue);
    });
  });

  describe('Function: functionName', () => {
    it('should handle success case', () => {
      const { result } = renderHook(() => useHookName({
        webViewRef: mockWebViewRef,
      }));
      
      act(() => {
        result.current.someFunction();
      });
      
      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('expectedJS')
      );
    });

    it('should handle error case gracefully', () => {
      mockWebViewRef.current = null; // Simulate null ref
      
      const { result } = renderHook(() => useHookName({
        webViewRef: mockWebViewRef,
      }));
      
      act(() => {
        result.current.someFunction();
      });
      
      // Should not crash
      expect(() => result.current.someFunction()).not.toThrow();
    });

    it('should update refs correctly', () => {
      const mockRef = { current: false };
      const { result } = renderHook(() => useHookName({
        someRef: mockRef,
      }));
      
      act(() => {
        result.current.someFunction();
      });
      
      expect(mockRef.current).toBe(true);
    });

    it('should handle async operations', async () => {
      const mockAsync = jest.fn().mockResolvedValue({ data: 'test' });
      
      const { result, waitForNextUpdate } = renderHook(() => useHookName({
        asyncFunction: mockAsync,
      }));
      
      act(() => {
        result.current.triggerAsync();
      });
      
      await waitForNextUpdate();
      
      expect(mockAsync).toHaveBeenCalled();
    });
  });

  describe('Timer/Side Effects', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });

    it('should execute callback after timeout', () => {
      const mockCallback = jest.fn();
      const { result } = renderHook(() => useHookName({
        onComplete: mockCallback,
      }));
      
      act(() => {
        result.current.startTimer();
      });
      
      // Immediately: callback not called yet
      expect(mockCallback).not.toHaveBeenCalled();
      
      // Advance time
      jest.advanceTimersByTime(300);
      
      // Now callback should be called
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should cleanup timers on unmount', () => {
      const { result, unmount } = renderHook(() => useHookName({}));
      
      act(() => {
        result.current.startTimer();
      });
      
      unmount();
      
      jest.advanceTimersByTime(1000);
      // Timer should be cleared, no errors
    });
  });

  describe('Return Interface', () => {
    it('should return all expected functions', () => {
      const { result } = renderHook(() => useHookName({}));
      
      expect(result.current).toHaveProperty('function1');
      expect(result.current).toHaveProperty('function2');
      expect(typeof result.current.function1).toBe('function');
    });
  });

  describe('Zero Regression Validation', () => {
    it('should maintain stable behavior after extraction', () => {
      // Document that hook was extracted from useTTSController
      // and maintains identical behavior
      const { result } = renderHook(() => useHookName({}));
      
      // Test a key scenario that confirms extraction success
      expect(result.current).toBeDefined();
    });
  });
});
```

---

## 🛠️ Complete Mock Setup Examples

### Mock Strategy Reference

**Copy these mocks into your test files as needed:**

#### MMKV Storage Mock
```typescript
import { storage } from '@utils/mmkv';

jest.mock('@utils/mmkv', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getAllKeys: jest.fn(),
  },
}));

// In test:
const mockStorage = storage as jest.Mocked<typeof storage>;
mockStorage.getString.mockReturnValue('50'); // Return saved position
mockStorage.set.mockImplementation(() => {}); // Mock setter
```

#### Database Queries Mock
```typescript
import * as ChapterQueries from '@database/queries/ChapterQueries';

jest.mock('@database/queries/ChapterQueries', () => ({
  markComplete: jest.fn(),
  getChaptersWithSavedTTSPosition: jest.fn(),
  updateChapterProgress: jest.fn(),
}));

// In test:
jest.spyOn(ChapterQueries, 'markComplete').mockResolvedValue();
jest.spyOn(ChapterQueries, 'getChaptersWithSavedTTSPosition')
  .mockResolvedValue([
    { chapterId: 123, novelId: 1, savedPosition: 30 },
  ]);
```

#### WebView Ref Mock
```typescript
const mockWebViewRef = {
  current: {
    injectJavaScript: jest.fn(),
    postMessage: jest.fn(),
  },
};

// Verify injection:
expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
  expect.stringContaining('highlightAndScrollToTextV2')
);
```

#### TTS Ref Mock
```typescript
const mockTTSRef = {
  current: {
    stop: jest.fn(),
    play: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  },
};

// Verify TTS control:
expect(mockTTSRef.current.stop).toHaveBeenCalled();
```

#### Navigation Mock
```typescript
import { useNavigation } from '@react-navigation/native';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

// In test:
const mockNavigate = jest.fn();
(useNavigation as jest.Mock).mockReturnValue({
  navigate: mockNavigate,
  goBack: jest.fn(),
});

// Verify navigation:
expect(mockNavigate).toHaveBeenCalledWith('BrowseStack', {
  screen: 'Novel',
  params: { novelId: 123 },
});
```

#### Ref Object Mock
```typescript
// For mutable refs (useRef)
const isTTSReadingRef = { current: true };
const prevChapterIdRef = { current: 100 };

// Pass to hook:
const { result } = renderHook(() => useHook({
  isTTSReadingRef,
  prevChapterIdRef,
}));

// Verify mutation:
expect(isTTSReadingRef.current).toBe(false);
```

#### Timer Mock (jest.useFakeTimers)
```typescript
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-01-15T10:00:00Z'));
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// In test:
act(() => {
  result.current.startTimer();
});

jest.advanceTimersByTime(300); // Move time forward 300ms

expect(mockCallback).toHaveBeenCalled();
```

---

## 📚 Related Documentation

**Read These Files for Context:**

1. **Template Test File (MUST READ FIRST):**
   - `src/screens/reader/hooks/__tests__/useDialogState.test.ts`
   - Contains working examples of all patterns

2. **Phase 2 Completion Report:**
   - `docs/analysis/useTTSController-phase2-COMPLETION.md`
   - Documents Phase 2 refactoring validation results
   - Shows how hooks were extracted and validated

3. **Existing Test Files:**
   - `src/screens/reader/hooks/__tests__/phase2-hooks.integration.test.ts`
   - Smoke tests for Phase 2 hooks (upgrade these to comprehensive tests)

4. **Hook Source Files (Read Before Testing):**
   - `src/screens/reader/hooks/useTTSUtilities.ts`
   - `src/screens/reader/hooks/useManualModeHandlers.ts`
   - `src/screens/reader/hooks/useChapterTransition.ts`
   - `src/screens/reader/hooks/useTTSConfirmationHandler.ts`
   - [All other hook files listed in Project Structure section]

5. **Mock Files:**
   - `__mocks__/react-native-mmkv.js` - MMKV mock setup
   - `__mocks__/@database/` - Database mock setup

---

---

## Mock Strategy

### Required Mocks

1. **@utils/mmkv/mmkv** (MMKV Storage)
   ```typescript
   jest.mock('@utils/mmkv/mmkv', () => ({
     MMKVStorage: {
       getNumber: jest.fn(),
       setNumber: jest.fn(),
       getString: jest.fn(),
       setString: jest.fn(),
     },
   }));
   ```

2. **@database/queries/ChapterQueries** (Database)
   ```typescript
   jest.mock('@database/queries/ChapterQueries', () => ({
     getRecentReadingChapters: jest.fn(),
     getChapter: jest.fn(),
     markChaptersBeforePositionRead: jest.fn(),
     resetFutureChaptersProgress: jest.fn(),
     updateChapterProgress: jest.fn(),
   }));
   ```

3. **react-native-webview** (WebView)
   ```typescript
   jest.mock('react-native-webview', () => ({
     default: 'WebView',
   }));
   ```

4. **@react-navigation/native** (Navigation)
   ```typescript
   jest.mock('@react-navigation/native', () => ({
     useNavigation: () => ({
       goBack: jest.fn(),
       navigate: jest.fn(),
     }),
   }));
   ```

---

## Estimation Summary

| Hook | Priority | Tests | Time Est. | Status |
|------|----------|-------|-----------|--------|
| useDialogState | HIGH | 20+ | - | ✅ DONE |
| useTTSUtilities | HIGH | 18 | 1.5h | ⏳ TODO |
| useManualModeHandlers | HIGH | 15 | 1h | ⏳ TODO |
| useChapterTransition | HIGH | 18 | 1.5h | ⏳ TODO |
| useResumeDialogHandlers | HIGH | 16 | 1h | ⏳ TODO |
| useTTSConfirmationHandler | HIGH | 20 | 1.5h | ⏳ TODO |
| useExitDialogHandlers | MEDIUM | 12 | 1h | ⏳ TODO |
| useSyncDialogHandlers | MEDIUM | 10 | 0.75h | ⏳ TODO |
| useChapterSelectionHandler | MEDIUM | 14 | 1h | ⏳ TODO |
| useBackHandler | MEDIUM | 14 | 1h | ⏳ TODO |
| useScrollSyncHandlers | LOW | 10 | 0.75h | ⏳ TODO |
| **TOTAL** | | **167** | **12h** | **1/11** |

---

## Priority Order for Implementation

### Batch 1: Critical Hooks (3-4 hours)
1. useTTSUtilities (resumeTTS is CRITICAL)
2. useManualModeHandlers (handleStopTTS is CRITICAL)
3. useChapterTransition (timer logic, frequent usage)

### Batch 2: High-Value Hooks (3-4 hours)
4. useTTSConfirmationHandler (Smart Resume - complex logic)
5. useResumeDialogHandlers (position resolution - 3 sources)
6. useExitDialogHandlers (navigation - user exit path)

### Batch 3: Medium-Value Hooks (3-4 hours)
7. useChapterSelectionHandler (chapter navigation)
8. useBackHandler (back button handling)
9. useSyncDialogHandlers (retry logic)

### Batch 4: Low-Priority Hooks (1-2 hours)
10. useScrollSyncHandlers (simple handlers)

---

## Quick Start Guide

To implement next test (useTTSUtilities):

1. Read the hook file:
   ```bash
   cat src/screens/reader/hooks/useTTSUtilities.ts
   ```

2. Identify:
   - Exported functions
   - Dependencies (props/callbacks)
   - Side effects (refs, storage, WebView)
   - Return interface

3. Create test file based on useDialogState template

4. Run test:
   ```bash
   pnpm run test -- src/screens/reader/hooks/__tests__/useTTSUtilities.test.ts
   ```

---

## Current Test Coverage

- **Phase 1:** 1/6 hooks tested (16.7%)
- **Phase 2:** 0/5 hooks tested (0% comprehensive, 100% smoke)
- **Overall:** 1/11 hooks tested (9%)
- **Target:** 11/11 hooks tested (100%)

---

## Benefits of Comprehensive Testing

1. **Regression Detection:**
   - Catch bugs immediately (not in production)
   - Verify zero behavioral changes claim
   - Safe refactoring for Phase 3 (if needed)

2. **Documentation:**
   - Tests document expected behavior
   - Examples for new developers
   - Living specification

3. **Confidence:**
   - Deploy with confidence
   - Easier code review
   - Reduced QA time

---

## Next Steps

**Option 1: Implement All Tests Now** (12 hours)
- Complete all 11 hook test files
- Comprehensive coverage
- Maximum safety

**Option 2: Batch Implementation** (Recommended)
- Batch 1 today (critical hooks - 4 hours)
- Batch 2 tomorrow (high-value hooks - 4 hours)
- Batch 3+4 later (remaining hooks - 4 hours)

**Option 3: Defer to Sprint Planning**
- Create test tickets
- Implement incrementally
- Track coverage over time

---

## 🚀 EXECUTION GUIDE FOR NEW SESSION

**If you are an agent starting fresh without conversation context, follow this guide:**

### Prerequisites Check

1. **Verify test library installed:**
   ```bash
   cd /Users/muhammadfaiz/Custom\ APP/LNreader
   pnpm list @testing-library/react-hooks
   # Expected: @testing-library/react-hooks@8.0.1
   ```

2. **Verify existing test passes:**
   ```bash
   pnpm run test -- src/screens/reader/hooks/__tests__/useDialogState.test.ts
   # Expected: All tests pass (20+ tests)
   ```

3. **Read template file:**
   ```bash
   cat src/screens/reader/hooks/__tests__/useDialogState.test.ts
   # Study structure and patterns
   ```

### Step-by-Step Implementation

**For EACH hook (start with Batch 1 priorities):**

#### Step 1: Read Hook Source (5-10 minutes)
```bash
cat src/screens/reader/hooks/useTTSUtilities.ts
```

**Understand:**
- What does this hook do?
- What are the input parameters?
- What does it return?
- What side effects does it have?
- What refs does it mutate?
- What external dependencies does it use?

#### Step 2: Read Implementation Guide Above (5 minutes)
- Find the hook in the "Remaining Tests" section above
- Read the "What This Hook Does" description
- Review "Key Functions to Test" code examples
- Study "Test Scenarios to Cover" examples
- Review "Mocking Strategy" for this specific hook

#### Step 3: Create Test File (20-40 minutes)
```bash
# File: src/screens/reader/hooks/__tests__/useTTSUtilities.test.ts
```

**Structure (copy from useDialogState.test.ts template):**
```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useTTSUtilities } from '../useTTSUtilities';

// 1. Add mocks (see "Complete Mock Setup Examples" section)
jest.mock('@utils/mmkv');
jest.mock('@database/queries/ChapterQueries');

describe('useTTSUtilities (Phase 1 - Step 2)', () => {
  // 2. Setup (beforeEach)
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 3. Initial State tests
  describe('Initial State', () => {
    // ...
  });

  // 4. Function tests (one describe block per function)
  describe('Function: resumeTTS', () => {
    it('should resume from saved position', () => {
      // Copy test scenario from guide above
    });
    
    it('should handle position out of bounds', () => {
      // Copy test scenario from guide above
    });
    
    // Add all scenarios from guide
  });

  // 5. Return Interface validation
  describe('Return Interface', () => {
    // ...
  });
});
```

#### Step 4: Run Test (Iterate Until Green)
```bash
pnpm run test -- src/screens/reader/hooks/__tests__/useTTSUtilities.test.ts
```

**If tests fail:**
- Read error message carefully
- Check mock setup (are mocks returning expected values?)
- Verify hook imports (correct path?)
- Check async handling (missing await or waitForNextUpdate?)
- Review timer setup (using jest.useFakeTimers correctly?)

**Common Issues:**
- **"Cannot read property of undefined"** → Mock not setup correctly
- **"Timeout exceeded"** → Forgot to wrap in act() or missing waitForNextUpdate()
- **"Timer not advanced"** → Forgot jest.useFakeTimers() or jest.advanceTimersByTime()
- **"Ref not updated"** → Pass ref object correctly: `{ current: value }`

#### Step 5: Verify All Tests Pass
```bash
pnpm run test -- src/screens/reader/hooks/__tests__/useTTSUtilities.test.ts

# Expected output:
# ✓ useTTSUtilities (Phase 1 - Step 2) (XXX ms)
#   ✓ Initial State (X ms)
#     ✓ should initialize correctly
#   ✓ Function: resumeTTS (X ms)
#     ✓ should resume from saved position (X ms)
#     ✓ should handle position out of bounds (X ms)
#     [... more tests ...]
#
# Test Suites: 1 passed, 1 total
# Tests: 15 passed, 15 total
```

#### Step 6: Update This Document
```markdown
In "Completed Tests" section, mark hook as complete:
✅ useTTSUtilities (15 tests) - PASSING
```

#### Step 7: Run Full Test Suite (Safety Check)
```bash
pnpm run test

# Expected: All tests pass (265 + your new tests)
```

#### Step 8: Move to Next Hook
- Repeat Steps 1-7 for next hook in Batch 1
- After Batch 1 complete, ask user if continuing or stopping

### Batch 1 Execution Order (Recommended)

**Execute in this order (critical hooks first):**

1. **useTTSUtilities.test.ts** (15-20 tests, ~60 minutes)
   - Critical: Resume TTS logic
   - Location: Hook #2 in plan above
   
2. **useManualModeHandlers.test.ts** (12-15 tests, ~45 minutes)
   - Critical: Stop TTS logic
   - Location: Hook #3 in plan above
   
3. **useChapterTransition.test.ts** (15-20 tests, ~60 minutes)
   - Critical: Timer logic, grace periods
   - Location: Hook #7 in plan above

**After Batch 1:** 4/11 hooks tested (~48% coverage)

### Expected Time Investment

| Batch | Hooks | Tests | Time | Priority |
|-------|-------|-------|------|----------|
| 1     | 3     | 42-55 | 3-4h | CRITICAL |
| 2     | 3     | 43-53 | 3-4h | HIGH     |
| 3     | 3     | 32-42 | 3-4h | MEDIUM   |
| 4     | 2     | 16-20 | 2h   | LOW      |
| **Total** | **11** | **133-170** | **11-14h** | - |

### Success Criteria

**After completing all tests:**
- ✅ All 11 hooks have test files
- ✅ All tests passing (265 + ~150 new = 415+ total)
- ✅ No regressions in existing tests
- ✅ Test coverage documented
- ✅ Lint/type check passing
- ✅ Ready to commit

### When to Ask User

**During implementation, use ask_user tool for:**
1. **After Batch 1 complete** - "Continue with Batch 2 or stop?"
2. **If test pattern unclear** - "Hook X has pattern Y not covered in guide, how to test?"
3. **If test fails repeatedly** - "Test failing, need clarification on expected behavior"
4. **After all tests complete** - "All 11 hooks tested, ready to commit?"

### Self-Contained Implementation Checklist

**Before implementing, verify you have:**
- ✅ This plan document (test-implementation-plan.md)
- ✅ Template test file (useDialogState.test.ts)
- ✅ Hook source files (src/screens/reader/hooks/*.ts)
- ✅ Mock examples (in "Complete Mock Setup Examples" section above)
- ✅ Test scenarios (in each hook's "Test Scenarios to Cover" section)
- ✅ Testing library installed (@testing-library/react-hooks@8.0.1)

**If missing anything, you can proceed without conversation context.**

---

## � CRITICAL TYPE SAFETY NOTES

### Known Type Errors to Avoid

**1. SyncDialogStatus Type (CORRECTED)**
```typescript
// ❌ WRONG (will cause type error)
const statuses = ['syncing', 'success', 'error'];

// ✅ CORRECT (matches src/screens/reader/types/tts.ts)
const statuses: Array<'syncing' | 'success' | 'failed'> = ['syncing', 'success', 'failed'];
```

**2. SyncDialogInfo Structure (CORRECTED)**
```typescript
// ❌ WRONG (missing required fields)
const info = {
  message: 'Test',
  chapterId: 1,
};

// ✅ CORRECT (matches type definition)
const info: SyncDialogInfo = {
  chapterName: 'Test Chapter',
  paragraphIndex: 0,
  totalParagraphs: 100,
  progress: 0,
};
```

**3. Import Hygiene**
```typescript
// ❌ WRONG (unused imports cause type-check errors)
import { MMKVStorage } from '@utils/mmkv/mmkv';

// ✅ CORRECT (only import what you use)
import { renderHook } from '@testing-library/react-hooks';
```

### Type Safety Validation

**Before committing ANY test file:**
```bash
# Run type-check (MUST pass)
pnpm run type-check

# Common errors to check:
# - TS6133: Unused imports
# - TS2345: Argument type mismatch
# - TS2353: Unknown property in object literal
```

**If type-check fails:**
1. Check src/screens/reader/types/tts.ts for correct type definitions
2. Ensure all mock objects match real types exactly
3. Remove unused imports
4. Use explicit type annotations where needed

### Known Issues

**WebViewReader_Backup.tsx Type Errors (IGNORE)**
- This is a backup file with missing imports
- Does NOT affect your test implementation
- Type errors in backup file are acceptable
- Only NEW test files must pass type-check

---

## �📝 FINAL NOTES FOR NEW SESSION AGENT

**Context Summary:**
- User completed Phase 2 refactoring (5 hooks extracted, all validated)
- User chose comprehensive testing approach (not smoke tests)
- Only 1/11 hooks has comprehensive tests (useDialogState)
- This plan created to enable future session to complete remaining 10 hooks
- User wants zero regression guarantee through comprehensive testing

**Your Mission:**
Implement comprehensive tests for remaining 10 hooks following the guides above. Start with Batch 1 (critical hooks), validate after each hook, ask user for direction after Batch 1 complete.

**Key Success Metric:**
All tests passing, zero regressions, behavior documented through tests.

**Philosophy:**
Tests are not just validation - they are living documentation. Write tests that clearly show what each hook does and how it should behave.

---

**Document Version:** 1.1 (Enhanced for Standalone Session)  
**Last Updated:** 2025-01-XX  
**Ready for Execution:** ✅ YES

**Ready to continue with Batch 1 (useTTSUtilities, useManualModeHandlers, useChapterTransition)?**
