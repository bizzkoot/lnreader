# TTS Auto-Stop (Redesign)

## Goal

Fix the issue where “TTS Sleep Timer” fails to stop playback after the configured limit by redesigning it into a unified, strict **Auto-Stop** feature.

This removes all screen-off checks and device-state dependencies. Auto-Stop is a straight playback limit.

---

## Proposed Changes

### Settings Layer

#### [MODIFY] [useSettings.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/hooks/persisted/useSettings.ts)

Replace the legacy chapter-continue setting with Auto-Stop.

1) Remove:

```ts
ttsContinueToNextChapter: 'none' | '5' | '10' | 'continuous';
```

2) Add:

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
  start(config: AutoStopConfig, onAutoStop: (reason: AutoStopReason) => void): void;
  stop(): void;

  onParagraphSpoken(): void;
  onChapterFinished(): void;

  resetCounters(): void; // for manual seek/restart
}

export const autoStopService = new AutoStopService();
```

Key behaviors:
- Strict: NO screen-off checks (applies whether screen is ON/OFF)
- Minutes: starts counting when TTS starts; resets on manual position change
- Paragraphs: increments per paragraph spoken; stops at `>= amount`
- Chapters: increments per chapter completion; stops at `>= amount`
- Auto-Stop calls back into controller to pause playback (and show optional toast)

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
- On auto-stop trigger, the service calls the callback which should pause TTS via the existing pause flow (e.g. `TTSHighlight.pause()` or the hook’s pause handler).

---

### UI (Global Reader Settings)

#### [MODIFY] [AccessibilityTab.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx)

Requirement: Insert the new UI just below “Background playback” in the Global TTS settings section.

UI:
- New section header: “Auto Stop”
- Mode selector: Off / Time / Chapter / Paragraph
- Chips/presets per mode:
  - Time: 15m / 30m / 45m / 60m
  - Chapter: 1 / 3 / 5 / 10
  - Paragraph: 5 / 10 / 15 / 20 / 30

---

## Verification Plan

### Automated Tests

#### Unit Tests for AutoStopService

Create `src/services/tts/__tests__/AutoStopService.test.ts`:
- Stops after N minutes (use fake timers)
- Stops after N paragraphs
- Stops after N chapters
- `stop()` prevents callback
- `resetCounters()` resets paragraph/chapter counters and restarts minute timer window as intended

#### Integration Tests

Add to existing TTS controller integration tests:
- “Auto Stop: paragraphs stops after 5”
- “Auto Stop: minutes stops after 15m” (fake timers)

Commands:
- `pnpm run type-check`
- `pnpm test -- AutoStopService.test.ts`
```

**Run**: `pnpm test -- useTTSController.integration.test.ts`

### Manual Verification

1. **Sleep Timer - Time Mode**
   - Open reader → TTS tab → Enable sleep timer → Set 1 minute
   - Start TTS → Wait 1 minute
   - ✅ TTS should pause with toast "Sleep timer expired"

2. **Sleep Timer - Paragraph Mode**
   - Set sleep timer to 3 paragraphs mode
   - Start TTS from beginning
   - ✅ TTS should pause after 3 paragraphs spoken

3. **Smart Rewind**
   - Play TTS to paragraph 10 → Pause
   - Wait 3 minutes (> 2 min threshold)
   - Resume TTS
   - ✅ TTS should resume from paragraph 8 (10 - 2)

4. **Background Playback**
   - Enable sleep timer → Start TTS → Lock screen
   - ✅ Sleep timer should still fire when backgrounded
