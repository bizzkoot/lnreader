# Active Context

## Current Goals

- 2025-12-24: Post-format health check. Fix lint break (duplicate import), document current lint warnings (deferred), update action plan + memory bank, then commit and push to origin/dev.

## Key Files Modified (This Session)

### TTS Per-Novel Settings Toggle Fix
- `src/screens/reader/ReaderScreen.tsx`: Pass `novel` prop to ReaderBottomSheetV2
- `src/screens/reader/components/ReaderBottomSheet/ReaderBottomSheet.tsx`: Accept `novel` prop, pass to ReaderTTSTab
- `src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx`: Accept `novel` as prop instead of context (Portal breaks context chain)

### Chapter Title Detection Fix
- `android/app/src/main/assets/js/core.js`: Fixed `enhanceChapterTitles()` to use inline style check instead of getComputedStyle (which fails in detached DOM)

## Root Causes Fixed

1. **Portal Context Issue**: `@gorhom/bottom-sheet` uses React Portal which renders content outside normal React tree, breaking context from `ChapterContextProvider`. Solution: Pass `novel` as props through component chain.

2. **Detached DOM Visibility**: Temp div had `visibility:hidden`, and `getComputedStyle()` inherits this. All elements appeared hidden, skipping pattern matching. Solution: Don't append temp div to document, check only inline styles for explicit hiding.

## Test Commands

```bash
# Run all tests
pnpm test

# Type check
pnpm run type-check

# Lint
pnpm run lint

# Android release build
pnpm run build:release:android
```

## Current Blockers

- None (Ready for git commit)
