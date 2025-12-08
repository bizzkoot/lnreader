import TTSHighlight, { TTSVoice, TTSParams } from '../TTSHighlight';
import TTSAudioManager from '../TTSAudioManager';

// Mock dependencies
jest.mock('react-native', () => ({
  NativeModules: {
    TTSHighlight: {
      speak: jest.fn(),
      speakBatch: jest.fn(),
      addToBatch: jest.fn(),
      stop: jest.fn(),
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
  setRestartInProgress: jest.fn(),
  isRestartInProgress: jest.fn(),
  setRefillInProgress: jest.fn(),
  isRefillInProgress: jest.fn(),
  hasRemainingItems: jest.fn(),
}));

describe('TTSHighlight Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('speak', () => {
    it('should call TTSHighlight.speak with provided parameters', async () => {
      const mockSpeak = require('react-native').NativeModules.TTSHighlight.speak;
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
      const mockSpeak = require('react-native').NativeModules.TTSHighlight.speak;
      mockSpeak.mockRejectedValue(new Error('All attempts failed'));
      
      await expect(TTSHighlight.speak('Test text')).rejects.toThrow('All attempts failed');
    });

    it('should generate utterance ID if not provided', async () => {
      const mockSpeak = require('react-native').NativeModules.TTSHighlight.speak;
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

  describe('restart management', () => {
    it('should set restart in progress', () => {
      const mockSetRestartInProgress = TTSAudioManager.setRestartInProgress as jest.Mock;
      
      TTSHighlight.setRestartInProgress(true);
      
      expect(mockSetRestartInProgress).toHaveBeenCalledWith(true);
    });

    it('should check if restart is in progress', () => {
      const mockIsRestartInProgress = TTSAudioManager.isRestartInProgress as jest.Mock;
      mockIsRestartInProgress.mockReturnValue(true);
      
      const result = TTSHighlight.isRestartInProgress();
      
      expect(mockIsRestartInProgress).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('refill management', () => {
    it('should set refill in progress', () => {
      const mockSetRefillInProgress = TTSAudioManager.setRefillInProgress as jest.Mock;
      
      TTSHighlight.setRefillInProgress(true);
      
      expect(mockSetRefillInProgress).toHaveBeenCalledWith(true);
    });

    it('should check if refill is in progress', () => {
      const mockIsRefillInProgress = TTSAudioManager.isRefillInProgress as jest.Mock;
      mockIsRefillInProgress.mockReturnValue(true);
      
      const result = TTSHighlight.isRefillInProgress();
      
      expect(mockIsRefillInProgress).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should check if remaining items exist', () => {
      const mockHasRemainingItems = TTSAudioManager.hasRemainingItems as jest.Mock;
      mockHasRemainingItems.mockReturnValue(true);
      
      const result = TTSHighlight.hasRemainingItems();
      
      expect(mockHasRemainingItems).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('pause', () => {
    it('should call TTSAudioManager.stop', async () => {
      const mockStop = TTSAudioManager.stop as jest.Mock;
      mockStop.mockResolvedValue(true);
      
      const result = await TTSHighlight.pause();
      
      expect(mockStop).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getVoices', () => {
    it('should call TTSHighlight.getVoices', async () => {
      const mockGetVoices = require('react-native').NativeModules.TTSHighlight.getVoices;
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
});