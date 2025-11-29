## What's New
This release brings a **comprehensive overhaul to the Text-to-Speech (TTS) system**, focusing on stability, customization, and user experience. It includes a new draggable TTS button, dedicated settings screens, and critical fixes for scrolling and reloading issues.

### ✨ Features
*   **TTS UI Overhaul**: The TTS button is now **draggable** and remembers its position. New, cleaner dialogs for resuming playback and syncing scroll position.
*   **Advanced TTS Settings**: Added dedicated settings screens for **Auto Resume** behavior, **Scroll Sync** preferences, and an improved **Voice Picker**.
*   **Background TTS Playback**: TTS continues playing seamlessly when the screen is off or the app is in the background (Android 14+ support included).
*   **Reading Stability**: Fixed critical bugs where the reader would reload unnecessarily or fail to scroll to the saved position.
*   **Enhanced Voice Naming**: TTS voices are displayed with human-readable names and sorted by language.
*   **Robust Playback Logic**: Improved queue system to prevent stops and ensure highlighting stays in sync.

### 📜 Commits
*   **feat(tts): comprehensive TTS overhaul and stability fixes**
    *   [0b50169599d14e4d76c510230939823f6d51516e](https://github.com/bizzkoot/lnreader/commit/0b50169599d14e4d76c510230939823f6d51516e)
*   **Fix: TTS button position persistence and icons**
    *   [89447ef08e77ff5a8165f81ab74a4332c4f704d0](https://github.com/bizzkoot/lnreader/commit/89447ef08e77ff5a8165f81ab74a4332c4f704d0)
*   **fix: resolve initial scroll race condition in WebView**
    *   [2eb9c48f0646415860e66c243477ecf1fc27e7a4](https://github.com/bizzkoot/lnreader/commit/2eb9c48f0646415860e66c243477ecf1fc27e7a4)
*   **Fix TTS 'Phantom 5' reset and improve progress saving**
    *   [ff8827ddc523cf13faebf75add399d40601cceae](https://github.com/bizzkoot/lnreader/commit/ff8827ddc523cf13faebf75add399d40601cceae)
*   **feat: enhance TTS with background playback, voice naming, and robustness fixes**
    *   [c87462fa911f55668c4c75258d83c7f21cdca7c9](https://github.com/LNReader/lnreader/commit/c87462fa911f55668c4c75258d83c7f21cdca7c9)
*   **Merge upstream/master**
    *   [e09704c71198df381033d3dc10910baa47c8c8e6](https://github.com/LNReader/lnreader/commit/e09704c71198df381033d3dc10910baa47c8c8e6)
