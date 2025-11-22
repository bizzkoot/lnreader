## What's New
This release focuses on significantly improving the Text-to-Speech (TTS) experience, specifically adding text highlighting and robust resume functionality.

### ✨ Features
*   **TTS Text Highlighting**: Text is now highlighted as it is spoken, improving the reading experience.
*   **Smart Resume**: TTS now intelligently resumes from your last read paragraph or your current scroll position.
*   **Scroll Correction**: Added a fallback mechanism to ensure TTS starts from the correct visible paragraph even if auto-scroll misses.
*   **UI Polish**: Improved TTS settings and confirmation dialogs for a smoother user experience.

### 📜 Commits
*   `35095e79` - **feat: complete tts resume logic and ui polish** ([Link](https://github.com/bizzkoot/lnreader/commit/35095e79))
    *   Finalized the resume logic and polished the UI for settings and dialogs.
*   `d0ea54ad` - **fix: tts resume logic and stale progress** ([Link](https://github.com/bizzkoot/lnreader/commit/d0ea54ad))
    *   Fixed issues where progress would become stale or incorrect, ensuring reliable playback resumption.
*   `d3719923` - **feat(tts): attempt to fix TTS resume logic with scroll correction** ([Link](https://github.com/bizzkoot/lnreader/commit/d3719923))
    *   Introduced scroll correction to handle edge cases where the player might start at the wrong position.
