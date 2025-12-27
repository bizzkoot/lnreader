# TTS Sleep Timer + Smart Rewind

## Goal

Add player-grade TTS controls: sleep timer (stop after N minutes/paragraphs/end of chapter) and smart rewind (on resume after pause, rewind N paragraphs based on pause duration).

---

## Proposed Changes

### Settings Layer

#### [MODIFY] [useSettings.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/hooks/persisted/useSettings.ts)

Add to `ChapterGeneralSettings` interface:

```typescript
// TTS Sleep Timer
ttsSleepTimerEnabled: boolean;
ttsSleepTimerMode: 'minutes' | 'endOfChapter' | 'paragraphs';
ttsSleepTimerMinutes: number;  // 5, 10, 15, 30, 45, 60
ttsSleepTimerParagraphs: number;  // Number of paragraphs

// TTS Smart Rewind
ttsSmartRewindEnabled: boolean;
ttsSmartRewindParagraphs: number;  // 1-5
ttsSmartRewindThresholdMs: number;  // e.g., 120000 (2 min)
```

Add to `initialChapterGeneralSettings`:

```typescript
ttsSleepTimerEnabled: false,
ttsSleepTimerMode: 'minutes',
ttsSleepTimerMinutes: 15,
ttsSleepTimerParagraphs: 5,
ttsSmartRewindEnabled: true,
ttsSmartRewindParagraphs: 2,
ttsSmartRewindThresholdMs: 120000, // 2 minutes
```

---

### Sleep Timer Service

#### [NEW] [SleepTimer.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/tts/SleepTimer.ts)

```typescript
/**
 * TTS Sleep Timer
 * 
 * Singleton scheduler that triggers pause/stop after:
 * - N minutes from start
 * - End of current chapter
 * - N paragraphs spoken
 */

type SleepTimerMode = 'minutes' | 'endOfChapter' | 'paragraphs';

interface SleepTimerConfig {
  mode: SleepTimerMode;
  minutes?: number;
  paragraphs?: number;
}

interface SleepTimerState {
  isActive: boolean;
  startedAt: number;
  remainingMs: number;
  remainingParagraphs: number;
  mode: SleepTimerMode;
}

export class SleepTimer {
  private timer: NodeJS.Timeout | null = null;
  private config: SleepTimerConfig | null = null;
  private onExpire: (() => void) | null = null;
  private paragraphsSpoken: number = 0;
  private startTime: number = 0;
  
  start(config: SleepTimerConfig, onExpire: () => void): void;
  cancel(): void;
  getState(): SleepTimerState;
  onParagraphSpoken(): void; // For paragraph-count mode
}

export const sleepTimer = new SleepTimer();
```

Key behaviors:
- Single active timer per reader session
- `start()` arms timer, stores callback
- `cancel()` disarms on manual stop or TTS stop
- `onParagraphSpoken()` called by TTS controller each paragraph
- Fires callback when condition met (pause TTS via existing action)

---

### TTS Controller Integration

#### [MODIFY] [useTTSController.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/hooks/useTTSController.ts)

**Add session tracking state** (around line 266 in hook body):

```typescript
// Session tracking for smart rewind
const lastPausedAtRef = useRef<number | null>(null);
const lastParagraphAtPauseRef = useRef<number>(0);
```

**On TTS start/resume** (in existing play path):

```typescript
// Arm sleep timer if enabled
if (settings.ttsSleepTimerEnabled) {
  sleepTimer.start({
    mode: settings.ttsSleepTimerMode,
    minutes: settings.ttsSleepTimerMinutes,
    paragraphs: settings.ttsSleepTimerParagraphs,
  }, () => {
    // Callback on expire
    pauseTTS();
    showToastMessage(getString('tts.sleepTimerExpired'));
  });
}
```

**On TTS pause/stop** (in existing pause path):

```typescript
// Record pause time + index for smart rewind
lastPausedAtRef.current = Date.now();
lastParagraphAtPauseRef.current = currentParagraphIndexRef.current;
sleepTimer.cancel();
```

**On TTS resume** (in existing resume path):

```typescript
// Smart rewind decision
if (settings.ttsSmartRewindEnabled && lastPausedAtRef.current) {
  const pauseDuration = Date.now() - lastPausedAtRef.current;
  if (pauseDuration > settings.ttsSmartRewindThresholdMs) {
    const rewindTo = Math.max(0, 
      lastParagraphAtPauseRef.current - settings.ttsSmartRewindParagraphs
    );
    // Start from `rewindTo` instead of current position
    currentParagraphIndexRef.current = rewindTo;
  }
}
lastPausedAtRef.current = null;
```

**On each paragraph spoken** (in `onTTSComplete` handler):

```typescript
sleepTimer.onParagraphSpoken();
```

---

### UI Controls

#### [MODIFY] [ReaderTTSTab.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx)

Add sleep timer section after existing TTS controls:

```tsx
{/* Sleep Timer */}
<View style={styles.section}>
  <View style={styles.row}>
    <AppText>Sleep Timer</AppText>
    <Switch
      value={chapterGeneralSettings.ttsSleepTimerEnabled}
      onValueChange={v => setChapterGeneralSettings({ ttsSleepTimerEnabled: v })}
    />
  </View>
  
  {chapterGeneralSettings.ttsSleepTimerEnabled && (
    <>
      {/* Mode picker: minutes/endOfChapter/paragraphs */}
      <SegmentedButtons
        value={chapterGeneralSettings.ttsSleepTimerMode}
        onValueChange={v => setChapterGeneralSettings({ ttsSleepTimerMode: v })}
        buttons={[
          { value: 'minutes', label: 'Time' },
          { value: 'endOfChapter', label: 'Chapter' },
          { value: 'paragraphs', label: 'Paragraphs' },
        ]}
      />
      
      {/* Time presets */}
      {chapterGeneralSettings.ttsSleepTimerMode === 'minutes' && (
        <Slider
          minimumValue={5}
          maximumValue={60}
          step={5}
          value={chapterGeneralSettings.ttsSleepTimerMinutes}
          onValueChange={v => setChapterGeneralSettings({ ttsSleepTimerMinutes: v })}
        />
      )}
      
      {/* Status chip when active */}
      {sleepTimerState.isActive && (
        <Chip icon="timer">{formatRemaining(sleepTimerState.remainingMs)}</Chip>
      )}
    </>
  )}
</View>
```

---

## Verification Plan

### Automated Tests

#### Unit Tests for SleepTimer

Create `src/services/tts/__tests__/SleepTimer.test.ts`:

```typescript
describe('SleepTimer', () => {
  it('fires callback after specified minutes', () => { ... });
  it('fires callback after N paragraphs spoken', () => { ... });
  it('cancel() prevents callback', () => { ... });
  it('getState() returns accurate remaining time', () => { ... });
});
```

**Run**: `pnpm test -- SleepTimer.test.ts`

#### Integration Tests for Smart Rewind

Add to existing TTS tests:

```typescript
describe('Smart Rewind', () => {
  it('rewinds N paragraphs if pause > threshold', () => { ... });
  it('does not rewind if pause < threshold', () => { ... });
  it('respects smart rewind enabled setting', () => { ... });
});
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
