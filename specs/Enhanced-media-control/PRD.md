# PRD: Enhanced TTS Media Control (Android Notification)

> **Last Updated**: December 13, 2025  
> **Status**: ✅ COMPLETE (Phase 1: 5-button MediaStyle + Phase 2: TTS Progress Sync)

---

## Summary

Enhanced LNReader's Android TTS notification to provide:
- **5 media control buttons** with proper icons (Previous, -5, Play/Pause, +5, Next)
- **Rich metadata** (Novel name, Chapter title, Progress text)
- **Lock screen visibility** via NotificationCompat.VISIBILITY_PUBLIC
- **TTS Progress Sync** between native TTS and reader (NEW - Phase 2)

**Note**: Visual seek bar feature was attempted but caused regressions. Decision made to keep 5 buttons.

---

## Current State (December 13, 2025)

### ✅ What's Working (Final State)

| Feature | Status | Details |
|---------|--------|---------|
| MediaStyle notification | ✅ Working | `androidx.media:media:1.7.0` dependency |
| 5 action buttons | ✅ Working | All visible with proper icons |
| Icon-based buttons | ✅ Working | Using `ic_media_previous`, `ic_media_rew`, etc. |
| Novel name display | ✅ Working | Shown in notification title |
| Chapter title display | ✅ Working | Shown in notification content |
| Progress text | ✅ Working | SubText shows "28% • Paragraph 42 of 150" |
| Lock screen visibility | ✅ Working | VISIBILITY_PUBLIC set |
| All button functionality | ✅ Working | Prev/Next chapter, ±5 paragraphs, Play/Pause |
| **TTS Progress Sync** | ✅ Working | Native saves position, Reader loads from native as fallback |

### ❌ Not Implemented (By Design Decision)

| Feature | Status | Reason |
|---------|--------|--------|
| Visual seek bar | ❌ Not implemented | MediaSession causes regression (3 buttons, missing text) |

---

## MediaSession Investigation Results

### Why MediaSession Was Disabled

We implemented MediaSessionCompat for seek bar. Results:

| With MediaSession | Without MediaSession |
|-------------------|---------------------|
| ❌ Only 3 buttons (Android limitation) | ✅ 5 buttons |
| ❌ Missing progress text | ✅ Progress text visible |
| ❌ Missing chapter label | ✅ Chapter label visible |
| ❌ Lock screen issues | ✅ Lock screen works |
| ✅ Seek bar visible | ❌ No seek bar |

**User Decision**: Keep 5 buttons. Seek bar is read-only anyway (TTS is paragraph-based).

### MediaSession Code Status

The MediaSession code is preserved in `TTSForegroundService.kt` as comments for potential future use.

---

## Technical Implementation

### Files Modified

```
android/app/build.gradle                           # Added androidx.media:media:1.7.0
android/app/src/main/.../TTSForegroundService.kt   # MediaStyle notification + TTS position save
android/app/src/main/.../TTSHighlightModule.kt     # getSavedTTSPosition() bridge method
src/services/TTSHighlight.ts                       # getSavedTTSPosition() TypeScript wrapper
src/screens/reader/components/WebViewReader.tsx    # Native TTS position fallback
```

### Notification Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [App Icon] Novel Name                                        │
│            Chapter xx: Title                                 │
│            28% • Paragraph 42 of 150                        │
│                                                              │
│  [⏮] [⏪] [⏸/▶] [⏩] [⏭]  [🗑]                                │
│  Prev  -5  Play   +5  Next  Stop                            │
└──────────────────────────────────────────────────────────────┘
```

### Button Configuration

| Index | Icon | Label | Action |
|-------|------|-------|--------|
| 0 | `ic_media_previous` | Previous Chapter | Jump to previous chapter |
| 1 | `ic_media_rew` | Rewind 5 | Go back 5 paragraphs |
| 2 | `ic_media_pause/play` | Pause/Play | Toggle playback |
| 3 | `ic_media_ff` | Forward 5 | Go forward 5 paragraphs |
| 4 | `ic_media_next` | Next Chapter | Jump to next chapter |
| 5 | `ic_delete` | Stop | Stop TTS and dismiss notification |

---

## Phase 2: TTS Progress Sync ✅ COMPLETE

### Problem Statement

Native TTS was saving progress to Android SharedPreferences, but the React Native reader was reading from MMKV storage. These are completely different storage backends, so the reader would never see the TTS-saved position.

### Solution Implemented (Option A with modifications)

1. **Native Bridge Method**: Added `getSavedTTSPosition(chapterId)` to TTSHighlightModule.kt
2. **TypeScript Wrapper**: Exposed method in TTSHighlight.ts
3. **Reader Integration**: WebViewReader.tsx fetches native position as fallback
4. **Centralized Saves**: TTSForegroundService saves position on pause/stop/destroy
5. **Renamed SharedPreferences**: `mmkv.tts_position` → `tts_progress`

### Data Flow

```
TTS Playback
    │
    ├─► onParagraphStart() ──► Native tracks mediaParagraphIndex
    │
    ├─► onPause() ──► saveTTSPosition() ──► SharedPreferences("tts_progress")
    │
    └─► onStop/Destroy() ──► saveTTSPosition() ──► SharedPreferences("tts_progress")
                                    │
                                    ▼
                           Reader Entry
                                    │
                                    └─► initialSavedParagraphIndex = max(DB, MMKV, Native)
```

### Position Resolution Logic

```typescript
const initialSavedParagraphIndex = Math.max(
  savedParagraphIndex ?? -1,               // Database
  MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1,  // MMKV
  nativeTTSPosition                        // Native SharedPreferences (async)
);
```

---

## Success Criteria

### ✅ Phase 1: MediaStyle Notification (COMPLETE)
- [x] 5 buttons visible with icons
- [x] Novel name, chapter, progress text displayed
- [x] Lock screen visible
- [x] All buttons functional

### ✅ Phase 2: TTS Progress Sync (COMPLETE)
- [x] TTS position persisted on pause/stop/destroy
- [x] Reader loads TTS position from native as fallback
- [x] Renamed SharedPreferences for clarity (`tts_progress`)
- [x] Centralized save logic in TTSForegroundService
- [x] Tests added for TTS position sync (5 new tests)
- [x] Build passes without errors

---

## References

- [Android MediaStyle Docs](https://developer.android.com/reference/androidx/media/app/NotificationCompat.MediaStyle)
- [Notification Best Practices](https://developer.android.com/develop/ui/views/notifications)
