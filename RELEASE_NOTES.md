
## What's New
### v2.0.7 — 2025-12-07

**Cross‑chapter TTS reliability and robustness — fixes and hardening to make TTS playback resilient across chapter boundaries, wake/resume, and queue timing so users see consistent highlighting and fewer unexpected jumps.**

### ✨ Features

- **Cross‑chapter continuity & resume safety** — persist last TTS chapter, add exit/chapter-selection dialogs, and guard resume flow with clamped paragraph indices to avoid out‑of‑range resumes.
- **Queue & refill hardening** — TTSAudioManager + TTSHighlight now detect JS queue state and avoid premature onQueueEmpty-driven navigation; queue refill logic improved to reduce false-positives.
- **Safer WebView interactions** — `safeInjectJS` wrapper prevents silent injection failures when the WebView is in a bad state.
- **DB helpers for chapter progress** — `markChaptersBeforePositionRead` and `resetFutureChaptersProgress` let us mark read chapters and optionally reset progress on upcoming chapters when jumping back.
- **HTML paragraph extraction improvements** — a stronger flattening strategy with block delimiters and entity decoding reduces lost text and improves TTS parsing accuracy.
- **UX & settings** — new dialogs and a `ttsForwardChapterReset` reader setting to control how future chapter progress is reset when continuing TTS.

### 📜 Commits

Range: `v2.0.6..HEAD` — 1 commit

* **chore(tts): cross-chapter TTS reliability, queue handling, and extractor improvements**
	* [edb661ce](https://github.com/bizzkoot/lnreader/commit/edb661ce)