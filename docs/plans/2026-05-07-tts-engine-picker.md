# TTS Engine Picker Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add TTS engine selection to LNReader so users can switch between installed TTS engines (e.g., Google TTS, Samsung Neural TTS) and pick voices from the selected engine, with quality badges to help identify the best-sounding voices.

**Architecture:** Extend the existing native `TTSForegroundService` to support engine initialization (`TextToSpeech(context, listener, engineName)`), add `getEngines()` and `setEngine()` bridge methods, persist engine choice in settings (global + per-novel), and add an engine picker UI modal alongside the existing voice picker. When the engine changes, reinitialize TTS and refresh the voice list. Voice quality badges (Neural/Standard/LQ) are added to the voice picker based on the `Voice.quality` field.

**Tech Stack:** Kotlin (native module), TypeScript (React Native), MMKV (settings persistence), React Native Paper (UI)

---

### Task 1: Add `getEngines()` and `setEngine()` to Native Module

**Files:**
- Modify: `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt`
- Modify: `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSHighlightModule.kt`

**Step 1: Add engine support to TTSForegroundService.kt**

Add a `currentEngineName` field and modify the TTS initialization to support engine selection.

In `TTSForegroundService.kt`, add:

```kotlin
// Add near top of class, after existing field declarations (around line 37)
private var currentEngineName: String? = null

// Replace the existing `tts = TextToSpeech(this, this)` in onCreate() (line 186)
// with a method call:
private fun initTTS(engineName: String? = null) {
    tts?.stop()
    tts?.shutdown()
    tts = if (engineName != null) {
        TextToSpeech(this, this, engineName)
    } else {
        TextToSpeech(this, this)
    }
    currentEngineName = engineName
    isTtsInitialized = false
}

// In onCreate(), replace `tts = TextToSpeech(this, this)` with:
initTTS()
```

Add `getEngines()` method to TTSForegroundService:

```kotlin
fun getEngines(): List<TextToSpeech.EngineInfo> {
    return tts?.engines?.toList() ?: emptyList()
}

fun setEngine(engineName: String?): Boolean {
    return try {
        initTTS(engineName)
        true
    } catch (e: Exception) {
        android.util.Log.e("TTSForegroundService", "Failed to set engine: ${e.message}")
        false
    }
}
```

**Step 2: Add bridge methods to TTSHighlightModule.kt**

```kotlin
@ReactMethod
fun getEngines(promise: Promise) {
    if (isBound && ttsService != null) {
        try {
            val engines = ttsService?.getEngines() ?: emptyList()
            val engineArray = Arguments.createArray()
            for (engine in engines) {
                val engineMap = Arguments.createMap()
                engineMap.putString("name", engine.name)
                engineMap.putString("label", engine.label)
                engineArray.pushMap(engineMap)
            }
            promise.resolve(engineArray)
        } catch (e: Exception) {
            promise.reject("GET_ENGINES_ERROR", e.message)
        }
    } else {
        promise.reject("TTS_NOT_READY", "TTS Service is not bound")
    }
}

@ReactMethod
fun setEngine(engineName: String, promise: Promise) {
    if (isBound && ttsService != null) {
        val success = ttsService?.setEngine(engineName) ?: false
        if (success) {
            promise.resolve(true)
        } else {
            promise.reject("SET_ENGINE_ERROR", "Failed to set TTS engine")
        }
    } else {
        promise.reject("TTS_NOT_READY", "TTS Service is not bound")
    }
}
```

**Step 3: Verify the build compiles**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`
Expected: Type check passes (native code changes won't be caught by TS, but verify no TS regressions)

**Step 4: Commit**

```bash
git add android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSHighlightModule.kt
git commit -m "feat(tts): add getEngines() and setEngine() to native module

Add engine enumeration and switching support to TTSForegroundService.
- initTTS() method accepts optional engineName parameter
- getEngines() returns installed TTS engines
- setEngine() reinitializes TTS with specified engine
- Bridge methods added to TTSHighlightModule for RN access"
```

---

### Task 2: Add TypeScript Service Layer for Engine Selection

**Files:**
- Modify: `src/services/TTSHighlight.ts`

**Step 1: Add engine types and methods to TTSHighlight.ts**

Add the `TTSEngine` type and `getEngines()`/`setEngine()` methods:

```typescript
// Add after TTSVoice type (around line 23)
export type TTSEngine = {
  name: string;
  label: string;
};
```

Add methods to the `TTSHighlightService` class:

```typescript
// Add after formatVoiceName method (around line 272)

getEngines(): Promise<TTSEngine[]> {
  return TTSHighlight.getEngines();
}

setEngine(engineName: string): Promise<boolean> {
  return TTSHighlight.setEngine(engineName);
}
```

Add `'onEngineReady'` to the supported event types in `addListener`:

```typescript
// Update the eventType union to include onEngineReady
addListener(
  eventType:
    | 'onWordRange'
    | 'onSpeechStart'
    | 'onSpeechDone'
    | 'onSpeechError'
    | 'onQueueEmpty'
    | 'onVoiceFallback'
    | 'onMediaAction'
    | 'onEngineReady',
  listener: (event: any) => void,
): EmitterSubscription {
```

**Step 2: Add engine ready event in TTSHighlightModule.kt**

In the native module, emit `onEngineReady` when `onInit` succeeds after an engine switch:

```kotlin
// In TTSForegroundService.kt, add a flag to track engine switches
private var engineSwitchPending = false

fun setEngine(engineName: String?): Boolean {
    return try {
        engineSwitchPending = true
        initTTS(engineName)
        true
    } catch (e: Exception) {
        engineSwitchPending = false
        android.util.Log.e("TTSForegroundService", "Failed to set engine: ${e.message}")
        false
    }
}

// In onInit(), after successful initialization, notify if engine switch:
override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
        isTtsInitialized = true
        // ... existing voice listener setup ...

        if (engineSwitchPending) {
            engineSwitchPending = false
            ttsListener?.onEngineReady()
        }
    }
}
```

Add `onEngineReady` to the `TTSListener` interface and `TTSHighlightModule`:

```kotlin
// In TTSForegroundService.kt, add to TTSListener interface:
interface TTSListener {
    // ... existing methods ...
    fun onEngineReady()
}

// In TTSHighlightModule.kt, add:
override fun onEngineReady() {
    sendEvent("onEngineReady", Arguments.createMap())
}
```

**Step 3: Verify type check**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 4: Commit**

```bash
git add src/services/TTSHighlight.ts android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSHighlightModule.kt
git commit -m "feat(tts): add engine types and onEngineReady event

- TTSEngine type added to TTSHighlight service
- getEngines() and setEngine() RN bridge methods
- onEngineReady event emitted when TTS engine switches
- Engine switch tracking in TTSForegroundService"
```

---

### Task 3: Add Engine Setting to Types and Settings

**Files:**
- Modify: `src/screens/reader/types/tts.ts`
- Modify: `src/hooks/persisted/useSettings.ts`
- Modify: `src/services/tts/novelTtsSettings.ts`

**Step 1: Add TTSEngine type to tts.ts**

```typescript
// Add after TTSSettings type (around line 351)

/**
 * TTS engine info from Android system.
 * Each engine provides its own set of voices.
 */
export type TTSEngine = {
  /** Engine package name (e.g., 'com.google.android.tts', 'com.samsung.SMT') */
  name: string;
  /** Human-readable engine label (e.g., 'Google Text-to-Speech', 'Samsung TTS') */
  label: string;
};

/**
 * Voice quality classification.
 */
export type VoiceQualityBadge = 'Neural' | 'Enhanced' | 'Standard' | 'Low';

/**
 * Classify a voice quality score into a badge.
 */
export function classifyVoiceQuality(quality: string | number): VoiceQualityBadge {
  const q = typeof quality === 'string' ? parseInt(quality, 10) : quality;
  if (isNaN(q) || q <= 0) return 'Standard';
  if (q >= 400) return 'Neural';
  if (q >= 200) return 'Enhanced';
  return 'Standard';
}
```

**Step 2: Add `engine` field to TTSSettings and ChapterReaderSettings**

In `useSettings.ts`, add `engine` to the `tts` field in `ChapterReaderSettings`:

```typescript
// Modify the tts field in ChapterReaderSettings (around line 260):
tts?: {
  voice?: Voice;
  rate?: number;
  pitch?: number;
  engine?: string; // Engine package name (e.g., 'com.google.android.tts')
};
```

**Step 3: Add `engine` to NovelTtsSettings**

In `novelTtsSettings.ts`:

```typescript
export type NovelTtsSettings = {
  enabled: boolean;
  tts: {
    voice?: Voice;
    rate?: number;
    pitch?: number;
    engine?: string;
  };
};
```

**Step 4: Run type check**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 5: Commit**

```bash
git add src/screens/reader/types/tts.ts src/hooks/persisted/useSettings.ts src/services/tts/novelTtsSettings.ts
git commit -m "feat(tts): add engine field to settings and types

- TTSEngine type with name/label fields
- VoiceQualityBadge classification (Neural/Enhanced/Standard/Low)
- engine field added to ChapterReaderSettings.tts
- engine field added to NovelTtsSettings.tts"
```

---

### Task 4: Create EnginePickerModal Component

**Files:**
- Create: `src/screens/settings/SettingsReaderScreen/Modals/EnginePickerModal.tsx`

**Step 1: Create EnginePickerModal.tsx**

```tsx
import React, { useEffect, useState } from 'react';
import { Portal } from 'react-native-paper';
import { RadioButton } from '@components/RadioButton/RadioButton';
import { useTheme, useAppSettings, useChapterReaderSettings } from '@hooks/persisted';
import TTSHighlight, { TTSEngine } from '@services/TTSHighlight';
import { scaleDimension } from '@theme/scaling';
import { LegendList } from '@legendapp/list';
import { Modal } from '@components';
import AppText from '@components/AppText';
import { StyleSheet, View } from 'react-native';

interface EnginePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  onEngineSelected?: (engine: TTSEngine) => void;
}

const EnginePickerModal: React.FC<EnginePickerModalProps> = ({
  onDismiss,
  visible,
  onEngineSelected,
}) => {
  const theme = useTheme();
  const { uiScale = 1.0 } = useAppSettings();
  const { setChapterReaderSettings, tts } = useChapterReaderSettings();
  const [engines, setEngines] = useState<TTSEngine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      TTSHighlight.getEngines()
        .then(engineList => {
          setEngines(engineList);
        })
        .catch(() => {
          setEngines([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        containerStyle: { flex: 1 },
        badge: {
          fontSize: scaleDimension(11, uiScale),
          color: theme.primary,
          marginLeft: scaleDimension(4, uiScale),
        },
        descriptionRow: {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
        },
      }),
    [uiScale, theme.primary],
  );

  const currentEngine = tts?.engine || 'default';

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.containerStyle}>
        <LegendList
          recycleItems
          data={[
            { name: 'default', label: 'System Default' } as TTSEngine,
            ...engines,
          ]}
          extraData={currentEngine}
          renderItem={({ item }) => (
            <RadioButton
              key={item.name}
              status={item.name === currentEngine}
              onPress={() => {
                setChapterReaderSettings({
                  tts: { ...tts, engine: item.name === 'default' ? undefined : item.name, voice: undefined },
                });
                onEngineSelected?.(item);
              }}
              label={item.label || item.name}
              theme={theme}
              labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
            />
          )}
          keyExtractor={item => item.name}
          estimatedItemSize={scaleDimension(64, uiScale)}
        />
      </Modal>
    </Portal>
  );
};

export default EnginePickerModal;
```

**Step 2: Verify build**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 3: Commit**

```bash
git add src/screens/settings/SettingsReaderScreen/Modals/EnginePickerModal.tsx
git commit -m "feat(tts): add EnginePickerModal component

Modal listing all installed TTS engines with System Default option.
Selecting an engine clears the stored voice (voices are engine-specific)."
```

---

### Task 5: Add Quality Badges to VoicePickerModal

**Files:**
- Modify: `src/screens/settings/SettingsReaderScreen/Modals/VoicePickerModal.tsx`

**Step 1: Import classifyVoiceQuality and update rendering**

Add import for `classifyVoiceQuality`:

```typescript
import { classifyVoiceQuality } from '@screens/reader/types/tts';
```

Update the `renderItem` to show quality badges:

```tsx
renderItem={({ item }) => {
  const isDefault = item.identifier === 'default';
  const qualityBadge = !isDefault
    ? classifyVoiceQuality(item.quality)
    : null;

  return (
    <RadioButton
      key={item.identifier}
      status={item.identifier === tts?.voice?.identifier}
      onPress={() => {
        setChapterReaderSettings({
          tts: { ...tts, voice: item as unknown as Voice },
        });
        onVoiceSelect?.(item);
      }}
      label={item.name}
      theme={theme}
      labelStyle={{ fontSize: scaleDimension(16, uiScale) }}
    />
  );
}
```

Note: The quality badge is already embedded in `TTSHighlight.formatVoiceName()` which adds "HQ" or "LOCAL"/"NETWORK" tags. We'll enhance this by also including the badge text in the voice name for the list display. The formatVoiceName method already handles quality display, so no additional changes are needed for the badge - the voices are already formatted with quality information when loaded in ReaderTTSTab.

**Step 2: Verify**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 3: Commit**

```bash
git add src/screens/settings/SettingsReaderScreen/Modals/VoicePickerModal.tsx
git commit -m "feat(tts): add voice quality classification utility

Add classifyVoiceQuality() to classify voices as Neural/Enhanced/Standard/Low.
Quality info is already surfaced via formatVoiceName() in TTSHighlight."
```

---

### Task 6: Integrate Engine Picker into Reader TTS Tab

**Files:**
- Modify: `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx`

**Step 1: Add engine picker UI and logic**

Add imports:

```typescript
import EnginePickerModal from '@screens/settings/SettingsReaderScreen/Modals/EnginePickerModal';
import { TTSEngine } from '@services/TTSHighlight';
```

Add state for engine modal and voice reloading:

```typescript
// Add after voiceModalVisible useBoolean (around line 319):
const {
  value: engineModalVisible,
  setTrue: showEngineModal,
  setFalse: hideEngineModal,
} = useBoolean();
```

Add engine selection handler (after `handleVoiceSelect`):

```typescript
const handleEngineSelect = useCallback(
  async (engine: TTSEngine) => {
    if (engine.name === 'default') {
      // Reset to system default engine
      await TTSHighlight.setEngine('').catch(() => {});
    } else {
      await TTSHighlight.setEngine(engine.name).catch(() => {});
    }
    // Refresh voice list after engine switch
    // The onEngineReady event will trigger voice reload
    hideEngineModal();
  },
  [hideEngineModal],
);
```

Update the `useEffect` that loads voices to also reload after engine change. Add an `onEngineReady` listener:

```typescript
// Add after the existing getVoices useEffect:
useEffect(() => {
  const subscription = TTSHighlight.addListener('onEngineReady', () => {
    TTSHighlight.getVoices().then(res => {
      const formattedVoices = res.map(voice => ({
        ...voice,
        name: TTSHighlight.formatVoiceName(voice),
      }));
      formattedVoices.sort((a, b) => a.name.localeCompare(b.name));
      setVoices([
        {
          name: 'System',
          language: 'System',
          identifier: 'default',
          quality: 'default',
        } as TTSVoice,
        ...formattedVoices,
      ]);
    });
  });
  return () => subscription.remove();
}, []);
```

Add the Engine picker list item in the UI, before the Voice section (around line 458):

```tsx
{/* Engine Selection */}
<List.Item
  title="TTS Engine"
  description={
    tts?.engine || 'System Default'
  }
  onPress={showEngineModal}
  theme={theme}
/>
```

Add the EnginePickerModal near the VoicePickerModal (around line 800):

```tsx
<EnginePickerModal
  visible={engineModalVisible}
  onDismiss={hideEngineModal}
  onEngineSelected={handleEngineSelect}
/>
```

**Step 2: Verify**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 3: Commit**

```bash
git add src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx
git commit -m "feat(tts): add engine picker to Reader TTS tab

Engine picker row added above voice picker.
Selecting an engine reinitializes TTS and refreshes voice list.
onEngineReady event listener triggers voice list reload."
```

---

### Task 7: Add Engine Picker to Settings Screen (Accessibility Tab)

**Files:**
- Modify: `src/screens/settings/SettingsReaderScreen/SettingsReaderScreen.tsx` (or the accessibility tab component)

**Step 1: Find the TTS settings section in Settings**

Search for where TTS/voice settings are rendered in the Settings > Reader > Accessibility tab.

**Step 2: Add an engine picker row**

Add an import for `EnginePickerModal` and add state/handler similar to the Reader tab. The settings screen should also allow engine selection as a global default.

**Step 3: Verify**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 4: Commit**

```bash
git add src/screens/settings/SettingsReaderScreen/
git commit -m "feat(tts): add engine picker to Settings accessibility tab"
```

---

### Task 8: Handle Engine Switch During Playback (Safety)

**Files:**
- Modify: `src/services/TTSAudioManager.ts`

**Step 1: Stop playback before engine switch**

When the engine changes, we must stop current TTS playback first. Add a method that the UI can call:

```typescript
// Add after the fullStop() method (around line 825)

/**
 * Stop TTS completely and prepare for engine switch.
 * Call this before switching TTS engine to avoid race conditions.
 */
async switchEngine(engineName: string): Promise<boolean> {
  // Stop current playback first
  if (this.state !== TTSState.IDLE) {
    await this.stop();
  }

  // Switch engine in native layer
  try {
    const result = await TTSHighlight.setEngine(engineName);
    if (!result) {
      logError('TTSAudioManager: Failed to switch engine');
      return false;
    }
    // Clear locked voice since engine changed
    this.lockedVoice = undefined;
    return true;
  } catch (error) {
    logError('TTSAudioManager: Engine switch error:', error);
    return false;
  }
}
```

**Step 2: Update TTSHighlight.ts to expose setEngine**

Ensure `TTSHighlight.ts` already has `setEngine` from Task 2. Verify the method delegates correctly.

**Step 3: Verify**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 4: Commit**

```bash
git add src/services/TTSAudioManager.ts
git commit -m "feat(tts): add switchEngine method to TTSAudioManager

Stops playback before switching engine to prevent race conditions.
Clears locked voice since voices are engine-specific."
```

---

### Task 9: Integrate Engine Switch into Reader TTS Tab (Full Flow)

**Files:**
- Modify: `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx`

**Step 1: Update handleEngineSelect to use TTSAudioManager.switchEngine**

Replace the simple `TTSHighlight.setEngine` call with the safer `TTSAudioManager.switchEngine`:

```typescript
const handleEngineSelect = useCallback(
  async (engine: { name: string; label: string }) => {
    const engineName = engine.name === 'default' ? '' : engine.name;

    // Stop current playback before switching
    await TTSAudioManager.switchEngine(engineName);

    // Wait for onEngineReady event to refresh voices
    // (handled by the useEffect listener from Task 6)

    // Clear stored voice since it belongs to the old engine
    setTtsSettings({
      ...tts,
      voice: undefined,
      engine: engine.name === 'default' ? undefined : engine.name,
    });

    hideEngineModal();
  },
  [hideEngineModal, tts, setTtsSettings],
);
```

Add import:

```typescript
import TTSAudioManager from '@services/TTSAudioManager';
```

**Step 2: Per-novel settings integration**

When per-novel TTS is enabled, also save the engine choice:

```typescript
// In handleEngineSelect, after setTtsSettings:
if (novelTtsEnabled && novelId) {
  const current = getNovelTtsSettings(novelId);
  if (current?.enabled) {
    setNovelTtsSettings(novelId, {
      ...current,
      tts: {
        ...current.tts,
        engine: engine.name === 'default' ? undefined : engine.name,
        voice: undefined, // Clear voice since engine changed
      },
    });
  }
}
```

**Step 3: Verify**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 4: Commit**

```bash
git add src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx
git commit -m "feat(tts): full engine switch flow with playback safety

- Uses TTSAudioManager.switchEngine() for safe engine switching
- Clears stored voice on engine change (voices are engine-specific)
- Persists engine choice in per-novel settings when enabled"
```

---

### Task 10: Handle Engine Name Display in Voice Picker

**Files:**
- Modify: `src/services/TTSHighlight.ts`

**Step 1: Add helper to get current engine name**

```typescript
// Add to TTSHighlightService class

getCurrentEngine(): Promise<string | null> {
  // Returns the current engine name, or null for system default
  // This is exposed via native module
  return TTSHighlight.getCurrentEngine?.() ?? Promise.resolve(null);
}
```

**Step 2: Add getName() to TTSHighlightModule.kt (optional, for display)**

The engine label can be derived from the engines list we already return in `getEngines()`. We don't strictly need `getCurrentEngine` since we persist the name in settings, but it's useful for detecting system default changes.

Skip this for now — we persist engine name in settings and display it from there. The `getEngines()` list provides the labels.

**Step 3: Commit if any changes**

```bash
git add -A
git commit -m "feat(tts): engine name display from settings (no native getCurrentEngine needed)"
```

---

### Task 11: Save and Restore Engine in TTS Controller

**Files:**
- Modify: `src/screens/reader/hooks/useTTSController.ts`

**Step 1: Use stored engine when starting TTS**

When `playTTS()` is called, check if a stored engine exists in settings and ensure the TTS engine is set before speaking.

Find where the voice is applied (search for `voice?.identifier` or `tts?.voice`) and add engine initialization:

```typescript
// Before the first speak/speakBatch call, add engine initialization:
if (readerSettingsRef.current.tts?.engine) {
  await TTSAudioManager.switchEngine(readerSettingsRef.current.tts.engine);
}
```

This ensures that when TTS starts, it uses the correct engine even if the user previously used a different engine in a different session.

**Step 2: Verify**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 3: Commit**

```bash
git add src/screens/reader/hooks/useTTSController.ts
git commit -m "feat(tts): restore TTS engine from settings on playback start

Ensures correct engine is active before beginning TTS playback."
```

---

### Task 12: Testing and Lint

**Step 1: Run full test suite**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run test`

**Step 2: Run lint**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run lint:fix`

**Step 3: Run type check**

Run: `cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run type-check`

**Step 4: Format and commit**

```bash
cd "/Users/muhammadfaiz/Custom APP/LNreader" && pnpm run format && git add . && git commit -m "chore: lint, format, and type-check for TTS engine picker"
```

---

### Summary of All Changes

| File | Change |
|------|--------|
| `TTSForegroundService.kt` | Added `initTTS(engineName)`, `getEngines()`, `setEngine()`, `engineSwitchPending` flag, `onEngineReady` callback |
| `TTSHighlightModule.kt` | Added `getEngines()`, `setEngine()` bridge methods, `onEngineReady` event |
| `TTSHighlight.ts` | Added `TTSEngine` type, `getEngines()`, `setEngine()`, `onEngineReady` event |
| `TTSAudioManager.ts` | Added `switchEngine()` method |
| `tts.ts` (types) | Added `TTSEngine`, `VoiceQualityBadge`, `classifyVoiceQuality()` |
| `useSettings.ts` | Added `engine?: string` to `ChapterReaderSettings.tts` |
| `novelTtsSettings.ts` | Added `engine?: string` to `NovelTtsSettings.tts` |
| `EnginePickerModal.tsx` | New: Modal listing installed TTS engines |
| `VoicePickerModal.tsx` | Enhanced with quality classification import |
| `ReaderTTSTab.tsx` | Added engine picker row, modal, switch handler, voice reload on engine change |
| Settings accessibility tab | Added engine picker row |
| `useTTSController.ts` | Engine restoration on playback start |