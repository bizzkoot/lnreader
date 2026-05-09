# TTS Engine Picker — Bug Fix + Alternative Engines

> **Date:** 2026-05-07
> **Status:** Pending implementation
> **Ref:** Extends [2026-05-07-tts-engine-picker.md](./2026-05-07-tts-engine-picker.md)

## Problem

After implementing the full TTS engine picker (Tasks 1-9), Samsung TTS (`com.samsung.SMT`) does not appear in the engine list. Only Google TTS (`com.google.android.tts`) is shown.

## Root Cause Analysis

The code architecture is correct:
- `TTForegroundService.getEngines()` first tries `tts?.engines` (Android API) then falls back to `packageManager.queryIntentServices(INTENT_ACTION_TTS_SERVICE)`
- `<queries>` tag in AndroidManifest correctly declares `android.intent.action.TTS_SERVICE`
- No filtering is applied

**Most likely cause:** Samsung TTS is simply not installed on the device. On modern Samsung devices (One UI 5.0+/Android 13+), Samsung has phased out their own TTS in favor of Google TTS. Samsung TTS (`com.samsung.SMT`) must be installed separately from Galaxy Store.

### Bug: AccessibilityTab — Missing onEngineSelected handler

In `AccessibilityTab.tsx:712-714`, `EnginePickerModal` is rendered WITHOUT `onEngineSelected` prop. The modal internally calls `setChapterReaderSettings()` (saves to MMKV) but **never calls `TTSAudioManager.switchEngine()`** — so selecting an engine from global settings saves the preference but does NOT actually switch the native engine. Selecting from the Reader TTS tab works correctly.

## Plan

### Phase 1: Fix AccessibilityTab Bug (P1)

**File:** `src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx`

Add `onEngineSelected` handler that:
1. Calls `TTSAudioManager.switchEngine(engineName)` to rebind the native engine
2. Clears stored voice (voices are engine-specific)
3. Persists to MMKV (already done by EnginePickerModal internally)

Alternatively, move `switchEngine()` into `EnginePickerModal` so it becomes self-contained. This is cleaner since the modal already handles MMKV persistence. The `onEngineSelected` callback remains optional for side effects.

### Phase 2: Improve Engine Discovery Fallback (P2)

**File:** `android/.../TTSForegroundService.kt`

Current `getEngines()` relies on `tts?.engines` which depends on the current engine being successfully initialized. If the default engine (Google TTS) has issues, the list may be empty. Add a more robust fallback:

```kotlin
fun getEngines(): List<TextToSpeech.EngineInfo> {
    // Try 1: Use currently-initialized TTS instance's engines list
    val ttsEngines = tts?.engines?.toList()
    if (!ttsEngines.isNullOrEmpty()) return ttsEngines

    // Try 2: Query package manager for TTS services
    val engines = mutableListOf<TextToSpeech.EngineInfo>()
    try {
        val intent = Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE)
        val infos = packageManager.queryIntentServices(intent, 0)
        for (info in infos) {
            val einfo = TextToSpeech.EngineInfo()
            einfo.name = info.serviceInfo.packageName
            einfo.label = info.serviceInfo.loadLabel(packageManager).toString()
            engines.add(einfo)
        }
    } catch (e: Exception) {
        android.util.Log.e("TTSForegroundService", "Failed to query TTS engines: ${e.message}")
    }
    return engines
}
```

This is already implemented in the diff. The issue is not in the code — it's that Samsung TTS isn't installed.

### Phase 3: Alternative TTS Engines (Research)

High-quality **local-only** TTS engines that register as Android system TTS engines:

| Engine | Package | Quality | Cost | Languages |
|--------|---------|---------|------|-----------|
| **RHVoice** | `com.github.olga_yakovleva.rhvoice.android` | High (CMU Arctic voices) | Free | EN (US/UK), RU, UK, TT, KY, EO, PT, KA, MK |
| **eSpeak NG** | `com.reecedunn.espeak` | Medium (formant) | Free | 50+ languages |
| **Samsung TTS** | `com.samsung.SMT` | Good (women/men voices) | Free | EN, KR, JP, CN, etc. (voice packs from Galaxy Store) |
| **Vocalizer** | `com.vocalizer.vocalizerttseng` | High | Paid | Many languages, premium voices |
| **Acapela** | varies | High | Paid | Many languages |

**Recommendation: RHVoice**

- Open source (Apache 2.0)
- Neural-quality voices (CMU Arctic: Alan, BDL, CLT, SLT)
- Fully offline
- Available on Google Play and F-Droid
- Active development (GitHub: RHVoice/RHVoice)
- Multiple English accents (US Alan, US BDL, British CLB)

### Phase 4 (Optional): Samsung TTS Diagnosis

If user wants Samsung TTS specifically:
1. Check: `Settings → General Management → Text-to-speech → Preferred engine`
2. If not listed, install from Galaxy Store, search "Samsung TTS"
3. Verify via adb: `adb shell pm list packages | grep -i smt`
4. If installed but not showing, check if disabled: `adb shell pm list packages -d | grep smt`
5. Re-enable if needed: `adb shell pm enable com.samsung.SMT`

## Implementation Tasks

### T1: Fix AccessibilityTab engine handler
- Move `switchEngine()` call into `EnginePickerModal` or add handler to AccessibilityTab
- Import `TTSAudioManager` where needed
- Test: open engine picker from Settings, select engine, verify native switches

### T2: Verify build + lint
- `pnpm run type-check`
- `pnpm run lint:fix`
- `pnpm run test`

### T3: Commit
```
fix(tts): call switchEngine when selecting engine from AccessibilityTab

EnginePickerModal in AccessibilityTab was missing onEngineSelected handler,
so engine selection saved to MMKV but never called the native setEngine.
Fixed by calling TTSAudioManager.switchEngine() in the modal's onPress.
```

## Files Affected

| File | Change |
|------|--------|
| `EnginePickerModal.tsx` | Add `TTSAudioManager.switchEngine()` call in onPress |
| `AccessibilityTab.tsx` | Pass `onEngineSelected` handler (if not handled by modal) |
