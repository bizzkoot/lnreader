## What's New
This release focuses on polishing the TTS experience, improving the resume logic, and fixing UI inconsistencies.

### ✨ Features
*   **Optimized TTS Scroll**: Initial TTS start/resume now skips scrolling if the target paragraph is already fully visible, providing a smoother experience.
*   **Refined Resume Prompt**: The "Change TTS Reading Position?" prompt is now smarter and won't appear if the paused paragraph is still visible on screen.
*   **UI Polish**: Improved the design of the TTS resume dialog and added proper settings modals for scroll behavior options.
*   **Bug Fixes**: Fixed an issue where the TTS icon would remain in the "Pause" state after stopping playback.

### 📜 Commits
*   **feat: optimize tts scroll and refine resume logic**
    *   Implemented visibility checks to skip unnecessary scrolling and prompts.
*   **fix: tts icon state on stop**
    *   Ensured the TTS button icon correctly reverts to "Play" when stopped.
*   **ui: polish tts settings and dialogs**
    *   Enhanced the visual design of the resume dialog and added new selection modals for settings.
