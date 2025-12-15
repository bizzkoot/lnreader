# Next Session Prompt: Fix Remaining 22 Integration Tests

## Context
**Current Status**: 512/534 tests passing (95.9%), 22 tests failing (down from 36)
**Test File**: `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts`
**Infrastructure**: ✅ FULLY FIXED (message structure + timing/async)
**Session 6 Progress**: 14/36 tests fixed (39% improvement)

## Your Prompt for Next Session

```
Continue fixing the remaining 22 failing integration tests in useTTSController.integration.test.ts.

Current status:
- Tests passing: 512/534 (95.9%)
- Tests failing: 22/534 (4.1%)
- Session 6 completed: Fixed 14 tests (message format, API mismatches, out-of-bounds indices)

The 22 remaining failures fall into clear categories:

**Category A: Event Listener Integration (11 tests)**
- onSpeechDone tests (4) - timing/state synchronization
- onSpeechStart tests (2) - ref update expectations  
- onWordRange test (1) - WebView injection verification
- onMediaAction tests (3) - media control flow
- onQueueEmpty test (1) - progress saving verification

**Category B: Wake/Sleep Cycles (4 tests)**
- Screen wake TTS queue refresh
- Valid queue acceptance on wake
- isTTSReadingRef state preservation
- Retry logic on wake sync failure

**Category C: WebView Message Routing (3 tests)**
- change-paragraph-position message handling
- Message validation tests

**Category D: Background TTS (2 tests)**
- Extract paragraphs in background mode
- Additional edge cases

**Category E: State Orchestration (2 tests)**
- Complex multi-hook coordination

Key patterns from Session 6:
1. Message type mapping: speak→speakBatch, tts-queue→addToBatch
2. Paragraph indices must be < 5 (mock returns 5 paragraphs)
3. Use observable behaviors (API calls) not ref values
4. TTS must be started before media actions work

Documentation: See test-implementation-plan.md SESSION 6 for complete patterns and examples.

Goal: Fix all 22 remaining failures systematically, prioritizing Event Listener tests first.
```

## What This Will Do

The agent will:
1. **Start with Event Listener tests** (highest value, 11 tests)
2. **Apply Session 6 patterns** (message format, API mapping, observable behaviors)
3. **Fix Wake/Sleep tests** (4 tests with lifecycle scenarios)
4. **Complete remaining categories** (7 tests)
5. **Verify zero regressions** in 512 passing tests

## Expected Outcome

By the end of next session:
- ✅ All 534 integration tests passing (100%)
- ✅ Zero regressions in existing tests
- ✅ Patterns documented for future maintenance
- ✅ Clean test suite ready for CI/CD

## Files to Monitor

- `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts` (test file being fixed)
- `docs/analysis/test-implementation-plan.md` (SESSION 6 completed, SESSION 7 to be added)
- No production code changes expected (all fixes in test code)

## Success Criteria

```bash
pnpm test -- useTTSController.integration.test.ts
# Expected output: Tests: 0 failed, 534 passed, 534 total
```

## Quick Reference: Session 6 Patterns

**Message Format**:
```typescript
// ✅ Correct (parsed object)
const msg: any = { type: 'speak', data: 'text', paragraphIndex: 0 };

// ❌ Wrong (nativeEvent wrapper)  
const msg = { nativeEvent: { data: JSON.stringify({...}) } };
```

**API Mapping**:
- `speak` message → `TTSHighlight.speakBatch()` 
- `tts-queue` message → `TTSHighlight.addToBatch()`

**Observable Behaviors**:
```typescript
// ✅ Good
expect(TTSHighlight.speakBatch).toHaveBeenCalled();

// ❌ Avoid (stale ref)
expect(result.current.backgroundTTSPendingRef.current).toBe(true);
```

**Paragraph Indices**:
```typescript
// ✅ Valid (mock has 5 paragraphs: 0-4)
await simulateTTSStart(simulator, 100, 2, ['text']);

// ❌ Out of bounds
await simulateTTSStart(simulator, 100, 10, ['text']); // 10 >= 5
```
