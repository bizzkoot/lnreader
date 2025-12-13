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

## Phase 2: MediaSessionCompat Integration ❌ REVERTED

### Attempt Summary
- [x] Add imports (MediaSessionCompat, PlaybackStateCompat, MediaMetadataCompat)
- [x] Initialize MediaSession in onCreate()
- [x] Implement MediaSessionCallback inner class
- [x] Implement updatePlaybackState() function
- [x] Connect MediaStyle to session token
- [x] Add updatePlaybackState() calls
- [x] Add cleanup in onDestroy()
- [x] Build successful

### Testing Result: ⚠️ REGRESSION
| Issue | Description |
|-------|-------------|
| #1 | Only 3 buttons instead of 5 (Android MediaSession limitation) |
| #2 | Missing "Paragraph xx of xx" text |
| #3 | Missing chapter label "Chapter xx: xxx" |
| #4 | Lock screen controls issues |

### Decision
**User chose**: Keep 5 buttons, no seek bar. MediaSession code reverted (commented out).

---

## Phase 3: TTS Progress Sync with Reader 🔜 NEW REQUIREMENT

### Goal
Ensure TTS progress is properly synced with reader position in ALL scenarios.

### Scenarios to Verify

#### Scenario 1: Pause via Notification
- [ ] User pauses TTS
- [ ] User enters reader mode
- [ ] Reader scrolls to last TTS paragraph

#### Scenario 2: Stop/Close Notification
- [ ] User closes TTS notification
- [ ] User enters reader mode
- [ ] Reader scrolls to last TTS paragraph

#### Scenario 3: Resume After Background
- [ ] App in background, TTS playing
- [ ] User opens app
- [ ] Reader shows current TTS paragraph

### Implementation Tasks

#### 3.1: Research Current State
- [ ] How is TTS position currently saved?
- [ ] What storage mechanism is used?
- [ ] When is position synced to reader?
- [ ] Find relevant code in WebViewReader.tsx

#### 3.2: Identify Gaps
- [ ] Test Scenario 1 (pause)
- [ ] Test Scenario 2 (stop/close)
- [ ] Test Scenario 3 (background)
- [ ] Document what works and what doesn't

#### 3.3: Implement Fixes (if needed)
- [ ] Add position save on paragraph change
- [ ] Add position save on pause
- [ ] Add position save on stop/close
- [ ] Ensure reader loads TTS position on entry

#### 3.4: Verification
- [ ] All 3 scenarios pass
- [ ] No regression in existing TTS functionality
- [ ] No regression in existing reader functionality

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
src/screens/reader/components/WebViewReader.tsx  # Reader + TTS state
specs/Enhanced-media-control/PRD.md              # Specification
specs/Enhanced-media-control/TASKS.md            # This file
```

### Git Checkpoints
```
bf843020 - Phase 1 complete (5 buttons working)
```
