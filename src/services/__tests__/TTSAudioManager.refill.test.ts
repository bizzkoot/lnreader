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
