# TASKS: Enhanced TTS Media Control

> **Last Updated**: December 13, 2025

---

## Phase 1: MediaStyle Notification ✅ COMPLETE

### Dependencies
- [x] Add `androidx.media:media:1.7.0` to `android/app/build.gradle`
- [x] Verify Gradle sync succeeds

### TTSForegroundService.kt Changes
- [x] Add import: `import androidx.media.app.NotificationCompat.MediaStyle`
- [x] Apply `MediaStyle()` to notification builder
- [x] Configure `setShowActionsInCompactView(0, 1, 2, 3, 4)`
- [x] Set up 6 action buttons with standard Android icons:
  - [x] `ic_media_previous` - Previous Chapter
  - [x] `ic_media_rew` - Rewind 5
  - [x] `ic_media_pause/play` - Play/Pause toggle
  - [x] `ic_media_ff` - Forward 5
  - [x] `ic_media_next` - Next Chapter
  - [x] `ic_delete` - Stop

### Verification
- [x] Build succeeds: `pnpm run build:release:android`
- [x] All 5 media buttons visible with icons
- [x] Buttons functional (verified by user)

---

## Phase 2: MediaSessionCompat Integration 🔄 IN PROGRESS

### Goal
Add visual seek bar showing chapter progress percentage.

### Pre-Requisites
- [x] Phase 1 committed as checkpoint (safe rollback point)
- [x] PRD and TASKS documentation updated

### Implementation Tasks

#### 2.1: Add Imports
- [ ] Add to `TTSForegroundService.kt`:
  ```kotlin
  import android.support.v4.media.session.MediaSessionCompat
  import android.support.v4.media.session.PlaybackStateCompat
  import android.support.v4.media.MediaMetadataCompat
  ```

#### 2.2: Initialize MediaSession
- [ ] Add private variable: `private var mediaSession: MediaSessionCompat? = null`
- [ ] Initialize in `onCreate()`:
  ```kotlin
  mediaSession = MediaSessionCompat(this, "TTSForegroundService").apply {
      setCallback(MediaSessionCallback())
      isActive = true
  }
  ```

#### 2.3: Implement MediaSessionCallback
- [ ] Create inner class `MediaSessionCallback` extending `MediaSessionCompat.Callback()`
- [ ] Override methods:
  - [ ] `onPlay()` → call `ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)`
  - [ ] `onPause()` → call `ttsListener?.onMediaAction(ACTION_MEDIA_PLAY_PAUSE)`
  - [ ] `onSkipToNext()` → call `ttsListener?.onMediaAction(ACTION_MEDIA_NEXT_CHAPTER)`
  - [ ] `onSkipToPrevious()` → call `ttsListener?.onMediaAction(ACTION_MEDIA_PREV_CHAPTER)`
  - [ ] `onFastForward()` → call `ttsListener?.onMediaAction(ACTION_MEDIA_SEEK_FORWARD)`
  - [ ] `onRewind()` → call `ttsListener?.onMediaAction(ACTION_MEDIA_SEEK_BACK)`
  - [ ] `onStop()` → call `stopTTS()`

#### 2.4: Implement updatePlaybackState()
- [ ] Create/uncomment `updatePlaybackState()` function:
  ```kotlin
  private fun updatePlaybackState() {
      mediaSession?.let { session ->
          val state = if (mediaIsPlaying) 
              PlaybackStateCompat.STATE_PLAYING 
          else 
              PlaybackStateCompat.STATE_PAUSED
          
          val position = (mediaParagraphIndex * 1000).toLong()
          val duration = (mediaTotalParagraphs * 1000).toLong()
          
          val playbackState = PlaybackStateCompat.Builder()
              .setState(state, position, 1.0f)
              .setActions(
                  PlaybackStateCompat.ACTION_PLAY or
                  PlaybackStateCompat.ACTION_PAUSE or
                  PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                  PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
                  PlaybackStateCompat.ACTION_FAST_FORWARD or
                  PlaybackStateCompat.ACTION_REWIND or
                  PlaybackStateCompat.ACTION_STOP
              )
              .build()
          
          session.setPlaybackState(playbackState)
          
          // Set metadata
          val metadata = MediaMetadataCompat.Builder()
              .putString(MediaMetadataCompat.METADATA_KEY_TITLE, mediaNovelName)
              .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, mediaChapterLabel)
              .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "LNReader TTS")
              .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration)
              .build()
          
          session.setMetadata(metadata)
      }
  }
  ```

#### 2.5: Connect MediaStyle to Session
- [ ] Update `createNotification()` to include session token:
  ```kotlin
  .setStyle(MediaStyle()
      .setMediaSession(mediaSession?.sessionToken)
      .setShowActionsInCompactView(0, 1, 2, 3, 4))
  ```

#### 2.6: Call updatePlaybackState()
- [ ] Uncomment/add calls in:
  - [ ] `updateMediaState()` - called when RN updates state
  - [ ] `stopAudioKeepService()` - called on pause

#### 2.7: Cleanup in onDestroy()
- [ ] Uncomment MediaSession cleanup:
  ```kotlin
  mediaSession?.release()
  mediaSession = null
  ```

### Build & Verification
- [ ] Run: `pnpm run build:release:android`
- [ ] Verify: No compilation errors
- [ ] Install APK and test:
  - [ ] Seek bar visible in notification
  - [ ] Seek bar shows progress (read-only)
  - [ ] All 5 buttons still work
  - [ ] Lock screen controls functional

### Rollback (If Build Fails)
If MediaSessionCompat compilation fails:
1. Revert `TTSForegroundService.kt` to Phase 1 state
2. Keep `androidx.media:media:1.7.0` (needed for MediaStyle)
3. Document specific error in PRD
4. Phase 1 functionality preserved

---

## Phase 3: QA & Polish (After Phase 2)

### Testing Checklist
- [ ] TTS starts correctly
- [ ] Notification shows with all controls
- [ ] Seek bar displays chapter progress
- [ ] Play/Pause works from notification
- [ ] Prev/Next chapter works from notification
- [ ] ±5 paragraph buttons work
- [ ] Background playback continues
- [ ] Chapter auto-advance works
- [ ] Lock screen controls functional
- [ ] Stop button removes notification

### Documentation
- [ ] Update PRD with final state
- [ ] Update TASKS marking all complete
- [ ] Git commit with summary

---

## Quick Reference

### Build Commands
```bash
# Full clean build
pnpm run clean:full && pnpm run build:release:android

# Quick rebuild (no clean)
cd android && ./gradlew assembleRelease

# Type check & lint
pnpm run type-check && pnpm run lint
```

### APK Location
```
android/app/build/outputs/apk/release/app-release.apk
```

### Key Files
```
android/app/build.gradle                         # Dependencies
android/app/src/main/.../TTSForegroundService.kt # Notification code
specs/Enhanced-media-control/PRD.md              # Specification
specs/Enhanced-media-control/TASKS.md            # This file
```
