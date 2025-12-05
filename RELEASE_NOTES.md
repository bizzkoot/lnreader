## What's New
This release brings a **comprehensive overhaul to the Text-to-Speech (TTS) system**, focusing on stability, customization, and user experience. It includes a new draggable TTS button, dedicated settings screens, and critical fixes for scrolling and reloading issues.

### ✨ Features
*   **TTS UI Overhaul**: The TTS button is now **draggable** and remembers its position. New, cleaner dialogs for resuming playback and syncing scroll position.
*   **Advanced TTS Settings**: Added dedicated settings screens for **Auto Resume** behavior, **Scroll Sync** preferences, and an improved **Voice Picker**.
*   **Background TTS Playback**: TTS continues playing seamlessly when the screen is off or the app is in the background (Android 14+ support included).
*   **Reading Stability**: Fixed critical bugs where the reader would reload unnecessarily or fail to scroll to the saved position.
*   **Enhanced Voice Naming**: TTS voices are displayed with human-readable names and sorted by language.
*   **Robust Playback Logic**: Improved queue system to prevent stops and ensure highlighting stays in sync.

*** End Patch

## Latest (most recent commits)
This section lists the latest features and fixes added on this fork. These
changes were added after the last release notes entry and include several
important TTS improvements, background playback fixes, and convenience
features.

### ✨ Features & Fixes
* **Continuous multi-chapter TTS**: TTS now continues across chapter
    boundaries with improved paragraph highlighting and queue handling.
* **Multi-chapter continuation & voice fallback**: Better handling when
    multiple chapters are queued; fallback to higher-quality voices where
    available.
* **Auto-download remaining chapters**: Option to auto-download remaining
    chapters for a series to improve offline reading and TTS continuity.
* **TTS tab in reader settings**: A dedicated TTS settings tab inside the
    reader with options for Auto Resume, Scroll Sync, and Voice Picker.
* **Background playback robustness**: Fixes for background/foreground service
    errors (including Android 12+) and improved resume behavior when returning
    to the reader.
* **Stale-event and cross-chapter event prevention**: Prevents outdated
    events from polluting the TTS queue during chapter transitions.
* **Version bump**: Version bumped to `2.0.5` for this collection of fixes.

### 📜 Commits (most recent-first)
*   **feat(tts): concise language-first voice labels and curated mappings**
    *   [ead5591e](https://github.com/bizzkoot/lnreader/commit/ead5591edd5452129dc714cc49eb20a2f7490c35)
*   **feat(tts): implement live TTS settings updates in reading mode**
    *   [c3875095](https://github.com/bizzkoot/lnreader/commit/c3875095d83b8679ab15fd41932a55584b06585b)
*   **fix(tts): multi-chapter continuation and voice quality fallback**
    *   [a220975e](https://github.com/bizzkoot/lnreader/commit/a220975ec553f2b76464b9b4c26460c97ad0820c)
*   **feat: Add auto-download on remaining chapters and TTS tab in reader settings**
    *   [5d1b704a](https://github.com/bizzkoot/lnreader/commit/5d1b704affb74be740a15a953d378ba205701fa9)
*   **fix(tts): resolve 3 TTS background playback and resume bugs**
    *   [7cd0f6e9](https://github.com/bizzkoot/lnreader/commit/7cd0f6e948e4f0dc9c4068b7395d76973afa7f00)
*   **fix(tts): Prevent stale events during chapter transition and improve UX**
    *   [c66dd07f](https://github.com/bizzkoot/lnreader/commit/c66dd07fe33a32320f6fbad84f3e0aef1fc65c98)
*   **fix(tts): prevent cross-chapter event pollution during transitions**
    *   [8dc1571a](https://github.com/bizzkoot/lnreader/commit/8dc1571ae4a8d3fe5f46ffae7c3d6192286577fd)
*   **fix(tts): resolve Android 12+ foreground service error during background chapter transitions**
    *   [f4dd3f62](https://github.com/bizzkoot/lnreader/commit/f4dd3f62333d8b3afb122d1f90fa45ca052b5a86)
*   **fix(tts): background TTS continuation across chapters; paragraph highlighting fixes**
    *   [1e7598da](https://github.com/bizzkoot/lnreader/commit/1e7598dafe1d893a2c8ad4ebaad13d3a9924e6e8)
*   **Fix: TTS background playback and paragraph highlighting**
    *   [e7aa3b86](https://github.com/bizzkoot/lnreader/commit/e7aa3b864dd2631579839f33717962e240685382)
*   **feat(tts): implement continuous TTS across chapters**
    *   [a5e130ee](https://github.com/bizzkoot/lnreader/commit/a5e130ee82a5b86df026372e6ff2f75717c34697)
*   **Fix: TTS Highlighting and Background Playback Auto-Refill**
    *   [26ce9be9](https://github.com/bizzkoot/lnreader/commit/26ce9be92e34536010b24ea1c5406f2af82bb374)

## v2.0.5 — 2025-12-04

### What's New

This release brings a comprehensive overhaul to the Text-to-Speech (TTS) system, focusing on stability, customization, and user experience. Major highlights include a draggable TTS button, advanced settings, and robust background playback.

### ✨ Features & Fixes

- **Draggable TTS Button**: Move and position the TTS button anywhere; position is remembered.
- **Advanced TTS Settings**: Dedicated screens for Auto Resume, Scroll Sync, and Voice Picker.
- **Continuous Multi-Chapter TTS**: Seamless playback across chapters with improved highlighting.
- **Auto-Download Chapters**: Option to auto-download remaining chapters for offline reading and TTS continuity.
- **Background Playback**: TTS continues when the screen is off or app is in the background (Android 14+ support).
- **Stability Improvements**: Fixed reload/scroll bugs, improved queue logic, and prevented stale/cross-chapter events.
- **Voice Naming**: Human-readable, language-sorted voice names; fallback to higher-quality voices.
- **Version Bump**: Now at `2.0.5`.

---

### 📜 Commit Log

| SHA | Date | Author | Message |
|------|------|--------|---------|
| [ead5591e](https://github.com/bizzkoot/lnreader/commit/ead5591edd5452129dc714cc49eb20a2f7490c35) | 2025-12-04 | bizzkoot | feat(tts): concise language-first voice labels and curated mappings |
| [c3875095](https://github.com/bizzkoot/lnreader/commit/c3875095d83b8679ab15fd41932a55584b06585b) | 2025-12-04 | bizzkoot | feat(tts): implement live TTS settings updates in reading mode |
| [a220975e](https://github.com/bizzkoot/lnreader/commit/a220975ec553f2b76464b9b4c26460c97ad0820c) | 2025-12-04 | bizzkoot | fix(tts): multi-chapter continuation and voice quality fallback |
| [5d1b704a](https://github.com/bizzkoot/lnreader/commit/5d1b704affb74be740a15a953d378ba205701fa9) | 2025-12-04 | bizzkoot | feat: Add auto-download on remaining chapters and TTS tab in reader settings |
| [7cd0f6e9](https://github.com/bizzkoot/lnreader/commit/7cd0f6e948e4f0dc9c4068b7395d76973afa7f00) | 2025-12-04 | bizzkoot | fix(tts): resolve 3 TTS background playback and resume bugs |
| [c66dd07f](https://github.com/bizzkoot/lnreader/commit/c66dd07fe33a32320f6fbad84f3e0aef1fc65c98) | 2025-12-03 | bizzkoot | fix(tts): Prevent stale events during chapter transition and improve UX |
| [8dc1571a](https://github.com/bizzkoot/lnreader/commit/8dc1571ae4a8d3fe5f46ffae7c3d6192286577fd) | 2025-12-03 | bizzkoot | fix(tts): prevent cross-chapter event pollution during transitions |
| [f4dd3f62](https://github.com/bizzkoot/lnreader/commit/f4dd3f62333d8b3afb122d1f90fa45ca052b5a86) | 2025-12-03 | bizzkoot | fix(tts): resolve Android 12+ foreground service error during background chapter transitions |
| [1e7598da](https://github.com/bizzkoot/lnreader/commit/1e7598dafe1d893a2c8ad4ebaad13d3a9924e6e8) | 2025-12-03 | bizzkoot | fix(tts): background TTS continuation across chapters; paragraph highlighting fixes |
| [e7aa3b86](https://github.com/bizzkoot/lnreader/commit/e7aa3b864dd2631579839f33717962e240685382) | 2025-12-03 | bizzkoot | Fix: TTS background playback and paragraph highlighting |
| [a5e130ee](https://github.com/bizzkoot/lnreader/commit/a5e130ee82a5b86df026372e6ff2f75717c34697) | 2025-12-03 | bizzkoot | feat(tts): implement continuous TTS across chapters |
| [26ce9be9](https://github.com/bizzkoot/lnreader/commit/26ce9be92e34536010b24ea1c5406f2af82bb374) | 2025-11-30 | bizzkoot | Fix: TTS Highlighting and Background Playback Auto-Refill |
| [9060a092](https://github.com/bizzkoot/lnreader/commit/9060a092a2893c76f39860d0bdb1d3428ec4a496) | 2025-11-30 | bizzkoot | chore: bump version to 2.0.5 |
| [67f69774](https://github.com/bizzkoot/lnreader/commit/67f697741d11e5e5ceb73e1450b2d702b6c36f2d) | 2025-11-30 | bizzkoot | Merge upstream/master |
| [0b501695](https://github.com/bizzkoot/lnreader/commit/0b50169599d14e4d76c510230939823f6d51516e) | 2025-11-30 | bizzkoot | feat(tts): comprehensive TTS overhaul and stability fixes |
| [e09704c7](https://github.com/bizzkoot/lnreader/commit/e09704c71198df381033d3dc10910baa47c8c8e6) | 2025-11-29 | Patrick Loser | fix: Replace react native paper components |
| [89447ef0](https://github.com/bizzkoot/lnreader/commit/89447ef08e77ff5a8165f81ab74a4332c4f704d0) | 2025-11-27 | bizzkoot | Fix: TTS button position persistence and icons |
| [2eb9c48f](https://github.com/bizzkoot/lnreader/commit/2eb9c48f0646415860e66c243477ecf1fc27e7a4) | 2025-11-26 | bizzkoot | fix: resolve initial scroll race condition in WebView |
| [ff8827dd](https://github.com/bizzkoot/lnreader/commit/ff8827ddc523cf13faebf75add399d40601cceae) | 2025-11-26 | bizzkoot | Fix TTS 'Phantom 5' reset and improve progress saving |
| [ecc0fc19](https://github.com/bizzkoot/lnreader/commit/ecc0fc19e2fefd60f742aa6a264e5f8ae61f0336) | 2025-11-24 | bizzkoot | chore: bump version to v2.0.4 |
| [c87462fa](https://github.com/bizzkoot/lnreader/commit/c87462fa911f55668c4c75258d83c7f21cdca7c9) | 2025-11-24 | bizzkoot | feat: enhance TTS with background playback, voice naming, and robustness fixes |
| [aaa6bdce](https://github.com/bizzkoot/lnreader/commit/aaa6bdce411bfa48a53e5d8b0d966e3af098be99) | 2025-11-23 | bizzkoot | Refactor TTS engine, fix resume bugs, and polish UI |
| [e49d202c](https://github.com/bizzkoot/lnreader/commit/e49d202c3165d7e72539d8f94f5e457ca9e390b8) | 2025-11-22 | bizzkoot | feat: optimize tts scroll, refine resume logic, and polish UI (v2.0.3) |
| [154f9d8a](https://github.com/bizzkoot/lnreader/commit/154f9d8aa027f852f81ff765673783ef749f3791) | 2025-11-22 | bizzkoot | chore: release v2.0.2 |
| [35095e79](https://github.com/bizzkoot/lnreader/commit/35095e791a57efa3bc0fb7c3e981958a15310164) | 2025-11-22 | bizzkoot | feat: complete tts resume logic and ui polish |
| [d0ea54ad](https://github.com/bizzkoot/lnreader/commit/d0ea54addb974a4aeeb275c1c893a34cc6445bfe) | 2025-11-22 | bizzkoot | fix: tts resume logic and stale progress |
| [d3719923](https://github.com/bizzkoot/lnreader/commit/d3719923d4d4a157a4c7c316787aba5819d65e05) | 2025-11-22 | bizzkoot | feat(tts): attempt to fix TTS resume logic with scroll correction |
| [3af24f08](https://github.com/bizzkoot/lnreader/commit/3af24f08154e9d202c11f4fa027aa75d29e17dab) | 2025-11-16 | Rajarshee Chatterjee | fix: Improve Migration Error Handling |
| [4c0e7f60](https://github.com/bizzkoot/lnreader/commit/4c0e7f6013d02eb6442899802830f96973a853ed) | 2025-11-16 | Rajarshee Chatterjee | fix: Add Backward Compatibility to Tasks Queue |
| [ea298273](https://github.com/bizzkoot/lnreader/commit/ea298273af619474eaca814ffad457af64fa07c2) | 2025-11-15 | Rajarshee Chatterjee | fix: Categories Not Sorting |



