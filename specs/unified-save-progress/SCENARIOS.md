# Progress Tracking Scenarios

## Overview

This document describes all possible progress tracking scenarios and their expected behavior under the unified paragraph-based system.

---

## 1. Manual Scrolling Scenarios

### 1.1 Normal Scroll Progress

**Actions**:
1. User opens chapter
2. User scrolls to 50% (e.g., paragraph 50 of 100)
3. User exits reader

**Expected Behavior**:
- `core.js` finds most visible paragraph (50)
- Calculates progress: `(50 + 1) / 100 * 100 = 51%`
- Saves to MMKV: `chapter_progress_{chapterId} = 50`
- Saves to DB: `progress = 51`

**Verification**:
- Chapter list shows 51%
- Re-opening chapter scrolls to paragraph 50 (centered)

### 1.2 Scroll and Re-enter

**Actions**:
1. Scroll to paragraph 30
2. Exit reader
3. Re-open same chapter

**Expected Behavior**:
- `initialSavedParagraphIndex` reads from MMKV: `30`
- WebView scrolls to paragraph 30 using `scrollIntoView({ block: 'center' })`
- Paragraph 30 appears in center of screen

### 1.3 Quick Exit (No Scroll)

**Actions**:
1. Open chapter
2. Immediately exit (no scroll)

**Expected Behavior**:
- No save event triggered (no scroll detected)
- MMKV retains previous value or `0` for new chapter
- Re-opening starts from paragraph 0 or last saved position

---

## 2. TTS Playback Scenarios

### 2.1 TTS Normal Playback

**Actions**:
1. Start TTS from paragraph 0
2. TTS reads paragraphs 0 → 10
3. User pauses at paragraph 10

**Expected Behavior**:
- Each `onSpeechDone` event triggers `saveProgress()`
- MMKV updated to `10` after paragraph 10 completes
- DB progress: `(10 + 1) / total * 100`
- Notification shows: "11% • Paragraph 11 of {total}"

**Verification**:
- Chapter list shows 11%
- Re-entering chapter starts TTS from paragraph 10

### 2.2 TTS Complete Chapter

**Actions**:
1. TTS reads entire chapter (paragraphs 0 → 99)
2. `onQueueEmpty` fires
3. Chapter marked as read

**Expected Behavior**:
- Progress saved as 100%
- MMKV: `chapter_progress_{chapterId} = 99`
- DB: `progress = 100`, `unread = 0`
- Chapter marked complete

**Verification**:
- Chapter shows checkmark in list
- `getRecentReadingChapters` excludes this chapter (due to `unread = 0`)

### 2.3 TTS Resume After Stop

**Actions**:
1. Start TTS at paragraph 0
2. Stop TTS at paragraph 20
3. Exit reader
4. Re-enter and resume TTS

**Expected Behavior**:
- MMKV has `20` saved
- `currentParagraphIndexRef.current = 20`
- TTS resumes from paragraph 20

---

## 3. Background TTS Scenarios

### 3.1 Background TTS Continues

**Actions**:
1. Start TTS
2. Screen off / app backgrounded
3. TTS continues for 50 paragraphs

**Expected Behavior**:
- Native service continues playback
- `onSpeechDone` events still fire
- RN saves to MMKV on each paragraph (even in background)
- Progress stays current

**Verification**:
- Wake screen → correct paragraph highlighted
- MMKV has latest paragraph index

### 3.2 App Killed During Background TTS

**Actions**:
1. Start TTS, background app
2. System kills app while TTS at paragraph 45
3. User re-opens app

**Expected Behavior**:
- MMKV has last saved position (e.g., 44 or 45)
- Native service may have advanced further before kill
- Resume from MMKV position (best effort)

**Fallback**:
- If MMKV is stale due to kill timing, minimal data loss (<1-2 paragraphs)

---

## 4. Media Notification Actions

### 4.1 Play/Pause from Notification

**Actions**:
1. TTS playing at paragraph 30
2. User taps pause in notification
3. Later taps play

**Expected Behavior**:
- Pause: `currentParagraphIndexRef.current = 30`
- Play: Resumes from `max(currentRef, latestRef) = 30`

### 4.2 Seek Forward/Backward

**Actions**:
1. TTS at paragraph 20
2. User taps "Seek Forward" (+5)

**Expected Behavior**:
- Calculate target: `20 + 5 = 25`
- Restart TTS from paragraph 25
- Save triggered on next `onSpeechDone`

### 4.3 Previous/Next Chapter

**Actions**:
1. TTS at paragraph 50 of Chapter 5
2. User taps "Next Chapter" in notification

**Expected Behavior**:
- Save current progress (50) to MMKV/DB
- Navigate to Chapter 6
- Set `chapter_progress_6 = 0` (start from beginning)
- Start TTS from paragraph 0

---

## 5. Chapter Navigation Scenarios

### 5.1 Manual Chapter Change During TTS

**Actions**:
1. TTS reading Chapter 3, paragraph 40
2. User manually navigates to Chapter 4

**Expected Behavior**:
- Save Chapter 3 progress: MMKV = 40, DB = calculated %
- Load Chapter 4
- If Chapter 4 has saved progress, resume from that
- Otherwise start from paragraph 0

### 5.2 Auto-Advance to Next Chapter

**Actions**:
1. TTS completes Chapter 2 (all paragraphs)
2. `onQueueEmpty` fires with next chapter available
3. Auto-navigates to Chapter 3

**Expected Behavior**:
- Mark Chapter 2 as read (100%, unread=0)
- Force `forceStartFromParagraphZeroRef.current = true`
- Chapter 3 starts from paragraph 0
- No conflict dialog (previous chapter marked read)

---

## 6. Edge Cases

### 6.1 Chapter with 0 Paragraphs

**Expected Behavior**:
- `saveProgress()` checks `totalParagraphs > 0`
- If 0, no save event triggered
- Progress remains at previous value or 0%

### 6.2 MMKV Returns -1 (Not Set)

**Expected Behavior**:
- `initialSavedParagraphIndex` defaults to `0`
- Chapter opens at top
- First scroll/TTS saves actual position

### 6.3 Paragraph Index Exceeds Total

**Expected Behavior**:
- `validateAndClampParagraphIndex()` clamps to `min(index, total - 1)`
- Never causes crash
- Progress capped at 100%

### 6.4 Rapid Chapter Switching

**Expected Behavior**:
- Each chapter saves independently to MMKV
- Keys are unique: `chapter_progress_1`, `chapter_progress_2`, etc.
- No interference between chapters

---

## 7. Migration Scenarios

### 7.1 Existing User with Old Progress Data

**Scenario**: User has:
- DB progress: 45%
- MMKV: (not set or old value)
- Native SharedPreferences: (now ignored)

**Expected Behavior**:
- `initialSavedParagraphIndex` uses MMKV or defaults to 0
- On first scroll/TTS, new paragraph-based progress saved
- Old DB % value gradually replaced with paragraph-based %

### 7.2 User Upgrades Mid-Chapter

**Scenario**: User is reading Chapter 5 at 60% (old scroll-based)

**Expected Behavior**:
- Old progress (60%) still displayed in chapter list
- On next interaction, paragraph-based progress overwrites it
- Smooth transition, no data loss

---

## 8. Cleanup/Reset Scenarios

### 8.1 Mark Chapter as Unread

**Actions**:
1. User marks completed chapter as unread

**Expected Behavior**:
- DB: `unread = 1`, `progress = 0`
- MMKV: Should ideally reset to `-1` or `0`
- Next open starts from beginning

### 8.2 Clear All Progress

**Actions**:
1. User clears reading history

**Expected Behavior**:
- DB: All chapters reset to `progress = 0`
- MMKV: Keys can remain (will be overwritten on next read)

---

## Comparison Matrix

| Scenario            | Old Behavior           | New Behavior               |
| ------------------- | ---------------------- | -------------------------- |
| Scroll 50% then TTS | Different % values     | Same % value               |
| Background TTS kill | May lose position      | MMKV updated per paragraph |
| Resume conflict     | Async race conditions  | Sync MMKV read             |
| Completed chapter   | May show in conflict   | Filtered by `unread = 0`   |
| Progress display    | Sometimes inconsistent | Always paragraph-based     |

---

## Testing Checklist

- [ ] Scroll 50% → exit → re-enter → paragraph centered
- [ ] TTS 50% → chapter list shows ~50%
- [ ] Background TTS → app killed → correct resume
- [ ] Complete chapter → no conflict dialog
- [ ] Rapid chapter switch → independent progress
- [ ] MMKV clear → starts from 0
- [ ] Negative paragraph index → clamped to 0
- [ ] Paragraph > total → clamped to total-1
