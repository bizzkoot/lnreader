# GEMINI.md

## Project Overview

LNReader is a React Native application for reading light novels.

## Current Task

TTS Auto-Advance Fix (Completed).

- **Goal**: Fix TTS to always start from paragraph 0 when auto-advancing to next chapter and wait for auto-download to complete.
- **Result**: Fixed in `useTTSController.ts`. Added download polling with 30s timeout and notification status updates.

## Key Files (TTS)

- `src/screens/reader/hooks/useTTSController.ts`: Main TTS orchestration, `onQueueEmpty` handler, download wait logic.
- `android/app/src/main/assets/js/core.js`: WebView scroll/save logic, grace period checks.
- `android/app/src/main/java/.../TTSForegroundService.kt`: Native TTS service, `saveTTSPosition()`.
- `android/app/src/main/java/.../TTSHighlightModule.kt`: RN bridge for TTS position read/write.

## Recent Fixes

- **Force Paragraph 0**: `onQueueEmpty` now sets `forceStartFromParagraphZeroRef.current = true` before navigating.
- **Download Wait**: Checks if next chapter is downloaded; if not, polls every 1.5s with 30s timeout.
- **Notification Update**: Shows "Downloading next chapter..." in notification during download wait.
- **Graceful Timeout**: Shows timeout toast and stops TTS if download doesn't complete in 30s.

## Notes

- TTS position stored in native SharedPreferences (`chapter_progress_{chapterId}`).
- MMKV/DB also store progress, initial scroll uses `max(DB, MMKV)` with native as fallback.
- Translation strings added: `readerScreen.tts.downloadingNextChapter`, `readerScreen.tts.downloadComplete`, `readerScreen.tts.downloadTimeout`.
