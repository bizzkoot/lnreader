# TTS Auto-Stop (Redesign from Sleep Timer) - Implementation Tracking

**PRD**: [2025-12-27-tts-sleep-timer-and-smart-rewind.md](../2025-12-27-tts-sleep-timer-and-smart-rewind.md)
**Status**: ✅ Implemented (with critical fixes)
**Started**: 2025-12-27
**Completed**: 2025-12-28

---

## Quick Links

| Document                               | Purpose                    |
| -------------------------------------- | -------------------------- |
| [implementation.md](implementation.md) | Detailed file-level plan   |
| [in-progress.md](in-progress.md)       | Current work session notes |
| [completed.md](completed.md)           | Finished items             |
| [verification.md](verification.md)     | Test results               |

---

## Summary

Replace the legacy "Sleep Timer" concept with a simpler, more reliable **Auto-Stop** playback limit.

~~This redesign intentionally removes screen-off / device-state conditions. The limit applies whether the screen is on or off.~~

**UPDATED:** Auto-Stop stops playback after a user-selected limit **ONLY when the screen is OFF**:

- **Time**: 15m / 30m / 45m / 60m
- **Chapters**: 1 / 3 / 5 / 10
- **Paragraphs**: 5 / 10 / 15 / 20 / 30
- **Off**: No limit (continuous)

**Critical Requirement:** Auto-Stop must ONLY trigger when the screen is actually OFF, not when the app is merely in the background. This was discovered through user testing and required adding back ScreenStateListener integration.

## Key Files

| File                                                                  | Purpose                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/hooks/persisted/useSettings.ts`                                  | Auto-Stop settings schema + defaults                         |
| `src/services/tts/AutoStopService.ts`                                 | Auto-Stop logic (time/chap/para) with screen-state awareness |
| `src/services/ScreenStateListener.ts`                                 | [NEW] Native Android module for screen ON/OFF events         |
| `src/screens/reader/hooks/useTTSController.ts`                        | Integrate callbacks & trigger points                         |
| `src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx` | Global "Auto Stop" UI (below Background playback)            |

Note: Reader bottom-sheet UI can optionally be added later, but the required placement is in Global TTS settings.

## Latest Iterations (2025-12-28)

### Critical Fixes Applied

1. **Screen State Detection Bug Fixed**
   - ~~Removed all screen-off checks~~ → **ADDED BACK** ScreenStateListener integration
   - Auto-Stop now uses native Android BroadcastReceiver for SCREEN_ON/SCREEN_OFF events
   - Only counts paragraphs/chapters/time when screen is actually OFF
   - Conservative default: assumes screen ON until explicit SCREEN_OFF event

2. **TTSAudioManager Race Condition Fixed**
   - Added `removeAllListeners()` to `stop()` method
   - Prevents refill subscriptions from firing during shutdown
   - Eliminates invalid state transitions (STOPPING → REFILLING)

3. **Cache Drift Enforcement Enhanced**
   - Added `setLastSpokenIndex()` method to track last completed paragraph
   - Drift enforcement now restarts from correct position
   - Called after each paragraph completion

4. **Auto-Stop Behavior Changed**
   - ~~Auto-Stop calls pause()~~ → **Auto-Stop calls stop()**
   - Immediate audio halt (no partial utterance completion)

### User Testing Results

**Test 1 (Initial Implementation):**

- ❌ FAIL: Auto-stop triggered when screen was ON but app in background
- Root cause: `ScreenStateListener.isActive()` incorrectly used to determine screen state
- `hasNativeSupport` not set, causing AppState fallback to activate

**Test 2 (After First Fix):**

- ❌ FAIL: Auto-stop still triggered when screen ON, app backgrounded
- Root cause: `hasNativeSupport` not set immediately, AppState fallback still activated

**Test 3 (After Final Fixes):**

- ✅ PASS: Auto-stop correctly ignores paragraphs when screen ON
- ✅ PASS: Auto-stop correctly counts when screen OFF
- ✅ PASS: No TTSAudioManager race condition errors
- Pending: User verification

## Architecture Notes

### ScreenStateListener Native Module

- Native Kotlin module that broadcasts SCREEN_ON/SCREEN_OFF events
- `isActive()` returns if listener is active, NOT if screen is on
- Cannot reliably determine initial screen state without PowerManager API
- Conservative default: assume screen ON until OFF event

### AutoStopService State Management

- `hasNativeSupport`: Boolean, marks if native ScreenStateListener is available
- `nativeScreenOff`: Boolean, tracks if screen is OFF (from native events)
- `appStateBackground`: Boolean, tracks if app is in background (AppState API)
- `isScreenOff` getter: Returns `nativeScreenOff` if `hasNativeSupport=true`, else `appStateBackground`
- **Critical:** Set `hasNativeSupport = true` immediately on subscription to prevent AppState fallback

### TTSAudioManager State Machine

- States: IDLE → STARTING → PLAYING → REFILLING → STOPPING
- Refill subscription continues during normal playback
- Must remove listeners before stopping to prevent race conditions
