// Ensure React Native env dev flag is present for logging guards
(global as any).__DEV__ = true;

jest.mock('react-native', () => ({
    NativeModules: {
      TTSHighlight: {
        pause: jest.fn(),
        getVoices: jest.fn(),
        addToBatch: jest.fn(),
        speakBatch: jest.fn(),
        getQueueSize: jest.fn(),
        stop: jest.fn(),
      },
    },
    NativeEventEmitter: jest.fn().mockImplementation(() => ({
      addListener: jest.fn(() => ({ remove: jest.fn() })),
    })),
}));

const { NativeModules } = require('react-native');
import TTSAudioManager from '../TTSAudioManager';

describe('TTSAudioManager helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
    // reset internal queue state
    (TTSAudioManager as any).currentQueue = [];
    (TTSAudioManager as any).currentUtteranceIds = [];
    (TTSAudioManager as any).currentIndex = 0;
  });

  test('pauseWithTimeout resolves true when pause resolves quickly', async () => {
    (NativeModules as any).TTSHighlight.pause.mockResolvedValue(undefined);
    const res = await TTSAudioManager.pauseWithTimeout(500);
    expect(res).toBe(true);
  });

  test('pauseWithTimeout times out when pause does not resolve', async () => {
    jest.useFakeTimers();
    // pause returns a promise that never resolves
    (NativeModules as any).TTSHighlight.pause.mockImplementation(() => new Promise(() => {}));

    const promise = TTSAudioManager.pauseWithTimeout(1000);
    // advance timers to trigger timeout
    jest.advanceTimersByTime(1000);
    const res = await promise;
    expect(res).toBe(false);
    jest.useRealTimers();
  });

  test('removeQueuedForChapterIds removes matching utterances', () => {
    (TTSAudioManager as any).currentUtteranceIds = [
      'chapter_10_utterance_0',
      'chapter_11_utterance_1',
      'random_utterance_2',
    ];
    (TTSAudioManager as any).currentQueue = ['a', 'b', 'c'];
    (TTSAudioManager as any).currentIndex = 3;

    TTSAudioManager.removeQueuedForChapterIds(['11']);

    const ids = (TTSAudioManager as any).currentUtteranceIds;
    const queue = (TTSAudioManager as any).currentQueue;
    expect(ids).not.toContain('chapter_11_utterance_1');
    expect(queue.length).toBe(2);
  });

  test('clearRemainingQueue clears internal queue state', () => {
    (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
    (TTSAudioManager as any).currentQueue = ['t1', 't2'];
    (TTSAudioManager as any).currentIndex = 2;
    TTSAudioManager.clearRemainingQueue();
    expect((TTSAudioManager as any).currentQueue.length).toBe(0);
    expect((TTSAudioManager as any).currentUtteranceIds.length).toBe(0);
    expect((TTSAudioManager as any).currentIndex).toBe(0);
  });

  describe('speakBatch', () => {
    afterEach(() => {
      jest.clearAllMocks();
      (TTSAudioManager as any).currentQueue = [];
      (TTSAudioManager as any).currentUtteranceIds = [];
      (TTSAudioManager as any).currentIndex = 0;
    });

    test('uses preferred voice when getVoices reports it is available', async () => {
      const native = NativeModules as any;
      native.TTSHighlight.getVoices.mockResolvedValue([{ identifier: 'voice_1' }]);
      native.TTSHighlight.speakBatch.mockResolvedValue(undefined);

      const texts = ['a', 'b'];
      const ids = ['id_a', 'id_b'];

      const count = await TTSAudioManager.speakBatch(texts, ids, { voice: 'voice_1' });

      expect(native.TTSHighlight.getVoices).toHaveBeenCalled();
      expect(native.TTSHighlight.speakBatch).toHaveBeenCalled();
      const opts = native.TTSHighlight.speakBatch.mock.calls[0][2];
      expect(opts.voice).toBe('voice_1');
      expect(count).toBe(texts.length);
    });

    test('falls back to system default immediately when preferred voice not present', async () => {
      const native = NativeModules as any;
      native.TTSHighlight.getVoices.mockResolvedValue([{ identifier: 'other' }]);
      native.TTSHighlight.speakBatch.mockResolvedValue(undefined);

      const texts = ['a', 'b'];
      const ids = ['id_a', 'id_b'];

      const count = await TTSAudioManager.speakBatch(texts, ids, { voice: 'missing_voice' });

      expect(native.TTSHighlight.getVoices).toHaveBeenCalled();
      expect(native.TTSHighlight.speakBatch).toHaveBeenCalled();
      const opts = native.TTSHighlight.speakBatch.mock.calls[0][2];
      expect(opts.voice).toBeUndefined();
      expect(count).toBe(texts.length);
    });

    test('if initial batch fails with requested voice, fallback to system default', async () => {
      const native = NativeModules as any;
      native.TTSHighlight.getVoices.mockResolvedValue([{ identifier: 'voice_ok' }]);
      // If called with a voice -> reject, otherwise succeed
      native.TTSHighlight.speakBatch.mockImplementation((texts: any, ids: any, opts: any) => {
        if (opts && opts.voice) return Promise.reject(new Error('bad voice'));
        return Promise.resolve(undefined);
      });

      const texts = ['a', 'b'];
      const ids = ['id_a', 'id_b'];

      const count = await TTSAudioManager.speakBatch(texts, ids, { voice: 'voice_ok' });

      // Expect speakBatch called at least twice (failed attempt + fallback)
      expect(native.TTSHighlight.speakBatch.mock.calls.length).toBeGreaterThanOrEqual(2);
      // Final call should not pass a voice
      const finalCallOpts = native.TTSHighlight.speakBatch.mock.calls.slice(-1)[0][2];
      expect(finalCallOpts.voice).toBeUndefined();
      expect(count).toBe(texts.length);
    });

    test('if getVoices throws we still try with requested voice', async () => {
      const native = NativeModules as any;
      native.TTSHighlight.getVoices.mockRejectedValue(new Error('boom'));
      native.TTSHighlight.speakBatch.mockResolvedValue(undefined);

      const texts = ['a', 'b'];
      const ids = ['id_a', 'id_b'];

      const count = await TTSAudioManager.speakBatch(texts, ids, { voice: 'someVoice' });

      expect(native.TTSHighlight.getVoices).toHaveBeenCalled();
      // Since getVoices failed we should still attempt with requested voice
      const opts = native.TTSHighlight.speakBatch.mock.calls[0][2];
      expect(opts.voice).toBe('someVoice');
      expect(count).toBe(texts.length);
    });

    test('currentIndex is set to actual queued batch length (not constant BATCH_SIZE)', async () => {
      const native = NativeModules as any;
      native.TTSHighlight.getVoices.mockResolvedValue([{ identifier: 'v' }]);
      native.TTSHighlight.speakBatch.mockResolvedValue(undefined);

      const texts = ['only_one'];
      const ids = ['id_1'];

      await TTSAudioManager.speakBatch(texts, ids, { voice: 'v' });

      const idx = (TTSAudioManager as any).currentIndex;
      expect(idx).toBe(1);
    });
  });
});
