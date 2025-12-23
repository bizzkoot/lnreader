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

- [ ] **Message format standardization:** Use a single canonical WebView message envelope and single parse.
  - Evidence: [WEBVIEW_SECURITY_AUDIT.md](WEBVIEW_SECURITY_AUDIT.md)

- [ ] **TTSAudioManager state refactor:** Replace multiple booleans with explicit state enum + dev assertions.
  - Evidence: [TTS_FEATURES_AUDIT.md](TTS_FEATURES_AUDIT.md)

- [ ] **UI scale boundaries:** Clamp ranges and separate typography vs spacing scaling.
  - Evidence: [UI_SCALE_AUDIT.md](UI_SCALE_AUDIT.md)

## P2 (Nice to have)

- [ ] Add visual regression coverage for scaled layouts.
- [ ] Expand reader integration tests for stitched mode edge cases.

## Definition of Done

- [ ] Unit/regression tests added for each P0 item.
- [ ] Type-check passes: `pnpm run type-check`
- [ ] Lint passes: `pnpm run lint`
- [ ] Optional: targeted tests pass: `pnpm test` (or relevant jest projects)
