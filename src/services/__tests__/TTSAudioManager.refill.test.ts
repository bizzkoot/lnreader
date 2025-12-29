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

const { NativeModules } = require('react-native');
const { TTSHighlight } = NativeModules as any;

const TTSAudioManager =
  require('../TTSAudioManager').default || require('../TTSAudioManager');
const { TTSState } = require('../TTSState');

afterEach(() => {
  jest.clearAllMocks();
  // reset internal manager state
  (TTSAudioManager as any).currentQueue = [];
  (TTSAudioManager as any).currentUtteranceIds = [];
  (TTSAudioManager as any).currentIndex = 0;
  (TTSAudioManager as any).state = TTSState.IDLE;
  (TTSAudioManager as any).refillCancelled = false;
});

test('refillQueue falls back to speakBatch after addToBatch failures', async () => {
  (TTSHighlight.addToBatch as jest.Mock).mockRejectedValue(
    new Error('Failed to add'),
  );
  (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(0);
  (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);

  (TTSAudioManager as any).currentQueue = ['a', 'b'];
  (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
  (TTSAudioManager as any).currentIndex = 0;

  const res = await (TTSAudioManager as any).refillQueue();

  expect(res).toBe(true);
  expect(TTSHighlight.addToBatch).toHaveBeenCalled();
  expect(TTSHighlight.getQueueSize).toHaveBeenCalled();
  expect(TTSHighlight.speakBatch).toHaveBeenCalledWith(
    ['a', 'b'],
    ['u1', 'u2'],
    expect.any(Object),
  );
});

test('refillQueue fallback uses locked voice (not system default)', async () => {
  // Simulate addToBatch failure and empty native queue
  (TTSHighlight.addToBatch as jest.Mock).mockRejectedValue(
    new Error('Failed to add'),
  );
  (TTSHighlight.getQueueSize as jest.Mock)
    .mockResolvedValueOnce(0) // initial queue size check
    .mockResolvedValueOnce(0); // queue size after addToBatch failures
  (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);

  // Lock voice by starting a batch with explicit voice
  await (TTSAudioManager as any).speakBatch(['t1'], ['id1'], {
    voice: 'en-us-x-foo-network',
    rate: 1,
    pitch: 1,
  });

  (TTSAudioManager as any).currentQueue = ['a'];
  (TTSAudioManager as any).currentUtteranceIds = ['u1'];
  (TTSAudioManager as any).currentIndex = 0;

  const res = await (TTSAudioManager as any).refillQueue();

  expect(res).toBe(true);
  expect(TTSHighlight.speakBatch).toHaveBeenLastCalledWith(
    ['a'],
    ['u1'],
    expect.objectContaining({ voice: 'en-us-x-foo-network' }),
  );
});

test('speakBatch sanitizes voice object into identifier string', async () => {
  (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);

  await (TTSAudioManager as any).speakBatch(['t1'], ['id1'], {
    // Simulate a bad caller passing the whole voice object
    voice: { identifier: 'en-us-x-bar-network', name: 'Bar' },
    rate: 1,
    pitch: 1,
  });

  expect(TTSHighlight.speakBatch).toHaveBeenCalledWith(
    ['t1'],
    ['id1'],
    expect.objectContaining({ voice: 'en-us-x-bar-network' }),
  );
});

test('refillQueue notifies user when fallback speakBatch also fails', async () => {
  (TTSHighlight.addToBatch as jest.Mock).mockRejectedValue(
    new Error('Failed to add'),
  );
  (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(0);
  (TTSHighlight.speakBatch as jest.Mock).mockRejectedValue(
    new Error('Fallback failed'),
  );

  (TTSAudioManager as any).currentQueue = ['a'];
  (TTSAudioManager as any).currentUtteranceIds = ['u1'];
  (TTSAudioManager as any).currentIndex = 0;

  const notifySpy = jest.fn();
  (TTSAudioManager as any).setNotifyUserCallback(notifySpy);

  const res = await (TTSAudioManager as any).refillQueue();

  expect(res).toBe(false);
  expect(notifySpy).toHaveBeenCalledWith(
    expect.stringContaining('TTS failed to queue audio'),
  );
});

test('refillQueue sets state to REFILLING during operation', async () => {
  (TTSHighlight.addToBatch as jest.Mock).mockResolvedValue(true);
  (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(5);

  (TTSAudioManager as any).currentQueue = ['a', 'b'];
  (TTSAudioManager as any).currentUtteranceIds = ['u1', 'u2'];
  (TTSAudioManager as any).currentIndex = 0;
  (TTSAudioManager as any).state = TTSState.PLAYING;

  // Start refill
  const refillPromise = (TTSAudioManager as any).refillQueue();

  // CRITICAL-2 FIX: With mutex pattern, refill is wrapped in promise chain
  // Let microtask queue process so mutex can start the refill operation
  await Promise.resolve();

  // During refill, state should be REFILLING
  expect((TTSAudioManager as any).state).toBe(TTSState.REFILLING);

  await refillPromise;

  // After refill, state should return to PLAYING
  expect((TTSAudioManager as any).state).toBe(TTSState.PLAYING);
});

test('stop() cancels ongoing refill operations without state transition errors', async () => {
  // Simulate slow addToBatch that takes time to complete
  let addToBatchResolver: (value: boolean) => void;
  const addToBatchPromise = new Promise<boolean>(resolve => {
    addToBatchResolver = resolve;
  });
  (TTSHighlight.addToBatch as jest.Mock).mockReturnValue(addToBatchPromise);
  (TTSHighlight.getQueueSize as jest.Mock).mockResolvedValue(2);
  (TTSHighlight.stop as jest.Mock).mockResolvedValue(true);
  (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);

  // Setup: Start with a batch so state is PLAYING
  await (TTSAudioManager as any).speakBatch(
    ['a', 'b', 'c'],
    ['u1', 'u2', 'u3'],
    {
      rate: 1,
      pitch: 1,
    },
  );

  // Verify state is PLAYING
  expect((TTSAudioManager as any).state).toBe(TTSState.PLAYING);

  // Setup currentIndex for refill
  (TTSAudioManager as any).currentIndex = 1; // Simulate having played one item

  // Start refill (will be slow due to our mock)
  const refillPromise = (TTSAudioManager as any).refillQueue();

  // Let microtask queue process so mutex starts the refill
  await Promise.resolve();
  await Promise.resolve();

  // Verify refill started
  expect((TTSAudioManager as any).state).toBe(TTSState.REFILLING);

  // Now call stop() while refill is in progress
  const stopPromise = (TTSAudioManager as any).stop();

  // Let stop() complete
  await stopPromise;

  // Verify stop() succeeded and set cancellation flag
  expect((TTSAudioManager as any).refillCancelled).toBe(true);
  expect((TTSAudioManager as any).state).toBe(TTSState.IDLE);

  // Now complete the slow addToBatch
  addToBatchResolver!(true);

  // Wait for refill to complete
  const refillResult = await refillPromise;

  // Refill should have been cancelled and returned false
  expect(refillResult).toBe(false);

  // State should still be IDLE (no invalid transition to PLAYING)
  expect((TTSAudioManager as any).state).toBe(TTSState.IDLE);
});

test('speakBatch resets refill cancellation flag for new session', async () => {
  (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);
  (TTSHighlight.stop as jest.Mock).mockResolvedValue(true);

  // First, simulate a stop that sets the cancellation flag
  (TTSAudioManager as any).currentQueue = ['a'];
  (TTSAudioManager as any).currentUtteranceIds = ['u1'];
  (TTSAudioManager as any).state = TTSState.PLAYING;
  await (TTSAudioManager as any).stop();

  // Verify flag is set
  expect((TTSAudioManager as any).refillCancelled).toBe(true);

  // Now start a new batch
  await (TTSAudioManager as any).speakBatch(['new1', 'new2'], ['id1', 'id2'], {
    rate: 1,
    pitch: 1,
  });

  // Flag should be reset for new session
  expect((TTSAudioManager as any).refillCancelled).toBe(false);
  expect((TTSAudioManager as any).state).toBe(TTSState.PLAYING);
});
