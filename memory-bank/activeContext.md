# Active Context

## Current Goals

- Bluetooth TTS Media Button Support (2026-01-01) - ✅ COMPLETED
- **Status:** Full implementation and verification complete
- **Solution:** Silent audio workaround with proper AudioAttributes
- **Test Method:** `adb shell cmd media_session dispatch play-pause`

## Key Files Modified (This Session)

### Bluetooth Media Button Support
- `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt`: Added silent MediaPlayer with AudioAttributes
- `android/app/src/main/res/raw/silence.mp3`: 0.5s silent audio file (NEW)
- `GEMINI.md`: Updated Current Task section
- `specs/bluetooth-headset-support/DEBUGGING_LOG.md`: Complete solution documentation
- `memory-bank/decisionLog.md`: Added decision entry

## Root Cause Fixed

**Problem:** TTS audio played by `com.google.android.tts` (system service), not our app → MediaSession "orphaned" from audio stack → `Media button session is null`

**Solution:** Play silent looping audio with `MediaPlayer` using `AudioAttributes` (USAGE_MEDIA, CONTENT_TYPE_MUSIC) → Our app becomes audio focus owner → Media button events route to our `MediaSession` → `Media button session is com.rajarsheechatterjee.LNReader.debug/LNReaderTTS` ✅

## Test Commands

```bash
# Correct test (simulates real Bluetooth):
adb shell cmd media_session dispatch play-pause

# Verify MediaSession registration:
adb shell dumpsys media_session | grep "Media button"

# Development
pnpm run dev:android

# Format before commit
pnpm run format
```

## Implementation Details

**Silent Audio Functions:**
- `startSilentAudioForMediaSession()` - Creates MediaPlayer with AudioAttributes, loops silence
- `stopSilentAudio()` - Stops and releases MediaPlayer
- Called in: `speakBatch()`, `stopTTS()`, `onDestroy()`

**Why AudioAttributes Matter:**
```kotlin
AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_MEDIA)
    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
```
These signal to Android that our app is the active media player.

## Current Blockers

- None (Ready for git commit)

## Next Steps

- Test with real Bluetooth headphones on physical device
- Consider removing debug logs in production build
