
## What's New
### v2.0.7 — 2025-12-07

**Cross‑chapter TTS reliability, wake/resume hardening, and TTS parsing stability — a collection of fixes to make playback robust across chapter transitions, WebView race conditions, queue timing, and parsing edge cases.**

### ✨ Features

- **Cross‑chapter continuity & resume safety** — persist last TTS chapter, add exit/chapter-selection dialogs, and guard resume flow with clamped paragraph indices to avoid out‑of‑range resumes.
- **Queue & refill hardening** — TTSAudioManager + TTSHighlight now detect JS queue state and avoid premature onQueueEmpty-driven navigation; queue refill logic improved to reduce false-positives.
- **Safer WebView interactions** — `safeInjectJS` wrapper prevents silent injection failures when the WebView is in a bad state.
- **DB helpers for chapter progress** — `markChaptersBeforePositionRead` and `resetFutureChaptersProgress` let us mark read chapters and optionally reset progress on upcoming chapters when jumping back.
- **HTML paragraph extraction improvements** — a stronger flattening strategy with block delimiters and entity decoding reduces lost text and improves TTS parsing accuracy.
- **UX & settings** — new dialogs and a `ttsForwardChapterReset` reader setting to control how future chapter progress is reset when continuing TTS.

### 📜 Commits

Range: `v2.0.6..HEAD` — 24 commits

Detailed technical summary of commits (condensed):

* **Core TTS reliability:** Fixed cross‑chapter resume logic, clamped paragraph indices for safe resumes, added exit/selection dialogs and `ttsForwardChapterReset` setting to control future‑chapter progress resets on forward navigation.
* **Queue & refill hardening:** Robust queue detection and refill guards in TTSAudioManager and TTSHighlight to prevent false onQueueEmpty navigation and reduce premature chapter advances.
* **WebViewReader safety & event filtering:** Blocked 'speak' / 'onWordRange' events during wake/resume transitions, added chapter‑aware utterance IDs, throttled stale‑event logging and guarded against stale events from old chapters.
* **Parsing & extractor improvements:** Stronger HTML paragraph flattening with block delimiters and entity decoding to avoid lost text and improve TTS paragraph extraction accuracy.
* **Persistence & DB helpers:** New helpers to mark chapters read before a position and reset future chapters' progress when appropriate.
* **UX polish & dialogs:** Added safer WebView injection wrapper (`safeInjectJS`), background playback UX fixes, and reader settings to control resume/reset behavior.

If you want the full commit list, I can include the raw commit hashes and links.