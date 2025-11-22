# Product Requirement Document: TTS Text Highlighting

## 1. Executive Summary
Implement real-time word-level text highlighting for the TTS (Text-to-Speech) feature in LNReader. This enhances the reading experience by visually tracking the spoken text ("karaoke mode").

## 2. Problem Statement
- Current TTS highlights the entire paragraph/block.
- Users lose track of the specific word being spoken.
- `expo-speech` (current library) does not support `onRangeStart` (word timing) on Android.

## 3. Solution Overview
- **Native Module**: Create a custom Android Native Module (`TTSHighlightModule`) that uses `android.speech.tts.TextToSpeech` and implements `UtteranceProgressListener.onRangeStart`.
- **React Native**: Expose this module to the JS side.
- **WebView Integration**: Pass the character range (start, end) from Native -> React Native -> WebView.
- **WebView JS**: Update `core.js` to highlight the specific text range within the currently active element.

## 4. Technical Requirements

### 4.1. Android Native Module (`TTSHighlightModule`)
- **Package**: `com.lnreader.tts`
- **Functionality**:
    - `speak(text: String, utteranceId: String, params: ReadableMap)`
    - `stop()`
    - `pause()` (if supported/needed, or just stop)
    - `setVoice(voiceId: String)`
    - `getVoices()`: Return list of available voices.
    - **Events**:
        - `onSpeechStart(utteranceId)`
        - `onSpeechDone(utteranceId)`
        - `onSpeechError(utteranceId, error)`
        - `onRangeStart(utteranceId, start, end, frame)`

### 4.2. React Native Layer
- **Hook/Service**: `useTTSHighlight` or update `WebViewReader.tsx` to use the new module.
- **Event Listeners**: Listen for `onRangeStart` and forward to WebView.

### 4.3. WebView / JS Layer (`core.js`)
- **Message Handling**: Handle `highlight-range` message from RN.
- **DOM Manipulation**:
    - Identify the text node(s) within `currentElement` corresponding to `start` and `end`.
    - Apply a highlight class (e.g., wrap in `<span class="word-highlight">`) to the target range.
    - **Cleanup**: Remove previous word highlight before applying new one.
    - **Normalization**: Ensure the text sent to TTS matches the DOM text to avoid offset mismatch.

## 5. Implementation Steps
1.  **Native Module**: Implement `TTSHighlightModule.java` and `TTSPackage.java`.
2.  **Register Module**: Add to `MainApplication.java`.
3.  **React Native**: Create `TTSHighlight` wrapper (TS interface).
4.  **WebViewReader**: Replace `Speech.speak` with `TTSHighlight.speak`.
5.  **WebView JS**: Modify `core.js` to handle word highlighting.
    - Implement `highlightRange(start, end)` function.
    - Ensure `normalizeText` doesn't break index mapping, or map indices correctly.

## 6. Risks & Mitigations
- **Index Mismatch**: `normalizeText` in `core.js` modifies text.
    - *Mitigation*: Send the *exact* `innerText` to TTS, or implement a mapping function.
- **Performance**: High frequency of `onRangeStart` events (every word).
    - *Mitigation*: Optimize WebView message passing. Debounce if needed (though might cause lag). Direct native-to-webview communication if possible (not easy in RN).
- **Engine Support**: Only Google TTS reliably supports `onRangeStart`.
    - *Mitigation*: Check engine capabilities. Fallback to paragraph highlighting if `onRangeStart` is not fired.

## 7. Verification Plan
- **Unit Test**: Test Native Module methods.
- **Manual Test**:
    - Play TTS on a chapter.
    - Verify words turn yellow (or configured color) as spoken.
    - Verify auto-scroll keeps working.
    - Verify pause/stop works.

## 8. Implemented Features (As of 2025-11-22)
- **Native Module**: `TTSHighlightModule` implemented and integrated.
- **Word Highlighting**: `core.js` updated to handle `highlightRange` and apply `word-highlight` class.
- **Database**: Added `ttsState` column to `Chapter` table via migration `003_add_tts_state.ts`.
- **Settings**: Added `ttsAutoResume` ('always' | 'prompt' | 'never') to `ChapterGeneralSettings`.
- **Resume Logic**:
    - **Core JS**: `tts.start()` respects `ttsAutoResume` setting.
    - **WebViewReader**: Handles confirmation prompt and prioritizes `savedIndex` from MMKV for reliable resuming.
    - **Fixes**:
        - Prevented `calculatePages` from re-scrolling to initial position on resize/exit.
        - Removed auto-start on load to prevent unwanted playback.
        - Fixed stale `savedParagraphIndex` by reading directly from MMKV.
        - **Fixed Resume Accuracy**: Suppressed save event on initial scroll to prevent overwriting progress with the top visible paragraph.
- **UI Polish**:
    - **Settings**: Replaced "Auto Resume" toggle with a `AutoResumeModal` for clear selection.
    - **Confirmation**: Replaced native Alert with a rounded `TTSResumeDialog`.

## 9. Current Issues
- **None**: All identified issues with TTS resume logic, position accuracy, and UI have been resolved.
