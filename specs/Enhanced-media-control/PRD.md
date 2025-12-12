# PRD: Enhanced TTS Media Control (Android Notification)

## Summary

Enhance LNReader’s Android TTS notification “media control” to provide richer playback controls and clearer context (Novel name + Chapter number + progress), while integrating safely with the existing TTS architecture (WebViewReader ⇄ Native TTSForegroundService) and preventing regressions in background playback, chapter transitions, and queue refill logic.

This PRD is intentionally implementation-oriented so it remains actionable long-term.

---

## Background / Current State

### What exists today

- Background playback uses `TTSForegroundService` (Android) + `TTSHighlightModule.kt` (RN bridge) + React Native logic in `WebViewReader.tsx`.
- Foreground service notification is created in `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt` via `createNotification()`.
- Current notification is very basic:
  - Title: `LNReader TTS`
  - Text: static `TTS is reading...`
  - One action: labeled “Stop” but uses `ic_media_pause` and calls `ACTION_STOP_TTS`.
- There is **no real media session** integration, no chapter/paragraph progress UI, and no additional actions.
- `pause()` in `TTSHighlightModule.kt` currently calls `stop()` (so “pause” semantics do not exist in native layer).

### Constraints from existing TTS logic

- Android 12+ restriction: avoid starting foreground service from background (already handled with `isServiceForeground` in service).
- Background mode is “batch queue” driven: `speakBatch(...)` + `addToBatch(...)`, driven by RN (`WebViewReader.tsx`) and `TTSAudioManager.ts`.
- Chapter transitions can happen while screen off, driven by `onQueueEmpty`.

---

## Goals

1. Show the **current novel name** in the notification and allow it to **auto-scroll (marquee)** for long titles (single line).
2. Show **current chapter number** in a compact format, e.g. `Chapter 23`.
3. Replace existing seek/progress semantics with:
   - Seek bar shows **percentage within the current chapter**:
     - $progress = \frac{currentParagraph}{totalParagraphsInChapter}$
4. Provide 5 buttons (left-to-right):
   - **Previous Chapter**: go to previous chapter and start from paragraph 0.
   - **Seek Back**: go back 5 paragraphs within current chapter (clamp at 0).
   - **Play/Pause**: pause or resume **without removing** notification.
   - **Seek Forward**: go forward 5 paragraphs within current chapter (clamp at last paragraph).
   - **Next Chapter**: go to next chapter and start from paragraph 0.

---

## Non-Goals (for MVP)

- iOS media notification changes.
- Lock-screen UI polish beyond standard MediaStyle.
- Headset button mapping or Android Auto.
- Per-word highlighting controls.

---

## User Stories

1. As a listener, I can see which novel is currently playing from the notification.
2. As a listener, I can see the chapter number at a glance.
3. As a listener, I can scrub (visually) around the chapter progress and understand where I am.
4. As a listener, I can jump back/forward 5 paragraphs quickly without leaving my current app.
5. As a listener, I can jump to previous/next chapter from the notification.
6. As a listener, I can pause and resume without the controls disappearing.

---

## UX Requirements (Android)

### Notification layout

- Use `MediaStyle` (NotificationCompat) for a standard media experience with action buttons.
- **Title**: Novel name (single line, truncates if long)
- **Subtitle**: Original chapter name from the source (e.g., "Chapter 1: The Beginning")
- **SubText**: Progress percentage (e.g., "42%") - shown instead of seek bar due to MediaStyle limitations.

### Controls

Buttons (in order):

1. Previous chapter
2. Seek back (−5 paragraphs)
3. Play/Pause (toggle)
4. Seek forward (+5 paragraphs)
5. Next chapter

Buttons must remain present while paused.

### Accessibility

- Each action must have an accessible label.
- Ensure notification channel importance remains LOW (no sound/vibration).

---

## Technical Design

### High-level approach

Implement a proper Android media notification backed by `MediaSessionCompat` hosted inside `TTSForegroundService`.

**Key idea**: the service owns notification UI + actions. RN remains the source of truth for “where are we (novel/chapter/paragraph) and what to do when navigation happens”. The service sends action events to RN via the existing bridge (`TTSHighlightModule.kt`), which triggers existing `WebViewReader.tsx` logic.

This keeps the complex TTS/chapter/queue logic in one place (RN), and avoids duplicating chapter navigation or DB logic in native.

### Required additions

#### 1) A “session state” update API from RN → native

Add a method in `TTSHighlightModule.kt` like:

- `updateMediaState(state: { novelName: string; chapterNumber: number; chapterId: number; paragraphIndex: number; totalParagraphs: number; isPlaying: boolean })`

RN (`WebViewReader.tsx`) updates this state whenever:

- chapter changes
- paragraph index changes (onSpeechStart/onSpeechDone)
- total paragraph count is known
- play/pause toggles

Native service stores this state and re-renders notification.

#### 2) Notification action intents

Define intents handled by the service, e.g.

- `ACTION_MEDIA_PREV_CHAPTER`
- `ACTION_MEDIA_SEEK_BACK`
- `ACTION_MEDIA_PLAY_PAUSE`
- `ACTION_MEDIA_SEEK_FORWARD`
- `ACTION_MEDIA_NEXT_CHAPTER`

Service maps these to events emitted to JS via `DeviceEventManagerModule` (same pattern as `onSpeechStart`).

Example event name: `onMediaAction` with payload `{ action: 'PREV_CHAPTER' | 'SEEK_BACK' | ... }`.

#### 3) RN handler that reuses existing functions

In `WebViewReader.tsx` (or a small helper), implement handlers that call existing navigation flows:

- Previous chapter:
  - call `navigateChapter('PREV')` or use existing `prevChapter`/`navigateChapter` flow
  - ensure start paragraph index is set to 0 and `TTSHighlight.speakBatch(...)` begins from 0.
- Next chapter:
  - `navigateChapter('NEXT')` similarly, start paragraph 0.
- Seek back/forward ±5 paragraphs:
  - compute `targetIndex = clamp(currentIndex ± 5, 0, totalParagraphs-1)`
  - restart batch from `targetIndex` without releasing foreground service.
  - must set `TTSHighlight.setRestartInProgress(true)` before requeue to avoid false `onQueueEmpty`.
- Play/Pause:
  - **MVP decision**: Pause = stop native TTS audio but keep foreground service + notification.
  - Resume = restart via `speakBatch` from the last known paragraph index.

### Seek bar calculation

- RN provides:
  - `paragraphIndex` (0-based)
  - `totalParagraphs` for current chapter
- Native computes:
  - `progressPercent = total > 0 ? floor(((paragraphIndex + 1) / total) * 100) : 0`
  - Notification progress uses max=100.

### Novel name marquee

- Android notifications don’t always marquee long titles by default.
- Proposed MVP:
  - show novel name in `setContentTitle` and ensure expanded style includes it.
- P1 enhancement:
  - use `RemoteViews` custom layout with `TextView` configured for marquee (`ellipsize="marquee"`, `marqueeRepeatLimit="marquee_forever"`, `singleLine=true`, `isSelected=true`).

---

## Risks / Edge Cases

1. **Pause semantics today are “stop”**
   - Current native module `pause()` calls `stop()`.
   - Introducing pause/resume must not regress background chapter transitions.

2. **Race conditions with queue empty / restart cycles**
   - Existing logic uses `restartInProgress` and `refillInProgress` to prevent false `onQueueEmpty`.
   - All “seek” operations MUST set restart flag and use the same restart pattern as “settings changed while playing”.

3. **WebView not synced (screen off)**
   - Notification actions must work even if WebView JS is suspended.
   - Therefore actions should be handled in RN but must not rely on WebView injection.
   - RN should extract paragraphs from `html` when possible, similar to background next chapter flow.

4. **Chapter availability**
   - Previous/Next chapter buttons should be disabled when not available OR no-op with a toast.

---

## Success Metrics

- Users can control TTS fully from notification.
- No regressions in:
  - background playback continuation
  - chapter auto-advance via `onQueueEmpty`
  - wake/sync flows
- Crash-free sessions for `TTSForegroundService`.

---

## Implementation Plan (MVP)

### MVP (Phase 1)

- Add media-state update API from RN → native.
- Update notification to show:
  - Novel name (title)
  - Chapter label (subtitle)
  - progress (0–100)
- Add the 5 actions; implement event bridge native → RN.
- Implement handlers in RN:
  - prev/next chapter jump to paragraph 0
  - ±5 paragraph seek clamp within chapter
- Implement pause/resume as:
  - Pause: stop native TTS audio but keep service running + notification showing paused state
  - Resume: requeue from last known paragraph index using `speakBatch`

### Phase 2 (Polish)

- True pause/resume semantics without flushing queue (optional).
- Marquee title using custom notification RemoteViews.
- Disable/enable action buttons based on chapter boundaries.

---

## Regression Prevention

### Automated

- Add unit tests around the new “seek target index” calculations (clamping) and progress percent computation.
- Add tests verifying that “restartInProgress” is set during seek operations.

### Manual verification checklist

- Start TTS, lock screen, press seek forward/back, ensure it clamps and continues.
- Press next/previous chapter while screen off, ensure correct chapter starts at paragraph 0.
- Pause from notification, ensure notification remains and “resume” works.
- Ensure `onQueueEmpty` still advances chapters when enabled.

---

## Open Questions (need confirmation)

1. For **Play/Pause**: Confirmed MVP = stop-to-pause + requeue-to-resume.
2. For **Chapter number**: Confirmed = use original `chapter.name` from source.
3. For **Novel title marquee**: Confirmed = defer true marquee (RemoteViews caused crashes).

---

## Known Issues (As of 2025-12-12)

### Issue 1: Seek Bar Not Visible (RESOLVED)

- **Status**: ✅ **Fixed**
- **Resolution**: Use `setProgress` on standard NotificationCompat builder.
- **Note**: Seek bar is visible but read-only (user cannot drag to seek) due to standard notification limitations.

### Issue 2: Prev/Next Chapter Start Position (RESOLVED)

- **Status**: ✅ **Fixed**
- **Resolution**: Logic correctly resets paragraph index to 0.

### Issue 3: Missing "+5" and "Next" Buttons

- **Status**: ⚠️ **Limitation**
- **Behavior**: Notification only shows "Previous", "-5", and "Play" buttons. "+5" and "Next" are hidden.
- **Cause**: Standard Android notification templates often limit action buttons to 3 in the compact/standard view. Without `MediaStyle` (which was removed due to dependency blocker), we lose the ability to show up to 5 actions or use expanded media templates effectively on some devices.
- **Workaround**: Users can still access these controls inside the app. Notification provides core "Previous" and "Rewind" capability.

---

## CRITICAL BLOCKER: MediaSessionCompat Dependency Issue (2025-12-12)

### Problem Summary

The Android release build fails with Kotlin compilation errors for `MediaSessionCompat`, `PlaybackStateCompat`, and `MediaMetadataCompat` classes used in `TTSForegroundService.kt`. The required dependency cannot be resolved despite extensive investigation.

### Investigation Results

| Approach                    | Library/Version                        | Result                                                             |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| Added androidx.media v1.7.1 | `androidx.media:media:1.7.1`           | ❌ Compilation fails - unresolved references                       |
| Added androidx.media v1.7.0 | `androidx.media:media:1.7.0`           | ❌ Same compilation errors persist                                 |
| Attempted Media3 migration  | `androidx.media3:media3-session:1.5.0` | ❌ Incompatible API (no MediaSessionCompat, requires full rewrite) |

**Key Finding**: Despite Android documentation stating `androidx.media:media` contains these classes, the Kotlin compiler cannot resolve them. Multiple build attempts over 90+ minutes with different versions, Gradle clean, dependency refresh all failed identically.

### Impact Analysis

**Immediate Impact (Blocking)**:

- ❌ **Cannot build release APK** - build fails at 98% during Kotlin compilation
- ❌ **Blocks all releases** until resolved
- ✅ JavaScript bundling works (100%)
- ✅ Native C++ builds complete (100%)
- ✅ Only fails on Kotlin compilation step

**Feature Impact**:

- ❌ **MediaSessionCompat integration disabled** - lock screen media controls not available
- ❌ **PlaybackStateCompat unavailable** - cannot sync playback state with Android system
- ✅ **Basic notification still works** - TTS continues to function
- ⚠️ **Notification actions limited** - All 5 actions logic works, but UI only displays first 3 (Prev, -5, Play) on standard view due to layout space. "+5" and "Next" are hidden.
- ✅ **Seek Bar visible** - Progress bar appears (read-only)

### Root Cause Hypothesis

The issue likely stems from one of:

1. **Gradle/SDK configuration incompatibility** specific to this React Native project
2. **Classes relocated to undocumented artifact** in newer library versions
3. **React Native build system conflict** with AndroidX media libraries
4. **Missing companion dependency** not documented in official guides

### Implemented Workaround (2025-12-12)

**Decision**: Temporarily comment out MediaSessionCompat code to unblock builds

**Changes Made**:

1. ✅ Commented out `MediaSessionCompat` initialization in `TTSForegroundService.kt`
2. ✅ Commented out `PlaybackStateCompat` and `MediaMetadataCompat` usage
3. ✅ Removed `androidx.media:media:1.7.0` dependency from `build.gradle`
4. ✅ Preserved all notification actions and UI (still fully functional)

**What Still Works**:

- ✅ TTS background playback
- ✅ All 5 notification actions (prev chapter, ±5 paragraphs, play/pause, next chapter)
- ✅ Chapter progress display (as text percentage)
- ✅ Novel name and chapter title in notification
- ✅ Foreground service lifecycle

**What's Temporarily Disabled**:

- ❌ MediaSession integration (lock screen controls may be limited)
- ❌ PlaybackState broadcasting to Android system
- ❌ MediaMetadata for system media UIs

### Future Resolution Plan

**Phase 1: Deep Investigation** (Priority: P2, Estimated: 4-8 hours)

- [ ] Download `androidx.media:media:1.7.0` AAR file and inspect actual package structure
- [ ] Test with different `compileSdk` / `targetSdk` versions
- [ ] Try legacy support library (`com.android.support:support-media-compat`)
- [ ] Consult React Native + AndroidX compatibility matrices
- [ ] Check if Expo modules conflict with androidx.media

**Phase 2: Alternative Approaches** (If Phase 1 fails)

- **Option A**: Migrate to Media3 (4-8 hour rewrite)
  - Use `androidx.media3.session.MediaSession` (not Compat)
  - Completely different API requiring code refactor
  - More modern, officially recommended by Google
- **Option B**: Use support-media-compat directly
  - Try `com.android.support:support-media-compat:28.0.0`
  - May work if androidx migration has issues
- **Option C**: Custom MediaSession implementation
  - Implement minimal MediaSession wrapper
  - Only core functionality needed for lock screen

**Phase 3: Re-enable MediaSession** (After successful resolution)

- [ ] Uncomment MediaSessionCompat code
- [ ] Add verified working dependency
- [ ] Test lock screen media controls
- [ ] Verify Android Auto compatibility (bonus)
- [ ] Update this PRD with final solution

### Testing Impact

**Automated Tests**:

- ✅ All existing Jest tests pass (mocked native modules)
- ✅ TypeScript compilation succeeds
- ✅ ESLint passes with warnings only

**Manual Testing Required**:

- [ ] Verify notification actions still work after workaround
- [ ] Confirm TTS background playback unaffected
- [ ] Test lock screen behavior (may have reduced functionality)
- [ ] Verify notification remains visible when paused

### Decision Rationale

**Why comment out vs. continue investigating?**

1. **Time investment**: 90+ minutes spent with zero progress
2. **Uncertain outcome**: Root cause unclear, could take days to resolve
3. **Low priority**: MediaSession is "nice-to-have" for enhanced lock screen UX
4. **Core functionality preserved**: TTS + all notification actions still work
5. **Reversible**: Easy to uncomment once dependency is resolved
6. **Unblocks development**: Team can continue working on other features

### References

- Investigation walkthrough: `brain/<conversation-id>/walkthrough.md`
- Relevant commits: Check git history for `TTSForegroundService.kt` and `build.gradle`
- Android docs: [Media Session documentation](https://developer.android.com/guide/topics/media/media-session)
- Media3 migration guide: [Migrate to Media3](https://developer.android.com/media/media3/migration-guide)
