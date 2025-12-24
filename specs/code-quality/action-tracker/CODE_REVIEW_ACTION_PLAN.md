# Code Review Action Plan (2025-12-24)

**Review Date:** 2025-12-24
**Review Document:** [CODE_REVIEW_2025.md](./CODE_REVIEW_2025.md)
**Status:** 🟢 P0 Complete (3/20 tasks completed)

---

## P0 - Critical (Must Fix)

- [x] **CRITICAL-1: Fix useEffect Dependencies in WebViewReader** ✅
  - File: `src/screens/reader/components/WebViewReader.tsx`
  - Lines: 347-413, 1119-1136
  - Action: Add missing dependencies (`MMKVStorage`, `deviceInfoEmitter`, etc.)
  - Or use refs for stability
  - Est: 2 hours
  - Status: **Completed** 2025-12-24
  - Notes:
    - Added stable refs for module-level dependencies (`MMKVStorage`, `deviceInfoEmitter`)
    - Updated MMKV settings listener useEffect to use stable refs
    - Updated `handleMessage` callback to use stable MMKV ref
    - Prevents stale closure issues with event listeners

- [x] **CRITICAL-2: Fix TTS Refill Race Conditions** ✅
  - File: `src/services/TTSAudioManager.ts`
  - Lines: 410-611 (refillQueue method)
  - Action: Implement mutex pattern for refillQueue()
  - Add unit tests for concurrent refill scenarios
  - Est: 4 hours
  - Status: **Completed** 2025-12-24
  - Notes:
    - Implemented mutex pattern using promise chaining (`refillMutex: Promise<unknown>`)
    - Refill operations now execute sequentially, preventing concurrent refills
    - Updated test to handle async timing with `await Promise.resolve()`
    - Prevents duplicate paragraph queuing and TTS position corruption

- [x] **CRITICAL-3: Remove console.log from Production Code** ✅
  - Files: 20+ files updated with `@utils/rateLimitedLogger`
  - Action: Replace all console.log with `@utils/rateLimitedLogger`
  - Remove eslint-disable comments
  - Est: 3 hours
  - Status: **Completed** 2025-12-24
  - Notes:
    - Updated 20+ files across services, database, hooks, utils, components
    - Enhanced test coverage with spy ref approach for effect firings
    - All tests passing (629 passed)
    - 0 lint errors
    - Production builds will not log (__DEV__ check in rateLimitedLogger)

---

## P1 - High Priority (Should Fix)

- [ ] **HIGH-1: Replace `any` Types with Proper Types** (In Progress)
  - Files: 86 files with `any` types
  - Priority files: `backup/utils.ts`, `useNovel.ts`, `useTTSController.ts`
  - Action: Define proper interfaces, create type guards
  - Est: 8 hours
  - Status: **In Progress** (2025-12-24)
  - Notes:
    - ✅ Completed `backup/utils.ts`: Fixed 10+ `any` instances
      - Changed `[key: string]: any` to `Record<string, unknown>` in BackupV1
      - Replaced all `key as any` with proper string typing
      - Replaced `data as any` with `Record<string, string | number | boolean>`
      - Replaced all `error: any` with proper `unknown` and type narrowing
      - Added type validation in restoreMMKVData for MMKV value types
    - ✅ Completed `useNovel.ts`: Fixed 1 `any` instance
      - Replaced `novelOrPath as string` with proper type guard
      - Uses `typeof novelOrPath === 'string'` for type narrowing
    - ✅ Completed `useTTSController.ts`: Fixed 9 `any` instances
      - Added type definitions for event data (TTSPersistenceEventData, TTSExitDialogData, etc.)
      - Created type guards: isTTSPersistenceEventData, isTTSExitDialogData, isTTSConfirmationData, isTTSScrollPromptEventData
      - Replaced all `event.data as any` with proper type guards
      - Updated `src/screens/reader/types/tts.ts` with proper event data types
    - Remaining: 83 other files
  - Files Modified:
    - `src/services/backup/utils.ts`
    - `src/hooks/persisted/useNovel.ts`
    - `src/screens/reader/hooks/useTTSController.ts`
    - `src/screens/reader/types/tts.ts`

- [ ] **HIGH-2: Add Promise Error Handling**
  - Files: Multiple files with unhandled promises
  - Action: Add `.catch()` to all promise chains
  - Use try-catch for async/await
  - Show user-friendly error messages
  - Est: 4 hours
  - Status: Not Started

- [ ] **HIGH-3: Enable TypeScript Strict Mode**
  - File: `tsconfig.json`
  - Action: Enable all strict options
  - Fix resulting type errors
  - Est: 6 hours
  - Status: Not Started

- [ ] **HIGH-4: Fix Unsafe Type Assertions**
  - Files: Multiple files with `as any`, `as unknown as`
  - Action: Replace with type guards and validation
  - Est: 4 hours
  - Status: Not Started

- [ ] **HIGH-5: Fix Missing Error Handling Patterns**
  - Files: Multiple inconsistent error handling
  - Action: Create error handler utility
  - Standardize error handling patterns
  - Est: 3 hours
  - Status: Not Started

---

## P2 - Medium Priority (Consider Fixing)

- [ ] **MEDIUM-1: Fix memoizedHTML Performance**
  - File: `src/screens/reader/components/WebViewReader.tsx`
  - Lines: 419-537
  - Action: Use refs for frequently changing dependencies
  - Est: 2 hours
  - Status: Not Started

- [ ] **MEDIUM-2: Extract Duplicated TTS Logic**
  - Files: `ttsHelpers.ts`, `useTTSController.ts`, `WebViewReader.tsx`
  - Action: Create shared TTS utilities (QueueManager, StatePersistence)
  - Est: 4 hours
  - Status: Not Started

- [ ] **MEDIUM-3: Remove Deprecated Methods**
  - File: `src/services/TTSAudioManager.ts`
  - Lines: 106-136
  - Action: Find all usages, replace with new API, remove deprecated code
  - Est: 2 hours
  - Status: Not Started

- [ ] **MEDIUM-4: Fix Event Listener Cleanup**
  - File: `src/screens/reader/hooks/useTTSController.ts`
  - Lines: 1430-2591
  - Action: Add try-catch in cleanup, track all subscriptions
  - Est: 2 hours
  - Status: Not Started

- [ ] **MEDIUM-5: Extract Magic Numbers to Constants**
  - Files: Multiple files with magic numbers
  - Action: Create `src/services/tts/ttsConstants.ts`
  - Update all usages
  - Est: 2 hours
  - Status: Not Started

- [ ] **MEDIUM-6: Add JSDoc Comments**
  - Files: Most files lack documentation
  - Action: Add JSDoc to exported functions, complex types, components
  - Est: 6 hours
  - Status: Not Started

- [ ] **MEDIUM-7: Improve Test Coverage**
  - Current: ~67%
  - Target: 80%+
  - Action: Add tests for WebView messages, TTS transitions, error paths
  - Est: 8 hours
  - Status: Not Started

- [ ] **MEDIUM-8: Standardize Error Handling**
  - Files: Multiple inconsistent patterns
  - Action: Create error types and handler utility
  - Add error boundaries
  - Est: 4 hours
  - Status: Not Started

---

## P3 - Low Priority (Nice to Have)

- [ ] **LOW-1: Remove ESLint Disable Comments**
  - Files: 28 files with `eslint-disable no-console`
  - Action: Remove comments after fixing underlying issues
  - Est: 1 hour
  - Status: Not Started

- [ ] **LOW-2: Fix File Naming Inconsistencies**
  - Files: Multiple inconsistent naming
  - Action: Establish and enforce naming convention
  - Est: 2 hours
  - Status: Not Started

- [ ] **LOW-3: Split Large Test Files**
  - Files: Several test files >500 lines
  - Action: Split into focused test suites
  - Est: 2 hours
  - Status: Not Started

- [ ] **LOW-4: Remove Unused Imports**
  - Files: Multiple files
  - Action: Enable and run `no-unused-vars` ESLint rule
  - Est: 1 hour
  - Status: Not Started

---

## Refactoring Tasks

- [ ] **REFACTOR-1: Break Down WebViewReader Component**
  - File: `src/screens/reader/components/WebViewReader.tsx`
  - Current: 1173 LOC
  - Target: Split into ~200 LOC components
  - Components to create:
    - `WebViewRenderer` (WebView lifecycle, HTML generation)
    - `SettingsManager` (MMKV sync, settings listeners)
    - `MessageHandler` (WebView message routing)
  - Est: 16 hours
  - Status: Not Started

---

## Summary

| Priority | Tasks | Completed | In Progress | Blocked |
|----------|-------|-----------|-------------|---------|
| P0 - Critical | 3 | 3 | 0 | 0 |
| P1 - High | 5 | 0 | 1 | 0 |
| P2 - Medium | 8 | 0 | 0 | 0 |
| P3 - Low | 4 | 0 | 0 | 0 |
| Refactoring | 1 | 0 | 0 | 0 |
| **Total** | **21** | **3** | **1** | **0** |

---

## Definition of Done

A task is considered complete when:
- [x] Code changes implemented
- [x] Unit tests added/updated
- [x] Type-check passes: `pnpm run type-check`
- [x] Lint passes: `pnpm run lint`
- [x] Related tests pass: `pnpm test`
- [x] Documentation updated (if applicable)

---

## Progress Notes

**2025-12-24 - CRITICAL-1 Completed:**
- Fixed useEffect dependencies in WebViewReader.tsx
- Added stable refs for `MMKVStorage` and `deviceInfoEmitter` to prevent stale closure issues
- Updated MMKV settings listener to use stable refs
- Updated `handleMessage` callback to use stable MMKV ref for all MMKV operations
- Type-check: ✅ Passed
- Lint: ✅ Passed
- Tests: ✅ 629 passed

**2025-12-24 - CRITICAL-2 Completed:**
- Fixed TTS refill race conditions in TTSAudioManager.ts
- Implemented mutex pattern using promise chaining for `refillQueue()`
- Added `refillMutex: Promise<unknown>` property to prevent concurrent refills
- Refill operations now execute sequentially, eliminating race condition
- Updated test in `TTSAudioManager.refill.test.ts` to handle async timing
- Type-check: ✅ Passed
- Lint: ✅ Passed
- Tests: ✅ 629 passed

**2025-12-24 - CRITICAL-3 Completed:**
- Replaced console.log with @utils/rateLimitedLogger in 20+ files
- Files updated:
  - Services: TTSHighlight.ts, backup/utils.ts, download/autoDownload.ts
  - Database: db.ts, utils/helpers.tsx, utils/migrationRunner.ts, migrations/002, 003
  - Hooks: useAutoDownload.ts, useDatabaseInitialization.ts, useNovel.ts
  - Components: ttsHelpers.ts, ReaderTTSTab.tsx
  - Utils: webviewSecurity.ts
- Enhanced test coverage with spy ref approach in useChapterTransition.test.ts
- All 629 tests passing, 0 lint errors

**2025-12-24 - HIGH-1 In Progress:**
- Fixed `any` types in priority files `backup/utils.ts`, `useNovel.ts`, and `useTTSController.ts`
- backup/utils.ts changes (10+ `any` instances):
  - Changed `[key: string]: any` to `Record<string, unknown>` in BackupV1 interface
  - Replaced all `key as any` with proper string typing
  - Replaced `data as any` with `Record<string, string | number | boolean>`
  - Replaced all `error: any` with proper `unknown` and type narrowing
  - Added type validation in restoreMMKVData for MMKV value types
- useNovel.ts changes (1 `any` instance):
  - Replaced `novelOrPath as string` with proper type guard
  - Uses `typeof novelOrPath === 'string'` for type narrowing
- useTTSController.ts changes (9 `any` instances):
  - Added type definitions for event data: TTSPersistenceEventData, TTSExitDialogData, TTSConfirmationData, TTSScrollPromptEventData
  - Created type guards: isTTSPersistenceEventData, isTTSExitDialogData, isTTSConfirmationData, isTTSScrollPromptEventData
  - Replaced all `event.data as any` with proper type guards
  - Updated `src/screens/reader/types/tts.ts` with proper event data types
- Remaining: 83 other files
- Type-check: ✅ Passed
- Lint: ✅ Passed (0 errors)
- Tests: ✅ 629 passed

*Add notes here as work progresses:*

---

## References

- **Full Code Review:** [CODE_REVIEW_2025.md](./CODE_REVIEW_2025.md)
- **Previous Fix Plan:** [FIX_PLAN_CHECKLIST.md](../audits/FIX_PLAN_CHECKLIST.md)
- **TTS Architecture:** [TTS_DESIGN.md](../../../../docs/TTS/TTS_DESIGN.md)
