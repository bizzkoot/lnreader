// @ts-nocheck
// Scoped setup to avoid global variable conflicts with other test files
(function setupMocks() {
  // Mutate the real react-native NativeModules in test scope so module-level
  // construction of NativeEventEmitter in `TTSAudioManager` succeeds without
  // requiring global test environment changes.
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

  // Provide a tolerant NativeEventEmitter if the environment doesn't supply it
  if (!RN.NativeEventEmitter) {
    class MockNativeEventEmitter {
      constructor(_nativeModule?: any) {}
      addListener(_event: string, _cb: (...args: any[]) => void) {
        return { remove: () => {} };
      }
    }
    RN.NativeEventEmitter = MockNativeEventEmitter;
  }
})();

const { NativeModules: NativeModulesCache } = require('react-native');
const { TTSHighlight: TTSHighlightCache } = NativeModulesCache as any;

const TTSAudioManagerCache =
  require('../TTSAudioManager').default || require('../TTSAudioManager');

afterEach(() => {
  jest.clearAllMocks();
  // reset internal manager state
  (TTSAudioManagerCache as any).currentQueue = [];
  (TTSAudioManagerCache as any).currentUtteranceIds = [];
  (TTSAudioManagerCache as any).currentIndex = 0;
  (TTSAudioManagerCache as any).lastKnownQueueSize = 0;
  (TTSAudioManagerCache as any).devCounters.cacheDriftDetections = 0;
  (TTSAudioManagerCache as any).speechDoneCounter = 0;
});

describe('TTSAudioManager Cache Calibration', () => {
  test('calibrateQueueCache updates lastKnownQueueSize when drift > 5', async () => {
    // Set cached size
    (TTSAudioManagerCache as any).lastKnownQueueSize = 10;

    // Mock actual queue size with significant drift
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(17);

    // Call calibration
    await (TTSAudioManagerCache as any).calibrateQueueCache();

    // Verify cache was updated
    expect((TTSAudioManagerCache as any).lastKnownQueueSize).toBe(17);
  });

  test('calibrateQueueCache increments devCounters.cacheDriftDetections when drift > 5', async () => {
    // Set cached size
    (TTSAudioManagerCache as any).lastKnownQueueSize = 10;

    // Mock actual queue size with significant drift
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(16);

    // Initial counter should be 0
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      0,
    );

    // Call calibration
    await (TTSAudioManagerCache as any).calibrateQueueCache();

    // Verify counter was incremented
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      1,
    );
  });

  test('calibrateQueueCache does not update when drift <= 5', async () => {
    // Set cached size
    (TTSAudioManagerCache as any).lastKnownQueueSize = 10;

    // Mock actual queue size with small drift
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(13);

    // Call calibration
    await (TTSAudioManagerCache as any).calibrateQueueCache();

    // Verify cache was NOT updated (drift is only 3)
    expect((TTSAudioManagerCache as any).lastKnownQueueSize).toBe(10);

    // Verify counter was NOT incremented
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      0,
    );
  });

  test('multiple drifts accumulate cacheDriftDetections counter', async () => {
    // First drift
    (TTSAudioManagerCache as any).lastKnownQueueSize = 10;
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(20);
    await (TTSAudioManagerCache as any).calibrateQueueCache();
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      1,
    );

    // Second drift
    (TTSAudioManagerCache as any).lastKnownQueueSize = 5;
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(15);
    await (TTSAudioManagerCache as any).calibrateQueueCache();
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      2,
    );

    // Third drift
    (TTSAudioManagerCache as any).lastKnownQueueSize = 8;
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(2);
    await (TTSAudioManagerCache as any).calibrateQueueCache();
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      3,
    );
  });

  test('periodic calibration triggers every 10 spoken items', async () => {
    const calibrateSpy = jest.spyOn(
      TTSAudioManagerCache as any,
      'calibrateQueueCache',
    );

    // Mock getQueueSize for calibration
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(10);

    // Simulate 9 speech done events
    for (let i = 0; i < 9; i++) {
      (TTSAudioManagerCache as any).speechDoneCounter++;
      if ((TTSAudioManagerCache as any).speechDoneCounter >= 10) {
        (TTSAudioManagerCache as any).speechDoneCounter = 0;
        await (TTSAudioManagerCache as any).calibrateQueueCache();
      }
    }

    // Should not have triggered calibration yet
    expect(calibrateSpy).not.toHaveBeenCalled();
    expect((TTSAudioManagerCache as any).speechDoneCounter).toBe(9);

    // 10th event should trigger calibration
    (TTSAudioManagerCache as any).speechDoneCounter++;
    if ((TTSAudioManagerCache as any).speechDoneCounter >= 10) {
      (TTSAudioManagerCache as any).speechDoneCounter = 0;
      await (TTSAudioManagerCache as any).calibrateQueueCache();
    }

    expect(calibrateSpy).toHaveBeenCalledTimes(1);
    expect((TTSAudioManagerCache as any).speechDoneCounter).toBe(0);

    calibrateSpy.mockRestore();
  });

  test('calibration is defensive and catches errors gracefully', async () => {
    // Mock getQueueSize to throw an error
    (TTSHighlightCache.getQueueSize as jest.Mock).mockRejectedValue(
      new Error('Native call failed'),
    );

    // Set cached size
    (TTSAudioManagerCache as any).lastKnownQueueSize = 10;

    // Should not throw
    await expect(
      (TTSAudioManagerCache as any).calibrateQueueCache(),
    ).resolves.not.toThrow();

    // Cache should remain unchanged
    expect((TTSAudioManagerCache as any).lastKnownQueueSize).toBe(10);

    // Counter should not increment on error
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      0,
    );
  });

  test('calibration handles negative drift (actual < cached)', async () => {
    // Set cached size higher
    (TTSAudioManagerCache as any).lastKnownQueueSize = 20;

    // Mock actual queue size lower
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(12);

    // Call calibration (drift = |12 - 20| = 8 > 5)
    await (TTSAudioManagerCache as any).calibrateQueueCache();

    // Verify cache was updated
    expect((TTSAudioManagerCache as any).lastKnownQueueSize).toBe(12);

    // Verify counter was incremented
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      1,
    );
  });

  test('calibration handles boundary case: drift exactly 5', async () => {
    // Set cached size
    (TTSAudioManagerCache as any).lastKnownQueueSize = 10;

    // Mock actual queue size with drift exactly 5
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(15);

    // Call calibration (drift = 5, NOT > 5)
    await (TTSAudioManagerCache as any).calibrateQueueCache();

    // Verify cache was NOT updated (drift must be GREATER than 5)
    expect((TTSAudioManagerCache as any).lastKnownQueueSize).toBe(10);

    // Verify counter was NOT incremented
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      0,
    );
  });

  test('calibration handles boundary case: drift exactly 6', async () => {
    // Set cached size
    (TTSAudioManagerCache as any).lastKnownQueueSize = 10;

    // Mock actual queue size with drift exactly 6
    (TTSHighlightCache.getQueueSize as jest.Mock).mockResolvedValue(16);

    // Call calibration (drift = 6, which is > 5)
    await (TTSAudioManagerCache as any).calibrateQueueCache();

    // Verify cache WAS updated
    expect((TTSAudioManagerCache as any).lastKnownQueueSize).toBe(16);

    // Verify counter WAS incremented
    expect((TTSAudioManagerCache as any).devCounters.cacheDriftDetections).toBe(
      1,
    );
  });
});
