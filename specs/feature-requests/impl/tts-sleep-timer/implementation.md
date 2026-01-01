# TTS Auto-Stop (Redesign)

## Goal

Fix the issue where "TTS Sleep Timer" fails to stop playback after the configured limit by redesigning it into a unified, strict **Auto-Stop** feature.

~~This removes all screen-off checks and device-state dependencies. Auto-Stop is a straight playback limit.~~

**UPDATED:** Auto-Stop ONLY triggers when the screen is OFF. Uses native Android BroadcastReceiver for accurate screen state detection.

---

## Proposed Changes

### Settings Layer

#### [MODIFY] [useSettings.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/hooks/persisted/useSettings.ts)

Replace the legacy chapter-continue setting with Auto-Stop.

1. Remove:

```ts
ttsContinueToNextChapter: 'none' | '5' | '10' | 'continuous';
```

2. Add:

```ts
ttsAutoStopMode: 'off' | 'paragraphs' | 'chapters' | 'minutes';
ttsAutoStopAmount: number;
```

Defaults:

- `ttsAutoStopMode: 'off'`
- `ttsAutoStopAmount: 0` (ignored when mode is `off`)

---

### Auto-Stop Service

#### [NEW] [AutoStopService.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/tts/AutoStopService.ts)

```typescript
type AutoStopMode = 'off' | 'minutes' | 'chapters' | 'paragraphs';

type AutoStopReason = 'minutes' | 'chapters' | 'paragraphs';

interface AutoStopConfig {
  mode: AutoStopMode;
  amount: number;
}

export class AutoStopService {
  start(
    config: AutoStopConfig,
    onAutoStop: (reason: AutoStopReason) => void,
  ): void;
  stop(): void;

  onParagraphSpoken(): void;
  onChapterFinished(): void;

  resetCounters(): void; // for manual seek/restart
}

export const autoStopService = new AutoStopService();
```

Key behaviors:
~~- Strict: NO screen-off checks (applies whether screen is ON/OFF)~~

- **Screen-state aware: Uses native ScreenStateListener to only count when screen is OFF**
- Minutes: starts counting when TTS starts AND screen is OFF; resets on manual position change
- Paragraphs: increments per paragraph spoken ONLY when screen OFF; stops at `>= amount`
- Chapters: increments per chapter completion ONLY when screen OFF; stops at `>= amount`
- Auto-Stop calls back into controller to **stop** playback (not pause, for immediate halt)

---

### Screen State Listener (Native Module)

#### [NEW] [ScreenStateListener.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/ScreenStateListener.ts)

```typescript
export interface ScreenStateListener {
  isAvailable(): boolean;
  isActive(): boolean;
  addListener(callback: (screenOn: boolean) => void): void;
  removeListener(): void;
}
```

Native Android implementation (Kotlin):

- Registers BroadcastReceiver for SCREEN_ON/SCREEN_OFF events
- Fires callback with `true` for SCREEN_ON, `false` for SCREEN_OFF
- Only available on Android (iOS returns stub with `isAvailable() = false`)

**Critical:** `isActive()` returns if listener is active (BroadcastReceiver registered), NOT if screen is on. Do not use to determine initial screen state.

---

### TTS Controller Integration

#### [MODIFY] [useTTSController.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/hooks/useTTSController.ts)

Start:

- When TTS starts, call `autoStopService.start({ mode, amount }, callback)`.

Updates:

- When a paragraph completes: `autoStopService.onParagraphSpoken()`.
- When a chapter finishes: `autoStopService.onChapterFinished()`.

Reset:

- On manual seek/restart/explicit paragraph jump: `autoStopService.resetCounters()`.

Stop:

- On manual stop or chapter change: `autoStopService.stop()`.

Callback behavior:

- ~~On auto-stop trigger, the service calls the callback which should pause TTS~~
- On auto-stop trigger, the service calls the callback which should **stop** TTS for immediate audio halt

---

### UI (Global Reader Settings)

#### [MODIFY] [AccessibilityTab.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx)

Requirement: Insert the new UI just below "Background playback" in the Global TTS settings section.

UI:

- New section header: "Auto Stop"
- Mode selector: Off / Time / Chapter / Paragraph
- Chips/presets per mode:
  - Time: 15m / 30m / 45m / 60m
  - Chapter: 1 / 3 / 5 / 10
  - Paragraph: 5 / 10 / 15 / 20 / 30

---

## Implementation Details (Updated 2025-12-28)

### Screen State Detection Architecture

**AutoStopService State Management:**

```typescript
class AutoStopService {
  private hasNativeSupport: boolean = false;
  private nativeScreenOff: boolean = false;
  private appStateBackground: boolean = false;

  private get isScreenOff(): boolean {
    // If native support is available, use native screen state
    // Otherwise, fall back to AppState (less accurate but safe)
    return this.hasNativeSupport
      ? this.nativeScreenOff
      : this.appStateBackground;
  }

  private handleScreenStateChange(screenOn: boolean): void {
    this.nativeScreenOff = !screenOn;
    this.log('Screen state changed', {
      screenOn,
      screenOff: this.nativeScreenOff,
    });
  }

  start(config: AutoStopConfig, onAutoStop: Callback): void {
    if (ScreenStateListener.isAvailable()) {
      this.screenStateSubscription = ScreenStateListener.addListener(
        this.handleScreenStateChange,
      );

      // CRITICAL: Set immediately to prevent AppState fallback
      this.hasNativeSupport = true;

      // Conservative default: assume screen ON until SCREEN_OFF event
      this.nativeScreenOff = false;
    } else {
      // Fallback for iOS or when native module unavailable
      this.hasNativeSupport = false;
      // AppState will be used instead
    }
  }
}
```

**Why Conservative Default (screen ON until OFF event)?**

- Cannot reliably determine initial screen state without PowerManager API
- Eliminates false positives (safer than missing true screen-off events)
- Edge case (starting TTS with screen already OFF) acceptable - just need to toggle screen once

**Why Set hasNativeSupport Immediately?**

- Prevents AppState fallback from ever activating
- AppState "background" ≠ screen "off"
- Users can listen to TTS with screen ON in background (valid use case)

### Paragraph/Chapter Counting Logic

```typescript
onParagraphSpoken(): void {
  if (!this.isRunning) {
    return;
  }

  // CRITICAL: Only count when screen is OFF
  if (this.isScreenOff) {
    this.paragraphCount++;
    this.log('Paragraph spoken', {
      count: this.paragraphCount,
      limit: this.config.amount,
    });

    if (this.shouldStopParagraphs()) {
      this.triggerAutoStop('paragraphs');
    }
  } else {
    this.log('onParagraphSpoken ignored (screen ON)');
  }
}
```

### TTSAudioManager Stop Method

```typescript
async stop(): Promise<boolean> {
  try {
    this.transitionTo(TTSState.STOPPING);

    // CRITICAL: Remove all event listeners BEFORE stopping native TTS
    // This prevents refill subscriptions from firing after we've stopped
    this.removeAllListeners();

    await TTSHighlight.stop();
    await this.nativeTts.stop();

    this.cleanup();
    this.transitionTo(TTSState.IDLE);
    return true;
  } catch (error) {
    this.transitionTo(TTSState.ERROR);
    this.log('stop failed', { error });
    return false;
  }
}
```

**Why Remove Listeners First?**

- Refill subscription continues firing during normal playback
- If we stop TTS without removing listeners, refill tries to add batches during shutdown
- This causes invalid state transitions (STOPPING → REFILLING)

### Cache Drift Enforcement

```typescript
// In TTSHighlight service
setLastSpokenIndex(index: number): void {
  this.lastSpokenIndex = index;
}

// In TTSAudioManager, after paragraph completes
private async playParagraph(index: number): Promise<void> {
  try {
    await this.nativeTts.speak(text);
    this.currentParagraphIndex = index;

    // CRITICAL: Update lastSpokenIndex after successful completion
    TTSHighlight.setLastSpokenIndex(index);
  } catch (error) {
    this.log('Failed to play paragraph', { index, error });
    throw error;
  }
}

// In drift enforcement
private enforceDriftCorrection(correctIndex: number): void {
  this.log('Enforcing drift correction', {
    lastSpokenIndex: this.lastSpokenIndex,
    correctIndex,
  });

  // Reset audio state
  this.resetAudioState();

  // Restart TTS from correct position
  this.restartFromIndex(correctIndex);
}
```

---

## Verification Plan

### Automated Tests

#### Unit Tests for AutoStopService

Create `src/services/tts/__tests__/AutoStopService.test.ts`:

- Stops after N minutes (use fake timers) ~~regardless of screen state~~ **when screen is OFF**
- Stops after N paragraphs **when screen is OFF**
- Stops after N chapters **when screen is OFF**
- Does NOT stop when screen is ON (paragraphs/chapters counted but ignored)
- `stop()` prevents callback
- `resetCounters()` resets paragraph/chapter counters and restarts minute timer window

#### Integration Tests

Add to existing TTS controller integration tests:

- "Auto Stop: paragraphs stops after 5 **when screen OFF**"
- "Auto Stop: minutes stops after 15m **when screen OFF**" (fake timers)
- "Auto Stop: ignores paragraphs when screen ON"
- "Auto Stop: does NOT trigger when app in background but screen ON"

Commands:

- `pnpm run type-check`
- `pnpm test -- AutoStopService.test.ts`
- `pnpm test -- useTTSController.integration.test.ts`

### Manual Verification

1. **Auto-Stop - Time Mode (Screen OFF)**
   - Open reader → TTS tab → Enable auto-stop → Set 1 minute
   - Start TTS → Turn screen OFF
   - Wait 1 minute
   - ✅ TTS should stop with toast "Auto-stop: time limit reached"

2. **Auto-Stop - Paragraph Mode (Screen OFF)**
   - Set auto-stop to 3 paragraphs mode
   - Start TTS from beginning → Turn screen OFF
   - ✅ TTS should stop after 3 paragraphs spoken

3. **Auto-Stop - Screen ON (Should NOT trigger)**
   - Set auto-stop to 3 paragraphs mode
   - Start TTS → Keep screen ON
   - ✅ TTS should continue playing past 3 paragraphs
   - ✅ Toast or log should show "ignored (screen ON)"

4. **Auto-Stop - App Background with Screen ON (Should NOT trigger)**
   - Set auto-stop to 3 paragraphs mode
   - Start TTS → Go to Android home screen (app in background)
   - ✅ TTS should continue playing past 3 paragraphs
   - ✅ No auto-stop should occur

5. **Auto-Stop - App Background with Screen OFF (Should trigger)**
   - Set auto-stop to 3 paragraphs mode
   - Start TTS → Lock screen (screen OFF)
   - ✅ TTS should stop after 3 paragraphs

6. **Background Playback**
   - Enable auto-stop → Start TTS → Lock screen
   - ✅ Auto-stop should still fire when backgrounded

7. **TTSAudioManager Race Condition Check**
   - Trigger auto-stop
   - ✅ No "invalid-transition STOPPING → REFILLING" errors in logs
   - ✅ Clean stop with no addToBatch failures

---

## Test Results Summary

### Initial Implementation (2025-12-27)

✅ All 917 tests passing
✅ Lint passing (0 errors)
✅ Type-check passing (0 errors)

### After Bug Fixes (2025-12-28)

✅ All 910 tests passing
✅ Lint passing (0 errors)
✅ Type-check passing (0 errors)

### User Testing

⏳ Pending final verification after fixes applied
