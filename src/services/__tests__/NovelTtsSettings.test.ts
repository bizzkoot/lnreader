import {
  getNovelTtsSettings,
  setNovelTtsSettings,
  deleteNovelTtsSettings,
} from '../tts/novelTtsSettings';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { VoiceQuality } from 'expo-speech';

// Mock MMKVStorage with proper function implementations
jest.mock('@utils/mmkv/mmkv', () => {
  const mockStorage = {
    set: jest.fn(),
    get: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
  };

  return {
    MMKVStorage: mockStorage,
    getMMKVObject: (key: string) => {
      const data = mockStorage.getString(key);
      if (data) {
        return JSON.parse(data);
      }
      return undefined;
    },
    setMMKVObject: (key: string, obj: any) => {
      mockStorage.set(key, JSON.stringify(obj));
    },
  };
});

describe('Per-Novel TTS Settings', () => {
  const mockNovelId = 123;
  const mockSettings = {
    enabled: true,
    tts: {
      voice: {
        identifier: 'test-voice',
        name: 'Test Voice',
        language: 'en-US',
        quality: '300' as VoiceQuality,
      },
      rate: 1.5,
      pitch: 0.8,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Settings Storage', () => {
    it('should store settings with correct MMKV key', () => {
      setNovelTtsSettings(mockNovelId, mockSettings);

      const expectedKey = `NOVEL_TTS_SETTINGS_${mockNovelId}`;
      expect(MMKVStorage.set).toHaveBeenCalledWith(
        expectedKey,
        JSON.stringify(mockSettings),
      );
    });

    it('should retrieve settings for specific novel', () => {
      (MMKVStorage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(mockSettings),
      );

      const result = getNovelTtsSettings(mockNovelId);

      const expectedKey = `NOVEL_TTS_SETTINGS_${mockNovelId}`;
      expect(MMKVStorage.getString).toHaveBeenCalledWith(expectedKey);
      expect(result).toEqual(mockSettings);
    });

    it('should return undefined when no settings exist', () => {
      (MMKVStorage.getString as jest.Mock).mockReturnValue(undefined);

      const result = getNovelTtsSettings(mockNovelId);

      expect(result).toBeUndefined();
    });
  });

  describe('Settings Toggle Behavior', () => {
    it('should preserve settings when toggled off (delete not called)', () => {
      setNovelTtsSettings(mockNovelId, mockSettings);

      // Simulate toggling off (set enabled to false)
      const disabledSettings = { ...mockSettings, enabled: false };
      setNovelTtsSettings(mockNovelId, disabledSettings);

      expect(MMKVStorage.set).toHaveBeenCalledWith(
        `NOVEL_TTS_SETTINGS_${mockNovelId}`,
        JSON.stringify(disabledSettings),
      );
      expect(MMKVStorage.delete).not.toHaveBeenCalled();
    });

    it('should restore previous settings when re-enabled', () => {
      // Store initial settings
      setNovelTtsSettings(mockNovelId, mockSettings);

      // Disable
      setNovelTtsSettings(mockNovelId, { ...mockSettings, enabled: false });

      // Re-enable with same settings
      setNovelTtsSettings(mockNovelId, mockSettings);

      expect(MMKVStorage.set).toHaveBeenCalledTimes(3);
    });

    it('should handle multiple novels independently', () => {
      const novel1Settings = {
        enabled: true,
        tts: {
          voice: {
            identifier: 'voice-1',
            name: 'Voice 1',
            language: 'en-US',
            quality: '300' as VoiceQuality,
          },
          rate: 1.5,
          pitch: 1.0,
        },
      };
      const novel2Settings = {
        enabled: true,
        tts: {
          voice: {
            identifier: 'voice-2',
            name: 'Voice 2',
            language: 'en-US',
            quality: '300' as VoiceQuality,
          },
          rate: 2.0,
          pitch: 0.8,
        },
      };

      setNovelTtsSettings(111, novel1Settings);
      setNovelTtsSettings(222, novel2Settings);

      expect(MMKVStorage.set).toHaveBeenCalledWith(
        'NOVEL_TTS_SETTINGS_111',
        JSON.stringify(novel1Settings),
      );
      expect(MMKVStorage.set).toHaveBeenCalledWith(
        'NOVEL_TTS_SETTINGS_222',
        JSON.stringify(novel2Settings),
      );
    });
  });

  describe('Settings Deletion', () => {
    it('should delete settings for specific novel', () => {
      deleteNovelTtsSettings(mockNovelId);

      const expectedKey = `NOVEL_TTS_SETTINGS_${mockNovelId}`;
      expect(MMKVStorage.delete).toHaveBeenCalledWith(expectedKey);
    });
  });

  describe('Voice Settings Persistence', () => {
    it('should persist voice identifier correctly', () => {
      const voiceSettings = {
        enabled: true,
        tts: {
          voice: {
            identifier: 'com.google.android.tts:en-us-x-iob-network',
            name: 'Network Voice',
            language: 'en-US',
            quality: '400' as VoiceQuality,
          },
          rate: 1.0,
          pitch: 1.0,
        },
      };

      // Mock getString BEFORE calling setNovelTtsSettings and getNovelTtsSettings
      (MMKVStorage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(voiceSettings),
      );

      setNovelTtsSettings(mockNovelId, voiceSettings);

      const result = getNovelTtsSettings(mockNovelId);

      expect(result?.tts?.voice?.identifier).toBe(
        'com.google.android.tts:en-us-x-iob-network',
      );
    });

    it('should persist rate and pitch independently', () => {
      const settings = {
        enabled: true,
        tts: { rate: 1.8, pitch: 0.7 },
      };

      // Mock getString BEFORE calling setNovelTtsSettings and getNovelTtsSettings
      (MMKVStorage.getString as jest.Mock).mockReturnValue(
        JSON.stringify(settings),
      );

      setNovelTtsSettings(mockNovelId, settings);

      const result = getNovelTtsSettings(mockNovelId);

      expect(result?.tts?.rate).toBe(1.8);
      expect(result?.tts?.pitch).toBe(0.7);
    });
  });
});
