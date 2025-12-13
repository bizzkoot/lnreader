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

## Phase 3: TTS Progress Sync with Reader ✅ COMPLETE

### Goal
Ensure TTS progress is properly synced with reader position in ALL scenarios.

### Scenarios Verified

#### Scenario 1: Pause via Notification ✅
- [x] User pauses TTS
- [x] User enters reader mode
- [x] Reader scrolls to last TTS paragraph

#### Scenario 2: Stop/Close Notification ✅
- [x] User closes TTS notification
- [x] User enters reader mode
- [x] Reader scrolls to last TTS paragraph

#### Scenario 3: Resume After Background ✅
- [x] App in background, TTS playing
- [x] User opens app
- [x] Reader shows current TTS paragraph

### Implementation Completed

#### 3.1: Research Current State ✅
- [x] TTS position saved via SharedPreferences (native side)
- [x] Reader reads from MMKV (different storage backend - BUG!)
- [x] Native bridge solution needed to expose SharedPreferences

#### 3.2: Problem Identified ✅
- [x] Critical Bug: Native writes to SharedPreferences, RN reads MMKV
- [x] Solution: Add native bridge method to expose SharedPreferences

#### 3.3: Fixes Implemented ✅
| File | Change |
|------|--------|
| `TTSForegroundService.kt` | Added SharedPreferences, `saveTTSPosition()`, `getChapterId()`, `getParagraphIndex()` |
| `TTSHighlightModule.kt` | Added `getSavedTTSPosition()` bridge method, removed duplicate save logic |
| `TTSHighlight.ts` | Added `getSavedTTSPosition()` TypeScript wrapper |
| `WebViewReader.tsx` | Added `nativeTTSPosition` state, async fetch effect, 3-way max resolution |
| `TTSMediaControl.test.ts` | Added 5 new tests for TTS position sync |

#### 3.4: Verification ✅
- [x] `pnpm run type-check` - Passed
- [x] `pnpm run lint` - 0 errors (18 pre-existing warnings)
- [x] `pnpm run test` - All 204 tests passed
- [x] `pnpm run build:release:android` - BUILD SUCCESSFUL
- [x] No regression in existing TTS functionality
- [x] No regression in existing reader functionality

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
android/app/src/main/.../TTSForegroundService.kt # Notification code + position saves
android/app/src/main/.../TTSHighlightModule.kt   # Native bridge methods
src/screens/reader/components/WebViewReader.tsx  # Reader + TTS state
src/services/tts/TTSHighlight.ts                 # TypeScript TTS service
src/__tests__/TTSMediaControl.test.ts            # TTS position sync tests
specs/Enhanced-media-control/PRD.md              # Specification
specs/Enhanced-media-control/TASKS.md            # This file
```

### Git Checkpoints
```
bf843020 - Phase 1 complete (5 buttons working)
[pending]  - Phase 3 complete (TTS Progress Sync)
```
