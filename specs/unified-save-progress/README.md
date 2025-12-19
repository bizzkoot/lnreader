# Unified Progress Tracking

> **Date**: December 18, 2025  
> **Status**: ✅ Implemented & Tested

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Architecture](#architecture)
- [Implementation Files](#implementation-files)
- [Testing](#testing)
- [Migration Guide](#migration-guide)

## Overview

This specification documents the unification of progress tracking for both manual scrolling and TTS (Text-to-Speech) playback in LNReader. The implementation establishes **paragraph index as the single source of truth** stored in MMKV, replacing the previous multi-source approach that used scroll percentages, MMKV, and native SharedPreferences.

## Problem Statement

### Issues Identified

1. **Incorrect TTS Resume Prompt**: Completed chapters triggered resume dialog
2. **Progress Not Visible**: Chapter list didn't show progress for active TTS sessions
3. **Inconsistent Resume Position**: Reader sometimes started from beginning despite saved progress
4. **Complex Multi-Source Logic**: Three different sources (DB%, MMKV paragraph, Native SharedPreferences) created race conditions

### Root Causes

1. `getRecentReadingChapters()` query didn't exclude `unread = 0` chapters
2. Scroll-based progress calculation differed from TTS paragraph-based tracking
3. Native position async fetch could override MMKV with stale data
4. Redundant SharedPreferences saving in native code

## Solution

### Design Principles

1. **Single Source of Truth**: MMKV `chapter_progress_${chapterId}` stores paragraph index
2. **Unified Calculation**: Both scroll and TTS use `(paragraphIndex + 1) / totalParagraphs * 100`
3. **Simplified Logic**: Removed native SharedPreferences and async position fetching
4. **Consistent Behavior**: Same resume experience for both manual and TTS reading

### Key Benefits

| Before                           | After                          |
| -------------------------------- | ------------------------------ |
| 3 sources: DB%, MMKV, Native     | 1 source: MMKV paragraph index |
| Scroll % ≠ TTS paragraph         | Unified paragraph-based %      |
| Race conditions with async fetch | Synchronous MMKV read          |
| Complex reconciliation logic     | Simple `Math.max()` fallback   |

## Architecture

### Data Flow

```
┌─────────────────┐
│  User Action    │
│ (Scroll/TTS)    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Find Most Visible Paragraph     │
│ (Intersection with viewport)    │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ Calculate Progress               │
│ (para + 1) / total * 100        │
└────────┬────────────────────────┘
         │
         ├──────────────┬──────────────┐
         ▼              ▼              ▼
    ┌────────┐    ┌────────┐    ┌──────────┐
    │   DB   │    │  MMKV  │    │  WebView │
    │ (%)    │    │ (index)│    │  (sync)  │
    └────────┘    └────────┘    └──────────┘
```

### Resume Flow

```
┌──────────────────┐
│ Chapter Opens    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Read MMKV paragraph index        │
│ (synchronous, no async wait)     │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Scroll to paragraph              │
│ scrollIntoView({ block: center })│
└──────────────────────────────────┘
```

## Implementation Files

See [CHANGES.md](./CHANGES.md) for detailed file-by-file changes.

### Summary

| File                      | Type       | Change                           |
| ------------------------- | ---------- | -------------------------------- |
| `core.js`                 | JavaScript | Progress from paragraph position |
| `ChapterQueries.ts`       | TypeScript | Added `unread = 1` filter        |
| `WebViewReader.tsx`       | TypeScript | MMKV-only initialization         |
| `useTTSController.ts`     | TypeScript | Removed native position fetch    |
| `TTSForegroundService.kt` | Kotlin     | Removed `saveTTSPosition()`      |
| `TTSHighlightModule.kt`   | Kotlin     | Removed `getSavedTTSPosition()`  |
| `TTSHighlight.ts`         | TypeScript | Removed native methods           |

## Testing

### Automated Tests

```bash
pnpm run test
```

**Results**: ✅ All 533 tests passed

### Manual Testing Scenarios

| Scenario                              | Expected Behavior                 | Status  |
| ------------------------------------- | --------------------------------- | ------- |
| Scroll 50% → exit → re-enter          | Resume at same paragraph (center) | To Test |
| TTS 50% → exit → chapter list         | Shows ~50% progress               | To Test |
| Background TTS → app killed           | Resume from last paragraph        | To Test |
| Complete chapter via TTS → open later | No conflict dialog                | To Test |

## Migration Guide

### No Breaking Changes

This is a **transparent migration** - existing progress data remains compatible:
- Old DB progress values (%) continue to work
- MMKV paragraph indices are preserved
- Users experience seamless transition

### For Developers

If you're adding new progress-tracking features:

1. **Always use MMKV**: `MMKVStorage.getNumber(\`chapter_progress_\${chapterId}\`)`
2. **Calculate % from paragraph**: `Math.round((index + 1) / total * 100)`
3. **Don't use native position**: Native SharedPreferences removed

### Rollback Plan

If issues arise, revert these commits:
1. Core.js progress calculation
2. WebViewReader.tsx MMKV-only init
3. Native Kotlin cleanup
4. Test updates

Git tags: `unified-progress-v1.0`

---

**See Also**:
- [CHANGES.md](./CHANGES.md) - Detailed code changes
- [TESTING.md](./TESTING.md) - Test plan and results
- [SCENARIOS.md](./SCENARIOS.md) - All progress tracking scenarios
