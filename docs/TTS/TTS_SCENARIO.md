# TTS User Scenarios

This document outlines the various user workflows and edge cases that interact with the TTS system. It serves as a testing guide and logic validation reference.

## 1. Standard Reading Flow

**Goal**: User listens to a chapter from start to finish without interruption.

- **Pre-condition**: User opens a chapter with no saved progress.
- **Actions**:
  1.  User taps "Play" or TTS starts automatically (if configured).
  2.  Audio plays paragraph by paragraph.
  3.  UI auto-scrolls to keep the active paragraph in view.
- **System Behavior**:
  - `speakBatch` (Background) or `speak` (Foreground) is called.
  - `onSpeechStart` triggers highlighting.
  - `onSpeechDone` saves progress.
- **End State**: Reaches end of chapter. Logic checks `ttsContinueToNextChapter`.
  - _If None_: Stops.
  - _If Continue_: Loads next chapter and continues audio.

## 2. Resume & Restoration

**Goal**: User returns to a chapter they were previously listening to.

- **Pre-condition**: Chapter has `savedParagraphIndex > 0`.
- **Actions**:
  1.  User opens chapter.
  2.  **Dialog Appears**: "Resume TTS" (Resume | Start Top | Restart).
  3.  User selects **Resume**.
- **System Behavior (Based on Selection)**:
  - **Resume**:
    - _Logic_: `handleResumeConfirm` calls `window.tts.restoreState()`.
    - _Action_: WebView scrolls instantly to `savedParagraphIndex`.
    - _Audio_: Playback queue starts from that paragraph.
  - **Start from Top**:
    - _Logic_: `handleResumeCancel` marks `hasAutoResumed = true` then calls `window.tts.start()`.
    - _Action_: `start()` ignores saved index and finds the first **visible** paragraph in the viewport.
    - _Audio_: Playback starts from the paragraph currently at the top of the screen (effectively the beginning, unless manually scrolled).
  - **Restart Chapter**:
    - _Logic_: `handleRestartChapter` forces a re-scan of `readableElements`.
    - _Action_: Calls `window.tts.start(elements[0])` explicitly.
    - _Audio_: Forces playback from Paragraph 0, regardless of scroll or visibility.

## 3. The "Scroll-While-Listening" Conflict

**Goal**: User wants to peek at previous/future text while TTS is playing.

- **Scenario A: Forward Scroll (Peeking)**
  - **Action**: User flicks down to see what's coming.
  - **Behavior**:
    - TTS continues playing.
    - Auto-scroll is temporarily paused during touch.
    - When touch releases, if TTS advances to next paragraph, auto-scroll snaps back to current playing position.
- **Scenario B: Backward Scroll (Manual Mode Trigger)**
  - **Action**: User scrolls _up_ significantly (reading previous text).
  - **Trigger**: Distance > 1 Screen Height.
  - **Dialog**: **Manual Mode Alert** ("Stop TTS" vs "Continue Following").
  - **Outcome**:
    - _Stop_: TTS kills audio. App enters manual reading mode at current scroll position.
    - _Continue_: WebView scrolling snaps back to the currently speaking paragraph.

## 4. The "Scroll-While-Paused" Re-sync

**Goal**: User paused TTS, read ahead/behind manually, and wants to resume.

- **Pre-condition**: TTS is Paused at Para 10. User scrolls to Para 20.
- **Action**: User presses "Play" (or system prompt triggers).
- **Dialog**: **Scroll Sync** ("Continue from Para 20" vs "Resume from Para 10").
- **Flow**:
  ```mermaid
  flowchart TD
      Paused[TTS Paused @ Para 10] --> Scroll[User Scrolls to Para 20]
      Scroll --> Action{User Action}

      Action -- Press Play --> CheckDiff{Is Diff > Thresh?}
      CheckDiff -- No --> ResumeOld[Resume @ Para 10]
      CheckDiff -- Yes --> Dialog[Show Sync Dialog]

      Dialog -- "Read from Here" --> SyncNew[Update TTS to Para 20] --> PlayNew[Play @ Para 20]
      Dialog -- "Resume Saved" --> ScrollBack[Scroll back to Para 10] --> ResumeOld
  ```

## 5. Background & Screen Off

**Goal**: Listen to novel like an audiobook while phone is locked.

- **Actions**:
  1.  TTS Playing.
  2.  User locks screen.
- **System Behavior**:
  - WebView JS freezes (Android behavior).
  - Native `TTSForegroundService` keeps app alive.
  - React Native `TTSAudioManager` continues feeding `speakBatch` to Native Module.
  - **Chapter Transition**:
    - Queue empties -> RN loads next chapter data -> Extracts text -> Starts new Batch.
    - _Crucial_: WebView is NOT updated yet (it's frozen).
  - **Wake Up / Unlock**:
    - **Event**: App state changes to `active`.
    - **Immediate Action**:
      - Pauses Native TTS (to prevent desync).
      - Sets `wakeTransitionInProgressRef = true` (Blocks new speech events).
      - Injects `reader.suppressSaveOnScroll = true` (Prevents scroll-based saves from overwriting TTS progress).
    - **Scenario A: Same Chapter** (WebView still loaded correct chapter):
      - Logic: `wakeChapterId === chapter.id`.
      - Action: Injects `window.tts.updateState` + `scrollToElement` to snap UI to the last spoken paragraph.
      - Result: TTS resumes `speakBatch` from that exact paragraph.
    - **Scenario B: Chapter Mismatch** (TTS advanced to next chapter in background):
      - Logic: `wakeChapterId !== chapter.id`.
      - Action: Shows **Sync Dialog** ("Syncing...").
      - Flow: Triggers `getChapter(savedWakeChapterId)` -> Navigates.
      - Retry: `onLoadEnd` fires again -> Detects match (Scenario A) -> Hides Dialog -> Resumes.
      - _Failure_: If sync fails > 3 times, shows **Sync Failure Dialog**.
    - **Completion Status**:
      - If TTS finished the chapter right before wake, `onQueueEmpty` handles the transition.
      - Visual progress bar updates only _after_ successful sync.

## 6. Dynamic Settings Update

**Goal**: Adjust speed/voice without stopping.

- **Action**: User opens TTS Settings sheet and drags Speed Slider.
- **System Behavior**:
  - Value updates in State.
  - `useEffect` detects change.
  - `TTSHighlight.setRate()` called immediately.
  - Current utterance continues (or restarts depending on Engine) with new rate.
  - No manual stop/start required by user.

## 7. Data Integrity & Completeness Logic

How the system ensures no paragraphs are skipped or repeated during complex state changes (backgrounding, waking, transitioning).

### A. Completeness Verification

- **Source of Truth**:
  - **Foreground**: `window.reader.getReadableElements()` in WebView.
  - **Background**: `extractParagraphs(html)` (RegEx-based) in React Native.
  - _Note_: These two must align. The RegEx is tuned to match the Reader's DOM selection logic.
- **End-of-Chapter Detection**:
  - The Native Module fires `onQueueEmpty` _only_ after the last queued utterance completes.
  - **Safety Check**: `WebViewReader` verifies `isTTSReadingRef` is true to ignore spurious empty events (e.g., from interleaved audio interruptions).
  - **Transition**: If `ttsContinueToNextChapter` is active, it triggers navigation.

### B. Wake-Transition Safety (The "Anti-Glitch" Shield)

When the screen wakes, the WebView is often "stale" or "loading," while the Native TTS engine is kilometers ahead.

- **Race Condition**: `onSpeechStart` events from the _old_ background queue might arrive while the _new_ WebView is loading, corrupting the `currentParagraphIndex`.
- **Solution**: `wakeTransitionInProgressRef`
  - **Action**: set to `true` immediately on `AppState: active`.
  - **Effect**: Blocks all `onSpeechStart` and `onWordRange` handlers. The React Native side stops listening to the Native Module's progress updates until the UI is stabilized.
- **Persistence Protection**: `reader.suppressSaveOnScroll`
  - **Problem**: Waking the screen often triggers a "scroll" event to position 0 (top) before restoring the correct position. This would normally autosave "Paragraph 0".
  - **Solution**: We inject `window.ttsScreenWakeSyncPending = true` which forces `core.js` to ignore these scroll events until the "Sync" operation is officially complete.

### C. The "Pending" Bridge (`backgroundTTSPendingRef`)

How we survive the "Void" between chapters when the screen is off.

1.  **Queue Empty**: Old chapter finishes.
2.  **Navigation**: RN calls `navigateChapter`.
3.  **The Void**: Old WebView unmounts. New WebView mounts. JS is dead.
4.  **The Flag**: `backgroundTTSPendingRef = true`.
5.  **New Chapter Load**: `onLoadEnd` fires for the new chapter.
6.  **Bridge**: `onLoadEnd` sees the flag -> **Skips** standard startup -> Immediately calls `extractParagraphs` -> Feeds `speakBatch` to Native.
    - _Result_: Audio continues with < 1s gap, even though UI never "rendered" to a user.

## 8. Complex Navigation Scenarios

### A. Cross-Chapter Resume (The "Library Jump")

**Goal**: User was reading a specific chapter, navigates away, and opens a different chapter (Forward or Reverse). System detects the active TTS session.

- **Pre-condition**: `lastTTSChapterId` exists (e.g., Ch 3).
- **Action**: User opens a different chapter (e.g., Ch 5 or Ch 1) and starts TTS.
- **Dialog Stage 1**: **Chapter Selection** ("You were listening to [Ch 3]. Continue there?" vs "Start [Current]").

#### 1. Forward Jump (e.g., Ch 3 -> Ch 5)

_User skips ahead to a future chapter._

- **Select "Continue [Ch 3]"**:
  - **Behavior**: Navigation jumps back to Ch 3. TTS resumes from saved position.
  - **Use Case**: "Oops, I didn't mean to start reading here, take me back."
- **Select "Start [Ch 5]"**:
  - **Behavior**:
    - `lastTTSChapterId` updates to 5.
    - **Auto-Complete**: System marks all chapters _before_ Ch 5 (e.g., Ch 1-4) as **Read** to reflect the user's intent to "Start Here".
    - **Reset Logic**: If `ttsForwardChapterReset` is enabled (e.g., "Reset Next 10"), system clears progress for upcoming chapters (Ch 6+) to ensure a clean slate.
  - **Use Case**: "I'm skipping the boring parts / starting directly from here."

#### 2. Reverse Jump (e.g., Ch 3 -> Ch 1)

_User looks back at a previous chapter._

- **Select "Continue [Ch 3]"**:
  - **Behavior**: Navigation jumps back to Ch 3.
  - **Use Case**: "Just checking something in Ch 1, now back to my audiobook."
- **Select "Start [Ch 1]"**:
  - **Behavior**:
    - `lastTTSChapterId` updates to 1.
    - **Auto-Complete**: Marks chapters _before_ Ch 1 as Read (in this case, none). If jumping Ch 10 -> Ch 5, Ch 1-4 are marked Read.
    - **Reset Logic**: If "Reset All" is enabled, this action is **destructive**. It wipes progress for Ch 2, 3, 4, etc., effectively restarting the volume.
  - **Use Case**: "I want to re-listen to the whole book from the beginning."
- **Outcome**: Explicit choice prevents accidental progress overwrites (re-reading Ch 1 doesn't kill Ch 3's state unless explicitly chosen).

### B. Exit Confirmation (The "Accidental Back")

**Goal**: Prevent accidental exit when TTS is playing vs User Reading.

- **Scenario**: User is listening (Para 50) but manually scrolled back to read Para 5.
- **Action**: User presses Android Back Button.
- **Conflict**:
  - Intent A: "Go back to Para 50 (Sync)"?
  - Intent B: "Exit Chapter"?
- **Logic**:
  - Implementation allows standard back behavior (Exit).
  - _Note_: No specific "Exit Confirmation" dialog exists currently, but `TTSManualModeDialog` serves as a soft barrier if they scroll far enough.
  - **Recommendation** (from analysis): Future implementation should add `BackHandler` interception if `isTTSReading` is true to ask "Stop TTS & Exit?".

## 9. Verification Scenarios (Test Guide)

### Scenario A: New Chapter Entry (No History)

1.  **Setup**: Play TTS in **Chapter 1** until Paragraph 10.
2.  **Action**: Navigate to **Chapter 2** (Assuming Ch 2 has NO saved progress).
    - _System Check_: Is `lastTTSChapterId` (Ch 1) == `currentChapterId` (Ch 2)? NO.
3.  **Prompt**: "You were listening to Chapter 1. Continue there?"
4.  **Expectation**:
    - Prompt appears even if Ch 2 is "New" because the active TTS session belongs to Ch 1.

### Scenario B: Library Jump (The Core Use Case)

1.  **Setup**: Play TTS in **Chapter 1** until Paragraph 50.
2.  **Action**: Go to Library -> Open **Chapter 5**.
3.  **Prompt**: "You were listening to Chapter 1. Continue there?"
4.  **Branch 1 (Continue)**: Select **"Continue Chapter 1"**.
    - **Expectation**: App navigates back to Chapter 1. TTS resumes from Para 50.
5.  **Branch 2 (Start)**: Select **"Start Chapter 5"**.
    - **Expectation**: App stays in Chapter 5. `lastTTSChapterId` updates to 5. Standard Resume Dialog appears (if Ch 5 has saved progress) or TTS starts from top.

### Scenario C: Starting Fresh with Reset

1.  **Pre-condition**: Ensure **Chapter 6** has saved progress (e.g., read 50%).
2.  **Setup**: Play TTS in **Chapter 1**.
3.  **Action**: Open **Chapter 5**.
4.  **Prompt**: Select **"Start Chapter 5"**.
5.  **Settings**: ensure `Auto-reset future progress` is set to **"Reset next chapter"**.
6.  **Action**: Confirm start.
7.  **Expectation**:
    - Chapter 5 starts playing.
    - **Chapter 6** progress is reset to 0% (Database/MMKV cleared).

### Scenario D: Reset All Warning

1.  **Action**: Go to Settings > Accessibility.
2.  **Selection**: Select "Reset ALL future chapters".
3.  **Expectation**:
    - **Alert**: "Confirm Reset All" warning appears.
    - Setting only applies if "Enable" is explicitly pressed.

## 10. Media Notification Control Scenarios

### A. Chapter Navigation via Notification

**Goal**: Control chapter navigation while phone is locked or minimized.

**PREV_CHAPTER Flow:**

1.  **Pre-condition**: TTS playing in Chapter 5 at paragraph 30.
2.  **Action**: User presses **Previous Chapter** in notification.
3.  **System Behavior**:
    - Navigation to Chapter 4 begins.
    - TTS starts from **paragraph 0** (fresh start).
    - `mediaNavSourceChapterIdRef` is set to Chapter 5's ID.
4.  **After 5 paragraphs**: Chapter 5 is marked as **100% complete**.
5.  **Use Case**: User wants to re-listen to previous chapter from the beginning.

**NEXT_CHAPTER Flow:**

1.  **Pre-condition**: TTS playing in Chapter 3 at paragraph 20.
2.  **Action**: User presses **Next Chapter** in notification.
3.  **System Behavior**:
    - Navigation to Chapter 4 begins.
    - TTS starts from **paragraph 0**.
    - `mediaNavSourceChapterIdRef` is set to Chapter 3's ID.
4.  **After 5 paragraphs**: Chapter 3 is marked as **100% complete**.
5.  **Use Case**: User wants to skip to next chapter (marks current as read).

### B. Pause via Notification

**Goal**: Ensure progress is preserved when pausing from locked screen.

1.  **Pre-condition**: TTS playing at paragraph 50.
2.  **Action**: User presses **Play/Pause** button in notification.
3.  **System Behavior**:
    - Progress is saved **immediately** (paragraph 50).
    - Grace period is activated (`ttsLastStopTime`).
    - TTS pauses but service remains active.
4.  **If app is killed**: Progress is preserved at paragraph 50.
5.  **Resume**: Pressing Play resumes from paragraph 50.

### C. Rapid Toggle Protection

**Goal**: Prevent queue corruption from accidental rapid tapping.

1.  **Action**: User rapidly taps Play/Pause multiple times.
2.  **System Behavior**:
    - First tap is processed.
    - Subsequent taps within **500ms** are **ignored** (debounced).
    - Console logs: `Media action debounced`.
3.  **Result**: Queue integrity preserved, no duplicate actions.

