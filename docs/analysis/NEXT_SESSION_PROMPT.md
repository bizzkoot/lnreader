# Next Session Prompt: Fix Remaining 36 Integration Tests

## Context
**Current Status**: 500/536 tests passing (93.3%), 36 tests failing
**Test File**: `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts`
**Infrastructure**: ✅ FULLY FIXED (message structure + timing/async)
**Remaining Work**: Individual test expectations need updating

## Your Prompt for Next Session

```
Continue fixing the 36 failing integration tests in useTTSController.integration.test.ts.

Current status:
- Tests passing: 500/536 (93.3%)
- Tests failing: 36/536 (6.7%)
- Infrastructure: FULLY FIXED (message structure + fake timers working)

Test infrastructure is solid. The 36 failures are individual test logic issues:
1. Tests expecting TTSHighlight.speak() instead of speakBatch()
2. Tests checking ref values (stale snapshots) instead of observable behaviors
3. Tests needing additional timer advancements or async handling
4. Tests with incorrect mock return values or preconditions

Documentation: See test-implementation-plan.md SESSIONS 4 & 5 for complete context.

Goal: Fix all 36 remaining failures systematically. Follow the Refactor Expert agent rules.
```

## What This Will Do

The agent will:
1. **Analyze the 36 failures** by category (mock API mismatches, timing issues, etc.)
2. **Fix them systematically** using patterns identified in documentation
3. **Run tests after each fix** to verify progress
4. **Document solutions** for future reference

## Expected Outcome

By the end of next session:
- ✅ All 68 integration tests passing
- ✅ Zero regressions in existing 500 passing tests
- ✅ Patterns documented for maintaining tests
- ✅ Clean test suite ready for CI/CD

## Files to Monitor

- `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts` (test file being fixed)
- `docs/analysis/test-implementation-plan.md` (progress tracking)
- No production code changes expected (all fixes in test code)

## Success Criteria

```bash
pnpm test -- useTTSController.integration.test.ts
# Expected output: Tests: 0 failed, 536 passed, 536 total
```
