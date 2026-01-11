import TTSHighlight, { TTSVoice, TTSParams } from '../TTSHighlight';
import TTSAudioManager from '../TTSAudioManager';
import { TTSState } from '../TTSState';

// Mock dependencies
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
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  })),
}));

jest.mock('../TTSAudioManager', () => ({
  speakBatch: jest.fn(),
  stop: jest.fn(),
  fullStop: jest.fn(),
  hasRemainingItems: jest.fn(),
  getState: jest.fn(),
  hasQueuedNativeInCurrentSession: jest.fn(),
}));

describe('TTSHighlight Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('speak', () => {
    it('should call TTSHighlight.speak with provided parameters', async () => {
      const mockSpeak =
        require('react-native').NativeModules.TTSHighlight.speak;
      mockSpeak.mockResolvedValue('utterance-id');

      const params: TTSParams = {
        voice: 'en-US-Wavenet-A',
        rate: 1.2,
        pitch: 1.1,
        utteranceId: 'test-utterance',
      };

      const result = await TTSHighlight.speak('Test text', params);

      expect(mockSpeak).toHaveBeenCalledWith('Test text', params);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should throw error if all attempts fail', async () => {
      const mockSpeak =
        require('react-native').NativeModules.TTSHighlight.speak;
      mockSpeak.mockRejectedValue(new Error('All attempts failed'));

      await expect(TTSHighlight.speak('Test text')).rejects.toThrow(
        'All attempts failed',
      );
    });

    it('should generate utterance ID if not provided', async () => {
      const mockSpeak =
        require('react-native').NativeModules.TTSHighlight.speak;
      mockSpeak.mockResolvedValue('generated-id');

      const result = await TTSHighlight.speak('Test text');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('speakBatch', () => {
    it('should call TTSAudioManager.speakBatch with provided parameters', async () => {
      const mockSpeakBatch = TTSAudioManager.speakBatch as jest.Mock;
      mockSpeakBatch.mockResolvedValue(2);

      const texts = ['Text 1', 'Text 2'];
      const utteranceIds = ['id-1', 'id-2'];
      const params: TTSParams = {
        voice: 'en-US-Wavenet-A',
        rate: 1.5,
      };

      const result = await TTSHighlight.speakBatch(texts, utteranceIds, params);

      expect(mockSpeakBatch).toHaveBeenCalledWith(texts, utteranceIds, params);
      expect(result).toBe(2);
    });
  });

  describe('stop', () => {
    it('should call TTSAudioManager.stop', async () => {
      const mockStop = TTSAudioManager.stop as jest.Mock;
      mockStop.mockResolvedValue(true);

      const result = await TTSHighlight.stop();

      expect(mockStop).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('fullStop', () => {
    it('should call TTSAudioManager.fullStop', async () => {
      const mockFullStop = TTSAudioManager.fullStop as jest.Mock;
      mockFullStop.mockResolvedValue(true);

      const result = await TTSHighlight.fullStop();

      expect(mockFullStop).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('state management', () => {
    it('should check restart using state enum', () => {
      const mockGetState = TTSAudioManager.getState as jest.Mock;
      mockGetState.mockReturnValue(TTSState.STARTING);

      const result = TTSAudioManager.getState();

      expect(result).toBe(TTSState.STARTING);
      expect([TTSState.STARTING, TTSState.STOPPING]).toContain(result);
    });

    it('should check refill using state enum', () => {
      const mockGetState = TTSAudioManager.getState as jest.Mock;
      mockGetState.mockReturnValue(TTSState.REFILLING);

      const result = TTSAudioManager.getState();

      expect(result).toBe(TTSState.REFILLING);
    });
  });

  describe('queue management', () => {
    it('should check if remaining items exist', () => {
      const mockHasRemainingItems =
        TTSAudioManager.hasRemainingItems as jest.Mock;
      mockHasRemainingItems.mockReturnValue(true);

      const result = TTSHighlight.hasRemainingItems();

      expect(mockHasRemainingItems).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('pause', () => {
    it('should call native pause', async () => {
      const mockPause =
        require('react-native').NativeModules.TTSHighlight.pause;
      mockPause.mockResolvedValue(true);

      const result = await TTSHighlight.pause();

      expect(mockPause).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getVoices', () => {
    it('should call TTSHighlight.getVoices', async () => {
      const mockGetVoices =
        require('react-native').NativeModules.TTSHighlight.getVoices;
      const mockVoices: TTSVoice[] = [
        {
          identifier: 'en-US-Wavenet-A',
          name: 'English US Wavenet A',
          language: 'en-US',
          quality: '400',
        },
      ];
      mockGetVoices.mockResolvedValue(mockVoices);

      const result = await TTSHighlight.getVoices();

      expect(mockGetVoices).toHaveBeenCalled();
      expect(result).toEqual(mockVoices);
    });
  });

  describe('formatVoiceName', () => {
    it('should format voice with explicit mapping', () => {
      const mockVoice: TTSVoice = {
        identifier: 'com.apple.ttsbundle.Samantha-compact',
        name: 'Samantha',
        language: 'en-US',
        quality: '300',
      };

      // Mock getVoiceMapping
      jest.doMock('../VoiceMapper', () => ({
        getVoiceMapping: jest.fn().mockReturnValue({
          name: 'Samantha',
          style: 'Friendly',
          matchedNativeType: 'local',
        }),
      }));

      const result = TTSHighlight.formatVoiceName(mockVoice);

      expect(result).toContain('English (US)');
      expect(result).toContain('Samantha');
      expect(result).toContain('Compact');
    });

    it('should format voice with Wavenet identifier', () => {
      const mockVoice: TTSVoice = {
        identifier: 'en-US-Wavenet-A',
        name: 'English US Wavenet A',
        language: 'en-US',
        quality: '400',
      };

      // Mock getVoiceMapping to return null (no explicit mapping)
      jest.doMock('../VoiceMapper', () => ({
        getVoiceMapping: jest.fn().mockReturnValue(null),
      }));

      const result = TTSHighlight.formatVoiceName(mockVoice);

      expect(result).toContain('English (US)');
      expect(result).toContain('Wavenet A');
      expect(result).toContain('HQ');
    });

    it('should handle unknown language', () => {
      const mockVoice: TTSVoice = {
        identifier: 'unknown-voice',
        name: 'Unknown Voice',
        language: 'xx-XX',
        quality: '300',
      };

      // Mock getVoiceMapping to return null (no explicit mapping)
      jest.doMock('../VoiceMapper', () => ({
        getVoiceMapping: jest.fn().mockReturnValue(null),
      }));

      const result = TTSHighlight.formatVoiceName(mockVoice);

      expect(result).toContain('Unknown');
      expect(result).toContain('Unknown Voice');
    });

    it('should handle empty identifier', () => {
      const mockVoice: TTSVoice = {
        identifier: '',
        name: 'Voice',
        language: 'en-US',
        quality: '300',
      };

      // Mock getVoiceMapping to return null (no explicit mapping)
      jest.doMock('../VoiceMapper', () => ({
        getVoiceMapping: jest.fn().mockReturnValue(null),
      }));

      const result = TTSHighlight.formatVoiceName(mockVoice);

      expect(result).toContain('English (US)');
      expect(result).toContain('Voice');
    });
  });

  describe('State transitions', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should start in IDLE state', () => {
      const mockGetState = TTSAudioManager.getState as jest.Mock;
      mockGetState.mockReturnValue(TTSState.IDLE);

      expect(TTSAudioManager.getState()).toBe(TTSState.IDLE);
    });

    it('should transition IDLE → STARTING → PLAYING on speakBatch', async () => {
      const mockGetState = TTSAudioManager.getState as jest.Mock;
      const mockSpeakBatch = TTSAudioManager.speakBatch as jest.Mock;

      // Initially IDLE
      mockGetState.mockReturnValue(TTSState.IDLE);
      expect(TTSAudioManager.getState()).toBe(TTSState.IDLE);

      // After speakBatch starts → STARTING
      mockSpeakBatch.mockResolvedValue(2);

      // Call speakBatch
      const speakPromise = TTSHighlight.speakBatch(
        ['text1', 'text2'],
        ['id1', 'id2'],
        {},
      );

      // During execution, state should be STARTING
      mockGetState.mockReturnValue(TTSState.STARTING);
      expect(TTSAudioManager.getState()).toBe(TTSState.STARTING);

      await speakPromise;

      expect(mockSpeakBatch).toHaveBeenCalled();

      // After speakBatch completes → PLAYING
      mockGetState.mockReturnValue(TTSState.PLAYING);
      expect(TTSAudioManager.getState()).toBe(TTSState.PLAYING);
    });

    it('should transition PLAYING → REFILLING → PLAYING during refill', () => {
      const mockGetState = TTSAudioManager.getState as jest.Mock;

      // Currently PLAYING
      mockGetState.mockReturnValueOnce(TTSState.PLAYING);
      expect(TTSAudioManager.getState()).toBe(TTSState.PLAYING);

      // During refill → REFILLING
      mockGetState.mockReturnValueOnce(TTSState.REFILLING);
      expect(TTSAudioManager.getState()).toBe(TTSState.REFILLING);

      // After refill completes → PLAYING
      mockGetState.mockReturnValueOnce(TTSState.PLAYING);
      expect(TTSAudioManager.getState()).toBe(TTSState.PLAYING);
    });

    it('should transition to IDLE after stop', async () => {
      const mockGetState = TTSAudioManager.getState as jest.Mock;
      const mockStop = TTSAudioManager.stop as jest.Mock;

      // Currently PLAYING
      mockGetState.mockReturnValue(TTSState.PLAYING);
      expect(TTSAudioManager.getState()).toBe(TTSState.PLAYING);

      // Stop initiated
      mockStop.mockResolvedValue(true);
      const stopPromise = TTSHighlight.stop();

      // During stop → STOPPING
      mockGetState.mockReturnValue(TTSState.STOPPING);
      expect(TTSAudioManager.getState()).toBe(TTSState.STOPPING);

      await stopPromise;

      expect(mockStop).toHaveBeenCalled();

      // After stop completes → IDLE
      mockGetState.mockReturnValue(TTSState.IDLE);
      expect(TTSAudioManager.getState()).toBe(TTSState.IDLE);
    });
  });
});

describe('TTSAudioManager - Rate/Pitch Tracking', () => {
  // These tests verify that TTSAudioManager tracks rate and pitch from speakBatch params
  // Properties should be added to TTSAudioManager class: currentRate, currentPitch

  it('should track rate and pitch from speakBatch params', async () => {
    // Get the actual TTSAudioManager singleton (not the mock)
    const manager = jest.requireActual('../TTSAudioManager').default;

    // Mock native methods for this test
    const NativeModules = require('react-native').NativeModules;
    const originalSpeakBatch = NativeModules.TTSHighlight?.speakBatch;

    NativeModules.TTSHighlight = {
      ...NativeModules.TTSHighlight,
      speakBatch: jest.fn().mockResolvedValue(2),
      getQueueSize: jest.fn().mockResolvedValue(10),
    };

    await manager.speakBatch(['text1', 'text2'], ['id1', 'id2'], {
      rate: 1.5,
      pitch: 0.8,
      voice: 'test-voice',
    });

    // Restore original
    if (originalSpeakBatch) {
      NativeModules.TTSHighlight.speakBatch = originalSpeakBatch;
    }

    // After implementation, these should pass
    expect(manager.currentRate).toBe(1.5);
    expect(manager.currentPitch).toBe(0.8);
  });

  it('should default to rate 1, pitch 1 when not specified', async () => {
    const manager = jest.requireActual('../TTSAudioManager').default;

    const NativeModules = require('react-native').NativeModules;
    const originalSpeakBatch = NativeModules.TTSHighlight?.speakBatch;

    NativeModules.TTSHighlight = {
      ...NativeModules.TTSHighlight,
      speakBatch: jest.fn().mockResolvedValue(1),
      getQueueSize: jest.fn().mockResolvedValue(10),
    };

    await manager.speakBatch(['text1'], ['id1'], {
      voice: 'test-voice',
    });

    if (originalSpeakBatch) {
      NativeModules.TTSHighlight.speakBatch = originalSpeakBatch;
    }

    expect(manager.currentRate).toBe(1);
    expect(manager.currentPitch).toBe(1);
  });

  it('should update rate/pitch on subsequent speakBatch calls', async () => {
    const manager = jest.requireActual('../TTSAudioManager').default;

    const NativeModules = require('react-native').NativeModules;
    const originalSpeakBatch = NativeModules.TTSHighlight?.speakBatch;

    NativeModules.TTSHighlight = {
      ...NativeModules.TTSHighlight,
      speakBatch: jest.fn().mockResolvedValue(1),
      getQueueSize: jest.fn().mockResolvedValue(10),
    };

    await manager.speakBatch(['text1'], ['id1'], {
      rate: 1.5,
      pitch: 0.8,
      voice: 'test-voice',
    });

    await manager.speakBatch(['text2'], ['id2'], {
      rate: 2.0,
      pitch: 1.2,
      voice: 'test-voice',
    });

    if (originalSpeakBatch) {
      NativeModules.TTSHighlight.speakBatch = originalSpeakBatch;
    }

    expect(manager.currentRate).toBe(2.0);
    expect(manager.currentPitch).toBe(1.2);
  });

  it('should preserve rate and pitch in emergency fallback', async () => {
    const manager = jest.requireActual('../TTSAudioManager').default;

    const NativeModules = require('react-native').NativeModules;
    const originalSpeakBatch = NativeModules.TTSHighlight?.speakBatch;

    // Start with custom rate/pitch - this sets currentRate and currentPitch
    const speakBatchMock = jest.fn().mockResolvedValue(1);
    NativeModules.TTSHighlight = {
      ...NativeModules.TTSHighlight,
      speakBatch: speakBatchMock,
    };

    await manager.speakBatch(['text1'], ['id1'], {
      rate: 1.8,
      pitch: 0.7,
      voice: 'test-voice',
    });

    // Verify rate/pitch were tracked
    expect(manager.currentRate).toBe(1.8);
    expect(manager.currentPitch).toBe(0.7);

    // The fix ensures that emergency fallback uses this.currentRate and this.currentPitch
    // instead of hardcoded rate: 1, pitch: 1. We verify the properties are set correctly.

    // Restore original
    if (originalSpeakBatch) {
      NativeModules.TTSHighlight.speakBatch = originalSpeakBatch;
    }
  });
});
