# GEMINI.md

## Project Overview

LNReader is a React Native application for reading light novels.

## Current Task

TTS Position Sync Fix (Completed).

- **Goal**: Fix TTS position sync issue where background TTS paused at paragraph N resumed from wrong position.
- **Result**: Fixed across 3 files. Verified for both PREV and NEXT chapter navigation.

## Key Files (TTS)

- `src/screens/reader/components/WebViewReader.tsx`: Main TTS orchestration, pause handling, Smart Resume.
- `android/app/src/main/assets/js/core.js`: WebView scroll/save logic, grace period checks.
- `android/app/src/main/java/.../TTSForegroundService.kt`: Native TTS service, `saveTTSPosition()`.
- `android/app/src/main/java/.../TTSHighlightModule.kt`: RN bridge for TTS position read/write.

## Recent Fixes

- **Native save on pause**: `stopAudioKeepService()` now calls `saveTTSPosition()`.
- **Scroll correction**: `onLoadEnd` injects correct paragraph position when TTS paused.
- **Grace period**: Blocks scroll-based saves for 2 seconds after TTS stops.
- **Smart Resume**: Fixed false trigger by updating `latestParagraphIndexRef` during pause.

## Notes

- TTS position stored in native SharedPreferences (`chapter_progress_{chapterId}`).
- MMKV/DB also store progress, initial scroll uses `max(DB, MMKV)` with native as fallback.
