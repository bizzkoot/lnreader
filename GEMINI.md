# GEMINI.md

## Project Overview

LNReader is a React Native application for reading light novels.

## Current Task

TTS Sleep Timer + Smart Rewind Implementation (2025-12-27).

- **Goal**: Add sleep timer (stop after N minutes/paragraphs/end of chapter) and smart rewind (rewind N paragraphs on resume after long pause).
- **Result**: Implemented. Settings in `useSettings.ts`, `SleepTimer.ts` service, controller hooks, UI in `ReaderTTSTab.tsx`. All 917 tests passing.

## Key Files (TTS)

- `src/screens/reader/hooks/useTTSController.ts`: Main TTS orchestration, sleep timer integration hooks.
- `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx`: TTS settings UI including sleep timer/smart rewind.
- `src/services/tts/SleepTimer.ts`: Sleep timer service with 3 modes (minutes, endOfChapter, paragraphs).
- `src/services/tts/novelTtsSettings.ts`: Per-novel TTS settings storage.
- `src/hooks/persisted/useSettings.ts`: TTS settings including sleep timer and smart rewind defaults.
- `android/app/src/main/assets/js/core.js`: WebView scroll/save logic.

## Recent Fixes

### MainActivity Startup Crash (2025-12-27)
- **Root Cause**: `window.insetsController` accessed before `super.onCreate()`, causing NPE when DecorView was null.
- **Fix**: Move `super.onCreate()` before WindowInsetsController API usage.
- **File**: `MainActivity.kt` - `onCreate()` method.

### Upstream PR Adoptions (2025-12-27)
- **PR #1573**: Added `'style'` attribute to `<span>` tags in `sanitizeChapterText.ts` for EPUB styling preservation.
- **PR #1599**: Added `clean_summary()` function to `Epub.cpp` to strip HTML tags and convert entities in EPUB summaries.
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

