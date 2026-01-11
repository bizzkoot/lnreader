# Codebase Concerns

**Analysis Date:** 2026-01-06

## Tech Debt

**Large files requiring refactoring:**

- **`src/screens/reader/hooks/useTTSController.ts`** (3,090 lines)
  - Issue: Monolithic hook handling too many responsibilities
  - Why: TTS state machine is complex, but file is too large to maintain
  - Impact: Difficult to understand, test, and modify
  - Fix approach: Extract into smaller focused hooks (useTTSPlayback, useTTSQueue, useTTSProgress, etc.)
  - Location: `src/screens/reader/hooks/useTTSController.ts`

- **`src/screens/reader/components/WebViewReader.tsx`** (1,299 lines)
  - Issue: Too many responsibilities in single component
  - Why: Reader UI, TTS integration, WebView bridge, scroll handling all mixed
  - Impact: Hard to maintain, test, and add features
  - Fix approach: Extract sub-components (TTSControls, WebViewContainer, ReaderHeader, etc.)
  - Location: `src/screens/reader/components/WebViewReader.tsx`

- **`android/app/src/main/assets/js/core.js`** (3,814 lines)
  - Issue: Monolithic WebView JavaScript
  - Why: All DOM manipulation, highlighting, scroll logic in one file
  - Impact: Hard to debug WebView issues, no modularity
  - Fix approach: Split into modules (highlighting.js, scroll.js, parser.js, etc.)
  - Location: `android/app/src/main/assets/js/core.js`

**Missing documentation:**

- Issue: No `.env.example` file despite having `.env`
  - Why: Environment configuration not documented
  - Impact: New contributors don't know what env vars are needed
  - Fix approach: Create `.env.example` with all required variables
  - Location: Root directory

## Known Bugs

**TODO/FIXME comments that represent actual bugs or missing features:**

- **iOS Native Modules:**
  - Symptoms: Native iOS modules not implemented
  - Location: `ios/NativeEpubUtil/RCTNativeEpubUtil.mm:18`, `ios/NativeVolumeButtonListener/RCTNativeVolumeButtonListener.mm:14`
  - TODO: "implement parse epub", "implement addlistener"
  - Workaround: Android-only currently
  - Root cause: iOS support incomplete
  - Fix: Complete iOS native module implementations

- **Auto-download hook:**
  - Location: `src/screens/reader/hooks/useChapter.ts:74`
  - TODO: "isTTSPlaying should be passed from TTS context"
  - Impact: May not auto-download chapters correctly during TTS playback
  - Fix: Connect TTS state to auto-download logic

- **NovelScreen:**
  - Location: `src/screens/novel/NovelScreen.tsx:68`
  - TODO: "fix this"
  - Impact: Unknown (needs investigation)
  - Fix: Investigate and fix the issue

## Security Considerations

**Missing .env.example:**
- Risk: Developers don't know what environment variables are needed
- Current mitigation: None
- Recommendations: Create `.env.example` documenting all env vars

**DEBUG flags in production:**
- Risk: Debug code may be exposed in production builds
- Files: `android/app/src/main/assets/js/core.js` (multiple DEBUG flags)
- Current mitigation: Stripped in release builds (hopefully)
- Recommendations: Ensure DEBUG code is properly stripped

**Certificate pinning placeholders:**
- Risk: DoH certificate pinning using placeholder hashes
- Files: `src/services/network/DoHManager.ts`
- Placeholders: "XXXXXXXXX" and "XXXX" for certificate hashes
- Current mitigation: None (pinning not functional)
- Recommendations: Add real certificate hashes or remove pinning code

**No certificate validation mentioned:**
- Risk: HTTPS certificates not properly validated in WebView
- Current mitigation: Default Android WebView behavior
- Recommendations: Document and test certificate validation

## Performance Bottlenecks

**Chapter progress operations:**
- Problem: Multiple MMKV operations for each chapter
- File: `src/database/queries/ChapterQueries.ts`
- Operations: `chapter_progress_${chapterId}` reads/writes
- Measurement: Not measured (needs profiling)
- Cause: Individual MMKV operations for each chapter
- Improvement path: Batch operations or reduce write frequency

**TTS queue management:**
- Problem: Complex refill logic may cause jank
- File: `src/screens/reader/hooks/useTTSController.ts`
- Measurement: Subjective (user reports)
- Cause: Frequent queue checks and refills
- Improvement path: Optimize refill threshold, batch operations

**WebView message passing:**
- Problem: Potential N+1 pattern in RN↔WebView communication
- Files: `src/screens/reader/components/WebViewReader.tsx`, `core.js`
- Measurement: Not measured
- Cause: Multiple postMessage calls for updates
- Improvement path: Batch updates, reduce message frequency

**Large file parsing:**
- Problem: EPUB and large chapter parsing may block UI
- Files: Plugin sources, EPUB handler
- Measurement: Not measured
- Cause: Synchronous parsing operations
- Improvement path: Move to WebWorkers or background threads

## Fragile Areas

**TTS State Machine:**
- File: `src/screens/reader/hooks/useTTSController.ts`
- Why fragile: 3,090 lines, complex state transitions, many race conditions
- Common failures: State drift, lost sync, wake-up issues
- Safe modification: Add tests for any state changes, document transitions
- Test coverage: Good (integration tests), but file is too complex
- Location: `src/screens/reader/hooks/useTTSController.ts`

**WebView Bridge Communication:**
- File: `src/screens/reader/components/WebViewReader.tsx` + `core.js`
- Why fragile: Async communication between RN and WebView, timing issues
- Common failures: Messages lost, timing mismatches, highlight desync
- Safe modification: Add message queuing, acknowledgments
- Test coverage: Integration tests exist but could be better
- Location: `src/screens/reader/components/WebViewReader.tsx`, `android/app/src/main/assets/js/core.js`

**Database migrations:**
- File: `src/database/migrations/`
- Why fragile: Breaking if not run in order, data loss possible
- Common failures: Missing migrations, schema changes without migration
- Safe modification: Always add migration for schema changes
- Test coverage: Good (each migration tested)
- Location: `src/database/migrations/`

## Scaling Limits

**SQLite database size:**
- Current capacity: Unknown (depends on device storage)
- Limit: Device storage free space
- Symptoms at limit: App crashes, database corruption
- Scaling path: Implement database cleanup, archiving

**Plugin cache size:**
- Current capacity: No limit enforced
- Limit: Device storage
- Symptoms at limit: Storage full, slow loading
- Scaling path: Implement plugin cache limits, LRU eviction

**TTS queue size:**
- Current capacity: 20 paragraphs per batch (MIN_BATCH_SIZE)
- Limit: Memory (depends on device)
- Symptoms at limit: OOM errors on low-memory devices
- Scaling path: Dynamic batch sizing based on available memory

## Dependencies at Risk

**react-native-webview 13.15.0:**
- Risk: May have security updates available
- Impact: WebView is critical for reading experience
- Migration plan: Check for updates, test thoroughly before upgrading

**expo-sqlite:**
- Risk: Expo SDK updates may break compatibility
- Impact: Core database functionality
- Migration plan: Test with new Expo versions before upgrading

**react-native-mmkv:**
- Risk: Version 3.x may have breaking changes in 4.x
- Impact: All settings and progress storage
- Migration plan: Migration script if data format changes

## Missing Critical Features

**iOS support:**
- Problem: iOS native modules incomplete (see TODO comments)
- Current workaround: Android-only app
- Blocks: iOS users cannot use LNReader
- Implementation complexity: High (requires Swift/Objective-C knowledge)

**Error boundaries:**
- Problem: No React Native error boundaries implemented
- Current workaround: App crashes on errors
- Blocks: Graceful error handling, better UX
- Implementation complexity: Low (React feature)

**Performance monitoring:**
- Problem: No performance tracking or profiling
- Current workaround: Manual profiling when needed
- Blocks: Identifying performance issues in production
- Implementation complexity: Medium (need to choose solution)

**Backup/restore testing:**
- Problem: Backup features not thoroughly tested
- Current workaround: Manual testing
- Blocks: Confidence in backup functionality
- Implementation complexity: Low (add more tests)

## Test Coverage Gaps

**Error handling scenarios:**
- What's not tested: Error paths, edge cases, failure modes
- Risk: Errors not handled gracefully in production
- Priority: Medium
- Difficulty to test: Need to mock error conditions

**WebView error states:**
- What's not tested: WebView load failures, JS errors, bridge failures
- Risk: Poor UX when WebView fails
- Priority: High
- Difficulty to test: Hard to mock WebView errors

**Performance edge cases:**
- What's not tested: Large files, many chapters, low memory
- Risk: App crashes or hangs in edge cases
- Priority: Medium
- Difficulty to test: Need to create large datasets

**Plugin validation:**
- What's not tested: Malicious plugins, invalid schemas, breaking changes
- Risk: Security vulnerabilities, crashes from bad plugins
- Priority: High
- Difficulty to test: Need to create malicious plugin samples

**Native module integration:**
- What's not tested: Native module failures, permission issues
- Risk: Poor error handling when native modules fail
- Priority: Medium
- Difficulty to test: Hard to mock native modules

---

*Concerns audit: 2026-01-06*
*Update as issues are fixed or new ones discovered*
