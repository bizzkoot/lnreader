# Completed Items

> Finished work for TTS Auto-Stop redesign

## Core Implementation (2025-12-27)

| Item                                  | Completed | Verified |
| ------------------------------------- | --------- | -------- |
| Auto-Stop settings schema updated     | ✅        | ✅       |
| AutoStopService implemented           | ✅        | ✅       |
| useTTSController trigger integration  | ✅        | ✅       |
| Global Settings UI (below background) | ✅        | ✅       |
| Unit tests passing                    | ✅        | ✅       |
| ~~Manual testing done~~               | ⬜        | ⬜       |

---

## Critical Bug Fixes (2025-12-28)

| Item                                     | Completed | Verified |
| ---------------------------------------- | --------- | -------- |
| ScreenStateListener integration added    | ✅        | ⬜       |
| Screen state initialization bug fixed    | ✅        | ⬜       |
| hasNativeSupport set immediately         | ✅        | ⬜       |
| Conservative default (screen ON) applied | ✅        | ⬜       |
| TTSAudioManager race condition fixed     | ✅        | ✅       |
| Cache drift enforcement enhanced         | ✅        | ⬜       |
| Auto-stop callback changed to stop()     | ✅        | ✅       |
| Test mocks updated                       | ✅        | ✅       |

---

## Details

### Core Implementation (2025-12-27)

**Settings Schema**

- Replaced `ttsContinueToNextChapter` with `ttsAutoStopMode` and `ttsAutoStopAmount`
- Added modes: off, minutes, chapters, paragraphs
- Set defaults: mode='off', amount=0

**AutoStopService**

- Implemented time-based auto-stop with fake timer support for testing
- Implemented paragraph-based counting
- Implemented chapter-based counting
- ~~No screen-off checks (applies regardless of screen state)~~

**UI Integration**

- Added "Auto Stop" section below "Background playback" in AccessibilityTab
- Mode selector: Off / Time / Chapter / Paragraph
- Preset chips for each mode

**Tests**

- Created AutoStopService unit tests (time/paragraph/chapter modes)
- Added integration tests in useTTSController
- All 917 tests passing

---

### Critical Bug Fixes (2025-12-28)

**Issue 1: Auto-stop triggering when screen is ON**

_Problem:_

- User reported auto-stop triggered with screen ON, app in background
- Root cause: ~~Removed all screen-off checks~~ was WRONG requirement
- Auto-stop should ONLY trigger when screen is OFF

_Fix Applied:_

- Added ScreenStateListener integration using native Android BroadcastReceiver
- Added `hasNativeSupport` flag to track native support availability
- Added `nativeScreenOff` flag to track actual screen state
- **Critical bug:** `ScreenStateListener.isActive()` incorrectly used to determine screen state
  - This method returns if listener is active, NOT if screen is on
  - Caused `nativeScreenOff = true` on initialization (false positive)

_Root Cause Analysis:_

1. Called `ScreenStateListener.isActive()` during initialization
2. Listener wasn't started yet, returned `false`
3. Incorrectly set `nativeScreenOff = true`
4. `hasNativeSupport` not set, so AppState fallback activated when app backgrounded
5. AppState background ≠ screen OFF, but we counted anyway

_Final Fix (src/services/tts/AutoStopService.ts lines 76-102):_

```typescript
// Set up native screen state listener
if (ScreenStateListener.isAvailable()) {
  this.screenStateSubscription = ScreenStateListener.addListener(
    this.handleScreenStateChange,
  );

  // CRITICAL: Mark native support as available immediately to prevent AppState fallback
  // from triggering when app goes to background (which is NOT same as screen off)
  this.hasNativeSupport = true;

  // IMPORTANT: Conservative default - assume screen ON until SCREEN_OFF event
  // We cannot reliably determine initial screen state without PowerManager API
  this.nativeScreenOff = false;
}
```

_Approach:_

- Conservative default: assume screen ON until explicit SCREEN_OFF event
- Set `hasNativeSupport = true` immediately to prevent AppState fallback
- Only count paragraphs/chapters/time when `nativeScreenOff = true`
- Prevents false positives (screen ON but counted) and background triggers

---

**Issue 2: TTSAudioManager race condition**

_Problem:_

- When auto-stop triggered TTS stop, caused state transition errors:
  ```
  [TTS] invalid-transition STOPPING → REFILLING
  [TTS] error TTSAudioManager: addToBatch failed
  ```

_Root Cause:_

- `stop()` method transitioned to STOPPING state
- Refill subscription continued firing and tried to add more audio batches
- Caused invalid state transition from STOPPING to REFILLING

_Fix Applied (src/services/TTSAudioManager.ts lines 758-775):_

```typescript
async stop(): Promise<boolean> {
  try {
    this.transitionTo(TTSState.STOPPING);

    // CRITICAL: Remove all event listeners BEFORE stopping native TTS
    // This prevents refill subscriptions from firing after we've stopped
    this.removeAllListeners();

    await TTSHighlight.stop();
    // ... cleanup code
  }
}
```

_Why this works:_

- Removes refill subscription immediately when stopping
- Prevents race condition where refill tries to add batches during shutdown
- Ensures clean state transitions

---

**Issue 3: Cache drift enforcement (Earlier in session)**

_Problem:_

- When cache drift detected, enforcement restarted TTS from wrong position
- `lastSpokenIndex` was never updated during playback

_Fix Applied:_

1. Added `setLastSpokenIndex(index: number)` method to TTSHighlight service
2. Call `TTSAudioManager.setLastSpokenIndex(currentIdx)` after each paragraph completes
3. Enhanced drift enforcement logging

---

**Issue 4: Auto-stop callback behavior**

_Original Design:_ Auto-stop calls `pause()` method
_Problem:_ Android TTS API `pause()` lets current utterance finish playing
_Updated Design:_ Auto-stop calls `stop()` method
_Files Changed:_

- useTTSController.ts (lines 860, 1446)
- TTSAudioManager.ts (line 274)
- useTTSUtilities.ts (line 140)

_Why:_ Auto-stop should be immediate - no partial utterance

---

## Test Updates

Added new mock methods to test files:

- `stop()` in TTSHighlight and TTSAudioManager mocks
- `setOnDriftEnforceCallback()` in TTSHighlight mocks
- `setLastSpokenIndex()` in TTSHighlight and TTSAudioManager mocks
- `ScreenStateListener` mock in WebViewReader tests

All tests passing: 910 tests, 53 test suites

---

## User Testing Status

**Test 1 (Initial Implementation):**

- ❌ FAIL: Auto-stop triggered with screen ON, app background
- Logs showed: `isActive called, returning false` followed by counting
- Root cause identified: Wrong requirement (removed all screen-off checks)

**Test 2 (After First Fix - Set hasNativeSupport):**

- ❌ FAIL: Still triggered with screen ON, app background
- Logs showed: `appstate-event state=background, hasNative=false, nowBackground=true`
- Followed by paragraph counting
- Root cause: `hasNativeSupport` not set immediately, AppState fallback activated

**Test 3 (After Final Fixes):**

- ✅ PASS: Auto-stop ignored paragraphs when screen ON
  - Logs: `onParagraphSpoken ignored (screen ON)`
- ✅ PASS: No TTSAudioManager errors when auto-stop triggered
- ⏳ Pending: User to verify auto-stop triggers correctly when screen OFF

---

## Architecture Decisions

### Conservative Default vs. PowerManager API

**Decision:** Use conservative default (assume screen ON until OFF event)
**Reasoning:**

- Requires only TypeScript changes, no native code modification
- Eliminates false positives (safer than missing true screen-off events)
- Edge case (starting with screen already OFF) acceptable trade-off
- Reduces complexity and maintenance burden

### stop() vs pause() for Auto-Stop

**Decision:** Use `stop()` instead of `pause()`
**Reasoning:**

- Android TTS API: `pause()` lets current utterance finish
- `stop()` immediately halts all audio
- Auto-stop should be immediate

### Setting hasNativeSupport Immediately

**Decision:** Set `hasNativeSupport = true` immediately when subscribing
**Reasoning:**

- Prevents AppState fallback from ever activating
- AppState "background" ≠ screen "off"
- Users can listen to TTS with screen ON in background (valid use case)
