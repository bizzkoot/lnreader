# Progress (Updated: 2026-01-03)

## Done (Latest)

- **TTS Chapter List Progress Sync - Real-Time Fix** (2026-01-03)
  - Fixed bug where Chapter List showed stale progress during active TTS playback
  - Added debounced refreshChaptersFromContext() call during every paragraph progress save
  - Debounce at 500ms balances responsiveness with performance
  - Implementation: useTTSController.ts (+24 lines)
  - Tests: 1071/1072 passing (pre-existing failure unrelated)
  - Commit: 18faebd83
  - Memory created and linked to related TTS fixes
  - Quality gates: type-check ✅ lint ✅ format ✅ tests ✅

## Done (Previous)

- Phase 1 Task 1.1: TTS error path tests (12 tests added)
- Phase 1 Task 1.2: WebView security tests (28 tests added)
- Coverage increased: 38.09% → 38.45% (+16 lines)
- All 662 tests passing (quality gates: type-check ✅ lint ✅)
- CODE_REVIEW_ACTION_PLAN.md updated with Phase 1 progress
- Git commit & push successful (commit 24018eacc)
- Session summary created (.agents/SESSION_SUMMARY_2025-12-25.md)

## Doing

- No active tasks

## Next

- Monitor user testing of real-time chapter list progress sync
- Consider optimizing debounce interval based on device performance
- Future: Reduce full DB reload to single-chapter update if performance is acceptable
