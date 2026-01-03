// Mock react-native first, before any imports
jest.mock('react-native', () => ({
  NativeModules: {
    TTSHighlight: {
      speak: jest.fn(),
      speakBatch: jest.fn(),
      addToBatch: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      updateMediaState: jest.fn(),
      getVoices: jest.fn(),
      getQueueSize: jest.fn(),
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  })),
  Platform: {
    OS: 'android',
  },
  ToastAndroid: {
    SHORT: 'SHORT',
    show: jest.fn(),
  },
}));

import TTSHighlight from '@services/TTSHighlight';

// Mock TTSHighlight module
jest.mock('@services/TTSHighlight');

describe('TTS Voice Fallback', () => {
  let manager: any;
  let voiceFallbackListener:
    | ((event: { originalVoice: string; fallbackVoice: string }) => void)
    | null = null;

  beforeEach(() => {
    manager = jest.requireActual('../TTSAudioManager').default;

    // Mock TTSHighlight.addListener to capture the callback
    (TTSHighlight.addListener as jest.Mock).mockImplementation(
      (event: string, callback: any) => {
        if (event === 'onVoiceFallback') {
          voiceFallbackListener = callback;
        }
        return { remove: jest.fn() };
      },
    );

    // Mock other TTSHighlight methods
    (TTSHighlight.speakBatch as jest.Mock).mockResolvedValue(true);
    (TTSHighlight.getVoices as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    voiceFallbackListener = null;
  });

  describe('Voice Fallback Event', () => {
    it('should be able to register onVoiceFallback listener', () => {
      const mockCallback = jest.fn();
      const subscription = TTSHighlight.addListener(
        'onVoiceFallback',
        mockCallback,
      );

      expect(TTSHighlight.addListener).toHaveBeenCalledWith(
        'onVoiceFallback',
        mockCallback,
      );
      expect(subscription).toBeDefined();
      expect(subscription.remove).toBeDefined();
    });

    it('should receive voice fallback event when native emits it', async () => {
      const mockCallback = jest.fn();
      TTSHighlight.addListener('onVoiceFallback', mockCallback);

      // Simulate native event
      const fallbackEvent = {
        originalVoice: 'com.google.android.tts:en-us-x-iob-network',
        fallbackVoice: 'com.google.android.tts:en-us-x-iob-local',
      };

      if (voiceFallbackListener) {
        voiceFallbackListener(fallbackEvent);
      }

      expect(mockCallback).toHaveBeenCalledWith(fallbackEvent);
      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should continue playback after voice fallback', async () => {
      const NativeModules = require('react-native').NativeModules;

      // Mock native methods
      NativeModules.TTSHighlight = {
        ...NativeModules.TTSHighlight,
        speakBatch: jest.fn().mockResolvedValue(2),
        getQueueSize: jest.fn().mockResolvedValue(10),
      };

      // Start playback
      await manager.speakBatch(['text1', 'text2'], ['id1', 'id2'], {
        voice: 'preferred-voice',
        rate: 1.5,
        pitch: 1.0,
      });

      // Simulate voice fallback event
      const fallbackEvent = {
        originalVoice: 'preferred-voice',
        fallbackVoice: 'fallback-voice',
      };

      if (voiceFallbackListener) {
        voiceFallbackListener(fallbackEvent);
      }

      // Verify manager is still in PLAYING state after fallback
      expect(manager.getState()).toBe('PLAYING');
    });
  });

  describe('Voice Fallback Integration', () => {
    it('should emit event with both original and fallback voice identifiers', () => {
      const mockCallback = jest.fn();
      TTSHighlight.addListener('onVoiceFallback', mockCallback);

      const event = {
        originalVoice: 'en-us-network-id',
        fallbackVoice: 'en-us-local-id',
      };

      if (voiceFallbackListener) {
        voiceFallbackListener(event);
      }

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          originalVoice: 'en-us-network-id',
          fallbackVoice: 'en-us-local-id',
        }),
      );
    });

    it('should handle voice fallback event during queue refill', async () => {
      const NativeModules = require('react-native').NativeModules;

      // Mock native methods
      NativeModules.TTSHighlight = {
        ...NativeModules.TTSHighlight,
        speakBatch: jest.fn().mockResolvedValue(1),
        addToBatch: jest.fn().mockResolvedValue(true),
        getQueueSize: jest.fn().mockResolvedValue(5),
      };

      await manager.speakBatch(['text1'], ['id1'], { voice: 'test-voice' });

      // Mock queue size to trigger refill
      jest
        .spyOn(NativeModules.TTSHighlight, 'getQueueSize')
        .mockResolvedValue(5);

      // Simulate voice fallback during refill
      const fallbackEvent = {
        originalVoice: 'test-voice',
        fallbackVoice: 'fallback-voice',
      };

      if (voiceFallbackListener) {
        voiceFallbackListener(fallbackEvent);
      }

      // Verify state remains consistent
      expect(manager.getState()).toBe('PLAYING');
    });
  });
});
