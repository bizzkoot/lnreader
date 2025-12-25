---
applyTo: '**'
---

# Coding Preferences

- Style: 2 spaces, single quotes, trailing commas, no tabs (project Prettier / TS settings).
- TypeScript: strict mode; avoid unused locals, prefer explicit types for public APIs.
- Testing: use existing Jest tests; include small focused unit tests for new features.
- UX: keep labels concise and avoid duplicate markers (e.g., LOCAL duplicated twice).

# Project Architecture

- Core TTS services live under `src/services` (TTSHighlight.ts, VoiceMapper.ts, AUTHORITATIVE_VOICE_MAP).
- UI voice selection lives in `src/screens/settings/SettingsReaderScreen/Modals/VoicePickerModal.tsx`.
- Data extraction / generation tooling under `scripts/` (extract-voice-data-final.js, generate-english-high-voices.js).

# Solutions Repository

- Voice mapping: `getVoiceMapping(identifier)` returns VoiceMapping and sets `matchedNativeType` when matched via nativeIds (values: 'local'|'network'|'unknown').
- Display names: `formatVoiceName()` in `TTSHighlight` now produces simplified labels: "English (UK) — Male 1 — Clear — LOCAL" and prefers matchedNativeType tag over quality inference.
- Authoritative data: `src/services/authoritative-voice-map.ts` contains curated voice metadata sourced from web-speech-recommended-voices and used as the canonical mapping.

# Recent Changes

- Added `matchedNativeType` to VoiceMapping to distinguish local vs network native IDs.
- Removed duplicate native badge rendering in `VoicePickerModal` (single source of truth is formatVoiceName()).
- Added scripts to regenerate authoritative voice data and report (scripts/).
- Fixed Gradle 8.14.3 configuration cache compatibility (2025-12-08): Updated `android/settings.gradle` to use single-chain provider approach with `.map()` for Expo path resolution, eliminating external process errors. Increased Metaspace from 512m to 1024m in `android/gradle.properties` to prevent memory warnings.

# 2025-12-07: TTS runtime fixes & safety additions

- Added safeInjectJS and validateAndClampParagraphIndex helpers (src/screens/reader/components/ttsHelpers.ts) to make WebView injections safer and clamp resume indices.
- WebViewReader.tsx: improved screen-wake resume (capture/verify chapter id and paragraph, clamp resume indexes), added `request-tts-exit` handling and `TTSExitDialog` + `TTSChapterSelectionDialog`, tightened save-event validation during chapter transitions, and fixed multiple resume/auto-start corner cases.
- TTSAudioManager.ts: increased batch size and refill threshold, added `hasRemainingItems()` and hardened the onQueueEmpty handler to ignore false-empty signals while refill/state operations are in progress.
- TTSHighlight.ts: added hasRemainingItems wrapper + onVoiceFallback event type and minor improvements to highlight/queue logic.
- htmlParagraphExtractor.ts: improved extraction logic (block-level delimiters, entity decoding, robust splitting) to better match WebView DOM traversal when WebView is suspended.
- AccessibilityTab.tsx: added UI for `ttsForwardChapterReset` and confirmation dialog for destructive reset-all behaviour; minor UX improvements for sliders and voice change handling.

- Cross-chapter progress updates (2025-12-07): DB and UI fixes to ensure consistent states when using TTS "Start Here" and reset flows: `markChaptersBeforePositionRead` sets `progress = 100` along with `unread = 0`; `resetFutureChaptersProgress` sets `unread = 1` with `progress = 0`; added `getRecentReadingChapters()` selector and improved `WebViewReader` + `TTSChapterSelectionDialog` UX to present up to 3 conflicting active chapters and overflow warning.

- WebView security hardening (2025-12-12): Added `src/utils/webviewSecurity.ts` utilities for reader WebViews: strict local-only navigation (`onShouldStartLoadWithRequest`), nonce injection (`window.__LNREADER_NONCE__`) and nonce-validated message parsing + rate limiting. Updated `android/app/src/main/assets/js/core.js` to attach nonce to all bridge messages.

# 2025-12-20: Continuous Scrolling Bug Fixes

- Fixed critical stack overflow in `manageStitchedChapters()` (android/app/src/main/assets/js/core.js): Replaced nested O(n²) loop with optimized O(n) "find first visible paragraph" approach with early exit. Added safety checks for empty boundaries and null elements.
- Fixed missing boundaries initialization: Added boundary creation for first chapter after `hasPerformedInitialScroll` flag is set in `calculatePages()`. Handles both saved position and no-saved-position cases.
- Added Settings UI for auto-trim threshold: Created `TransitionThresholdModal.tsx` component (cloned from ChapterBoundaryModal pattern) with options 5%, 10%, 15%, 20%. Updated `NavigationTab.tsx` to display threshold selector when continuous scrolling is enabled.
- **Performance Pattern**: When checking DOM element visibility in scroll handlers, always use early exit strategy - find first visible element and stop. Avoid nested loops with `getBoundingClientRect()` calls (expensive at scale with 400+ paragraphs).
- **Modal Pattern**: For new settings modals, clone existing modal components (ChapterBoundaryModal.tsx, ContinuousScrollingModal.tsx) which include Portal, RadioButton, theme support, and UI scaling.
- **Boundary Initialization Pattern**: Initialize chapter boundaries after DOM is stable (after initial scroll completes) with check `if (chapterBoundaries.length === 0)` to prevent duplicate initialization.

Files modified in this set:

- android/app/src/main/assets/js/core.js
- src/screens/settings/SettingsReaderScreen/tabs/NavigationTab.tsx
- src/screens/settings/SettingsReaderScreen/Modals/TransitionThresholdModal.tsx (NEW)

Files modified in this set:

- src/screens/reader/components/WebViewReader.tsx
- src/screens/reader/components/ttsHelpers.ts
- src/services/TTSAudioManager.ts
- src/services/TTSHighlight.ts
- src/utils/htmlParagraphExtractor.ts
- src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx

Action / Next checks

- Verify MMKV <-> DB sync stability in the wild (add save-source debug logging).
- Add targeted unit tests around resume/index clamping and onQueueEmpty false-positive scenarios.

# Notes / Next Actions

- Keep `authoritative-voice-map.ts` up-to-date from web-speech-recommended-voices when possible.
- Add cross-language voice mappings in future iterations (currently English-focused dataset added).

---

# 2025-12-23: P1 Code Quality Fixes Completion

## WebView Message Format Standardization
- **Pattern**: Single-parse security wrapper with optional timestamp field
- **Implementation**: `parseWebViewMessage()` utility enforces single JSON.parse
- All messages flow through security validator (nonce + type whitelist + rate limiting)
- Timestamp field (`ts?: number`) optional but validated when present (rejects ≤ 0)
- Consolidated duplicate logging handler into main parse flow
- **Tests**: 5 new timestamp validation tests + 4 existing security tests = 9 total passing
- **Files**: webviewSecurity.ts, WebViewReader.tsx, core.js
- **Key insight**: Audit concern was preventative - no double-parse patterns existed, enhancement adds timestamp for replay attack prevention

## TTS State Machine Pattern
- **Pattern**: Explicit state enum replaces boolean soup (reduces 64 possible states to 5 valid ones)
- **States**: IDLE → STARTING → PLAYING → REFILLING → STOPPING → IDLE
- **Validator**: `assertValidTransition()` catches invalid transitions in dev mode (console.error)
- **Implementation**: TTSState.ts enum + TTSAudioManager.ts refactor
- Replaced flags: `isPlaying`, `restartInProgress`, `refillInProgress` → single `state: TTSState`
- Helper method: `transitionTo(newState)` validates + logs transitions in __DEV__
- Backward compatibility: Deprecated methods `isRestartInProgress()`, `isRefillInProgress()` maintained for external code
- **Tests**: Updated 7 test suites + added 7 new state transition tests = 625 total tests passing
- **Benefit**: Eliminates race conditions (atomic state checks), clearer lifecycle, easier debugging

## UI Scale Safe Boundaries
- **Pattern**: Clamp user input to safe ranges before storage to prevent UX disasters
- **Range**: 0.8-1.3 (80%-130%) prevents extreme values
- **Implementation**: `clampUIScale()` in scaling.ts
- Applied at: utility function (scaleDimension auto-clamps), storage hook (read/write), UI sliders (min/max bounds)
- **Prevents**:
  - Text illegibility: <80% makes 14px → 11px (minimum readable)
  - Layout overflow: >130% causes modals to clip offscreen
  - Touch target failures: <80% reduces 44dp targets to 35dp (still usable)
- **Tests**: 16 new tests covering clamping, scaling, and UX disaster scenarios, all passing
- Migration: Existing users with 0.2 or 1.5 automatically clamped on next app load
- Future consideration: Split `textScale` (0.8-1.2) + `layoutScale` (0.5-1.5) deferred to separate feature (Option B)
- **Files**: scaling.ts, useSettings.ts, OnboardingScreen.tsx, SettingsAppearanceScreen.tsx

## Code Quality Patterns Learned

### State Management
- Boolean flags → Enums when >2 flags represent lifecycle
- Always add transition validators in dev mode
- Keep deprecated methods for backward compatibility
- Document state transitions explicitly

### Security & Validation
- Single-parse + validation at entry point
- Optional fields should validate when present (warn, don't fail)
- Timestamp fields useful for debugging, not just security
- Consolidate duplicate parsers into single validated flow

### User Input Clamping
- Clamp at multiple layers: utility, storage, UI
- Document "why" for ranges (UX disasters at extremes)
- Provide migration for existing out-of-range values
- Test extreme values explicitly (0, negative, Infinity)

### Testing Strategy
- Add positive + negative + edge case tests
- Test backward compatibility explicitly
- State transition tests validate sequences, not just individual states
- Clamping tests should include real-world UX scenarios (text size, button height, touch targets)

---

## applyTo: '\*\*'

# Coding Preferences

- Use project's existing style (2 spaces, single quotes, trailing commas)
- Path aliases: `@components`, `@utils`, `@hooks`, `@services`, etc.
- No console.log (use conditional logging with **DEV**)
- Use TypeScript strict mode

# Project Architecture

- React Native + WebView for reader (native modules for TTS, file access)
- TTS: Native Android service (`TTSForegroundService.kt`) + RN bridge (`TTSHighlightModule.kt`) + JS module (`TTSAudioManager.ts`)
- Reader: WebView with JS (`core.js`) communicates with RN via `postMessage`/`injectJavaScript`
- When screen is off, WebView JS is suspended - use RN-side logic for background operations

# Solutions Repository

## TTS Background Playback (2025-12-03)

- **Problem**: TTS fails to continue to next chapter when screen is off
- **Cause**: WebView JS is suspended, so `navigateChapter()` doesn't trigger new JS execution
- **Solution**:
  1. Set `backgroundTTSPendingRef = true` before navigation
  2. Watch for `chapter.id` + `html` changes in useEffect
  3. Extract paragraphs from HTML using regex (`htmlParagraphExtractor.ts`)
  4. Start TTS batch directly from RN

## Stale Paragraph Index (2025-12-03)

- **Problem**: "updateState index X out of bounds" during chapter transition
- **Cause**: Old utterance IDs (e.g., `utterance_179`) still arriving after navigating to new chapter
- **Solution**: Reset `currentParagraphIndexRef = 0` on chapter change + bounds check in `highlightParagraph()`

## Log Spam Reduction (2025-12-03)

- **Problem**: "No more items to refill" logged on every `onSpeechDone` after queue exhausted
- **Solution**: Added `hasLoggedNoMoreItems` flag to only log once per batch

## Cross-Chapter Event Pollution (2025-12-03)

- **Problem**: Save events from old chapter corrupt new chapter's progress during transitions
- **Cause**: WebView's `updateState()` sends save events without chapter ID; old WebView still processes while new chapter loads
- **Key Insight**: WebView-side state updates continue independently of RN chapter state
- **Solution**:
  1. Add `chapterId` to ALL save events in `core.js` (5 locations)
  2. Validate `chapterId` in RN's `onMessage` handler for save events
  3. Add 1-second grace period (`chapterTransitionTimeRef`) after chapter change
  4. Clear TTSAudioManager queue state before starting new batch
  5. Reject events with mismatched or missing chapterId during grace period

## ForegroundService Error on Android 12+ (2025-12-03)

- **Problem**: `ForegroundServiceStartNotAllowedException` during chapter transitions
- **Cause**: Android 12+ restricts starting foreground services from background
- **Solution**: Track `isServiceForeground` state, only call `startForeground()` when not already foreground

## Screen Wake TTS Scroll Issue (2025-12-03)

- **Problem**: When screen wakes during background TTS after chapter transition, WebView scrolls to wrong paragraphs (from previous chapter) then jumps back
- **Cause**:
  1. When screen wakes, WebView resumes and processes stale JS injections from RN's event listeners
  2. `onSpeechStart`/`onSpeechDone` still have queued calls for old chapter paragraphs
  3. These inject `highlightParagraph()` and `updateState()` with old indices, causing wrong scrolls
- **Solution**:
  1. Add chapter ID parameter to `highlightParagraph(paragraphIndex, chapterId)` and `updateState(paragraphIndex, chapterId)` in core.js
  2. Validate chapter ID before processing - reject stale events from old chapters
  3. Pass `prevChapterIdRef.current` in all RN inject calls
  4. Add screen wake handler in AppState listener to force sync WebView to current paragraph

## TTS Resume Skips First Paragraph (2025-12-03)

- **Problem**: When user confirms resume from prompt, TTS starts from next paragraph instead of saved paragraph
- **Cause**: `restoreState()` sets `currentElement` but then calls `next()` which advances to next element due to `findNextTextNode()` logic
- **Solution**: Call `speak()` directly instead of `next()` in `restoreState()` when `autoStart` is true. Also set `prevElement` to previous paragraph to prevent skip logic.

## TTS Slider UX (2025-12-03)

- **Problem**: Rate/pitch sliders only respond to tap, not drag. Hard to adjust values precisely.
- **Solution**:
  1. Add local state for slider values (`localRate`, `localPitch`) with drag tracking
  2. Use `onValueChange` for real-time display updates during drag
  3. Use `onSlidingComplete` to persist to settings
  4. Add +/- buttons for fine control
  5. Add visual markers (Slow/Normal/Fast, Low/Normal/High)
  6. Reduce max values to more usable ranges (3x speed, 2x pitch)

## TTS Multi-Chapter Continuation Bug (2025-12-04)

- **Problem**: TTS playback stops after transitioning to one chapter, won't continue to subsequent chapters
- **Root Cause**: After successful background TTS batch start in `WebViewReader.tsx`, `isTTSReadingRef.current` was not set to `true`. The `onQueueEmpty` handler checks this flag and ignores events if false.
- **Key Insight**: The TTS flow requires `isTTSReadingRef.current = true` for `onQueueEmpty` to trigger next chapter navigation
- **Solution**: Added `isTTSReadingRef.current = true;` in the `.then()` callback after successful `TTSHighlight.speakBatch()` call
- **Files Modified**: `src/screens/reader/components/WebViewReader.tsx`

## TTS Robotic/Low-Quality Voice Bug (2025-12-04)

- **Problem**: TTS sometimes uses robotic/low-quality voice instead of user's preferred voice
- **Root Cause**: In `TTSForegroundService.kt`, when preferred voice is not found in `ttsInstance.voices`, the loop completes silently without setting any voice, falling back to system default
- **Key Insight**: Android TTS doesn't throw errors on voice unavailability - it silently falls back. TypeScript-side retry logic is ineffective.
- **Solution**:
  1. Added voice availability check with retry logic in native `speak()` and `speakBatch()` functions
  2. If preferred voice not found, refresh voices list and retry
  3. If still not found, select best quality voice for the same language as fallback
  4. Added logging for voice selection issues
- **Files Modified**: `android/app/src/main/java/com/rajarsheechatterjee/LNReader/TTSForegroundService.kt`

# Failed Approaches (Avoid These)

- Adding retry logic only in TypeScript layer for voice issues - doesn't help because Android TTS doesn't throw errors on voice unavailability
- Using `global.showToast()` for notifications in service files - causes TypeScript errors due to missing type definitions
