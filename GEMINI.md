# GEMINI.md

## Project Overview

LNReader is a React Native application for reading light novels.

## Current Task

TTS Per-Novel Settings Auto-Load Fix (2025-12-25).

- **Goal**: Fix TTS per-novel settings to auto-load on reader entry, not just when opening TTS tab.
- **Result**: Fixed. Settings now sync to MMKV on novel entry; reset to global defaults when switching novels.

## Key Files (TTS)

- `src/screens/reader/hooks/useTTSController.ts`: Main TTS orchestration, `onQueueEmpty` handler, download wait logic.
- `src/screens/reader/components/WebViewReader.tsx`: Per-novel TTS settings initialization.
- `src/services/tts/novelTtsSettings.ts`: Per-novel TTS settings storage.
- `android/app/src/main/assets/js/core.js`: WebView scroll/save logic, `enhanceChapterTitles()` function.
- `android/app/src/main/java/.../TTSForegroundService.kt`: Native TTS service, `saveTTSPosition()`.
- `android/app/src/main/java/.../TTSHighlightModule.kt`: RN bridge for TTS position read/write.

## Recent Fixes

### Filter Icon Crash in Browse Source Screen (2025-12-25)
- **Root Cause**: `clampUIScale(undefined)` returned `NaN` when `uiScale` was missing from MMKV storage (partial data from older app versions).
- **Fix**: Added defensive null checks in `scaling.ts` and `useSettings.ts` to default `uiScale` to `1.0`.
- **Files**: `src/theme/scaling.ts`, `src/hooks/persisted/useSettings.ts`.

### TTS Per-Novel Settings Auto-Load (2025-12-25)
- **Root Cause**: `WebViewReader.tsx` updated only local ref (`readerSettingsRef`) on novel entry, not MMKV.
- **Fix**: Call `setChapterReaderSettings({ tts: stored.tts })` to sync settings to MMKV. Reset to global defaults when novel has no per-novel settings.
- **File**: `WebViewReader.tsx` - useEffect at lines 207-250.

### TTS Per-Novel Settings Toggle (2025-12-23)
- **Root Cause**: `@gorhom/bottom-sheet` uses React Portal which renders outside normal React tree, breaking context.
- **Fix**: Pass `novel` as props through `ReaderScreen` → `ReaderBottomSheetV2` → `ReaderTTSTab`.
- **Files**: `ReaderScreen.tsx`, `ReaderBottomSheet.tsx`, `ReaderTTSTab.tsx`.

### Chapter Title Duplication (2025-12-23)
- **Root Cause**: Temp div had `visibility:hidden`, `getComputedStyle()` inherited this, making all elements appear hidden.
- **Fix**: Don't append temp div to document. Check only inline styles for explicit `display:none`/`visibility:hidden`.
- **File**: `core.js` - `enhanceChapterTitles()` function.

## Notes

- TTS position stored in native SharedPreferences (`chapter_progress_{chapterId}`).
- MMKV/DB also store progress, initial scroll uses `max(DB, MMKV)` with native as fallback.
- Debug logs in `core.js` and `ReaderTTSTab.tsx` only output when `__DEV__` is true (development builds).

