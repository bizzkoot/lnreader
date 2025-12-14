# Active Context

## Current Goals

- WebViewReader Refactor - Phase 2 Planning Complete
- ## Current State
- - Phase 1 (TTS extraction + critical chapter sync fixes) ✅ COMPLETE
- - Phase 2 (100% functional parity) 📋 PLANNED - awaiting implementation
- ## Critical Gaps Identified
- 1. **Background TTS Chapter Navigation Effect** (CRITICAL) - Media controls PREV/NEXT don't work during background playback
- 2. **Full Wake Handling** (HIGH) - Screen wake during TTS causes WebView/position desync
- 3. **Wake Sync Chapter Mismatch Handler** (HIGH) - Chapter mismatch after wake not auto-resolved
- ## Implementation Plan Created
- - Detailed 3-step plan in `docs/analysis/WebViewReader-refactor-fixes.md`
- - Step 1: Background TTS effect (1-2 hours)
- - Step 2: Full wake handling (3-4 hours)
- - Step 3: Wake sync chapter mismatch (2-3 hours)
- - Step 4: Testing & validation (2-3 hours)
- - Total: ~8-12 hours for 100% parity
- ## Next Action
- Awaiting user approval to begin Step 1 implementation (Background TTS Chapter Navigation Effect)

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
