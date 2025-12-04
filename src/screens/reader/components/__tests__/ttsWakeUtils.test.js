const {
  computeInitialIndex,
  buildBatch,
  shouldIgnoreSaveEvent,
} = require('../ttsWakeUtils');

describe('ttsWakeUtils', () => {
  describe('computeInitialIndex', () => {
    test('picks highest available index from multiple sources', () => {
      expect(computeInitialIndex(3, 5, 2)).toBe(5);
      expect(computeInitialIndex(10, 5, 2)).toBe(10);
      expect(computeInitialIndex(3, 5, 12)).toBe(12);
    });

    test('handles undefined/missing values gracefully', () => {
      expect(computeInitialIndex(undefined, -1, 10)).toBe(10);
      expect(computeInitialIndex(undefined, undefined, undefined)).toBe(-1);
      expect(computeInitialIndex(null, null, null)).toBe(-1);
      expect(computeInitialIndex(0, -1, -1)).toBe(0);
    });

    test('returns -1 when all sources are negative or missing', () => {
      expect(computeInitialIndex(-1, -1, -1)).toBe(-1);
      expect(computeInitialIndex()).toBe(-1);
    });
  });

  describe('buildBatch', () => {
    test('creates slice and correct utterance ids from startIndex', () => {
      const paragraphs = ['a', 'b', 'c', 'd'];
      const { startIndex, textsToSpeak, utteranceIds } = buildBatch(paragraphs, 2);
      expect(startIndex).toBe(2);
      expect(textsToSpeak).toEqual(['c', 'd']);
      expect(utteranceIds).toEqual(['chapter_XXX_utterance_2', 'chapter_XXX_utterance_3']);
    });

    test('defaults to 0 when startIndex is negative or undefined', () => {
      const paragraphs = ['a', 'b', 'c'];
      expect(buildBatch(paragraphs, -5).startIndex).toBe(0);
      expect(buildBatch(paragraphs, undefined).startIndex).toBe(0);
      expect(buildBatch(paragraphs, null).startIndex).toBe(0);
    });

    test('returns empty arrays when startIndex exceeds paragraph count', () => {
      const paragraphs = ['a', 'b'];
      const { textsToSpeak, utteranceIds } = buildBatch(paragraphs, 10);
      expect(textsToSpeak).toEqual([]);
      expect(utteranceIds).toEqual([]);
    });

    test('throws if paragraphs is not an array', () => {
      expect(() => buildBatch(null, 0)).toThrow('paragraphs must be an array');
      expect(() => buildBatch('string', 0)).toThrow('paragraphs must be an array');
    });
  });

  describe('shouldIgnoreSaveEvent', () => {
    test('ignores events from different chapter', () => {
      expect(
        shouldIgnoreSaveEvent({ eventChapterId: 123, currentChapterId: 456 }),
      ).toBe(true);
    });

    test('ignores events without chapterId during grace period', () => {
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 100,
          eventChapterId: undefined,
          currentChapterId: 1,
          latestIdx: -1,
          currentIdx: -1,
        }),
      ).toBe(true);
    });

    test('ignores events where incoming index is behind latest', () => {
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 100,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 3,
          latestIdx: 5,
        }),
      ).toBe(true);
    });

    test('ignores initial 0 save when we already have progress', () => {
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 100,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 0,
          latestIdx: 5,
        }),
      ).toBe(true);

      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 100,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 0,
          currentIdx: 10,
          latestIdx: -1,
        }),
      ).toBe(true);
    });

    test('accepts valid save events outside grace period', () => {
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 2000,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 2,
          latestIdx: 1,
        }),
      ).toBe(false);
    });

    test('accepts valid forward progress during grace period', () => {
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 500,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 10,
          latestIdx: 5,
        }),
      ).toBe(false);
    });

    test('accepts first save (0) when no prior progress exists', () => {
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 100,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 0,
          latestIdx: -1,
          currentIdx: -1,
        }),
      ).toBe(false);
    });
  });

  describe('TTS Wake Flow Simulation', () => {
    /**
     * Simulates the complete TTS wake flow:
     * 1. TTS plays in background, reaches paragraph N
     * 2. Screen wakes
     * 3. Pause TTS, sync UI to paragraph N
     * 4. Resume TTS from paragraph N
     */
    test('wake flow preserves paragraph position', () => {
      // Simulate: TTS was at paragraph 50 when screen woke
      const ttsProgressBeforeWake = 50;
      const dbIndex = 45; // DB slightly behind (async save)
      const mmkvIndex = 48; // MMKV slightly behind
      const ttsStateIndex = 50; // Most recent

      // Step 1: Compute initial index (should pick highest)
      const resolvedIndex = computeInitialIndex(dbIndex, mmkvIndex, ttsStateIndex);
      expect(resolvedIndex).toBe(50);

      // Step 2: Build batch from resolved index
      const paragraphs = Array.from({ length: 100 }, (_, i) => `Paragraph ${i}`);
      const { startIndex, textsToSpeak } = buildBatch(paragraphs, resolvedIndex);
      expect(startIndex).toBe(50);
      expect(textsToSpeak.length).toBe(50); // 100 - 50 remaining

      // Step 3: Verify stale saves are blocked
      // WebView might send 0 on reload
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 200,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 0,
          latestIdx: 50,
        }),
      ).toBe(true);

      // Old progress from before wake should be ignored
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 200,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 45,
          latestIdx: 50,
        }),
      ).toBe(true);

      // New progress (51) should be accepted
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 200,
          eventChapterId: 1,
          currentChapterId: 1,
          incomingIdx: 51,
          latestIdx: 50,
        }),
      ).toBe(false);
    });

    test('chapter transition preserves new chapter start at 0', () => {
      // When transitioning to a NEW chapter, 0 IS valid
      const dbIndex = -1; // No saved progress for new chapter
      const mmkvIndex = -1;
      const ttsStateIndex = -1;

      const resolvedIndex = computeInitialIndex(dbIndex, mmkvIndex, ttsStateIndex);
      expect(resolvedIndex).toBe(-1);

      // In this case, startIndex defaults to 0
      const paragraphs = ['First', 'Second', 'Third'];
      const { startIndex } = buildBatch(paragraphs, resolvedIndex);
      expect(startIndex).toBe(0);

      // First save of 0 should be accepted (no prior progress)
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 100,
          eventChapterId: 2,
          currentChapterId: 2,
          incomingIdx: 0,
          latestIdx: -1,
          currentIdx: -1,
        }),
      ).toBe(false);
    });

    test('background chapter advance scenario', () => {
      // TTS finishes chapter 1, auto-advances to chapter 2
      // User wakes screen during chapter 2, paragraph 30

      // Chapter 2 state
      const chapter2Progress = 30;
      const dbIndex = -1; // DB not yet updated
      const mmkvIndex = 28; // MMKV slightly behind
      const ttsStateIndex = 30; // Most recent from native TTS

      const resolvedIndex = computeInitialIndex(dbIndex, mmkvIndex, ttsStateIndex);
      expect(resolvedIndex).toBe(30);

      // Events from chapter 1 should be ignored
      expect(
        shouldIgnoreSaveEvent({
          eventChapterId: 1,
          currentChapterId: 2,
          incomingIdx: 150,
          latestIdx: 30,
        }),
      ).toBe(true);

      // Valid chapter 2 progress should be accepted
      expect(
        shouldIgnoreSaveEvent({
          timeSinceTransition: 500,
          eventChapterId: 2,
          currentChapterId: 2,
          incomingIdx: 31,
          latestIdx: 30,
        }),
      ).toBe(false);
    });
  });
});
