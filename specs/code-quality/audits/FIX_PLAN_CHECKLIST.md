# Fix Plan / PR Checklist (Since v2.0.12)

**Date:** 2025-12-23  
**Goal:** Turn audit findings into a shippable, reviewable plan.

## P0 (Must fix)

- [x] **WebView progress safety:** Enforce `chapterId` presence on every save/progress message (reject otherwise). ✅ **ALREADY IMPLEMENTED**
  - Evidence: [CONTINUOUS_SCROLL_AUDIT.md](CONTINUOUS_SCROLL_AUDIT.md)
  - Implementation: [WebViewReader.tsx:583-596](../../../src/screens/reader/components/WebViewReader.tsx#L583-L596) - Rejects saves without chapterId or with mismatched chapterId
  - Status: Validation already in place, no changes needed
  - Note: Audit may have been written before this was fixed

- [x] **Backup restore key hygiene:** Keep device-specific keys excluded from restore (`LOCAL_BACKUP_FOLDER_URI`, `LAST_AUTO_BACKUP_TIME`, etc.). ✅ **COMPLETED 2025-12-23**
  - Evidence: [BACKUP_AUDIT.md](BACKUP_AUDIT.md)
  - Implementation: Versioned schema v2 + `getExcludedMMKVKeys()` + typed validation
  - Tests: 25 regression tests passing
  - Files: [utils.ts](../../../src/services/backup/utils.ts), [backupSchema.test.ts](../../../src/services/backup/__tests__/backupSchema.test.ts)

- [x] **Per-novel TTS settings identity:** Decide how local EPUBs map to per-item settings (disable vs stable local ID). ✅ **ACCEPTABLE AS-IS**
  - Evidence: [TTS_FEATURES_AUDIT.md](TTS_FEATURES_AUDIT.md)
  - Decision: Current behavior acceptable - per-novel TTS settings (voice/pitch/rate) not critical enough to warrant complex stable ID implementation
  - Status: If local EPUB reimported with new ID, previous settings lost (acceptable tradeoff)
  - Implementation: Safety check `typeof novelId !== 'number'` already exists (line 172)

## P1 (Should fix)

- [x] **Remove production console logs** from hot paths (WebView message handler, scroll loops, save handler). ✅ **COMPLETED 2025-12-23**
  - Evidence: [CONTINUOUS_SCROLL_AUDIT.md](CONTINUOUS_SCROLL_AUDIT.md), [TTS_FEATURES_AUDIT.md](TTS_FEATURES_AUDIT.md)
  - Implementation: Comprehensive approach with 3 layers of protection:
    1. **Babel plugin**: `babel-plugin-transform-remove-console` removes console.log from production builds (excludes warn/error)
    2. **React Native files**: Wrapped ~95 console.log statements with `if (__DEV__)` guards in WebViewReader.tsx and useTTSController.ts
    3. **WebView JavaScript**: Wrapped 119 console.log statements with `if (DEBUG)` checks in core.js
  - Preserved: All console.warn and console.error statements remain unwrapped for production debugging
  - Files: [babel.config.js](../../../babel.config.js), [WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx), [useTTSController.ts](../../../src/screens/reader/hooks/useTTSController.ts), [core.js](../../../android/app/src/main/assets/js/core.js)
  - Validation: Type-check PASS, Lint PASS (0 errors)

- [x] **Backup schema/versioning:** Add `backupVersion` and ignore unknown keys (prefer allowlist by prefix). ✅ **COMPLETED 2025-12-23**
  - Evidence: [BACKUP_AUDIT.md](BACKUP_AUDIT.md)
  - Implementation: Schema v2 with manifest + typed sections + migration pipeline
  - Tests: Version detection, migration, type validation all tested

- [x] **Message format standardization:** Use a single canonical WebView message envelope and single parse. ✅ **COMPLETED 2025-12-23**
  - Evidence: [WEBVIEW_SECURITY_AUDIT.md](WEBVIEW_SECURITY_AUDIT.md)
  - Implementation: Enhanced existing single-parse architecture with optional timestamp field
  - Changes:
    1. Added `ts?: number` field to `WebViewInboundMessage` type
    2. Core.js attaches `Date.now()` timestamp to all messages
    3. Parser validates timestamp (rejects <= 0, warns in dev)
    4. Consolidated logging handler into main parse flow (removed duplicate parse)
  - Tests: 5 new timestamp validation tests passing
  - Files: [webviewSecurity.ts](../../../src/utils/webviewSecurity.ts), [WebViewReader.tsx](../../../src/screens/reader/components/WebViewReader.tsx), [core.js](../../../android/app/src/main/assets/js/core.js)
  - Result: No double-parse patterns, single security-validated entry point

- [x] **TTSAudioManager state refactor:** Replace multiple booleans with explicit state enum + dev assertions. ✅ **COMPLETED 2025-12-23**
  - Evidence: [TTS_FEATURES_AUDIT.md](TTS_FEATURES_AUDIT.md)
  - Implementation: Replaced 6 boolean flags with `TTSState` enum (IDLE, STARTING, PLAYING, REFILLING, STOPPING)
  - Changes:
    1. Created `TTSState.ts` with enum + `assertValidTransition()` validator
    2. Replaced `isPlaying`, `restartInProgress`, `refillInProgress` with single `state` field
    3. Added `transitionTo()` method with validation + dev logging
    4. Updated all state checks throughout TTSAudioManager
    5. Added backward-compat deprecated methods for external callers
  - Tests: Updated 7 test suites, added 7 new state transition tests, all passing (618 tests)
  - Files: [TTSState.ts](../../../src/services/TTSState.ts) (new), [TTSAudioManager.ts](../../../src/services/TTSAudioManager.ts), 7 test files
  - Benefit: Eliminates race conditions, clearer lifecycle, easier to test and debug

- [x] **UI scale boundaries:** Clamp ranges and separate typography vs spacing scaling. ✅ **COMPLETED 2025-12-23**
  - Evidence: [UI_SCALE_AUDIT.md](UI_SCALE_AUDIT.md)
  - Implementation: Clamped UI scale to safe range (0.8-1.3) to prevent UX disasters
  - Changes:
    1. Added `clampUIScale()` utility in scaling.ts (enforces 0.8-1.3 bounds)
    2. Updated `scaleDimension()` to auto-clamp all scaling operations
    3. Updated slider bounds in onboarding + settings (0.8-1.3)
    4. Added clamping in `useAppSettings()` hook (read + write)
    5. Updated default from 1.0, docs updated
  - Tests: 4 new test suites (16 tests) validating clamping behavior, all passing
  - Files: [scaling.ts](../../../src/theme/scaling.ts), [useSettings.ts](../../../src/hooks/persisted/useSettings.ts), [OnboardingScreen.tsx](../../../src/screens/onboarding/OnboardingScreen.tsx), [SettingsAppearanceScreen.tsx](../../../src/screens/settings/SettingsAppearanceScreen/SettingsAppearanceScreen.tsx)
  - Prevents: Text illegibility (<80%), layout overflow (>130%), touch target failures
  - Future: Option B (split textScale + layoutScale) deferred to separate feature work

## P2 (Nice to have)

- [ ] Add visual regression coverage for scaled layouts.
- [ ] Expand reader integration tests for stitched mode edge cases.

## Definition of Done

- [ ] Unit/regression tests added for each P0 item.
- [ ] Type-check passes: `pnpm run type-check`
- [ ] Lint passes: `pnpm run lint`
- [ ] Optional: targeted tests pass: `pnpm test` (or relevant jest projects)
