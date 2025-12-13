# PRD: Enhanced TTS Media Control (Android Notification)

> **Last Updated**: December 13, 2025  
> **Status**: ✅ COMPLETE (5-button MediaStyle - MediaSession disabled due to regressions)

---

## Summary

Enhanced LNReader's Android TTS notification to provide:
- **5 media control buttons** with proper icons (Previous, -5, Play/Pause, +5, Next)
- **Rich metadata** (Novel name, Chapter title, Progress text)
- **Lock screen visibility** via NotificationCompat.VISIBILITY_PUBLIC

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
android/app/build.gradle                         # Added androidx.media:media:1.7.0
android/app/src/main/.../TTSForegroundService.kt # MediaStyle notification
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

## NEW REQUIREMENT: TTS Progress Sync with Reader

### Requirement (December 13, 2025)

**User Request**: Ensure TTS progress is properly synced with reader position in ALL scenarios.

### Scenarios to Handle

#### Scenario 1: Pause via Notification
```
User pauses TTS → User enters reader mode → Reader scrolls to last TTS paragraph
```

#### Scenario 2: Stop/Close Notification
```
User closes TTS notification → User enters reader mode → Reader scrolls to last TTS paragraph
```

#### Scenario 3: Resume After Background
```
App in background → TTS playing → User opens app → Reader shows current TTS paragraph
```

### Implementation Requirements

| Event | Action Required |
|-------|----------------|
| TTS paragraph change | Save `chapterId` + `paragraphIndex` to persistent storage |
| TTS pause | Confirm position is saved |
| TTS stop/close | Confirm position is saved |
| Reader entry | Load saved position and scroll to paragraph |

### Questions to Investigate

1. **Current State**: Does the reader currently save/restore TTS position?
2. **Storage Mechanism**: What storage is used? (MMKV, SQLite, etc.)
3. **Sync Timing**: How often is position saved during playback?
4. **Conflict Resolution**: What if reader has different position than TTS?

### Proposed Data Flow

```
TTS Playback
    │
    ├─► onParagraphStart() ──► Save to TTS position storage
    │
    ├─► onPause() ──► Confirm saved (sync to chapter progress)
    │
    └─► onStop/Close() ──► Sync TTS position to chapter read progress
                                    │
                                    ▼
                           Chapter Progress Storage
                                    │
                                    ▼
                           Reader Entry
                                    │
                                    └─► Load position ──► Scroll to paragraph
```

---

## Success Criteria

### ✅ Phase 1: MediaStyle Notification (COMPLETE)
- [x] 5 buttons visible with icons
- [x] Novel name, chapter, progress text displayed
- [x] Lock screen visible
- [x] All buttons functional

### 🔜 Phase 2: Progress Sync (NEW)
- [ ] TTS position persisted on every paragraph change
- [ ] Reader loads TTS position on entry
- [ ] Stop/Close properly saves final position
- [ ] Verified: Pause → Enter reader → Correct position
- [ ] Verified: Close → Enter reader → Correct position

---

## References

- [Android MediaStyle Docs](https://developer.android.com/reference/androidx/media/app/NotificationCompat.MediaStyle)
- [Notification Best Practices](https://developer.android.com/develop/ui/views/notifications)
