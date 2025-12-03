# Project Brief

## Purpose

Define the main purpose of this project.

## Target Users

Describe who will use this.

## Recent Feature Brief — TTS Background Continuation (2025-12-03)

- **What**: Native TTS service now emits an `onQueueEmpty` event when its utterance queue fully completes. React Native listens and can navigate to the next chapter and prefetch content without relying on the WebView JavaScript runtime.

- **Why**: Users reported TTS stopping at chapter end when the screen is off. The root cause was WebView JS suspension. This native/RN hybrid fix ensures long reading sessions continue uninterrupted per user settings (`ttsContinueToNextChapter`).

- **User impact**:
	- Background reading continues across chapter boundaries when enabled.
	- Paragraph highlighting remains accurate during background playback.
	- No additional permissions required; uses existing foreground service and wake-lock handling.

- **Files / Commits**: Changes across native and JS modules; see commit `e7aa3b86` on branch `dev` for details.

## Full Project Brief (Suggested content to keep here)

This section should contain a short, consumable summary for stakeholders and new contributors. Items to include (populated below):

- Purpose: A lightweight reader for web/epub novels with advanced TTS features and text highlighting.
- Key capabilities: offline/downloaded chapters, WebView rendering, background TTS with native foreground service, paragraph-level highlights, user-configurable TTS behavior (continue to next chapter, background playback), MMKV persistence.
- Primary users: readers who consume long-form serialized fiction (novels/light-novels), power users who want continuous background listening.
- Success metrics: reduce background TTS stoppages to zero in QA runs, maintain paragraph highlighting accuracy within ±0 paragraphs, acceptable memory/CPU usage during long sessions (no OOMs), <1% crash rate per release.
- Release notes for this change: commit `e7aa3b86` — fixes background TTS stopping at chapter end and alignment of paragraph highlighting.

## QA/Release Checklist (for maintainers)

1. Run `pnpm run type-check` and `pnpm run lint` — fix issues before PR.
2. Manual QA: Start TTS on a long chapter (>100 paragraphs), enable `ttsBackgroundPlayback`, set `ttsContinueToNextChapter=continuous`, lock or turn off device screen — confirm continuous playback into next chapter(s).
3. Check logs via `adb logcat -s TTSForegroundService TTSAudioManager ReactNativeJS` to verify `onQueueEmpty` events and that `TTSForegroundService` holds/releases the wake lock as expected.
4. Verify paragraph highlighting sync when screen is on and when returning from background.
5. Run smoke tests for chapter navigation, downloads, and progress persistence.

## Recent Feature Brief — TTS Background Continuation (2025-12-03)

- **What**: Native TTS service now emits an `onQueueEmpty` event when its utterance queue fully completes. React Native listens and can navigate to the next chapter and prefetch content without relying on the WebView JavaScript runtime.

- **Why**: Users reported TTS stopping at chapter end when the screen is off. The root cause was WebView JS suspension. This native/RN hybrid fix ensures long reading sessions continue uninterrupted per user settings (`ttsContinueToNextChapter`).

- **User impact**:
	- Background reading continues across chapter boundaries when enabled.
	- Paragraph highlighting remains accurate during background playback.
	- No additional permissions required; uses existing foreground service and wake-lock handling.

- **Files / Commits**: Changes across native and JS modules; see commit `e7aa3b86` on branch `dev` for details.

