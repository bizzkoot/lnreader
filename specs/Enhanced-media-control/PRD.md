# PRD: Enhanced TTS Media Control (Android Notification)

> **Last Updated**: December 13, 2025  
> **Status**: Phase 2 In Progress (MediaStyle ✅, MediaSessionCompat 🔄)

---

## Summary

Enhance LNReader's Android TTS notification to provide:
- **5 media control buttons** with proper icons (Previous, -5, Play/Pause, +5, Next)
- **Visual seek bar** showing chapter progress
- **Rich metadata** (Novel name, Chapter title, Progress text)
- **Lock screen integration** via MediaSessionCompat

---

## Current State (December 13, 2025)

### ✅ What's Working

| Feature | Status | Details |
|---------|--------|---------|
| MediaStyle notification | ✅ Working | `androidx.media:media:1.7.0` dependency resolved |
| 5 action buttons | ✅ Working | All visible with proper icons |
| Icon-based buttons | ✅ Working | Using `ic_media_previous`, `ic_media_rew`, etc. |
| Novel name display | ✅ Working | Shown in notification title |
| Chapter title display | ✅ Working | Shown in notification content |
| Progress text | ✅ Working | SubText shows "28% • Paragraph 42 of 150" |
| All button functionality | ✅ Working | Prev/Next chapter, ±5 paragraphs, Play/Pause |

### ❓ Pending Implementation

| Feature | Status | Details |
|---------|--------|---------|
| Visual seek bar | 🔄 Pending | Requires MediaSessionCompat integration |
| Lock screen controls | 🔄 Pending | Requires MediaSessionCompat integration |

---

## Technical Architecture

### Files Involved

```
android/app/build.gradle                    # Dependencies
android/app/src/main/java/.../TTSForegroundService.kt  # Notification + MediaSession
android/app/src/main/java/.../TTSHighlightModule.kt    # RN bridge
src/screens/reader/components/WebViewReader.tsx        # RN state management
```

### Dependencies

```gradle
// Currently enabled
implementation 'androidx.media:media:1.7.0'  // MediaStyle + MediaSessionCompat

// Core
implementation 'androidx.core:core-ktx:1.15.0'
implementation 'androidx.legacy:legacy-support-v4:1.0.0'
```

### Data Flow

```
WebViewReader.tsx (RN)
    │
    ├─► updateMediaState() ─────────► TTSHighlightModule.kt
    │                                      │
    │                                      ▼
    │                               TTSForegroundService.kt
    │                                      │
    │   ┌──────────────────────────────────┘
    │   │
    │   ├─► updateNotification() ─────► Android Notification
    │   │                                    │
    │   │                                    ├─► MediaStyle (5 icon buttons)
    │   │                                    └─► MediaSessionCompat (seek bar) [TODO]
    │   │
    │   └─► onMediaAction() ──────────► RN event listener
    │                                      │
    ◄──────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Basic Enhanced Notification ✅ COMPLETE

**Goal**: Show all 5 buttons with icons

**Completed**:
- [x] Add `androidx.media:media:1.7.0` dependency
- [x] Import `androidx.media.app.NotificationCompat.MediaStyle`
- [x] Apply MediaStyle to notification builder
- [x] Configure `setShowActionsInCompactView(0, 1, 2, 3, 4)`
- [x] All 6 actions with standard Android icons
- [x] Build successful

### Phase 2: MediaSessionCompat Integration 🔄 IN PROGRESS

**Goal**: Add visual seek bar showing chapter progress

**Required Changes**:

1. **Add imports** in `TTSForegroundService.kt`:
   ```kotlin
   import android.support.v4.media.session.MediaSessionCompat
   import android.support.v4.media.session.PlaybackStateCompat
   import android.support.v4.media.MediaMetadataCompat
   ```

2. **Initialize MediaSession** in `onCreate()`:
   ```kotlin
   private var mediaSession: MediaSessionCompat? = null
   
   // In onCreate():
   mediaSession = MediaSessionCompat(this, "TTSForegroundService").apply {
       setCallback(MediaSessionCallback())
       isActive = true
   }
   ```

3. **Update PlaybackState** for seek bar:
   ```kotlin
   private fun updatePlaybackState() {
       val state = if (mediaIsPlaying) 
           PlaybackStateCompat.STATE_PLAYING 
       else 
           PlaybackStateCompat.STATE_PAUSED
       
       // Map paragraph progress to milliseconds (paragraph * 1000)
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
               PlaybackStateCompat.ACTION_REWIND
           )
           .build()
       
       mediaSession?.setPlaybackState(playbackState)
   }
   ```

4. **Set MediaMetadata** for title display:
   ```kotlin
   val metadata = MediaMetadataCompat.Builder()
       .putString(MediaMetadataCompat.METADATA_KEY_TITLE, mediaNovelName)
       .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, mediaChapterLabel)
       .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, "LNReader TTS")
       .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration)
       .build()
   
   mediaSession?.setMetadata(metadata)
   ```

5. **Connect MediaStyle to session**:
   ```kotlin
   .setStyle(MediaStyle()
       .setMediaSession(mediaSession?.sessionToken)
       .setShowActionsInCompactView(0, 1, 2, 3, 4))
   ```

---

## Seek Bar Behavior

### How It Works

The seek bar displays **chapter progress** mapped to a time-like format:
- Each paragraph = 1 second (1000ms)
- Position = `paragraphIndex * 1000`
- Duration = `totalParagraphs * 1000`

### User Interaction

| Action | Result |
|--------|--------|
| View seek bar | Shows visual progress through chapter |
| Drag seek bar | **No effect** (read-only) - TTS is paragraph-based |

**Why read-only?**: TTS content is paragraph-based, not time-based. Users cannot meaningfully "scrub" to an arbitrary millisecond. The seek bar is purely for visual feedback.

---

## Button Configuration

| Index | Icon | Label | Action |
|-------|------|-------|--------|
| 0 | `ic_media_previous` | Previous Chapter | Jump to previous chapter, paragraph 0 |
| 1 | `ic_media_rew` | Rewind 5 | Go back 5 paragraphs (clamp at 0) |
| 2 | `ic_media_pause/play` | Pause/Play | Toggle playback state |
| 3 | `ic_media_ff` | Forward 5 | Go forward 5 paragraphs (clamp at max) |
| 4 | `ic_media_next` | Next Chapter | Jump to next chapter, paragraph 0 |
| 5 | `ic_delete` | Stop | Stop TTS and remove notification |

---

## Historical Context

### Previous Blocker (RESOLVED)

On December 12, 2025, we encountered compilation errors when trying to use `MediaSessionCompat`. The error was:
```
Unresolved reference: MediaSessionCompat
Unresolved reference: PlaybackStateCompat
```

**Resolution (December 13, 2025)**:
- The `androidx.media:media:1.7.0` dependency now compiles successfully
- `MediaStyle` import works: `import androidx.media.app.NotificationCompat.MediaStyle`
- This suggests the full MediaSession classes should also be available

### What Changed

The previous investigation may have had:
1. Incorrect import paths
2. Gradle cache issues
3. Partial builds that left stale artifacts

After a clean build with proper imports, the dependency resolves correctly.

---

## Success Criteria

### Phase 1 ✅
- [x] All 5 buttons visible with icons
- [x] Buttons functional (tested by user)
- [x] Build succeeds

### Phase 2 (Target)
- [ ] Seek bar visible in notification
- [ ] Seek bar shows chapter progress
- [ ] Lock screen media controls work
- [ ] Build succeeds
- [ ] No regressions in TTS functionality

---

## Rollback Plan

If Phase 2 (MediaSessionCompat) fails:

1. Revert to Phase 1 state:
   - Remove MediaSessionCompat code
   - Keep MediaStyle for icon buttons
   - Progress shown as text only

2. Current Phase 1 commit provides safe checkpoint

---

## References

- [Android MediaStyle Docs](https://developer.android.com/reference/androidx/media/app/NotificationCompat.MediaStyle)
- [MediaSessionCompat Docs](https://developer.android.com/reference/android/support/v4/media/session/MediaSessionCompat)
- [Media Controls Guide](https://developer.android.com/media/implement/surfaces/mobile)
