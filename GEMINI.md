# GEMINI.md

## Project Overview

LNReader is a React Native application for reading light novels.

## Current Task

TTS Regressions Fix (Completed 2025-12-23).

- **Goal**: Fix two regressions from commit 2d72b94: (1) TTS per-novel settings toggle not enabling, (2) Chapter title duplication.
- **Result**: Both fixed. Portal context issue resolved by passing novel as props. Detached DOM visibility check fixed by using inline style check.

## Key Files (TTS)

- `src/screens/reader/hooks/useTTSController.ts`: Main TTS orchestration, `onQueueEmpty` handler, download wait logic.
- `android/app/src/main/assets/js/core.js`: WebView scroll/save logic, `enhanceChapterTitles()` function.
- `android/app/src/main/java/.../TTSForegroundService.kt`: Native TTS service, `saveTTSPosition()`.
- `android/app/src/main/java/.../TTSHighlightModule.kt`: RN bridge for TTS position read/write.

## Recent Fixes (2025-12-23)

### 1. TTS Per-Novel Settings Toggle
- **Root Cause**: `@gorhom/bottom-sheet` uses React Portal which renders outside normal React tree, breaking context.
- **Fix**: Pass `novel` as props through `ReaderScreen` → `ReaderBottomSheetV2` → `ReaderTTSTab`.
- **Files**: `ReaderScreen.tsx`, `ReaderBottomSheet.tsx`, `ReaderTTSTab.tsx`.

### 2. Chapter Title Duplication
- **Root Cause**: Temp div had `visibility:hidden`, `getComputedStyle()` inherited this, making all elements appear hidden.
- **Fix**: Don't append temp div to document. Check only inline styles for explicit `display:none`/`visibility:hidden`.
- **File**: `core.js` - `enhanceChapterTitles()` function.

## Notes

- TTS position stored in native SharedPreferences (`chapter_progress_{chapterId}`).
- MMKV/DB also store progress, initial scroll uses `max(DB, MMKV)` with native as fallback.
- Debug logs in `core.js` and `ReaderTTSTab.tsx` only output when `__DEV__` is true (development builds).
