# Next Session Prompt: Complete Final 2 Integration Tests

## Context
**Current Status**: 532/534 tests passing (99.6%), 2 tests failing
**Test File**: `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts`
**Infrastructure**: ✅ FULLY FIXED (message structure + timing/async)
**Session 8 Progress**: Reduced failing tests from 13 → 2 by implementing implementation-first review methodology
**Key Breakthrough**: Testing with actual implementation behavior, not assumptions

## Your Prompt for Next Session

```
Complete the final 2 failing integration tests in useTTSController.integration.test.ts using implementation-first review methodology.

Current status:
- Tests passing: 532/534 (99.6%)
- Tests failing: 2/534 (0.4%)
- Session 8 completed: Fixed 11 tests (media actions, sleep tests, WebView routing, queue initialization)

The 2 remaining failures are:
1. "should ignore onSpeechDone when index < queueStartIndex" (lines 949-972)
2. "should defer to WebView when index >= queueEndIndex" (lines 978-1012)

Both tests need to manipulate the SAME ref objects that the hook uses.

Key findings from Session 8:
- Full Android media intent strings are required:
  'com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE' not 'PLAY_PAUSE'
- ttsStateRef must be initialized via 'tts-state' message before saveProgress works
- Background playback routes 'tts-queue' to addToBatch, not speakBatch
- Queue boundary logic in onSpeechDone is complex:
  * ignores events when index < queueStartIndex
  * defers to WebView when index >= queueEndIndex

Next session should:
1. Run the failing tests to see exact error messages
2. Read onSpeechDone implementation (useTTSController.ts lines 1359-1432)
3. Fix tests to properly manipulate shared ref objects:
   - Ensure currentParagraphIndexRef.current matches test expectations
   - Verify queueStartIndexRef.current and queueEndIndexRef.current are correct
   - Check if wakeTransitionInProgressRef affects behavior
4. Validate isWebViewSyncedRef state if needed
5. Re-run tests until 534/534 pass

Documentation: See test-implementation-plan.md SESSION 8 for detailed patterns and fixes.

Goal: Achieve 534/534 passing (100%) by aligning final tests with actual implementation behavior.
```

## Session 8 Key Discoveries

### TTS Media Intent Strings
```typescript
// ❌ WRONG (simplified actions)
triggerNativeEvent('onMediaAction', { action: 'PLAY_PAUSE' });

// ✅ CORRECT (full Android intent strings)
triggerNativeEvent('onMediaAction', {
  action: 'com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE'
});
```

### Ref-Backed State Dependencies
```typescript
// Functions like saveProgress check multiple refs:
- ttsStateRef.current.paragraphIndex (must be set)
- chapterGeneralSettingsRef.current.ttsContinueToNextChapter (must be configured)
- isWebViewSyncedRef.current (must be true)
```

### Background Playback Routing
```typescript
// When ttsBackgroundPlayback = true:
'tts-queue' message → addToBatch() // ✅ correct
'tts-queue' message → speakBatch()  // ❌ wrong

// When ttsBackgroundPlayback = false:
'tts-queue' message → speakBatch() // ✅ correct
'tts-queue' message → addToBatch() // ❌ wrong
```

### Queue Boundary Logic in onSpeechDone
```typescript
// Complex boundary checking:
if (currentParagraphIndex < queueStartIndex) {
  // IGNORE event - don't process
  return;
}

if (currentParagraphIndex >= queueEndIndex) {
  // DEFER to WebView - inject 'tts.next?.()'
  return;
}

// Process event normally
```

## What This Will Do

The agent will:
1. **Run failing tests** to get exact error messages
2. **Read onSpeechDone implementation** (lines 1359-1432) to understand queue boundary logic
3. **Analyze ref object sharing** - ensure tests manipulate same refs as hook
4. **Fix test setup** to properly initialize refs before triggering events
5. **Validate test assertions** match actual implementation behavior
6. **Run full test suite** to confirm 534/534 tests pass

## Expected Outcome

By end of next session:
- ✅ All 534 integration tests passing (100%)
- ✅ Zero regressions in 532 passing tests
- ✅ All tests aligned with actual implementation
- ✅ Clean test suite ready for commit

## Files to Monitor

- `src/screens/reader/hooks/__tests__/useTTSController.integration.test.ts` (test file being fixed)
- `src/screens/reader/hooks/useTTSController.ts` (implementation reference)
- `docs/analysis/test-implementation-plan.md` (SESSION 8 completed)

No production code changes expected (all fixes in test code).

## Success Criteria

```bash
pnpm test -- useTTSController.integration.test.ts
# Expected output: Tests: 0 failed, 534 passed, 534 total
```

## Quick Reference: Implementation-First Patterns

### Ref Manipulation Pattern
```typescript
// ✅ CORRECT: Manipulate the same ref object
await act(async () => {
  result.current.currentParagraphIndex = 0; // Updates shared ref
});

// ❌ WRONG: Only update local state
expect(result.current.currentParagraphIndex).toBe(0); // May not update shared ref
```

### Message Initialization Pattern
```typescript
// ✅ Initialize ttsStateRef before testing
await act(async () => {
  const ttsStateEvent: any = {
    type: 'tts-state',
    data: {
      paragraphIndex: 0,
      timestamp: Date.now(),
    },
  };
  simulator.result.current.handleTTSMessage(ttsStateEvent);
});
```

### Observable Behaviors
```typescript
// Check these actual behaviors:
- mockSaveProgress.mock.calls.length (was saveProgress called?)
- mockInjectJavaScript.mock.calls (was JS injected?)
- TTSHighlight.speakBatch.mock.calls (was TTS called?)
```

## Final Implementation Notes

- The hook uses shared refs extensively across functions
- Queue boundary logic protects against invalid indices
- WebView sync state affects message processing
- Implementation-first approach prevents assuming behavior

Focus on aligning tests with what the code ACTUALLY does, not what we think it should do.