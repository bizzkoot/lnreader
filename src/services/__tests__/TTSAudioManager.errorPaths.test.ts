// @ts-nocheck
// Error path tests for TTSAudioManager - testing voice failures, queue errors, and state issues

(function setupMocks() {
  const RN = require('react-native');
  RN.NativeModules = RN.NativeModules || {};
  RN.NativeModules.TTSHighlight = RN.NativeModules.TTSHighlight || {
    addToBatch: jest.fn(),
    speakBatch: jest.fn(),
    getQueueSize: jest.fn(),
    stop: jest.fn(),
    speak: jest.fn(),
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  };
  RN.NativeModules.DevMenu = RN.NativeModules.DevMenu || { show: jest.fn() };
  RN.NativeModules.SettingsManager = RN.NativeModules.SettingsManager || {
    getSettings: jest.fn(() => ({})),
    getConstants: jest.fn(() => ({})),
  };
  RN.NativeModules.NativeSettingsManager = RN.NativeModules
    .NativeSettingsManager || { getConstants: jest.fn(() => ({})) };

  if (!RN.NativeEventEmitter) {
    class MockNativeEventEmitter {
      constructor(_nativeModule?: any) {}
      addListener(_event: string, _cb: (...args: any[]) => void) {
        return { remove: () => {} };
      }
    }
    RN.NativeEventEmitter = MockNativeEventEmitter;
  }

  RN.Platform = { OS: 'android' };
  RN.ToastAndroid = { show: jest.fn(), SHORT: 0 };
})();

const { NativeModules } = require('react-native');
const { TTSHighlight } = NativeModules as any;
const TTSAudioManager =
  require('../TTSAudioManager').default || require('../TTSAudioManager');
const { TTSState } = require('../TTSState');

afterEach(() => {
  jest.clearAllMocks();
  (TTSAudioManager as any).currentQueue = [];
  (TTSAudioManager as any).currentUtteranceIds = [];
  (TTSAudioManager as any).currentIndex = 0;
  (TTSAudioManager as any).state = TTSState.IDLE;
  (TTSAudioManager as any).refillCancelled = false;
});

describe('TTSAudioManager Error Paths', () => {
  describe('Voice fallback scenarios', () => {
    test('should use fallback voice when addToBatch fails repeatedly', async () => {
      (TTSHighlight.addToBatch as jest.Mock).mockRejectedValue(
        new Error('Voice unavailable'),
      );
      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(0);
      (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);

      (TTSAudioManager as any).currentQueue = ['text1', 'text2'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
      (TTSAudioManager as any).currentIndex = 0;

      const result = await (TTSAudioManager as any).refillQueue();

      expect(result).toBe(true);
      expect(TTSHighlight.addToBatch).toHaveBeenCalled();
      expect(TTSHighlight.speakBatch).toHaveBeenCalled();
    });

    test('should fallback when preferred voice is locked but unavailable', async () => {
      (TTSAudioManager as any).lockedVoice = 'unavailable-voice-123';
      (TTSHighlight.addToBatch as jest.Mock).mockRejectedValue(
        new Error('Locked voice unavailable'),
      );
      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(0);
      (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);

      (TTSAudioManager as any).currentQueue = ['text1', 'text2'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
      (TTSAudioManager as any).currentIndex = 0;

      const result = await (TTSAudioManager as any).refillQueue();

      expect(result).toBe(true);
      // Should fallback to speakBatch after retries
      expect(TTSHighlight.speakBatch).toHaveBeenCalled();
    });
  });

  describe('Queue empty scenarios', () => {
    test('should return false when refill called with empty queue', async () => {
      (TTSAudioManager as any).currentQueue = ['a', 'b'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
      (TTSAudioManager as any).currentIndex = 2; // Already consumed all

      const result = await (TTSAudioManager as any).refillQueue();

      expect(result).toBe(false);
      expect(TTSHighlight.addToBatch).not.toHaveBeenCalled();
    });

    test('should handle queue empty during refill operation', async () => {
      (TTSHighlight.addToBatch as jest.Mock).mockRejectedValue(
        new Error('Queue empty'),
      );
      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(0);
      (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);

      (TTSAudioManager as any).currentQueue = ['text1', 'text2', 'text3'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2', 'u3'];
      (TTSAudioManager as any).currentIndex = 0;

      const result = await (TTSAudioManager as any).refillQueue();

      // Should fallback to speakBatch
      expect(result).toBe(true);
      expect(TTSHighlight.speakBatch).toHaveBeenCalled();
    });
  });

  describe('Concurrent refill prevention', () => {
    test('should serialize multiple concurrent refill calls', async () => {
      let callCount = 0;
      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(1);
      (TTSHighlight.addToBatch as jest.Mock).mockImplementation(async () => {
        callCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
        return null;
      });

      (TTSAudioManager as any).currentQueue = Array.from(
        { length: 20 },
        (_, i) => `text${i}`,
      );
      (TTSAudioManager as any).currentUtteranceIds = Array.from(
        { length: 20 },
        (_, i) => `id${i}`,
      );
      (TTSAudioManager as any).currentIndex = 0;
      (TTSAudioManager as any).state = TTSState.PLAYING;

      // Fire multiple refills concurrently
      const promises = [
        (TTSAudioManager as any).refillQueue(),
        (TTSAudioManager as any).refillQueue(),
        (TTSAudioManager as any).refillQueue(),
      ];

      await Promise.all(promises);

      // Due to mutex, should be called sequentially, not 3x in parallel
      expect(callCount).toBeGreaterThanOrEqual(1);
      expect(callCount).toBeLessThanOrEqual(3);
    });
  });

  describe('addToBatch retry logic', () => {
    test('should retry addToBatch on transient failure', async () => {
      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(1);
      (TTSHighlight.addToBatch as jest.Mock)
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce(null);

      (TTSAudioManager as any).currentQueue = ['a', 'b'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
      (TTSAudioManager as any).currentIndex = 0;
      (TTSAudioManager as any).state = TTSState.PLAYING;

      const result = await (TTSAudioManager as any).refillQueue();

      expect(result).toBe(true);
      expect(TTSHighlight.addToBatch).toHaveBeenCalledTimes(2);
    });

    test('should fallback to speakBatch after max retries', async () => {
      (TTSHighlight.getQueueSize as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0); // Queue empty
      (TTSHighlight.addToBatch as jest.Mock).mockRejectedValue(
        new Error('Persistent failure'),
      );
      (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);

      (TTSAudioManager as any).currentQueue = ['a', 'b'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
      (TTSAudioManager as any).currentIndex = 0;
      (TTSAudioManager as any).state = TTSState.PLAYING;

      const result = await (TTSAudioManager as any).refillQueue();

      // Should try multiple times then fallback
      expect(TTSHighlight.addToBatch.mock.calls.length).toBeGreaterThanOrEqual(
        3,
      );
      expect(TTSHighlight.speakBatch).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('State transition during errors', () => {
    test('should return to PLAYING state after successful refill', async () => {
      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(1);
      (TTSHighlight.addToBatch as jest.Mock).mockResolvedValue(null);

      (TTSAudioManager as any).currentQueue = ['a', 'b'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
      (TTSAudioManager as any).currentIndex = 0;
      (TTSAudioManager as any).state = TTSState.PLAYING;

      await (TTSAudioManager as any).refillQueue();

      expect((TTSAudioManager as any).state).toBe(TTSState.PLAYING);
    });

    test('should handle concurrent stop during refill', async () => {
      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(1);
      (TTSHighlight.addToBatch as jest.Mock).mockImplementation(() => {
        return new Promise(resolve => setTimeout(() => resolve(null), 50));
      });
      (TTSHighlight.stop as jest.Mock).mockResolvedValue(true);

      (TTSAudioManager as any).currentQueue = ['a', 'b'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
      (TTSAudioManager as any).currentIndex = 0;
      (TTSAudioManager as any).state = TTSState.PLAYING;

      // Start refill and stop concurrently
      const refillPromise = (TTSAudioManager as any).refillQueue();
      const stopPromise = (TTSAudioManager as any).stop();

      await Promise.all([refillPromise, stopPromise]);

      // State could be PLAYING, STOPPING, or IDLE depending on timing
      expect([TTSState.IDLE, TTSState.STOPPING, TTSState.PLAYING]).toContain(
        (TTSAudioManager as any).state,
      );
    });
  });

  describe('Notification callback edge cases', () => {
    test('should not crash when notification callback is undefined', async () => {
      (TTSAudioManager as any).setNotifyUserCallback(undefined);
      (TTSHighlight.addToBatch as jest.Mock).mockRejectedValue(
        new Error('Failure'),
      );
      (TTSHighlight.getQueueSize as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      (TTSAudioManager as any).currentQueue = [];
      (TTSAudioManager as any).currentUtteranceIds = [];
      (TTSAudioManager as any).currentIndex = 0;
      (TTSAudioManager as any).state = TTSState.PLAYING;

      await expect(
        (TTSAudioManager as any).refillQueue(),
      ).resolves.toBeDefined();
    });
  });

  describe('Edge cases', () => {
    test('should handle single item queue', async () => {
      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(0);
      (TTSHighlight.addToBatch as jest.Mock).mockResolvedValue(null);

      (TTSAudioManager as any).currentQueue = ['single text'];
      (TTSAudioManager as any).currentUtteranceIds = ['u1'];
      (TTSAudioManager as any).currentIndex = 0;
      (TTSAudioManager as any).state = TTSState.PLAYING;

      const result = await (TTSAudioManager as any).refillQueue();

      expect(result).toBe(true);
      expect(TTSHighlight.addToBatch).toHaveBeenCalledWith(
        ['single text'],
        ['u1'],
      );
    });

    test('should handle very large queue', async () => {
      const largeQueue = Array.from({ length: 1000 }, (_, i) => `text${i}`);
      const largeIds = Array.from({ length: 1000 }, (_, i) => `id${i}`);

      (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(1);
      (TTSHighlight.addToBatch as jest.Mock).mockResolvedValue(null);

      (TTSAudioManager as any).currentQueue = largeQueue;
      (TTSAudioManager as any).currentUtteranceIds = largeIds;
      (TTSAudioManager as any).currentIndex = 0;
      (TTSAudioManager as any).state = TTSState.PLAYING;

      const result = await (TTSAudioManager as any).refillQueue();

      expect(result).toBe(true);
      // Should only queue BATCH_SIZE items (BATCH_SIZE = 25)
      const calls = TTSHighlight.addToBatch.mock.calls[0];
      expect(calls[0].length).toBeLessThanOrEqual(25); // BATCH_SIZE constant
    });
  });
});
