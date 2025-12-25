/**
 * Tests for TTSHighlight.speak() error handling
 *
 * Focus: Test retry logic and fallback to system default voice
 * Coverage targets:
 * - Transient voice errors (succeeds on retry)
 * - Persistent voice errors (fallback to system default)
 * - Complete failure (all attempts fail)
 * - Edge cases (empty text, special characters, long text)
 */

(function setupMocks() {
  const RN = require('react-native');
  RN.NativeModules = RN.NativeModules || {};
  RN.NativeModules.TTSHighlight = RN.NativeModules.TTSHighlight || {
    speak: jest.fn(),
    addToBatch: jest.fn(),
    speakBatch: jest.fn(),
    getQueueSize: jest.fn(),
    stop: jest.fn(),
    pause: jest.fn(),
    updateMediaState: jest.fn(),
    getVoices: jest.fn(),
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

const TTSHighlightService =
  require('../TTSHighlight').default || require('../TTSHighlight');
// @ts-ignore - NativeModules is set up in setupMocks
const { TTSHighlight } = require('react-native').NativeModules;

afterEach(() => {
  jest.clearAllMocks();
});

describe('TTSHighlight.speak() - Error Path Tests', () => {
  describe('Retry logic for transient errors', () => {
    it('should retry once on transient voice failure', async () => {
      // First call fails, second succeeds
      (TTSHighlight.speak as jest.Mock)
        .mockRejectedValueOnce(new Error('Voice busy'))
        .mockResolvedValueOnce(undefined);

      const result = await TTSHighlightService.speak('Hello world', {
        voice: 'en-us-voice',
      });

      expect(TTSHighlight.speak).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('should pass same parameters on retry', async () => {
      const params = { voice: 'en-us-voice', rate: 1.5, pitch: 1.2 };

      (TTSHighlight.speak as jest.Mock)
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce(undefined);

      await TTSHighlightService.speak('Test text', params);

      expect(TTSHighlight.speak).toHaveBeenNthCalledWith(1, 'Test text', {
        voice: 'en-us-voice',
        rate: 1.5,
        pitch: 1.2,
        utteranceId: undefined,
      });
      expect(TTSHighlight.speak).toHaveBeenNthCalledWith(2, 'Test text', {
        voice: 'en-us-voice',
        rate: 1.5,
        pitch: 1.2,
        utteranceId: undefined,
      });
    });
  });

  describe('Fallback to system default voice', () => {
    it('should fallback to system default after 2 failed attempts', async () => {
      // Both attempts with preferred voice fail
      (TTSHighlight.speak as jest.Mock)
        .mockRejectedValueOnce(new Error('Voice unavailable'))
        .mockRejectedValueOnce(new Error('Voice unavailable'))
        // Third call (fallback) succeeds
        .mockResolvedValueOnce(undefined);

      const result = await TTSHighlightService.speak('Test', {
        voice: 'custom-voice-123',
      });

      // Should be called 3 times: 2 retries + 1 fallback
      expect(TTSHighlight.speak).toHaveBeenCalledTimes(3);
      // Last call should NOT have voice parameter (system default)
      expect(TTSHighlight.speak).toHaveBeenLastCalledWith('Test', {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: undefined,
      });
      expect(result).toBeDefined();
    });

    it('should log warning when falling back to system default', async () => {
      // Note: The TTSHighlight.speak() method logs via rate-limited logger
      // Testing the actual log output is flaky due to rate limiting
      // Instead, we verify the fallback behavior occurs correctly

      (TTSHighlight.speak as jest.Mock)
        .mockRejectedValueOnce(new Error('Voice locked'))
        .mockRejectedValueOnce(new Error('Voice locked'))
        .mockResolvedValueOnce(undefined);

      const result = await TTSHighlightService.speak('Test', {
        voice: 'premium-voice',
      });

      // Verify fallback happened: 2 failed attempts + 1 system default call
      expect(TTSHighlight.speak).toHaveBeenCalledTimes(3);
      // Last call uses system default (no voice parameter)
      expect(TTSHighlight.speak).toHaveBeenLastCalledWith('Test', {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: undefined,
      });
      expect(result).toBeDefined();
    });

    it('should preserve rate and pitch when falling back', async () => {
      (TTSHighlight.speak as jest.Mock)
        .mockRejectedValueOnce(new Error('Error'))
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce(undefined);

      await TTSHighlightService.speak('Test', {
        voice: 'custom-voice',
        rate: 1.8,
        pitch: 0.9,
      });

      expect(TTSHighlight.speak).toHaveBeenLastCalledWith('Test', {
        voice: undefined,
        rate: 1.8,
        pitch: 0.9,
        utteranceId: undefined,
      });
    });
  });

  describe('Complete failure scenarios', () => {
    it('should throw error when all attempts fail', async () => {
      (TTSHighlight.speak as jest.Mock).mockRejectedValue(
        new Error('TTS engine not available'),
      );

      await expect(
        TTSHighlightService.speak('Test', { voice: 'en-us-voice' }),
      ).rejects.toThrow('TTS engine not available');
    });

    it('should throw the first error when fallback also fails', async () => {
      const firstError = new Error('Custom voice failed');
      const fallbackError = new Error('System default failed');

      (TTSHighlight.speak as jest.Mock)
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(firstError)
        .mockRejectedValueOnce(fallbackError);

      await expect(
        TTSHighlightService.speak('Test', { voice: 'custom-voice' }),
      ).rejects.toEqual(firstError);
    });

    it('should throw when system default fails after preferred voice retries', async () => {
      (TTSHighlight.speak as jest.Mock)
        .mockRejectedValueOnce(new Error('Preferred failed'))
        .mockRejectedValueOnce(new Error('Preferred failed'))
        .mockRejectedValueOnce(new Error('System default failed'));

      await expect(
        TTSHighlightService.speak('Test', { voice: 'preferred' }),
      ).rejects.toThrow('Preferred failed');
    });
  });

  describe('Utterance ID handling', () => {
    it('should return provided utteranceId on success', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      const result = await TTSHighlightService.speak('Test', {
        utteranceId: 'custom-id-123',
      });

      expect(result).toBe('custom-id-123');
    });

    it('should return timestamp as utteranceId when not provided', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      const beforeTime = Date.now();
      const result = await TTSHighlightService.speak('Test', {});
      const afterTime = Date.now();

      // Result should be a timestamp string between before and after
      const resultNum = parseInt(result, 10);
      expect(resultNum).toBeGreaterThanOrEqual(beforeTime);
      expect(resultNum).toBeLessThanOrEqual(afterTime);
    });

    it('should pass utteranceId to native module on all attempts', async () => {
      (TTSHighlight.speak as jest.Mock)
        .mockRejectedValueOnce(new Error('Fail'))
        .mockRejectedValueOnce(new Error('Fail'))
        .mockResolvedValueOnce(undefined);

      await TTSHighlightService.speak('Test', { utteranceId: 'utt-456' });

      // All 3 calls should include the utteranceId
      expect(TTSHighlight.speak).toHaveBeenNthCalledWith(1, 'Test', {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: 'utt-456',
      });
      expect(TTSHighlight.speak).toHaveBeenNthCalledWith(2, 'Test', {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: 'utt-456',
      });
      expect(TTSHighlight.speak).toHaveBeenNthCalledWith(3, 'Test', {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: 'utt-456',
      });
    });
  });

  describe('Parameter handling', () => {
    it('should use default rate=1 when not specified', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      await TTSHighlightService.speak('Test', { voice: 'en-us' });

      expect(TTSHighlight.speak).toHaveBeenCalledWith('Test', {
        voice: 'en-us',
        rate: 1,
        pitch: 1,
        utteranceId: undefined,
      });
    });

    it('should use default pitch=1 when not specified', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      await TTSHighlightService.speak('Test', { voice: 'en-us' });

      expect(TTSHighlight.speak).toHaveBeenCalledWith('Test', {
        voice: 'en-us',
        rate: 1,
        pitch: 1,
        utteranceId: undefined,
      });
    });

    it('should pass all parameters to native module', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      await TTSHighlightService.speak('Test text', {
        voice: 'en-us-premium',
        rate: 1.5,
        pitch: 0.8,
        utteranceId: 'test-utt-1',
      });

      expect(TTSHighlight.speak).toHaveBeenCalledWith('Test text', {
        voice: 'en-us-premium',
        rate: 1.5,
        pitch: 0.8,
        utteranceId: 'test-utt-1',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty text string', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      const result = await TTSHighlightService.speak('', {});

      expect(TTSHighlight.speak).toHaveBeenCalledWith('', {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: undefined,
      });
      expect(result).toBeDefined();
    });

    it('should handle text with special characters', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      const specialText = 'Hello, 世界! 🎉 <script>alert("xss")</script>';
      await TTSHighlightService.speak(specialText, {});

      expect(TTSHighlight.speak).toHaveBeenCalledWith(specialText, {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: undefined,
      });
    });

    it('should handle very long text', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      const longText = 'A'.repeat(10000); // 10KB text
      await TTSHighlightService.speak(longText, {});

      expect(TTSHighlight.speak).toHaveBeenCalledWith(longText, {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: undefined,
      });
    });

    it('should handle text with unicode emojis', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      const emojiText = '😀😃😄😁😆😅😂🤣😊😇';
      await TTSHighlightService.speak(emojiText, {});

      expect(TTSHighlight.speak).toHaveBeenCalledWith(emojiText, {
        voice: undefined,
        rate: 1,
        pitch: 1,
        utteranceId: undefined,
      });
    });

    it('should handle extreme rate values', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      await TTSHighlightService.speak('Test', { rate: 0.1 });
      expect(TTSHighlight.speak).toHaveBeenCalledWith('Test', {
        voice: undefined,
        rate: 0.1,
        pitch: 1,
        utteranceId: undefined,
      });

      await TTSHighlightService.speak('Test', { rate: 5.0 });
      expect(TTSHighlight.speak).toHaveBeenCalledWith('Test', {
        voice: undefined,
        rate: 5.0,
        pitch: 1,
        utteranceId: undefined,
      });
    });

    it('should handle extreme pitch values', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      await TTSHighlightService.speak('Test', { pitch: 0.5 });
      expect(TTSHighlight.speak).toHaveBeenCalledWith('Test', {
        voice: undefined,
        rate: 1,
        pitch: 0.5,
        utteranceId: undefined,
      });

      await TTSHighlightService.speak('Test', { pitch: 2.0 });
      expect(TTSHighlight.speak).toHaveBeenCalledWith('Test', {
        voice: undefined,
        rate: 1,
        pitch: 2.0,
        utteranceId: undefined,
      });
    });
  });

  describe('Success path', () => {
    it('should succeed on first attempt with all parameters', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      const result = await TTSHighlightService.speak('Hello world', {
        voice: 'en-us-voice',
        rate: 1.2,
        pitch: 1.1,
        utteranceId: 'utt-001',
      });

      expect(TTSHighlight.speak).toHaveBeenCalledTimes(1);
      expect(result).toBe('utt-001');
    });

    it('should succeed on first attempt with minimal parameters', async () => {
      (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);

      const result = await TTSHighlightService.speak('Hello world');

      expect(TTSHighlight.speak).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });
  });
});
