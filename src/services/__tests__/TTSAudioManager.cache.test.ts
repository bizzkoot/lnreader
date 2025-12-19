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

const { NativeModules } = require('react-native');
const { TTSHighlight } = NativeModules as any;

const TTSAudioManager =
  require('../TTSAudioManager').default || require('../TTSAudioManager');

afterEach(() => {
  jest.clearAllMocks();
  // reset internal manager state
  (TTSAudioManager as any).currentQueue = [];
  (TTSAudioManager as any).currentUtteranceIds = [];
  (TTSAudioManager as any).currentIndex = 0;
  (TTSAudioManager as any).lastKnownQueueSize = 0;
  (TTSAudioManager as any).devCounters.cacheDriftDetections = 0;
  (TTSAudioManager as any).speechDoneCounter = 0;
});

describe('TTSAudioManager Cache Calibration', () => {
  test('calibrateQueueCache updates lastKnownQueueSize when drift > 5', async () => {
    // Set cached size
    (TTSAudioManager as any).lastKnownQueueSize = 10;

    // Mock actual queue size with significant drift
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(17);

    // Call calibration
    await (TTSAudioManager as any).calibrateQueueCache();

    // Verify cache was updated
    expect((TTSAudioManager as any).lastKnownQueueSize).toBe(17);
  });

  test('calibrateQueueCache increments devCounters.cacheDriftDetections when drift > 5', async () => {
    // Set cached size
    (TTSAudioManager as any).lastKnownQueueSize = 10;

    // Mock actual queue size with significant drift
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(16);

    // Initial counter should be 0
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(0);

    // Call calibration
    await (TTSAudioManager as any).calibrateQueueCache();

    // Verify counter was incremented
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(1);
  });

  test('calibrateQueueCache does not update when drift <= 5', async () => {
    // Set cached size
    (TTSAudioManager as any).lastKnownQueueSize = 10;

    // Mock actual queue size with small drift
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(13);

    // Call calibration
    await (TTSAudioManager as any).calibrateQueueCache();

    // Verify cache was NOT updated (drift is only 3)
    expect((TTSAudioManager as any).lastKnownQueueSize).toBe(10);

    // Verify counter was NOT incremented
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(0);
  });

  test('multiple drifts accumulate cacheDriftDetections counter', async () => {
    // First drift
    (TTSAudioManager as any).lastKnownQueueSize = 10;
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(20);
    await (TTSAudioManager as any).calibrateQueueCache();
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(1);

    // Second drift
    (TTSAudioManager as any).lastKnownQueueSize = 5;
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(15);
    await (TTSAudioManager as any).calibrateQueueCache();
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(2);

    // Third drift
    (TTSAudioManager as any).lastKnownQueueSize = 8;
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(2);
    await (TTSAudioManager as any).calibrateQueueCache();
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(3);
  });

  test('periodic calibration triggers every 10 spoken items', async () => {
    const calibrateSpy = jest.spyOn(
      TTSAudioManager as any,
      'calibrateQueueCache',
    );

    // Mock getQueueSize for calibration
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(10);

    // Simulate 9 speech done events
    for (let i = 0; i < 9; i++) {
      (TTSAudioManager as any).speechDoneCounter++;
      if ((TTSAudioManager as any).speechDoneCounter >= 10) {
        (TTSAudioManager as any).speechDoneCounter = 0;
        await (TTSAudioManager as any).calibrateQueueCache();
      }
    }

    // Should not have triggered calibration yet
    expect(calibrateSpy).not.toHaveBeenCalled();
    expect((TTSAudioManager as any).speechDoneCounter).toBe(9);

    // 10th event should trigger calibration
    (TTSAudioManager as any).speechDoneCounter++;
    if ((TTSAudioManager as any).speechDoneCounter >= 10) {
      (TTSAudioManager as any).speechDoneCounter = 0;
      await (TTSAudioManager as any).calibrateQueueCache();
    }

    expect(calibrateSpy).toHaveBeenCalledTimes(1);
    expect((TTSAudioManager as any).speechDoneCounter).toBe(0);

    calibrateSpy.mockRestore();
  });

  test('calibration is defensive and catches errors gracefully', async () => {
    // Mock getQueueSize to throw an error
    (TTSHighlight.getQueueSize as jest.Mock).mockRejectedValue(
      new Error('Native call failed'),
    );

    // Set cached size
    (TTSAudioManager as any).lastKnownQueueSize = 10;

    // Should not throw
    await expect(
      (TTSAudioManager as any).calibrateQueueCache(),
    ).resolves.not.toThrow();

    // Cache should remain unchanged
    expect((TTSAudioManager as any).lastKnownQueueSize).toBe(10);

    // Counter should not increment on error
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(0);
  });

  test('calibration handles negative drift (actual < cached)', async () => {
    // Set cached size higher
    (TTSAudioManager as any).lastKnownQueueSize = 20;

    // Mock actual queue size lower
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(12);

    // Call calibration (drift = |12 - 20| = 8 > 5)
    await (TTSAudioManager as any).calibrateQueueCache();

    // Verify cache was updated
    expect((TTSAudioManager as any).lastKnownQueueSize).toBe(12);

    // Verify counter was incremented
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(1);
  });

  test('calibration handles boundary case: drift exactly 5', async () => {
    // Set cached size
    (TTSAudioManager as any).lastKnownQueueSize = 10;

    // Mock actual queue size with drift exactly 5
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(15);

    // Call calibration (drift = 5, NOT > 5)
    await (TTSAudioManager as any).calibrateQueueCache();

    // Verify cache was NOT updated (drift must be GREATER than 5)
    expect((TTSAudioManager as any).lastKnownQueueSize).toBe(10);

    // Verify counter was NOT incremented
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(0);
  });

  test('calibration handles boundary case: drift exactly 6', async () => {
    // Set cached size
    (TTSAudioManager as any).lastKnownQueueSize = 10;

    // Mock actual queue size with drift exactly 6
    (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(16);

    // Call calibration (drift = 6, which is > 5)
    await (TTSAudioManager as any).calibrateQueueCache();

    // Verify cache WAS updated
    expect((TTSAudioManager as any).lastKnownQueueSize).toBe(16);

    // Verify counter WAS incremented
    expect((TTSAudioManager as any).devCounters.cacheDriftDetections).toBe(1);
  });
});
