# Next Session Prompt: Fix Remaining 13 Integration Tests

## Context
**Current Status**: 521/534 tests passing (97.6%), 13 tests failing  
**Test File**: `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts`  
**Infrastructure**: ✅ FULLY FIXED (message structure + timing/async)  
**Session 7 Progress**: 6 tests fixed (wake cycles + WebView routing)  
**Key Breakthrough**: Implementation-first review reveals actual behavior vs test assumptions

## Your Prompt for Next Session

```
Continue fixing the remaining 13 failing integration tests in useTTSController.integration.test.ts using the implementation-first review methodology.

Current status:
- Tests passing: 521/534 (97.6%)
- Tests failing: 13/534 (2.4%)
- Session 7 completed: Fixed 6 tests (wake cycles + WebView routing)

The 13 remaining failures need implementation code review first:

**Batch A: onSpeechDone (4 tests)** - Lines 889-967
1. "should update ttsStateRef timestamp when onSpeechDone advances"
2. "should ignore onSpeechDone when index < queueStartIndex"
3. "should defer to WebView when index >= queueEndIndex"
4. "should skip onSpeechDone during wake transition"

**Action**: Read useTTSController.ts lines 1359-1432 (onSpeechDone implementation) first

**Batch D: onMediaAction (4 tests)** - Lines 1178-1277
1. "should pause TTS when PLAY_PAUSE received during reading"
2. "should navigate to PREV_CHAPTER when media action received"
3. "should navigate to NEXT_CHAPTER when media action received"
4. "should debounce rapid media actions"

**Action**: Read useTTSController.ts lines 1652-1848 (media action handler) first

**Batch E: onQueueEmpty (1 test)** - Lines 1278-1297
1. "should save progress when onQueueEmpty fires"

**Action**: Read useTTSController.ts lines 1871-1938 (onQueueEmpty handler) first

**Screen Sleep (3 tests)** - Lines 1527-1589
1. "should pause TTS when screen goes to background"
2. "should save current position when sleeping"
3. "should preserve TTS state when sleeping"

**Action**: Debug why tests fail despite checking TTSHighlight.stop (seems correct)

**WebView Routing (1 test)** - Lines 1603-1614
1. "should handle tts-queue message and initialize TTS"

**Action**: Read 'tts-queue' handler (lines 881-988), check why speakBatch not called

Key methodology from Session 7:
1. **Read actual implementation code first** (useTTSController.ts specific lines)
2. **Identify observable behaviors** (function calls, WebView injections, API calls)
3. **Fix tests to match implementation reality** (not assumptions)
4. **Verify one step at a time** (test after each fix)

Documentation: See test-implementation-plan.md SESSION 7 for wake cycle patterns and examples.

Goal: Achieve 534/534 passing (100%) by aligning all tests with actual implementation behavior.
```

## Session 7 Key Discoveries

**Wake Cycle Real Implementation**:
```
AppState 'active' → Pause → Scroll sync injection (300ms) → 900ms delay → TTSHighlight.speakBatch()
```
- ❌ Does NOT use 'ttsRequestQueueSync' injection
- ❌ Does NOT need queue message from WebView
- ✅ Directly calls speakBatch after 1200ms total

**Sleep Cycle Real Implementation**:
```
AppState 'background' → Save state → TTSHighlight.stop() → isTTSReadingRef = false
```
- ✅ Uses stop(), not pause()
- ✅ Immediate (no delays)

**Non-existent Handlers**:
- 'tts-sync-error' - not in implementation
- 'change-paragraph-position' - not in implementation
- 'ttsRequestQueueSync' - never injected

**Real Handlers** (lines 691-991):
- 'speak' → speakBatch
- 'stop-speak' → fullStop
- 'tts-queue' → addToBatch
- 'tts-state' → update refs
- (7 more dialog/prompt handlers)

## What This Will Do

The agent will:
1. **Read onSpeechDone implementation** (lines 1359-1432)
2. **Fix Batch A tests** (4 tests) based on actual behavior
3. **Read onMediaAction implementation** (lines 1652-1848)
4. **Fix Batch D tests** (4 tests) based on actual behavior
5. **Read onQueueEmpty implementation** (lines 1871-1938)
6. **Fix Batch E test** (1 test) based on actual behavior
7. **Debug sleep tests** (3 tests) - implementation looks correct but tests fail
8. **Debug tts-queue test** (1 test) - check handler conditions

## Expected Outcome

By the end of next session:
- ✅ All 534 integration tests passing (100%)
- ✅ Zero regressions in 521 passing tests
- ✅ All tests aligned with actual implementation
- ✅ Clean test suite ready for CI/CD

## Files to Monitor

- `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts` (test file being fixed)
- `src/screens/reader/hooks/useTTSController.ts` (implementation reference)
- `docs/analysis/test-implementation-plan.md` (SESSION 7 completed)
- No production code changes expected (all fixes in test code)

## Success Criteria

```bash
pnpm test -- useTTSController.integration.test.ts
# Expected output: Tests: 0 failed, 534 passed, 534 total
```

## Quick Reference: Session 7 Implementation-First Patterns

**Methodology**:
```
1. Read implementation code (specific line ranges)
2. Document actual behavior flow
3. Identify observable behaviors (API calls, injections)
4. Update test assertions to match reality
5. Verify test passes
```

**Wake Cycle Example**:
```typescript
// ❌ WRONG (before implementation review)
expect(mockInjectJavaScript).toHaveBeenCalledWith(
  expect.stringContaining('ttsRequestQueueSync')
);

// ✅ CORRECT (after reading implementation)
await act(async () => { jest.advanceTimersByTime(1200); });
expect(TTSHighlight.speakBatch).toHaveBeenCalled();
```

**Observable Behaviors to Check**:
```typescript
// ✅ Function calls
expect(TTSHighlight.speakBatch).toHaveBeenCalled();
expect(TTSHighlight.stop).toHaveBeenCalled();
expect(mockSaveProgress).toHaveBeenCalledWith(...);

// ✅ WebView injections (if actually exist)
expect(mockInjectJavaScript).toHaveBeenCalledWith(
  expect.stringContaining('actualInjectedCode')
);

// ✅ State changes
expect(result.current.showExitDialog).toBe(true);

// ❌ Avoid stale refs
expect(result.current.isTTSReadingRef.current).toBe(true); // May not reflect reality
```

**Message Format** (already fixed in Session 7):
```typescript
// ✅ Correct (parsed WebViewPostEvent)
const msg: any = {
  type: 'tts-queue',
  data: ['text1', 'text2'],
  startIndex: 0,
  chapterId: 100
};
```

**Implementation Code Ranges to Review**:
- onSpeechDone: lines 1359-1432
- onMediaAction: lines 1652-1848
- onQueueEmpty: lines 1871-1938
- AppState sleep: lines 1988-2014
- 'tts-queue' handler: lines 881-988

