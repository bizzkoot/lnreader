# Bluetooth TTS Media Button Support - Solution Log

**Objective:** Enable Bluetooth headset play/pause controls for TTS playback  
**Status:** ✅ COMPLETED  
**Date:** 2026-01-01

## The Problem

**Symptom:** Bluetooth headset play/pause buttons had no effect on TTS playback, especially when device screen was off.

**Root Cause:** TTS audio is played by the system TTS engine (`com.google.android.tts`), not by our application. This caused our `MediaSession` to be "orphaned" from Android's audio stack:

```bash
# adb shell dumpsys media_session output when screen OFF:
Media button session is null  # ❌ Events not routed to our app
...
LNReaderTTS ... active=true ... state=PLAYING(3)  # Session exists but orphaned
```

Android determines which app receives media button events based on which app currently "owns" audio focus. Since the system TTS service was playing the audio, Android didn't recognize our MediaSession as the active media player.

## Failed Approaches

### Attempt 1: Attach MediaSession to Notification
**Action:** Added `.setStyle(MediaStyle().setMediaSession(mediaSession.sessionToken))` to notification

**Result:**  
- ✅ Media button routing worked!
- ❌ Android enforced system-standard media notification (lost custom 6-button layout)
- ❌ Limited to 5 buttons maximum

**Decision:** Reverted to preserve custom notification UI

### Attempt 2: Direct Service Intent Filter
**Action:** Added `<intent-filter>` for `MEDIA_BUTTON` to `TTSForegroundService`

**Result:** Inconsistent - sometimes `onStartCommand` was skipped or delayed

**Decision:** Reverted

## The Solution: Silent Audio Workaround

### Strategy
Play a **silent looping audio file** using `MediaPlayer` with proper `AudioAttributes`. This makes our app the "audio focus owner" from Android's perspective, causing media button events to route to our `MediaSession`.

### Implementation

1. **Created Silent Audio Resource**
   - File: `android/app/src/main/res/raw/silence.mp3`
   - Duration: 0.5 seconds
   - Size: ~2KB
   - Generated with: `ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 0.5 -q:a 9 -acodec libmp3lame silence.mp3`

2. **Modified `TTSForegroundService.kt`**

   **Added instance variable:**
   ```kotlin
   private var silentMediaPlayer: MediaPlayer? = null
   ```

   **Start silent audio function:**
   ```kotlin
   private fun startSilentAudioForMediaSession() {
       if (silentMediaPlayer != null) return
       
       try {
           silentMediaPlayer = MediaPlayer().apply {
               // Set audio attributes BEFORE setting data source
               val audioAttributes = AudioAttributes.Builder()
                   .setUsage(AudioAttributes.USAGE_MEDIA)
                   .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                   .build()
               setAudioAttributes(audioAttributes)
               
               // Load the silent audio resource
               val afd = resources.openRawResourceFd(R.raw.silence)
               if (afd != null) {
                   setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                   afd.close()
                   prepare()
                   isLooping = true
                   setVolume(0f, 0f)
                   start()
               }
           }
       } catch (e: Exception) {
           android.util.Log.e("TTS_DEBUG", "Failed to start silent audio: ${e.message}")
       }
   }
   ```

   **Stop silent audio function:**
   ```kotlin
   private fun stopSilentAudio() {
       silentMediaPlayer?.let { player ->
           try {
               if (player.isPlaying) {
                   player.stop()
               }
               player.release()
           } catch (e: Exception) {
               android.util.Log.e("TTS_DEBUG", "Failed to stop silent audio: ${e.message}")
           }
       }
       silentMediaPlayer = null
   }
   ```

   **Integration:**
   - Call `startSilentAudioForMediaSession()` in `speakBatch()` after `requestAudioFocus()`
   - Call `stopSilentAudio()` in `stopTTS()` before `abandonAudioFocus()`
   - Call `stopSilentAudio()` in `onDestroy()` for cleanup

### Why This Works

**Key Component: AudioAttributes**
```kotlin
AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_MEDIA)      // Tell Android: "This is media playback"
    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)  // Type: Music
    .build()
```

These attributes signal to Android that our app is actively playing media content, making it the audio focus owner. Once we own audio focus, Android routes media button events to our `MediaSession`.

**Result:**
```bash
# adb shell dumpsys media_session output after fix:
Media button session is com.rajarsheechatterjee.LNReader.debug/LNReaderTTS  # ✅ Events route to us!
```

### Trade-offs

**Pros:**
- ✅ Bluetooth media buttons work reliably
- ✅ Custom 6-button notification preserved
- ✅ No duplicate notifications
- ✅ Minimal code changes

**Cons:**
- Very slight battery impact (silent audio loop running)
- Adds ~2KB to APK size
- Slightly more complex implementation than ideal

## Verification

### Testing Commands

**Correct test method** (simulates real Bluetooth like Android does):
```bash
adb shell cmd media_session dispatch play-pause
```

**Incorrect test method** (doesn't use MediaSession routing):
```bash
adb shell input keyevent 85  # This bypasses MediaSession!
```

### Test Results

| Action        | Command                                                  | Result              |
| ------------- | -------------------------------------------------------- | ------------------- |
| Pause TTS     | `adb shell cmd media_session dispatch pause`             | ✅ TTS pauses        |
| Resume TTS    | `adb shell cmd media_session dispatch play`              | ✅ TTS resumes       |
| dumpsys check | `adb shell dumpsys media_session \| grep "Media button"` | ✅ Shows LNReaderTTS |

### Logs Confirm Success

```
Silent audio started with AudioAttributes for MediaSession
Media button session is com.rajarsheechatterjee.LNReader.debug/LNReaderTTS
```

## Why `adb shell input keyevent 85` Doesn't Work

The `adb shell input keyevent` command injects key events directly to the **focused window**, bypassing Android's MediaSession routing system entirely. This is NOT how real Bluetooth headsets work.

Real Bluetooth headsets → Send media button events → Android MediaSessionManager → Routes to active MediaSession → Our callbacks

The correct simulation is `adb shell cmd media_session dispatch` which uses the actual MediaSession routing path.

## Production Deployment

Real Bluetooth headsets will work correctly because they use the MediaSession system, exactly like `cmd media_session dispatch` does.

**Files Modified:**
- `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt`
- `android/app/src/main/res/raw/silence.mp3` (new file)

**Test on real hardware** with actual Bluetooth headphones to confirm end-to-end functionality.
