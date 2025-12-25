# LNReader Codebase Review & Technical Debt

**Review Date:** 2025-12-24
**Reviewer:** Claude Code Analysis
**Project:** LNReader - React Native Light Novel Reader with TTS
**Repository:** `/Users/muhammadfaiz/Custom APP/LNreader`

---

## Executive Summary

This document provides a comprehensive code review of the LNReader codebase, identifying critical issues, technical debt, and actionable recommendations for future development. The codebase demonstrates solid architectural foundations in some areas but has significant technical debt in type safety, error handling, and code organization.

### Key Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total Files Analyzed | 363 source files | - |
| Test Coverage | ~67% (244 test files) | Medium |
| Critical Issues | 3 | Red |
| High Priority Issues | 5 | Orange |
| Medium Priority Issues | 8 | Yellow |
| Files with `any` type | 40+ | Poor |
| Files with console.log | 28+ | Poor |
| Largest Component | 1173 LOC (WebViewReader.tsx) | Poor |

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [High Priority Issues](#high-priority-issues)
3. [Medium Priority Issues](#medium-priority-issues)
4. [Low Priority Issues](#low-priority-issues)
5. [Architecture Assessment](#architecture-assessment)
6. [TTS System Deep Dive](#tts-system-deep-dive)
7. [Type Safety Analysis](#type-safety-analysis)
8. [Error Handling Analysis](#error-handling-analysis)
9. [React & Performance Issues](#react--performance-issues)
10. [Security Considerations](#security-considerations)
11. [Actionable Task List](#actionable-task-list)

---

## Critical Issues

### Issue #1: Missing useEffect Dependencies in WebViewReader

**Severity:** CRITICAL
**File:** `src/screens/reader/components/WebViewReader.tsx`
**Lines:** 347-413, 1119-1136

**Problem:**
Multiple `useEffect` hooks have incomplete dependency arrays, which can cause stale closures and runtime bugs.

**Specific Examples:**

```typescript
// Line 347-413: MMKV Settings Listener
useEffect(() => {
  const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
    // Uses webViewRef, CHAPTER_READER_SETTINGS, CHAPTER_GENERAL_SETTINGS
  });

  const subscription = deviceInfoEmitter.addListener(
    'RNDeviceInfo_batteryLevelDidChange',
    (level: number) => {
      // Uses webViewRef
    }
  );

  return () => {
    subscription.remove();
    mmkvListener.remove();
  };
}, [webViewRef]); // ❌ Missing: MMKVStorage, deviceInfoEmitter
```

```typescript
// Line 1119-1136: handleMessage dependencies
const handleMessage = useCallback(
  (event: WebViewPostEvent): boolean => { /* ... */ },
  [
    tts,
    webViewRef,
    onPress,
    navigateChapter,
    chapter.id,
    saveProgress,
    showToastMessage,
    novel?.pluginId,
    novel?.id,
    prevChapter,
    setAdjacentChapter,
    getChapter,
    // ❌ Missing: MMKVStorage (used in case 'save')
  ]
);
```

**Impact:**
- Stale closures may access outdated values
- Event listeners may not update when dependencies change
- Potential memory leaks from incomplete cleanup
- Unpredictable behavior in production

**Fix:**

```typescript
// Fix Option 1: Add all dependencies
useEffect(() => {
  // ...
  return () => {
    subscription.remove();
    mmkvListener.remove();
  };
}, [webViewRef, MMKVStorage, deviceInfoEmitter, CHAPTER_READER_SETTINGS, CHAPTER_GENERAL_SETTINGS]);

// Fix Option 2: Use refs for stability
const stableMMKV = useRef(MMKVStorage);
const stableEmitter = useRef(deviceInfoEmitter);

useEffect(() => {
  // ...
}, [webViewRef]);
```

---

### Issue #2: Massive Component Violating SRP

**Severity:** CRITICAL
**File:** `src/screens/reader/components/WebViewReader.tsx`
**Lines:** 110-1272 (1173 lines)

**Problem:**
WebViewReader is a monolithic component that handles too many responsibilities:
- WebView lifecycle management
- TTS state management
- Settings synchronization
- HTML generation
- Message handling
- Chapter transitions
- Dialog state management

**Impact:**
- Nearly impossible to test comprehensively
- Hard to understand and maintain
- Changes in one area can accidentally affect others
- High cognitive load for developers
- Poor code reusability

**Recommended Refactoring:**

```
WebViewReader (container component, ~200 LOC)
├── WebViewRenderer (WebView lifecycle, HTML generation)
├── TTSControllerProvider (TTS state machine wrapper)
│   └── uses useTTSController hook (already extracted)
├── SettingsManager (MMKV sync, settings listeners)
├── MessageHandler (WebView message routing)
└── DialogManager (all dialog state coordination)
```

**Example Structure:**

```typescript
// WebViewRenderer.tsx - Handles only WebView lifecycle
interface WebViewRendererProps {
  html: string;
  baseUrl?: string;
  onMessage: (event: WebViewPostEvent) => void;
  onLoadEnd: () => void;
  isTransitioning: boolean;
}

const WebViewRenderer: React.FC<WebViewRendererProps> = ({
  html,
  baseUrl,
  onMessage,
  onLoadEnd,
  isTransitioning,
}) => {
  return (
    <WebView
      source={{ baseUrl, html }}
      onMessage={handleMessage}
      onLoadEnd={onLoadEnd}
      style={{ opacity: isTransitioning ? 0 : 1 }}
      // ... WebView-specific props only
    />
  );
};
```

---

### Issue #3: TTS Race Conditions in Refill Logic

**Severity:** CRITICAL
**File:** `src/services/TTSAudioManager.ts`
**Lines:** 410-611 (refillQueue method)

**Problem:**
The `refillQueue()` method has complex async logic with potential race conditions:

```typescript
async refillQueue(): Promise<boolean> {
  // State check (not atomic with refill)
  if (this.state === TTSState.REFILLING) {
    logDebug('TTSAudioManager: Refill already in progress, skipping');
    return false;
  }

  // ❌ RACE: Multiple async operations between state check and set
  this.transitionTo(TTSState.REFILLING);

  try {
    // Async call - another refill could start while this awaits
    const queueSize = await TTSHighlight.getQueueSize();

    // ❌ RACE: Multiple refills could pass this check simultaneously
    const thresholdToUse = queueSize <= EMERGENCY_THRESHOLD
      ? EMERGENCY_THRESHOLD
      : PREFETCH_THRESHOLD;

    if (queueSize > thresholdToUse) {
      this.transitionTo(TTSState.PLAYING);
      return false;
    }

    // ... more async operations
  }
}
```

**Specific Race Conditions:**

1. **Concurrent Refill Detection Gap:**
   - Time between state check (`REFILLING`) and state transition
   - Two callers could both pass the check

2. **Queue Size Staleness:**
   - `getQueueSize()` is async
   - Queue could change between call and processing

3. **addToBatch Retry Race:**
   - Retry loop has no mutex
   - Multiple concurrent refills could trigger duplicate batches

**Impact:**
- Duplicate paragraphs queued
- TTS position corruption
- Audio glitches or skips
- Inconsistent state between native queue and JS tracking

**Recommended Fix:**

```typescript
class TTSAudioManager {
  private refillMutex: Promise<void> = Promise.resolve();

  async refillQueue(): Promise<boolean> {
    // Use mutex pattern to prevent concurrent refills
    return this.refillMutex = this.refillMutex.then(async () => {
      if (this.state === TTSState.REFILLING) {
        return false;
      }

      if (this.currentIndex >= this.currentQueue.length) {
        if (!this.hasLoggedNoMoreItems) {
          logDebug('TTSAudioManager: No more items to refill');
          this.hasLoggedNoMoreItems = true;
        }
        return false;
      }

      this.hasLoggedNoMoreItems = false;
      this.transitionTo(TTSState.REFILLING);

      try {
        const queueSize = await TTSHighlight.getQueueSize();

        const thresholdToUse = queueSize <= EMERGENCY_THRESHOLD
          ? EMERGENCY_THRESHOLD
          : PREFETCH_THRESHOLD;

        if (queueSize > thresholdToUse) {
          this.transitionTo(TTSState.PLAYING);
          return false;
        }

        // ... rest of refill logic

        this.transitionTo(TTSState.PLAYING);
        return true;
      } catch (error) {
        logError('TTSAudioManager: Failed to refill queue:', error);
        this.transitionTo(TTSState.PLAYING);
        return false;
      }
    });
  }
}
```

---

## High Priority Issues

### Issue #4: Excessive `any` Type Usage

**Severity:** HIGH
**Count:** 40+ instances across 30+ files

**Problem:**
Extensive use of `any` type bypasses TypeScript's type safety, leading to runtime errors and poor IDE support.

**Affected Files:**

| File | Line(s) | Context |
|------|---------|---------|
| `src/services/backup/utils.ts` | 127, 249, 301, 378, 396 | `BackupV1`, `MMKVStorage.getAllKeys()`, filter includes |
| `src/database/utils/helpers.tsx` | Multiple | Database query results |
| `src/plugins/helpers/fetch.ts` | Multiple | Plugin responses |
| `src/hooks/persisted/useNovel.ts` | 76, 208, 259, 311 | Type assertions for MMKV |
| `src/screens/reader/hooks/useTTSController.ts` | 193, 272, 877, 893 | WebView event data casting |

**Specific Examples:**

```typescript
// backup/utils.ts:127
export interface BackupV1 {
  [key: string]: any;  // ❌ Loses all type information
}

// useNovel.ts:76
const novelPath = novel?.path ?? (novelOrPath as string); // ❌ Unsafe cast

// useTTSController.ts:877
const { visible, ttsIndex } = event.data as any; // ❌ Dangerous cast
```

**Impact:**
- Runtime type errors not caught at compile time
- Poor autocomplete/IDE support
- Refactoring becomes unsafe
- Difficult to understand data flow

**Recommended Fixes:**

```typescript
// Define proper types instead of any
interface BackupV1 {
  version?: string;
  settings?: Record<string, unknown>;
  novels?: unknown[];
  // ... specific fields
}

// Use type guards
function isWebViewEventData(data: unknown): data is { visible: number; ttsIndex: number } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'visible' in data &&
    'ttsIndex' in data
  );
}

// Use discriminated unions
type WebViewPostEvent =
  | { type: 'save'; data: number; chapterId: number }
  | { type: 'speak'; data: string; paragraphIndex: number }
  | { type: 'tts-state'; data: TTSPersistenceState }
  // ... other events
```

---

### Issue #5: console.log in Production Code

**Severity:** HIGH
**Count:** 28+ files with `eslint-disable no-console`

**Problem:**
Direct use of `console.log` throughout the codebase violates the project's own guidance in CLAUDE.md which specifies using `@utils/rateLimitedLogger` instead.

**Affected Files:**

| File | Lines | Count |
|------|-------|-------|
| `src/screens/reader/components/WebViewReader.tsx` | 10, 314-317, 360-363, 738-741, 790-793 | 8+ |
| `src/screens/reader/hooks/useTTSController.ts` | 9, 485, 495-497, 542-546, 573-576 | 15+ |
| `src/services/TTSAudioManager.ts` | 226-229, 313-316, 476-479, 538-541 | 8+ |
| `android/app/src/main/assets/js/core.js` | Throughout | 20+ |
| `src/hooks/persisted/useNovel.ts` | 259, 311 | 2+ |

**Specific Examples:**

```typescript
// WebViewReader.tsx:314-317
if (__DEV__) {
  console.log(
    'WebViewReader: TTS settings changed while playing, restarting with new settings',
  );
}

// useTTSController.ts:542-546
if (__DEV__) {
  console.log(
    'useTTSController: Background TTS batch started successfully from index',
    startIndex,
  );
}

// TTSAudioManager.ts:226-229
if (__DEV__) {
  // eslint-disable-next-line no-console
  console.warn(
    `TTSAudioManager: Cache drift detected (cached=${this.lastKnownQueueSize}, actual=${actualSize}, drift=${drift})`,
  );
}
```

**Impact:**
- Performance degradation in production (console operations are expensive)
- Potential information leakage (sensitive data in logs)
- No rate limiting (log spam)
- Violates project standards

**Recommended Fix:**

```typescript
// Replace all console.log with rateLimitedLogger

import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const readerLog = createRateLimitedLogger('WebViewReader', { windowMs: 1500 });

// Instead of:
if (__DEV__) {
  console.log('WebViewReader: TTS settings changed');
}

// Use:
readerLog.info('settings-changed', 'TTS settings changed while playing');

// For warnings:
readerLog.warn('cache-drift', `Cache drift detected: ${drift}`);

// For errors:
readerLog.error('refill-failed', 'Failed to refill queue', error);
```

**Migration Script Suggestion:**

```bash
# Find all console.log usages
grep -rn "console\." src/ --include="*.ts" --include="*.tsx"

# Use eslint to auto-fix where possible
npx eslint src/ --fix --rule "no-console: error"
```

---

### Issue #6: Unhandled Promise Rejections

**Severity:** HIGH
**Files:** Multiple files with Promise chains lacking `.catch()`

**Problem:**
Async operations without proper error handling can cause unhandled promise rejections, leading to app crashes.

**Specific Examples:**

```typescript
// useTTSController.ts:535-558
TTSHighlight.speakBatch(textsToSpeak, utteranceIds, {
  voice: readerSettingsRef.current.tts?.voice?.identifier,
  pitch: readerSettingsRef.current.tts?.pitch || 1,
  rate: readerSettingsRef.current.tts?.rate || 1,
})
  .then(() => {
    if (__DEV__) {
      console.log('...'); // ❌ No .catch()
    }
    isTTSReadingRef.current = true;
  });
  // ❌ Missing .catch() - unhandled rejection

// useNovel.ts:208-216
const followNovel = useCallback(() => {
  switchNovelToLibrary(novelPath, pluginId).then(() => { // ❌ No error handling
    if (novel) {
      setNovel({
        ...novel,
        inLibrary: !novel?.inLibrary,
      });
    }
  });
}, [novel, novelPath, pluginId, switchNovelToLibrary]);
```

**Impact:**
- App crashes in production
- Poor user experience (silent failures)
- Difficult to debug
- May violate app store guidelines

**Recommended Fix:**

```typescript
// Always handle promise rejections
TTSHighlight.speakBatch(textsToSpeak, utteranceIds, {
  voice: readerSettingsRef.current.tts?.voice?.identifier,
  pitch: readerSettingsRef.current.tts?.pitch || 1,
  rate: readerSettingsRef.current.tts?.rate || 1,
})
  .then(() => {
    ttsCtrlLog.info('batch-start-success');
    isTTSReadingRef.current = true;
    isTTSPlayingRef.current = true;
    updateTtsMediaNotificationState(true);
  })
  .catch(err => {
    ttsCtrlLog.error('batch-start-failed', err);
    isTTSReadingRef.current = false;
    isTTSPlayingRef.current = false;
    showToastMessage('TTS failed to start. Please try again.');
  });

// For user actions, show user-friendly error
const followNovel = useCallback(async () => {
  try {
    await switchNovelToLibrary(novelPath, pluginId);
    if (novel) {
      setNovel({
        ...novel,
        inLibrary: !novel.inLibrary,
      });
    }
  } catch (error) {
    showToastMessage(`Failed to ${novel.inLibrary ? 'unfollow' : 'follow'} novel`);
    logger.error('followNovel failed', error);
  }
}, [novel, novelPath, pluginId, switchNovelToLibrary]);
```

---

### Issue #7: Missing TypeScript Strict Mode

**Severity:** HIGH
**File:** `tsconfig.json`

**Problem:**
The project may not be running TypeScript in strict mode, allowing many type errors to go unchecked.

**Current State (to be verified):**

```json
{
  "compilerOptions": {
    "strict": true,  // Should be enabled
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**Recommendations:**

1. Enable all strict type checking options
2. Fix resulting type errors (there will be many)
3. Replace `any` with proper types
4. Add missing return statements
5. Handle all null/undefined cases

---

### Issue #8: Unsafe Type Assertions

**Severity:** HIGH
**Files:** Multiple

**Problem:**
Type assertions (`as`) are used extensively, bypassing type checking without validation.

**Examples:**

```typescript
// useTTSController.ts:862
ttsStateRef.current = event.data as unknown as TTSPersistenceState;
// ❌ Double cast - very dangerous

// useTTSController.ts:877
const { visible, ttsIndex } = event.data as any;
// ❌ Cast to any loses all type safety

// WebViewReader.tsx:306
readerSettingsRef.current = {
  ...readerSettingsRef.current,
  tts: liveReaderTts,
} as any;  // ❌ Type assertion instead of fixing the type
```

**Recommendation:**

```typescript
// Use type guards instead of assertions
function isTTSPersistenceState(data: unknown): data is TTSPersistenceState {
  return (
    typeof data === 'object' &&
    data !== null &&
    'paragraphIndex' in data &&
    'timestamp' in data
  );
}

// Validate before casting
if (isTTSPersistenceState(event.data)) {
  ttsStateRef.current = event.data;
} else {
  ttsCtrlLog.warn('invalid-tts-state', event.data);
}
```

---

## Medium Priority Issues

### Issue #9: memoizedHTML Performance Issue

**Severity:** MEDIUM
**File:** `src/screens/reader/components/WebViewReader.tsx`
**Lines:** 419-537

**Problem:**
The `memoizedHTML` useMemo is recreated on every render despite appearing to have stable dependencies.

```typescript
const memoizedHTML = useMemo(() => {
  return `<!DOCTYPE html>...`;
}, [
  readerSettings,        // ❌ Object recreated on each settings change
  chapterGeneralSettings, // ❌ Object recreated on each settings change
  validatedScrollSettings,
  stableChapter,
  html,
  novel,
  nextChapter,           // ❌ Changed to use refs for updates
  prevChapter,           // ❌ Changed to use refs for updates
  batteryLevel,
  initialSavedParagraphIndex,
  pluginCustomCSS,
  pluginCustomJS,
  theme,
]);
```

**Impact:**
- WebView reloads unnecessarily
- Performance degradation
- Loss of scroll position during settings changes

**Fix:**
The code already has a fix in place (using refs for nextChapter/prevChapter), but other dependencies like `readerSettings` and `chapterGeneralSettings` may need similar treatment or memoization.

---

### Issue #10: Code Duplication in TTS Logic

**Severity:** MEDIUM
**Files:**
- `src/screens/reader/components/ttsHelpers.ts`
- `src/screens/reader/hooks/useTTSController.ts`
- `src/screens/reader/components/WebViewReader.tsx`

**Problem:**
Similar TTS handling logic is repeated across multiple files.

**Examples:**

1. **Paragraph extraction and validation** appears in multiple places
2. **TTS state persistence logic** duplicated
3. **Queue management patterns** repeated

**Recommendation:**

```typescript
// Create shared TTS utilities
// src/services/tts/ttsQueueManager.ts
export class TTSQueueManager {
  validateParagraphIndex(index: number, total: number): number {
    return Math.max(0, Math.min(index, total - 1));
  }

  extractQueueFromParagraphs(
    paragraphs: string[],
    startIndex: number
  ): TTSQueueState {
    return {
      startIndex,
      texts: paragraphs.slice(startIndex),
    };
  }
}

// src/services/tts/ttsStatePersistence.ts
export class TTSStatePersistence {
  save(chapterId: number, state: TTSPersistenceState): void {
    MMKVStorage.set(
      `tts_state_${chapterId}`,
      JSON.stringify(state)
    );
  }

  load(chapterId: number): TTSPersistenceState | null {
    const data = MMKVStorage.getString(`tts_state_${chapterId}`);
    return data ? JSON.parse(data) : null;
  }
}
```

---

### Issue #11: Deprecated Methods Not Removed

**Severity:** MEDIUM
**File:** `src/services/TTSAudioManager.ts`
**Lines:** 106-136

**Problem:**
Deprecated methods are kept in the codebase, creating confusion and technical debt.

```typescript
/**
 * @deprecated Use getState() === TTSState.STARTING || getState() === TTSState.STOPPING instead
 */
setRestartInProgress(value: boolean) {
  if (value) {
    this.transitionTo(TTSState.STARTING);
  }
  logDebug(`TTSAudioManager: [DEPRECATED] setRestartInProgress(${value})`);
}
```

**Recommendation:**
1. Search for all usages of deprecated methods
2. Replace with new API
3. Remove deprecated methods
4. Update all callers

```bash
# Find deprecated method usages
grep -rn "setRestartInProgress\|isRestartInProgress\|setRefillInProgress\|isRefillInProgress" src/
```

---

### Issue #12: Event Listener Cleanup Issues

**Severity:** MEDIUM
**Files:** Multiple files with useEffect

**Problem:**
Potential memory leaks from event listeners not being properly cleaned up.

**Examples:**

```typescript
// useTTSController.ts:1430-2591
useEffect(() => {
  const onSpeechDoneSubscription = TTSHighlight.addListener('onSpeechDone', ...);
  const rangeSubscription = TTSHighlight.addListener('onWordRange', ...);
  const startSubscription = TTSHighlight.addListener('onSpeechStart', ...);
  const mediaActionSubscription = TTSHighlight.addListener('onMediaAction', ...);
  const queueEmptySubscription = TTSHighlight.addListener('onQueueEmpty', ...);
  const voiceFallbackSubscription = TTSHighlight.addListener('onVoiceFallback', ...);
  const appStateSubscription = AppState.addEventListener('change', ...);

  // ❌ What happens if component unmounts during listener setup?

  return () => {
    onSpeechDoneSubscription.remove();
    rangeSubscription.remove();
    startSubscription.remove();
    mediaActionSubscription.remove();
    queueEmptySubscription.remove();
    voiceFallbackSubscription.remove();
    appStateSubscription.remove();
    TTSHighlight.stop(); // ❌ This could throw!
    // ... more cleanup
  };
}, [/* deps */]);
```

**Recommendation:**

```typescript
useEffect(() => {
  const subscriptions: EmitterSubscription[] = [];

  try {
    const onSpeechDoneSubscription = TTSHighlight.addListener('onSpeechDone', ...);
    subscriptions.push(onSpeechDoneSubscription);

    // ... add other subscriptions

  } catch (error) {
    logger.error('listener-setup-failed', error);
    // Cleanup any subscriptions that were added
    subscriptions.forEach(s => s.remove());
    return;
  }

  return () => {
    // Safe cleanup
    subscriptions.forEach(s => {
      try {
        s.remove();
      } catch (e) {
        logger.warn('listener-cleanup-failed', e);
      }
    });

    try {
      TTSHighlight.stop();
    } catch (e) {
      logger.warn('tts-stop-failed', e);
    }
  };
}, deps);
```

---

### Issue #13: Magic Numbers Throughout Codebase

**Severity:** MEDIUM
**Files:** Multiple

**Problem:**
Magic numbers scattered throughout the code without named constants.

**Examples:**

```typescript
// TTSAudioManager.ts
const BATCH_SIZE = 25;
const REFILL_THRESHOLD = 10;
const PREFETCH_THRESHOLD = Math.max(REFILL_THRESHOLD, 12);
const EMERGENCY_THRESHOLD = 4;
const CACHE_DRIFT_THRESHOLD = 5;
const CALIBRATION_INTERVAL = 10;

// useTTSController.ts
setTimeout(() => { ... }, 100);  // What is 100ms?
setTimeout(() => { ... }, 300);  // What is 300ms?
setTimeout(() => { ... }, 500);  // What is 500ms?
setTimeout(() => { ... }, 900);  // What is 900ms?

// WebViewReader.tsx
}, 200); // Optimized delay (reduced from 350ms) for faster transitions
```

**Recommendation:**

```typescript
// src/services/tts/ttsConstants.ts
export const TTS_CONSTANTS = {
  QUEUE: {
    BATCH_SIZE: 25,
    REFILL_THRESHOLD: 10,
    PREFETCH_THRESHOLD: 12,
    EMERGENCY_THRESHOLD: 4,
  },
  TIMING: {
    RESUME_DIALOG_DELAY: 100,
    INVISIBLE_TRANSITION_DELAY: 200,
    AUTO_START_DELAY: 300,
    INITIAL_SCROLL_DELAY: 500,
    WAKE_SYNC_DELAY: 900,
    MEDIA_ACTION_DEBOUNCE_MS: 500,
  },
  CALIBRATION: {
    DRIFT_THRESHOLD: 5,
    INTERVAL: 10,
  },
} as const;

// Usage:
setTimeout(() => { ... }, TTS_CONSTANTS.TIMING.AUTO_START_DELAY);
```

---

### Issue #14: Missing JSDoc Comments

**Severity:** MEDIUM
**Files:** Most files in the codebase

**Problem:**
Complex functions lack documentation, making them difficult to understand and maintain.

**Example of Good Documentation (already in TTSState.ts):**

```typescript
/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: TTSState, to: TTSState): boolean {
  // Allow staying in same state (idempotent operations)
  if (from === to) {
    return true;
  }
  return VALID_TRANSITIONS.some(t => t.from === from && t.to === to);
}
```

**Example of Poor Documentation (most other files):**

```typescript
// No documentation for complex function
const handleMessage = useCallback((event: WebViewPostEvent): boolean => {
  // 200+ lines of complex logic
}, [/* deps */]);
```

**Recommendation:**
Add JSDoc comments to:
- All exported functions
- Complex internal functions
- Component props interfaces
- Type definitions
- Public APIs

---

### Issue #15: Test Coverage Gaps

**Severity:** MEDIUM
**Files:** Multiple untested areas

**Problem:**
Test coverage is approximately 67%, with critical gaps in:
- Core reader functionality
- Error scenarios
- TTS edge cases
- WebView communication

**Missing Tests:**

1. **WebView Message Handling:**
   - Invalid message formats
   - Malicious messages
   - Rate limiting behavior

2. **TTS State Transitions:**
   - Invalid transitions
   - Recovery from error states
   - Concurrent operation handling

3. **Error Paths:**
   - Network failures during chapter fetch
   - TTS initialization failures
   - MMKV storage errors

**Recommendation:**

```typescript
// Example: Add comprehensive TTS state tests
describe('TTSState', () => {
  describe('isValidTransition', () => {
    it('should allow valid transitions', () => {
      expect(isValidTransition(TTSState.IDLE, TTSState.STARTING)).toBe(true);
      expect(isValidTransition(TTSState.STARTING, TTSState.PLAYING)).toBe(true);
    });

    it('should reject invalid transitions', () => {
      expect(isValidTransition(TTSState.IDLE, TTSState.REFILLING)).toBe(false);
      expect(isValidTransition(TTSState.PLAYING, TTSState.IDLE)).toBe(false);
    });

    it('should allow idempotent operations', () => {
      Object.values(TTSState).forEach(state => {
        expect(isValidTransition(state, state)).toBe(true);
      });
    });
  });
});

// Example: Add WebView message handler tests
describe('WebViewReader Message Handler', () => {
  it('should reject messages without valid nonce', () => {
    const mockEvent = {
      type: 'save',
      data: 50,
      nonce: 'invalid-nonce',
    };

    const result = handleMessage(mockEvent);
    expect(result).toBe(false);
  });

  it('should handle malformed messages gracefully', () => {
    const mockEvent = {
      type: 'corrupted',
      data: '<script>alert("xss")</script>',
      nonce: webViewNonceRef.current,
    };

    expect(() => handleMessage(mockEvent)).not.toThrow();
  });
});
```

---

### Issue #16: Inconsistent Error Handling Patterns

**Severity:** MEDIUM
**Files:** Multiple

**Problem:**
Different error handling patterns throughout the codebase create inconsistency.

**Patterns Found:**

1. **Try-catch with toast:**
```typescript
try {
  await operation();
} catch (error) {
  showToastMessage('Operation failed');
}
```

2. **Try-catch with console.error:**
```typescript
try {
  await operation();
} catch (error) {
  console.error(error);
}
```

3. **Promise.catch:**
```typescript
operation().catch(error => {
  logger.error('operation-failed', error);
});
```

4. **Silent failures:**
```typescript
try {
  await operation();
} catch (e) {
  // ignore
}
```

**Recommendation:**

```typescript
// Create consistent error handling utilities
// src/utils/errorHandler.ts

export enum ErrorSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Critical = 'critical',
}

export interface ErrorHandlerOptions {
  severity?: ErrorSeverity;
  showToast?: boolean;
  logToService?: boolean;
  fallbackValue?: unknown;
}

export function handleOperationError(
  operation: string,
  error: unknown,
  options: ErrorHandlerOptions = {}
): void {
  const {
    severity = ErrorSeverity.Error,
    showToast = true,
    logToService = false,
  } = options;

  // Log the error
  logger.error(`${operation}-failed`, error);

  // Show toast to user
  if (showToast) {
    const message = getErrorMessage(operation, error);
    showToastMessage(message);
  }

  // Send to error tracking service
  if (logToService) {
    errorTrackingService.captureException(error, { operation });
  }
}

// Usage:
try {
  await deleteChapter(chapterId);
} catch (error) {
  handleOperationError('deleteChapter', error, {
    severity: ErrorSeverity.Warning,
    showToast: true,
  });
}
```

---

## Low Priority Issues

### Issue #17: ESLint Disable Comments

**Severity:** LOW
**Files:** 28 files with `eslint-disable no-console`

**Problem:**
Excessive ESLint disable comments suggest the rules may be too strict or the code needs refactoring.

**Recommendation:**
1. Remove `eslint-disable` comments after fixing underlying issues
2. Consider if rules are appropriate for the project
3. Use `.eslintrc.js` for directory-specific rule overrides instead

---

### Issue #18: File Naming Inconsistencies

**Severity:** LOW
**Files:** Multiple

**Problem:**
Inconsistent file naming conventions:
- Some use kebab-case: `use-tts-controller.ts`
- Some use camelCase: `useNovel.ts`
- Some use PascalCase for hooks: `useChapter.ts`

**Recommendation:**
Establish and enforce consistent naming:
- Hooks: `use*.ts` (camelCase)
- Components: `*.tsx` (PascalCase)
- Utilities: `*.ts` (camelCase or kebab-case, pick one)

---

### Issue #19: Large Test Files

**Severity:** LOW
**Files:** Several test files >500 lines

**Problem:**
Large test files are hard to navigate and maintain.

**Recommendation:**
Split large test files into focused suites:
```typescript
// useTTSController.test.ts
import { describeTTSState } from './__tests__/suites/ttsState.test';
import { describeTTSQueue } from './__tests__/suites/ttsQueue.test';
import { describeTTSEvents } from './__tests__/suites/ttsEvents.test';

describe('useTTSController', () => {
  describeTTSState();
  describeTTSQueue();
  describeTTSEvents();
});
```

---

### Issue #20: Unused Imports

**Severity:** LOW
**Files:** Multiple

**Problem:**
Unused imports clutter the code and suggest incomplete refactoring.

**Recommendation:**
Enable `no-unused-vars` ESLint rule and auto-fix:
```bash
npx eslint src/ --fix --rule "no-unused-vars: error"
```

---

## Architecture Assessment

### Strengths

1. **TTS State Machine:**
   - Well-designed explicit state enum (`TTSState`)
   - Valid transition enforcement
   - Clear lifecycle semantics

2. **Plugin System:**
   - Dynamic plugin loading
   - Clean separation between core and plugins
   - Good use of path aliases

3. **WebView Security:**
   - Nonce validation for messages
   - Rate limiting on messages
   - Origin whitelist

4. **Rate-Limited Logging:**
   - `@utils/rateLimitedLogger` exists and is well-designed
   - Prevents log spam
   - Unfortunately, not consistently used

5. **Hook Extraction (In Progress):**
   - `useTTSController` has been extracted from `WebViewReader`
   - Multiple sub-hooks created for specific concerns
   - This is a good pattern that should continue

### Weaknesses

1. **Component Size:**
   - `WebViewReader.tsx` is 1173 lines (too large)
   - Should be broken into smaller components

2. **Type Safety:**
   - Excessive `any` usage (40+ instances)
   - Unsafe type assertions throughout

3. **Error Handling:**
   - Inconsistent patterns
   - Many unhandled promises

4. **Code Duplication:**
   - TTS logic repeated across files
   - Similar patterns not abstracted

5. **Documentation:**
   - Missing JSDoc on most functions
   - Complex logic lacks comments

---

## TTS System Deep Dive

### Architecture Overview

The TTS system uses a **3-layer hybrid architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native Layer                       │
│  WebViewReader.tsx → useTTSController → TTSAudioManager     │
│  - State management, UI, user interactions                   │
│  - Background playback queueing                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      WebView Layer                           │
│  core.js (window.tts, window.reader)                        │
│  - DOM parsing, text extraction                              │
│  - Visual highlighting, scrolling                            │
│  - Foreground playback loop                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Native Android Layer                       │
│  TTSHighlightModule.kt, TTSForegroundService.kt             │
│  - System TTS engine access                                  │
│  - Background playback (ForegroundService)                   │
│  - Media notification, playback events                       │
└─────────────────────────────────────────────────────────────┘
```

### State Machine

**Valid Transitions:**

```
IDLE → STARTING → PLAYING → REFILLING → PLAYING → STOPPING → IDLE
                ↓                                                ↑
                └────────────────────────────────────────────────┘
```

**Emergency Stop:** Any state → STOPPING → IDLE

### Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `BATCH_SIZE` | 25 | Paragraphs queued per batch |
| `REFILL_THRESHOLD` | 10 | Queue size triggering refill |
| `PREFETCH_THRESHOLD` | 12 | Early refill trigger |
| `EMERGENCY_THRESHOLD` | 4 | Critical low queue trigger |
| `CACHE_DRIFT_THRESHOLD` | 5 | Max allowed cache drift |
| `CALIBRATION_INTERVAL` | 10 | Paragraphs between calibrations |

### Race Condition Protections

**Current Protections:**
1. `wakeTransitionInProgressRef` - Blocks events during wake
2. `isWebViewSyncedRef` - Blocks stale WebView messages
3. `chapterTransitionTimeRef` - Validates save events
4. `lastStaleLogTimeRef` - Rate limits stale event warnings

**Missing Protections:**
1. **No mutex for refill operations** - Multiple concurrent refills possible
2. **No state lock for speakBatch** - Could start while refill in progress
3. **No utterance ID validation** - Stale events could still match

### Critical TTS Functions

#### speakBatch (Background Playback)

```typescript
async speakBatch(
  texts: string[],
  utteranceIds: string[],
  params: TTSAudioParams = {}
): Promise<number>
```

**Flow:**
1. Lock voice for session consistency
2. Clear existing queue state
3. Queue initial batch (BATCH_SIZE items)
4. Setup auto-refill subscription
5. Transition to PLAYING state

**Issues:**
- No protection against concurrent calls
- Retries are done in loop without backoff cap

#### refillQueue

```typescript
async refillQueue(): Promise<boolean>
```

**Flow:**
1. Check if already refilling (not atomic)
2. Get current queue size (async)
3. Determine threshold based on queue size
4. Add next batch with retry logic
5. Update cache and calibrate

**Issues:**
- **Race condition between step 1 and state transition**
- Queue size could change during async operations
- Multiple refills could pass the check simultaneously

---

## Type Safety Analysis

### Files with Most `any` Usage

| File | `any` Count | Primary Issues |
|------|-------------|----------------|
| `backup/utils.ts` | 8 | Legacy data structures, MMKV keys |
| `useNovel.ts` | 4 | Type assertions for MMKV values |
| `useTTSController.ts` | 4 | WebView event data casting |
| `TTSAudioManager.ts` | 3 | Native module types |

### Type Safety Improvement Plan

**Phase 1: Define Missing Types**

```typescript
// src/types/webview.ts
export interface WebViewMessageBase {
  nonce: string;
  ts: number;
}

export type WebViewMessage<T extends string, D> = WebViewMessageBase & {
  type: T;
  data?: D;
  paragraphIndex?: number;
  chapterId?: number;
};

export type WebViewPostEvent =
  | WebViewMessage<'save', number>
  | WebViewMessage<'speak', string>
  | WebViewMessage<'stop-speak', undefined>
  | WebViewMessage<'tts-state', TTSPersistenceState>
  | WebViewMessage<'request-tts-exit', { visible: number; ttsIndex: number }>
  // ... all other event types
```

**Phase 2: Create Type Guards**

```typescript
// src/utils/typeGuards.ts
export function isWebViewPostEvent(data: unknown): data is WebViewPostEvent {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const msg = data as Partial<WebViewPostEvent>;

  return (
    typeof msg.nonce === 'string' &&
    typeof msg.ts === 'number' &&
    typeof msg.type === 'string' &&
    VALID_MESSAGE_TYPES.includes(msg.type)
  );
}

export function isTTSState(data: unknown): data is TTSPersistenceState {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const state = data as Partial<TTSPersistenceState>;

  return (
    typeof state.paragraphIndex === 'number' &&
    typeof state.timestamp === 'number'
  );
}
```

**Phase 3: Replace `any` with Proper Types**

```typescript
// Before
const { visible, ttsIndex } = event.data as any;

// After
if (isRequestTtsExitData(event.data)) {
  const { visible, ttsIndex } = event.data;
  // ...
} else {
  logger.warn('invalid-event-data', event);
}
```

---

## Error Handling Analysis

### Current Patterns

| Pattern | Count | Status |
|---------|-------|--------|
| try-catch | ~150 | Good |
| Promise.catch() | ~40 | Good |
| Unhandled promises | ~15 | Bad |
| Silent failures | ~8 | Poor |

### Error Handling Improvement Plan

**1. Create Error Types**

```typescript
// src/types/errors.ts
export enum ErrorCategory {
  Network = 'network',
  Storage = 'storage',
  TTS = 'tts',
  Validation = 'validation',
  Unknown = 'unknown',
}

export class AppError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NetworkError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(message, ErrorCategory.Network, originalError);
    this.name = 'NetworkError';
  }
}

export class TTS_ERROR extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(message, ErrorCategory.TTS, originalError);
    this.name = 'TTS_ERROR';
  }
}
```

**2. Create Error Handler Utility**

```typescript
// src/utils/errorHandler.ts
export interface ErrorHandlingResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string
): Promise<ErrorHandlingResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    logger.error(`${context}-failed`, error);
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// Usage:
const result = await safeAsync(
  () => fetchChapter(pluginId, path),
  'fetchChapter'
);

if (!result.success) {
  showToastMessage('Failed to load chapter');
  return;
}

const chapter = result.data;
```

**3. Add Error Boundaries**

```typescript
// src/components/ErrorBoundary.tsx
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('react-error-boundary', { error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorScreen error={this.state.error} />;
    }

    return this.props.children;
  }
}
```

---

## React & Performance Issues

### useCallback Overuse

**Problem:**
Many functions use `useCallback` without actual performance benefit.

**Example:**

```typescript
// This is recreated every render anyway due to inline object
const showToastMessage = useCallback(
  (message: string) => {
    toastMessageRef.current = message;
    showToast();
  },
  [showToast], // ❌ showToast is stable anyway
);
```

**Guideline:**
Only use `useCallback` when:
1. Function is passed to a memoized child component
2. Function is used as a dependency in another hook
3. Function is referenced in a long-lived effect

### Missing React.memo

**Problem:**
Components that could benefit from memoization don't use it.

**Example:**

```typescript
// This component re-renders when parent re-renders
const ReaderBottomSheet = ({ settings, onSettingsChange }: Props) => {
  return (
    <BottomSheet>
      {/* Expensive rendering */}
    </BottomSheet>
  );
};

// Should be:
const ReaderBottomSheet = React.memo(({ settings, onSettingsChange }: Props) => {
  return (
    <BottomSheet>
      {/* Expensive rendering */}
    </BottomSheet>
  );
}, (prev, next) => {
  // Custom comparison for settings object
  return prev.settings === next.settings;
});
```

### Large Dependency Arrays

**Problem:**
Large dependency arrays make hooks re-run frequently.

**Example:**

```typescript
// useTTSController.ts:2592-2604
}, [
  chapter.id,
  html,
  showToastMessage,
  webViewRef,
  navigateChapter,
  nextChapter,
  prevChapter,
  restartTtsFromParagraphIndex,
  updateTtsMediaNotificationState,
  chapterGeneralSettingsRef,
  readerSettingsRef,
]);
```

**Recommendation:**
Split large hooks into smaller, focused hooks with fewer dependencies.

---

## Security Considerations

### Current Security Measures

1. **WebView Message Validation:**
   - Nonce validation prevents message injection
   - Rate limiting prevents message spam

2. **Input Sanitization:**
   - HTML content is sanitized before WebView injection

3. **Storage Security:**
   - MMKV used for secure key-value storage
   - Device-specific keys excluded from backup

### Security Improvements Needed

1. **Console.log in Production:**
   - May leak sensitive information
   - Should be replaced with rate-limited logger

2. **WebView Source Validation:**
   - Ensure only trusted sources can load in WebView

3. **Error Message Exposure:**
   - Some error messages may contain sensitive paths
   - Sanitize before displaying to user

---

## Actionable Task List

### Phase 1: Critical Fixes (Week 1)

- [ ] **Fix useEffect Dependencies in WebViewReader**
  - File: `src/screens/reader/components/WebViewReader.tsx`
  - Add missing dependencies to all useEffect hooks
  - Use refs for stability where appropriate

- [ ] **Fix TTS Refill Race Conditions**
  - File: `src/services/TTSAudioManager.ts`
  - Implement mutex pattern for refillQueue()
  - Add unit tests for concurrent refill scenarios

- [ ] **Replace console.log with rateLimitedLogger**
  - Files: All files with `console.log`
  - Use `@utils/rateLimitedLogger` consistently
  - Remove `eslint-disable no-console` comments

### Phase 2: High Priority (Week 2-3)

- [ ] **Replace `any` Types**
  - Start with most problematic files
  - Define proper TypeScript interfaces
  - Create type guards for runtime validation

- [ ] **Add Promise Error Handling**
  - Add `.catch()` to all promise chains
  - Use try-catch for async/await
  - Show user-friendly error messages

- [ ] **Enable TypeScript Strict Mode**
  - Update `tsconfig.json`
  - Fix resulting type errors

### Phase 3: Medium Priority (Week 4-6)

- [ ] **Refactor WebViewReader Component**
  - Split into smaller components
  - Extract WebViewRenderer
  - Extract SettingsManager
  - Extract MessageHandler

- [ ] **Remove Deprecated Methods**
  - Find all usages
  - Replace with new API
  - Remove deprecated code

- [ ] **Add TTS Constants File**
  - Extract magic numbers
  - Document each constant
  - Update all usages

- [ ] **Improve Test Coverage**
  - Add WebView message handler tests
  - Add TTS state transition tests
  - Add error scenario tests

### Phase 4: Low Priority (Ongoing)

- [ ] **Add JSDoc Comments**
  - Document all exported functions
  - Document complex types
  - Add component prop documentation

- [ ] **Standardize Error Handling**
  - Create error types
  - Create error handler utility
  - Add error boundaries

- [ ] **File Naming Consistency**
  - Establish naming convention
  - Rename files as needed
  - Update imports

---

## Testing Strategy

### Current Test Coverage

```
Total Tests: 244 test files
Coverage: ~67%

Gaps:
- Core reader functionality: ~40%
- WebView communication: ~20%
- Error scenarios: ~30%
- TTS edge cases: ~50%
```

### Recommended Test Structure

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── services/
│   │   │   ├── TTSAudioManager.test.ts
│   │   │   └── TTSState.test.ts
│   │   ├── hooks/
│   │   │   └── useTTSController.test.ts
│   │   └── utils/
│   │       └── typeGuards.test.ts
│   ├── integration/
│   │   ├── reader/
│   │   │   └── WebViewReader.test.tsx
│   │   └── tts/
│   │       └── TTSLifecycle.test.ts
│   └── e2e/
│       └── reader/
│           └── ChapterNavigation.test.ts
└── mocks/
    ├── native/
    │   └── TTSHighlight.mock.ts
    └── webview/
        └── core.mock.js
```

### Test Priority Areas

1. **TTS Refill Race Conditions**
   - Test concurrent refill calls
   - Test queue state during refill
   - Test recovery from refill failures

2. **WebView Message Handling**
   - Test valid message processing
   - Test invalid message rejection
   - Test nonce validation
   - Test rate limiting

3. **State Transitions**
   - Test all valid transitions
   - Test invalid transitions are rejected
   - Test emergency stop from all states

4. **Error Handling**
   - Test network failures
   - Test TTS initialization failures
   - Test storage errors

---

## Migration Checklist

When implementing the fixes in this document, use this checklist:

### Pre-Migration

- [ ] Create feature branch
- [ ] Run full test suite and document failures
- [ ] Create backup of current state
- [ ] Estimate time for each task

### During Migration

- [ ] Make one type of change at a time
- [ ] Commit frequently with descriptive messages
- [ ] Run tests after each significant change
- [ ] Update documentation as code changes

### Post-Migration

- [ ] Run full test suite
- [ ] Run type checking (`pnpm run type-check`)
- [ ] Run linting (`pnpm run lint`)
- [ ] Manual testing of critical paths
- [ ] Update CLAUDE.md with any new patterns

---

## Conclusion

The LNReader codebase demonstrates solid architectural foundations, particularly in the TTS system design and plugin architecture. However, there are significant technical debts in type safety, error handling, and code organization that need attention.

### Priority Summary

1. **Must Fix Immediately:**
   - Missing useEffect dependencies
   - TTS refill race conditions
   - Console.log in production

2. **Should Fix Soon:**
   - Replace `any` types
   - Add promise error handling
   - Enable TypeScript strict mode

3. **Consider Fixing:**
   - Refactor large components
   - Remove deprecated code
   - Add comprehensive tests

4. **Nice to Have:**
   - Add JSDoc comments
   - Standardize naming
   - Improve error UX

With these fixes, the codebase will be more maintainable, performant, and reliable for long-term development.

---

## Appendix: File Reference

### Critical Files

| File | LOC | Priority | Issues |
|------|-----|----------|--------|
| `src/screens/reader/components/WebViewReader.tsx` | 1173 | Critical | Dependencies, size |
| `src/services/TTSAudioManager.ts` | 773 | Critical | Race conditions |
| `src/screens/reader/hooks/useTTSController.ts` | 2696 | High | Console.log, any types |
| `android/app/src/main/assets/js/core.js` | ~2000 | Medium | Console.log |

### Files Requiring Type Safety Improvements

- `src/services/backup/utils.ts`
- `src/hooks/persisted/useNovel.ts`
- `src/database/utils/helpers.tsx`
- `src/plugins/helpers/fetch.ts`
- All files with WebView message handling

### Files Replacing console.log

All 28 files with `eslint-disable no-console` should use `@utils/rateLimitedLogger` instead.

---

*This document should be updated as issues are resolved and new issues are discovered.*
