# Active Context

## Current Goals

- TTS progress regression (release Android): standardized progress % to paragraph-based for all WebView TTS save events; ensured Novel chapter list re-renders on progress updates; tests/type-check passing. Preparing commit + push.

## Key Files Modified (TTS Progress Sync)

- `android/app/src/main/.../TTSForegroundService.kt`: SharedPreferences, saveTTSPosition(), getters
- `android/app/src/main/.../TTSHighlightModule.kt`: getSavedTTSPosition() bridge method
- `src/services/tts/TTSHighlight.ts`: TypeScript wrapper for getSavedTTSPosition()
- `src/screens/reader/components/WebViewReader.tsx`: nativeTTSPosition state, async fetch, 3-way max
- `src/__tests__/TTSMediaControl.test.ts`: 5 new tests for TTS position sync
- `specs/Enhanced-media-control/PRD.md`: Documentation updated
- `specs/Enhanced-media-control/TASKS.md`: Phase 3 marked complete

## Test Commands

```bash
# Run all tests
pnpm test

# Run specific TTS tests
pnpm test -- --testPathPattern=TTSMediaControl

# Type check
pnpm run type-check

# Lint
pnpm run lint

# Android release build
pnpm run build:release:android
```

## Current Blockers

- None (Ready for git commit and manual verification)
