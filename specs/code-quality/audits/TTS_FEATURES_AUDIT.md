# TTS Features Audit

**Date:** 2025-12-23  
**Scope:** TTS changes since v2.0.12 (per-novel settings, stitched restart fixes, EPUB TTS sync, queue manager hardening, media notification)

## Relevant files

- Reader and bridge:
  - [src/screens/reader/components/WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx)
  - [android/app/src/main/assets/js/core.js](../../../../android/app/src/main/assets/js/core.js)
- TTS controller and audio manager:
  - [src/screens/reader/hooks/useTTSController.ts](../../../src/screens/reader/hooks/useTTSController.ts)
  - [src/services/TTSAudioManager.ts](../../../src/services/TTSAudioManager.ts)
- Per-novel settings:
  - [src/services/tts/novelTtsSettings.ts](../../../src/services/tts/novelTtsSettings.ts)
  - [src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx](../../../src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx)
- EPUB TTS sync tests:
  - [src/screens/reader/components/__tests__/chapterTitleEnhancement.test.ts](../../../src/screens/reader/components/__tests__/chapterTitleEnhancement.test.ts)
- Android media notification + service:
  - [android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt](../../../../android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt)

## Findings

## 1) Per-novel TTS settings: “stable ID” ambiguity (library vs local EPUB)

**Severity:** 🚨 CRITICAL

**Where**

- Storage key requires numeric `novelId`:  
  [novelTtsSettings.ts](../../../src/services/tts/novelTtsSettings.ts#L1-L25)
- Reader UI assumes per-novel identity is available:  
  [ReaderTTSTab.tsx](../../../src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx#L120-L160)

**Why it matters**

Per-novel settings are conceptually “per item being read”. For local EPUB or other reader contexts where a DB `novel.id` may not be reliable/stable/numeric, the feature becomes misleading or broken.

**Fix options**

- Option A (safe UX): disable/hide toggle if `typeof novel.id !== 'number'` or `novel.isLocal === true`, with explanatory text.
- Option B (complete feature): introduce stable `localBookId` for EPUB reader and store separately via `LOCAL_TTS_SETTINGS_${localBookId}`.

---

## 2) Per-novel overrides applied by mutating refs without guaranteeing visible UI sync

**Severity:** ⚠️ MAJOR

**Where**

- Per-novel override effect mutates `readerSettingsRef.current` and pushes settings into WebView:
  [WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx#L120-L155)

**Why**

This ensures behavior changes, but it is possible for UI controls (sliders/voice picker) to lag behind until their own sync passes run.

**Fix**

- When applying per-novel override, also call the same state update path used by settings UI: `setChapterReaderSettings({ tts: merged })` so the UI remains consistent.

---

## 3) WebViewReader has production-path console logging

**Severity:** ⚠️ MAJOR

**Where**

- Adjacent chapter refs update logs:  
  [WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx#L155-L175)
- Save handler logs:  
  [WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx#L585-L606)

**Standard check (verified)**

React Native performance docs recommend removing console usage from production bundles due to JS thread bottlenecks.

- https://reactnative.dev/docs/performance

**Fix**

- Gate logs behind `__DEV__` or a debug flag.
- Optionally adopt `babel-plugin-transform-remove-console` for production builds (RN docs recommended).

---

## 4) TTSAudioManager: robust, but “boolean soup” increases regression risk

**Severity:** ⚠️ MAJOR

**Where**

- Multiple concurrency / lifecycle flags: `restartInProgress`, `refillInProgress`, `hasQueuedNativeThisSession`, `lastSpokenIndex`, etc.
  [TTSAudioManager.ts](../../../src/services/TTSAudioManager.ts#L40-L130)

**Why**

This is effectively a state machine implemented with many booleans. It works, but it is harder to prove correct.

**Fix**

- Replace with explicit state enum:
  - Idle → Starting → Playing → Refilling → Playing → Stopping
  - Include dev assertions for illegal transitions.

---

## 5) Media notification: correct choice to keep 5 actions (seek bar tradeoff)

**Severity:** ✅ Strength

**Where**

- Notification uses `MediaStyle()` and specifies compact actions indices:
  [TTSForegroundService.kt](../../../../android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt)

**Standard check (verified)**

`MediaStyle.setShowActionsInCompactView` supports promoting up to 3 actions in compact view, while expanded view can show more actions.

- https://developer.android.com/reference/androidx/media/app/NotificationCompat.MediaStyle

**Notes / improvements**

- Consider `Notification.Action.Builder.setAuthenticationRequired(true)` for actions that should not be invokable from lockscreen without unlock, if any action is sensitive.
  (Android notification docs discuss lock screen action behavior.)

## Suggested Tests

- Add unit tests for per-novel override application to ensure UI + runtime get same effective settings.
- Add tests for TTSAudioManager transition logic if you refactor to a state enum.
