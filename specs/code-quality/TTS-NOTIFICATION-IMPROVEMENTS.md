# PRD: TTS Notification Code Quality Improvements

> **Created**: December 13, 2025  
> **Status**: 📋 PLANNED  
> **Priority**: Medium  
> **Effort**: ~30 minutes

---

## Overview

Code quality improvements identified during review of TTS Media Notification implementation. These changes improve maintainability, reduce duplication, and fix misleading elements without changing functionality.

---

## Issues Summary

| ID | Issue | Priority | Effort | Status |
|----|-------|----------|--------|--------|
| CQ-1 | Compact view shows suboptimal button selection | Medium | 1 min | ⏳ Pending |
| CQ-2 | Duplicate voice fallback logic (~60 lines × 2) | Medium | 15 min | ⏳ Pending |
| CQ-3 | Magic numbers for PendingIntent request codes | Low | 5 min | ⏳ Pending |
| CQ-4 | Misleading comment says MMKV, uses SharedPreferences | Low | 1 min | ⏳ Pending |
| CQ-5 | Magic string "save_position" for internal signal | Low | 3 min | ⏳ Pending |

---

## CQ-1: Compact View Button Selection

### Problem

```kotlin
.setShowActionsInCompactView(0, 1, 2, 3, 4)
```

Android only shows **first 3 indices** in compact view. Currently shows:
- `[⏮]` Previous Chapter (index 0)
- `[⏪]` Rewind 5 (index 1)
- `[⏸]` Play/Pause (index 2)

### Solution

Show most frequently used buttons:
```kotlin
.setShowActionsInCompactView(1, 2, 3)  // [⏪] [⏸/▶] [⏩]
```

This shows:
- `[⏪]` Rewind 5 (index 1)
- `[⏸]` Play/Pause (index 2)
- `[⏩]` Forward 5 (index 3)

### Rationale

Chapter navigation (Prev/Next) is less common than paragraph navigation (±5).

---

## CQ-2: Duplicate Voice Fallback Logic

### Problem

Voice selection logic is duplicated in both `speak()` and `speakBatch()`:

```kotlin
// In speak() - ~60 lines
if (voiceId != null) {
    var voiceFound = false
    try {
        for (voice in ttsInstance.voices) { ... }
        if (!voiceFound) {
            // Retry logic
            // Fallback to best quality voice
            // Notify listener
        }
    } catch (e: Exception) { ... }
}

// In speakBatch() - ~60 lines (copy-pasted)
if (voiceId != null) {
    // Same logic repeated
}
```

### Solution

Extract to private helper method:

```kotlin
/**
 * Sets the TTS voice with intelligent fallback.
 * 1. Try to find exact voice by ID
 * 2. If not found, refresh voice list and retry
 * 3. If still not found, select best quality voice for same language
 * 4. Notifies listener if fallback occurs
 *
 * @param ttsInstance The TextToSpeech instance
 * @param voiceId The preferred voice identifier
 * @return true if a voice was set (exact or fallback), false otherwise
 */
private fun setVoiceWithFallback(ttsInstance: TextToSpeech, voiceId: String?): Boolean {
    if (voiceId == null) return true
    
    var voiceFound = false
    try {
        // Step 1: Try to find exact voice
        for (voice in ttsInstance.voices) {
            if (voice.name == voiceId) {
                ttsInstance.voice = voice
                return true
            }
        }
        
        android.util.Log.w("TTSForegroundService", "Preferred voice '$voiceId' not found, attempting fallback")
        
        // Step 2: Refresh voices and retry
        val refreshedVoices = ttsInstance.voices
        for (voice in refreshedVoices) {
            if (voice.name == voiceId) {
                ttsInstance.voice = voice
                android.util.Log.i("TTSForegroundService", "Voice found on retry")
                return true
            }
        }
        
        // Step 3: Select best quality voice for same language
        val currentLocale = ttsInstance.voice?.locale ?: Locale.getDefault()
        var bestVoice: Voice? = null
        var bestQuality = -1
        
        for (voice in refreshedVoices) {
            if (voice.locale.language == currentLocale.language && voice.quality > bestQuality) {
                bestVoice = voice
                bestQuality = voice.quality
            }
        }
        
        if (bestVoice != null) {
            ttsInstance.voice = bestVoice
            android.util.Log.w("TTSForegroundService", "Using fallback voice: ${bestVoice.name} (quality: $bestQuality)")
            ttsListener?.onVoiceFallback(voiceId, bestVoice.name)
            return true
        }
        
    } catch (e: Exception) {
        android.util.Log.e("TTSForegroundService", "Voice setting error: ${e.message}")
    }
    
    return false
}
```

### Usage

```kotlin
fun speak(...) {
    tts?.let { ttsInstance ->
        ttsInstance.setSpeechRate(rate)
        ttsInstance.setPitch(pitch)
        setVoiceWithFallback(ttsInstance, voiceId)  // Simplified call
        // ... rest of speak logic
    }
}

fun speakBatch(...) {
    tts?.let { ttsInstance ->
        ttsInstance.setSpeechRate(rate)
        ttsInstance.setPitch(pitch)
        setVoiceWithFallback(ttsInstance, voiceId)  // Same simplified call
        // ... rest of batch logic
    }
}
```

### Benefits

- Single source of truth for voice selection
- Easier to maintain and test
- Reduces code by ~50 lines

---

## CQ-3: Magic Numbers for Request Codes

### Problem

```kotlin
val prevChapterPI = actionPendingIntent(ACTION_MEDIA_PREV_CHAPTER, 101)
val seekBackPI = actionPendingIntent(ACTION_MEDIA_SEEK_BACK, 102)
val playPausePI = actionPendingIntent(ACTION_MEDIA_PLAY_PAUSE, 103)
val seekForwardPI = actionPendingIntent(ACTION_MEDIA_SEEK_FORWARD, 104)
val nextChapterPI = actionPendingIntent(ACTION_MEDIA_NEXT_CHAPTER, 105)
val stopPI = PendingIntent.getService(this, 106, stopIntent, ...)
```

### Solution

Add constants to companion object:

```kotlin
companion object {
    const val CHANNEL_ID = "tts_service_channel"
    const val NOTIFICATION_ID = 1001
    
    // Action strings
    const val ACTION_STOP_TTS = "com.rajarsheechatterjee.LNReader.STOP_TTS"
    const val ACTION_MEDIA_PREV_CHAPTER = "com.rajarsheechatterjee.LNReader.TTS.PREV_CHAPTER"
    const val ACTION_MEDIA_SEEK_BACK = "com.rajarsheechatterjee.LNReader.TTS.SEEK_BACK"
    const val ACTION_MEDIA_PLAY_PAUSE = "com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE"
    const val ACTION_MEDIA_SEEK_FORWARD = "com.rajarsheechatterjee.LNReader.TTS.SEEK_FORWARD"
    const val ACTION_MEDIA_NEXT_CHAPTER = "com.rajarsheechatterjee.LNReader.TTS.NEXT_CHAPTER"
    
    // PendingIntent request codes (must be unique per action)
    const val REQUEST_PREV_CHAPTER = 101
    const val REQUEST_SEEK_BACK = 102
    const val REQUEST_PLAY_PAUSE = 103
    const val REQUEST_SEEK_FORWARD = 104
    const val REQUEST_NEXT_CHAPTER = 105
    const val REQUEST_STOP = 106
}
```

### Usage

```kotlin
val prevChapterPI = actionPendingIntent(ACTION_MEDIA_PREV_CHAPTER, REQUEST_PREV_CHAPTER)
val seekBackPI = actionPendingIntent(ACTION_MEDIA_SEEK_BACK, REQUEST_SEEK_BACK)
// etc.
```

---

## CQ-4: Misleading Comment

### Problem

```kotlin
// Save TTS position to MMKV for reader sync  ← WRONG
private fun saveTTSPosition() {
    if (mediaChapterId != null && mediaParagraphIndex >= 0) {
        val key = "chapter_progress_$mediaChapterId"
        sharedPrefs.edit().putInt(key, mediaParagraphIndex).apply()  // Uses SharedPreferences!
    }
}
```

### Solution

```kotlin
// Save TTS position to SharedPreferences for reader sync
private fun saveTTSPosition() {
    // ...
}
```

---

## CQ-5: Magic String for Internal Signal

### Problem

Using `"save_position"` as utterance ID to signal internal save operation:

```kotlin
// TTSForegroundService.kt
ttsListener?.let { listener ->
    listener.onSpeechDone("save_position")  // Magic string
}

// TTSHighlightModule.kt
override fun onSpeechDone(utteranceId: String) {
    if (utteranceId == "save_position") {  // Magic string check
        return
    }
    // ...
}
```

### Risk

Could theoretically conflict if user text ever contains "save_position".

### Solution

Use a constant with unlikely value:

**TTSForegroundService.kt:**
```kotlin
companion object {
    // ...existing constants...
    
    // Internal signal for TTS position save (not a real utterance ID)
    const val INTERNAL_SAVE_POSITION_SIGNAL = "__INTERNAL_TTS_SAVE_POSITION__"
}

// Usage:
ttsListener?.onSpeechDone(INTERNAL_SAVE_POSITION_SIGNAL)
```

**TTSHighlightModule.kt:**
```kotlin
override fun onSpeechDone(utteranceId: String) {
    // Skip internal save_position signals from TTSForegroundService
    // Position saving is now centralized in the Service
    if (utteranceId == TTSForegroundService.INTERNAL_SAVE_POSITION_SIGNAL) {
        return
    }
    // ...
}
```

---

## Implementation Checklist

- [ ] CQ-1: Change `setShowActionsInCompactView(1, 2, 3)`
- [ ] CQ-2: Extract `setVoiceWithFallback()` helper method
- [ ] CQ-3: Add request code constants
- [ ] CQ-4: Fix misleading comment
- [ ] CQ-5: Replace magic string with constant

---

## Verification

After implementation:
1. `pnpm run type-check` - TypeScript must pass
2. `pnpm run lint` - Lint must have 0 new errors
3. `pnpm run test` - All tests must pass
4. `pnpm run build:release:android` - Build must succeed
5. **Manual test**: TTS notification buttons work correctly
6. **Manual test**: Compact view shows correct 3 buttons
7. **Manual test**: Voice fallback still works

---

## Files to Modify

| File | Changes |
|------|---------|
| `TTSForegroundService.kt` | All changes (CQ-1 through CQ-5) |
| `TTSHighlightModule.kt` | CQ-5 (import constant) |

---

## Notes

- These are **code quality** improvements only
- No functional changes expected
- All changes are backward compatible
- Focus on maintainability and clarity
