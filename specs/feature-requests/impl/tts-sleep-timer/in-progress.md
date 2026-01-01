# In Progress

> Current work session notes for TTS Auto-Stop (Redesign)

## Session: 2025-12-28 (Critical Bug Fixes)

### Focus

Fix critical auto-stop bugs discovered during user testing:

1. Auto-stop triggering when screen is ON (should only trigger when OFF)
2. TTSAudioManager race condition when auto-stop triggers
3. Cache drift enforcement not restarting from correct position

### Blockers

- User reported auto-stop incorrectly triggered with screen ON, app in background
- Need to add ScreenStateListener integration (~~removed per original plan~~)
- Need to fix screen state initialization logic

### Notes

#### Root Cause Analysis

**Issue 1: Wrong Requirement**

- Original plan: ~~Remove all screen-off checks, apply regardless of screen state~~
- User testing revealed: Auto-stop should ONLY trigger when screen is OFF
- This is a valid use case: Users listen to TTS with screen ON in background
- Solution: Add back ScreenStateListener integration using native Android module

**Issue 2: ScreenStateListener.isActive() Misuse**

- `ScreenStateListener.isActive()` returns if **listener is active**, NOT if **screen is on**
- Called during initialization, returned `false` (listener not started yet)
- Incorrectly set `nativeScreenOff = true` (false positive)
- Root cause: Misunderstanding of what `isActive()` means

**Issue 3: AppState Fallback Activating**

- `hasNativeSupport` not set immediately in AutoStopService.start()
- When app went to background, `appStateBackground = true`
- `isScreenOff` getter returned `true` because `hasNativeSupport = false`
- AppState background ≠ screen OFF, but we counted anyway

**Issue 4: TTSAudioManager Race Condition**

- `stop()` method transitioned to STOPPING state
- Refill subscription continued firing and tried to add audio batches
- Caused invalid state transition STOPPING → REFILLING
- Solution: Call `removeAllListeners()` before stopping native TTS

#### Decisions Made

1. **Conservative Default for Screen State**
   - Assume screen ON (`nativeScreenOff = false`) until explicit SCREEN_OFF event
   - Cannot reliably determine initial screen state without PowerManager API
   - Acceptable trade-off: Edge case (starting with screen already OFF) handled by toggling screen once

2. **Set hasNativeSupport Immediately**
   - Set `hasNativeSupport = true` immediately when subscribing to ScreenStateListener
   - Prevents AppState fallback from ever activating
   - AppState "background" ≠ screen "off"

3. **Use stop() Instead of pause() for Auto-Stop**
   - Android TTS API: `pause()` lets current utterance finish
   - `stop()` immediately halts all audio
   - Auto-stop should be immediate - no partial utterance

#### Files Modified

**AutoStopService.ts (lines 76-102)**

```typescript
// Set up native screen state listener
if (ScreenStateListener.isAvailable()) {
  this.screenStateSubscription = ScreenStateListener.addListener(
    this.handleScreenStateChange,
  );

  // CRITICAL: Mark native support as available immediately
  this.hasNativeSupport = true;

  // Conservative default - assume screen ON until SCREEN_OFF event
  this.nativeScreenOff = false;
}
```

**TTSAudioManager.ts (lines 758-775)**

```typescript
async stop(): Promise<boolean> {
  try {
    this.transitionTo(TTSState.STOPPING);

    // CRITICAL: Remove all event listeners BEFORE stopping native TTS
    this.removeAllListeners();

    await TTSHighlight.stop();
    // ... cleanup
  }
}
```

**TTSHighlight.ts (lines 121-129)**

```typescript
setLastSpokenIndex(index: number): void {
  this.lastSpokenIndex = index;
  this.log('Last spoken index set', { index });
}
```

**useTTSController.ts (lines 1607-1610)**

```typescript
// After paragraph completes, update lastSpokenIndex for drift enforcement
if (TTSAudioManager.setLastSpokenIndex) {
  TTSAudioManager.setLastSpokenIndex(currentIdx);
}
```

#### Test Updates

Added new mock methods to test files:

- `stop()` in TTSHighlight and TTSAudioManager mocks
- `setOnDriftEnforceCallback()` in TTSHighlight mocks
- `setLastSpokenIndex()` in TTSHighlight and TTSAudioManager mocks
- `ScreenStateListener` mock in WebViewReader tests

All tests passing: 910 tests, 53 test suites

---

## Session: 2025-12-27 (Initial Implementation)

### Focus

Implement Auto-Stop service with time/paragraph/chapter modes, integrate with TTS controller, add UI settings

### Blockers

None

### Notes

#### Decisions Made

1. ~~Remove all screen-off checks - Auto-Stop applies regardless of screen state~~
2. Use simple counters for time/paragraph/chapter
3. Auto-stop callback should pause TTS (later changed to stop)
4. Place UI below "Background playback" in AccessibilityTab

#### Files Modified

1. **useSettings.ts**: Added `ttsAutoStopMode` and `ttsAutoStopAmount`, removed `ttsContinueToNextChapter`
2. **AutoStopService.ts**: Implemented time/paragraph/chapter auto-stop logic
3. **useTTSController.ts**: Integrated start/stop/trigger/reset callbacks
4. **AccessibilityTab.tsx**: Added "Auto Stop" UI section

#### Tests Created

1. **AutoStopService.test.ts**: Unit tests for all modes
2. Added integration tests to useTTSController

All 917 tests passing

---

## Backlog

### Completed ✅

- [x] Add `ttsAutoStopMode` + `ttsAutoStopAmount` to settings schema, defaults, and types
- [x] Remove/deprecate `ttsContinueToNextChapter` and update usages/tests
- [x] Implement `AutoStopService` + unit tests
- [x] Integrate triggers into `useTTSController` (paragraph + chapter + timer start/reset)
- [x] Add Global Settings UI below "Background playback"
- [x] Add ScreenStateListener integration
- [x] Fix screen state initialization bug
- [x] Set hasNativeSupport immediately
- [x] Fix TTSAudioManager race condition
- [x] Add cache drift enforcement with lastSpokenIndex

### Awaiting User Testing ⏳

- [ ] Verify auto-stop does NOT trigger when screen ON
- [ ] Verify auto-stop DOES trigger when screen OFF
- [ ] Verify no TTSAudioManager race condition errors
- [ ] Verify auto-stop works with app in background (screen ON vs OFF)
- [ ] Verify cache drift enforcement works correctly

### Future Enhancements 📋

- [ ] Consider adding PowerManager API to reliably determine initial screen state
- [ ] Add reader bottom-sheet UI for quick auto-stop configuration
- [ ] Add analytics tracking for auto-stop usage
- [ ] Consider smart rewind integration with auto-stop
