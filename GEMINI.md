# GEMINI.md

## Project Overview
LNReader is a React Native application for reading light novels.

## Current Task
TTS Progress Save Refinement - **COMPLETED**
- **Goal**: Fix background TTS progress stagnation, implement cross-chapter TTS state tracking.
- **Status**: Implementation complete. TypeScript check passed.
- **Key Changes**:
  1. Background TTS % now calculated from `totalParagraphsRef` instead of stale scroll position
  2. Added `ttsForwardChapterReset` setting with 'reset-all' | 'reset-unread' | 'keep' options
  3. Cross-chapter dialog shows when user starts TTS from earlier chapter
  4. Forward chapters' progress reset when user confirms restart from earlier chapter

## Key Files
- `src/screens/reader/components/WebViewReader.tsx`: TTS logic, cross-chapter dialog
- `src/hooks/persisted/useSettings.ts`: Settings including `ttsForwardChapterReset`
- `src/database/queries/ChapterQueries.ts`: `getChaptersBetweenPositions`, `resetChaptersProgress`
- `src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx`: Settings UI

## Notes
- The `TTS_LAST_POSITION` MMKV key stores global TTS position for cross-chapter tracking
- `saveGlobalTTSPosition()` called on 'stop-speak' event
- `checkCrossChapterTTS()` called on 'speak' event to detect backward navigation
