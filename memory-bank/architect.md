# MemoriPilot: System Architect

## Overview

This file contains the architectural decisions and design patterns for the MemoriPilot project.

## Architectural Decisions

- TTS wake/resume queue handling: clear stale queue on wake start, track ttsSession, add wake-resume grace period, validate queue bounds and enforce monotonic lastSpokenIndex. Added Unified Batch playback resilience and exit dialog smart resume heuristics.

- Retry + fallback in TTSAudioManager.refillQueue to handle intermittent addToBatch rejections; try addToBatch up to 3 attempts with backoff, then if native queue is empty fallback to speakBatch to restart playback.
- Add robust retry and fallback in WebViewReader tts-queue handler to try addToBatch before falling back to injecting WebView tts.next.
- Add pendingScreenWakeSyncRef to WebViewReader to run a screen-wake sync on onLoadEnd when WebView was out-of-sync during background TTS.

1. **Decision 1**: Description of the decision and its rationale.
2. **Decision 2**: Description of the decision and its rationale.
3. **Decision 3**: Description of the decision and its rationale.

## Project Overview (Concrete)

- Name: LNReader (local fork)
- Type: React Native app with native Android modules and a WebView-based reader component. Hybrid JS/native code: TypeScript/React + Kotlin (Android) + a small C++/native helper library.
- Primary platforms: Android (first-class), iOS (present in repo but recent work targeted Android native TTS improvements).

## Top-level Structure

- `android/` — full native Android project (Gradle, native modules, generated assets). Key files:
  - `android/app/src/main/java/.../TTSForegroundService.kt` — foreground TTS service, wake-lock, queue management
  - `android/app/src/main/java/.../TTSHighlightModule.kt` — React Native module bridging native TTS events
  - `android/app/src/main/assets/js/core.js` — WebView reader runtime (tts controller, highlighting, navigation)
- `ios/` — iOS native project (AppDelegate, Swift bridging for native modules)
- `src/` — React Native TypeScript app
  - `src/screens/reader/components/WebViewReader.tsx` — coordinates WebView, TTS events, chapter navigation
  - `src/services/TTSAudioManager.ts` — JS batch queue manager for TTS playback
  - `src/services/TTSHighlight.ts` — wrapper service for native `TTSHighlight` module
  - `src/components/` — shared UI components (TTS controls, dialogs)
- `shared/` & `native/` — C++ helpers and native utilities (pugixml, epub parsers)
- `memory-bank/` — living documentation and project memory (architect.md, projectBrief.md, progress.md, decisionLog.md, activeContext.md)

## Runtime Architecture & TTS Flow

High-level flow for TTS reading:

1. WebView (`core.js`) controls paragraph iteration and layout. When TTS starts for paragraph N, WebView posts:
   - `speak` (text, now includes `paragraphIndex`)
   - `tts-state` (metadata: paragraphIndex, progress)
   - `tts-queue` (lookahead list: next 50 paragraphs starting at N+1)

2. React Native `WebViewReader.tsx` receives `tts-queue` and, when `ttsBackgroundPlayback` is enabled, calls `TTSHighlight.speakBatch()` with utterance IDs in the format `utterance_<index>`.

3. Native `TTSForegroundService` queues all utterances into Android `TextToSpeech` and acquires a persistent partial wake lock while the foreground notification is active.

4. Native service emits events via `TTSHighlightModule` (`onSpeechStart`, `onSpeechDone`, `onWordRange`, and newly `onQueueEmpty`). React Native listens via `TTSAudioManager`/`TTSHighlight`.

5. When the native queue empties, `onQueueEmpty` fires. RN `WebViewReader` checks `ttsContinueToNextChapter` and navigates/prefetches the next chapter (no reliance on WebView JS, which may be suspended when screen is off).

Design tradeoffs and rationale:

- WebView-first design gives flexibility for page layout and DOM-driven features (highlights, bionic reading). However, WebView JS may be suspended when the OS throttles background WebViews — critical for long-running TTS sessions.
- Thus, important responsibilities were moved to native/RN layers for background continuity: persistent wake-lock, native queue tracking, and `onQueueEmpty` event.

## Important Patterns & Conventions

- Bridge events: native -> RN use `DeviceEventManagerModule` (exposed via `TTSHighlight` wrapper). RN -> native uses direct RN module calls that accept `utteranceId` and options.
- Utterance id convention: `utterance_<paragraphIndex>` — ensures native events map directly to paragraph indexes for accurate highlighting.
- Batch sizes & refill policy: `BATCH_SIZE = 15`, `REFILL_THRESHOLD = 5` (JS `TTSAudioManager`), with native `addToBatch` for adding more utterances without flushing playing queue.

## Build, Run & Tooling Notes

- Build (Android release):
  ```bash
  pnpm run build:release:android
  # or for dev builds
  pnpm run dev:start && pnpm run dev:android
  ```
- Type-check & lint:
  ```bash
  pnpm run type-check
  pnpm run lint
  pnpm run format:check
  ```
- Native debug: use `adb logcat -s TTSForegroundService TTSAudioManager ReactNativeJS` to filter relevant logs.

## CI / Code Quality

- Repo uses `pnpm` with lockfile `pnpm-lock.yaml` and relies on Husky pre-commit hooks (linting). Keep `tsconfig.json` strict mode enabled.

## Persistence & State

- MMKV used for lightweight key-value storage (chapter progress, TTS button position). SQLite (via `expo-sqlite`) used for heavier data where needed.

## Performance & Safety Concerns

- Wake locks: acquire only when reading; always release in `onDestroy` and when `stopTTS()` is called. Use try/catch when acquiring/releasing to avoid app crashes on OEM variants.
- Avoid heavy DOM rebuilds while TTS is reading; WebView `core.js` includes protections to pause/skip layout recalculations during TTS operations.

## Commit Delta (vs upstream/master)

Computed against `upstream/master` at the time of this update.

Commits on this branch (upstream/master..HEAD):

- `e7aa3b86` (HEAD -> dev) Fix: TTS background playback and paragraph highlighting — add native `onQueueEmpty`, add utterance id alignment, update RN handling, commit pushed to `dev`.
- `a5e130ee` feat(tts): implement continuous TTS across chapters

If you need a full chronological log or the 16-commit delta you mentioned earlier, I can produce a full `git log --oneline <base>..HEAD` and attach it to this doc.

## Owners & Contacts

- Primary: Mobile engineering (owner name/contact should be added here)
- Secondary: Native Android engineering

## Recent TTS Architecture Update (2025-12-03)

- **Change**: Introduced native-driven TTS queue-empty detection and RN-side continuation logic.

- **Rationale**: WebView JavaScript execution can be suspended when the device sleeps or the screen is off, which breaks WebView-driven chapter transitions and queue refills for background TTS. Moving end-of-queue detection to the native TTS service ensures reliable background playback and enables RN to prefetch or navigate chapters even when the WebView runtime is inactive.

- **Implementation Notes**:
  - `TTSForegroundService.kt` now tracks queued utterance IDs and emits `onQueueEmpty` when the native queue is empty.
  - `TTSHighlightModule.kt` emits `onQueueEmpty` to React Native via `DeviceEventManager`.
  - `TTSAudioManager.ts` and `TTSHighlight.ts` were extended to listen for `onQueueEmpty` and expose a callback.
  - `WebViewReader.tsx` listens for `onQueueEmpty` and will navigate to the next chapter according to `ttsContinueToNextChapter` settings.
  - `core.js` now includes `paragraphIndex` in `speak()` postings so RN can create stable utterance IDs (`utterance_<index>`) used for highlighting.

- **Impact**: Improves reliability of background TTS, prevents unexpected stops at chapter boundaries, and keeps paragraph highlighting accurate while minimizing JS dependence during background playback.

- **Commit**: e7aa3b86 (pushed to `dev`)

## Design Considerations

- Prevented paragraph duplication/skips on screen wake cycles

- Native TTS can intermittently return non-SUCCESS; this leads to failing queue refills which stops background TTS.
- Avoid using speakBatch (QUEUE_FLUSH) unless native queue is empty to prevent interrupting currently-playing utterance.
- Keep debug logs minimal and rely on existing logDebug/logError helpers; avoid leaving experimental [DEBUG] markers.

## Components

### WebViewReader

Handles WebView messaging and wake/resume TTS queue management

**Responsibilities:**

- Queue lifecycle
- Wake handling
- Exit dialog orchestration

### TTSAudioManager

Manages TTS queue and lastSpokenIndex for monotonic enforcement

**Responsibilities:**

- Queue playback
- lastSpokenIndex tracking

### scripts/tts_wake_cycle_test.js

Local test to reproduce multi-wake queue issues

**Responsibilities:**

- Simulate wake cycles and validate queue correctness

### TTSAudioManager.refillQueue

Retry + fallback logic for addToBatch failures, with backoff and speakBatch fallback if native queue appears empty.

### WebViewReader tts-queue handler

Retry addToBatch up to 3 times before falling back to WebView-driven tts.next.

### WebViewReader screen-wake sync

pendingScreenWakeSyncRef ensures the screen-wake sync runs after WebView reloads when it was suspended during background playback.
