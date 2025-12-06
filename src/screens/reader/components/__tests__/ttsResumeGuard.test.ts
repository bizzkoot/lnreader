import createResumeGuard from '../ttsResumeGuard';

describe('ttsResumeGuard helper', () => {
  test('defers speak and queue while pending and processes on confirm', async () => {
    const guard = createResumeGuard();
    const spySpeak = jest.fn(() => Promise.resolve(true));
    const spyAddToBatch = jest.fn(() => Promise.resolve(true));

    // request confirmation
    guard.requestConfirmation(3);
    expect(guard.isPending()).toBe(true);

    // speak while pending -> deferred
    const allowed1 = guard.onSpeak('first', 3);
    expect(allowed1).toBe(false);

    // queue while pending -> deferred
    const allowed2 = guard.onQueue(4, ['a', 'b']);
    expect(allowed2).toBe(false);

    // confirm -> should call speak then addToBatch
    await guard.confirm(spySpeak, spyAddToBatch, 10);

    expect(spySpeak).toHaveBeenCalledTimes(1);
    expect(spySpeak).toHaveBeenCalledWith('first', 3);
    expect(spyAddToBatch).toHaveBeenCalledTimes(1);
    expect(spyAddToBatch).toHaveBeenCalledWith(['a', 'b'], ['chapter_10_utterance_4', 'chapter_10_utterance_5']);

    expect(guard.isPending()).toBe(false);
  });

  test('cancel clears pending items', () => {
    const guard = createResumeGuard();
    guard.requestConfirmation(5);
    guard.onSpeak('x');
    guard.onQueue(1, ['k']);
    expect(guard.isPending()).toBe(true);
    guard.cancel();
    expect(guard.isPending()).toBe(false);
    const st = guard._debugState();
    expect(st.deferredSpeakQueue.length).toBe(0);
    expect(st.queuedBatch).toBeNull();
  });
});
