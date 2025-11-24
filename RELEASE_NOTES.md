## What's New
This release introduces robust Background TTS playback, improved voice management, and significant stability fixes for the reading experience.

### ✨ Features
*   **Background TTS Playback**: TTS now continues playing seamlessly when the screen is off or the app is in the background (Android 14+ support included). Added a "Background Playback" toggle in settings.
*   **Enhanced Voice Naming**: TTS voices are now displayed with human-readable names (e.g., "English (US) - High Quality") and sorted by language.
*   **Robust Playback Logic**: Implemented a queue-based system to prevent playback stops and ensure highlighting stays in sync with audio.
*   **Reliable Resume**: Fixed issues where TTS would restart from the beginning. It now correctly resumes from the last read paragraph even after the app was in the background.

### 📜 Commits
*   **feat: enhance TTS with background playback, voice naming, and robustness fixes**
    *   [c87462fa911f55668c4c75258d83c7f21cdca7c9](https://github.com/LNReader/lnreader/commit/c87462fa911f55668c4c75258d83c7f21cdca7c9)
