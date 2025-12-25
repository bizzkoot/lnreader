# Continuous Scrolling Audit

**Date:** 2025-12-23  
**Feature:** Continuous scrolling via DOM stitching and trimming + thresholds

## What shipped

- Multi-chapter stitched DOM: append next chapter into WebView DOM and track boundaries
- Trim previous chapter when crossing threshold
- Settings: stitch threshold and transition threshold
- Auto-mark short chapters

Key implementation is in:

- WebView runtime: [android/app/src/main/assets/js/core.js](../../../../android/app/src/main/assets/js/core.js)
- Reader bridge + save/progress: [src/screens/reader/components/WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx)
- Settings modals:
  - [src/screens/settings/SettingsReaderScreen/Modals/StitchThresholdModal.tsx](../../../src/screens/settings/SettingsReaderScreen/Modals/StitchThresholdModal.tsx)
  - [src/screens/settings/SettingsReaderScreen/Modals/TransitionThresholdModal.tsx](../../../src/screens/settings/SettingsReaderScreen/Modals/TransitionThresholdModal.tsx)

## Findings

### 1) Save/progress events can desync from the visible chapter

**Severity:** ⚠️ MAJOR  

**Where**

- Stitched DOM state is tracked in WebView: `loadedChapters`, `currentVisibleChapter`, `chapterBoundaries`  
  [core.js](../../../../android/app/src/main/assets/js/core.js#L42-L70)
- React Native save handler only rejects stale saves when `event.chapterId` is provided  
  [WebViewReader save handler](../../../src/screens/reader/components/WebViewReader.tsx#L546-L579)

**Why it’s risky**

When multiple chapters exist in the DOM, a save event with no chapterId will be interpreted as “current RN chapter”, even if the visible chapter in the WebView is different.

This becomes a correctness issue for:

- Unified paragraph-index progress (`chapter_progress_${chapter.id}`)
- Resume positions
- “Mark read” behavior across chapters

**Fix (actionable)**

- Enforce `chapterId` presence for *all* `save` events emitted by the WebView layer, especially in stitched mode.
- Additionally, in RN:
  - If continuous scroll is enabled **or** if WebView reports multiple loaded chapters, reject any save event that lacks chapterId.

---

### 2) WebView console logging can hurt scroll smoothness

**Severity:** ⚠️ MAJOR

**Where**

- `core.js` globally disables the no-console lint rule and logs frequently (scroll-driven pathways). Example warning log output:
  [core.js boundary mismatch warning](../../../../android/app/src/main/assets/js/core.js#L494-L505)

**Standard check (verified)**

React Native performance docs warn console statements can bottleneck the JS thread in production builds and cause dropped frames.

- https://reactnative.dev/docs/performance

**Fix**

- Replace global `/* eslint-disable no-console */` with conditional logging behind `DEBUG`.
- Ensure production builds set `DEBUG=false`.

---

### 3) Auto-mark short chapter uses a fixed 500ms delay

**Severity:** 🔧 MINOR

**Where**

- `checkShortChapterAutoMark` waits a fixed `setTimeout(..., 500)` before measuring layout and possibly marking as read.  
  [core.js](../../../../android/app/src/main/assets/js/core.js#L94-L141)

**Why**

Images and fonts might load after 500ms, which can cause false positives (chapter marked read early).

**Fix**

- Replace fixed timeout with “layout stable” approach:
  - If images exist, wait for `load` events or poll until image `complete===true`.
  - Or do a 2–3 frame `requestAnimationFrame` settle loop before measuring.

---

### 4) Threshold settings UX lacks guardrails

**Severity:** 🔧 MINOR

**Where**

- Stitch threshold selection UI:  
  [StitchThresholdModal.tsx](../../../src/screens/settings/SettingsReaderScreen/Modals/StitchThresholdModal.tsx)

**Why**

Thresholds are power-user settings. Without guardrails, users may select extreme values and blame the app for load lag or memory usage.

**Fix**

- Add copy under settings rows describing tradeoffs:
  - Earlier stitch ⇒ smoother transitions but more preloading.
  - Later stitch ⇒ less background work but more visible loading.
- Add “Reset to defaults” affordance.

## Suggested Tests

- E2E-ish integration test: stitch → trim → resume → ensure chapterId + paragraphIndex stay consistent.
- Unit test: RN side rejects save events with no chapterId when continuous scrolling is enabled.
