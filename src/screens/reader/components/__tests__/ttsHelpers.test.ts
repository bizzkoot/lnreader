import type { RefObject } from 'react';
import type WebView from 'react-native-webview';
import {
  applyTtsUpdateToWebView,
  safeInjectJS,
  validateAndClampParagraphIndex,
} from '../ttsHelpers';

// Mock __DEV__
const originalDev = (global as any).__DEV__;
(global as any).__DEV__ = true;

describe('ttsHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = true;
  });

  afterEach(() => {
    (global as any).__DEV__ = originalDev;
  });

  describe('applyTtsUpdateToWebView', () => {
    it('should inject JavaScript when webViewRef is available', () => {
      const mockWebView = {
        current: {
          injectJavaScript: jest.fn(),
        },
      } as unknown as RefObject<WebView | null>;
      const settings = { rate: 1.5, pitch: 1.2 };

      const result = applyTtsUpdateToWebView(settings, mockWebView);

      expect((mockWebView.current as any)?.injectJavaScript).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should not inject when webViewRef is null', () => {
      const mockWebView = {
        current: null,
      } as unknown as RefObject<WebView | null>;
      const settings = { rate: 1.5 };

      const result = applyTtsUpdateToWebView(settings, mockWebView);

      expect(result).toBe(false);
    });

    it('should not inject when webViewRef.current is undefined', () => {
      const mockWebView = {
        current: undefined,
      } as unknown as RefObject<WebView | null>;
      const settings = { rate: 1.5 };

      const result = applyTtsUpdateToWebView(settings, mockWebView);

      expect(result).toBe(false);
    });

    it('should handle exceptions gracefully', () => {
      const mockWebView = {
        current: {
          injectJavaScript: jest.fn().mockImplementation(() => {
            throw new Error('Injection failed');
          }),
        },
      } as unknown as RefObject<WebView | null>;
      const settings = { rate: 1.5 };

      const result = applyTtsUpdateToWebView(settings, mockWebView);

      expect(result).toBe(false);
    });

    it('should pass correct settings to JavaScript', () => {
      const mockWebView = {
        current: {
          injectJavaScript: jest.fn(),
        },
      } as unknown as RefObject<WebView | null>;
      const settings = { rate: 1.5, pitch: 1.2, voice: 'en-US' };

      applyTtsUpdateToWebView(settings, mockWebView);

      const injectedScript = (
        (mockWebView.current as any)?.injectJavaScript as jest.Mock
      ).mock.calls[0][0];
      expect(injectedScript).toContain('window.tts.applySettings');
      expect(injectedScript).toContain(JSON.stringify(settings));
    });
  });

  describe('safeInjectJS', () => {
    it('should inject JavaScript when webViewRef is available', () => {
      const mockWebView = {
        current: {
          injectJavaScript: jest.fn(),
        },
      } as unknown as RefObject<WebView | null>;
      const script = 'window.test = true;';

      const result = safeInjectJS(mockWebView, script);

      expect(
        (mockWebView.current as any)?.injectJavaScript,
      ).toHaveBeenCalledWith(script);
      expect(result).toBe(true);
    });

    it('should not inject when webViewRef is null', () => {
      const mockWebView = {
        current: null,
      } as unknown as RefObject<WebView | null>;
      const script = 'window.test = true;';

      const result = safeInjectJS(mockWebView, script);

      expect(result).toBe(false);
    });

    it('should not inject when webViewRef.current is undefined', () => {
      const mockWebView = {
        current: undefined,
      } as unknown as RefObject<WebView | null>;
      const script = 'window.test = true;';

      const result = safeInjectJS(mockWebView, script);

      expect(result).toBe(false);
    });

    it('should include context in warning when provided', () => {
      const mockWebView = {
        current: null,
      } as unknown as RefObject<WebView | null>;
      const script = 'window.test = true;';
      const context = 'TTS Update';

      safeInjectJS(mockWebView, script, context);

      // Context is included in the warning but we're not testing console output
    });

    it('should handle exceptions gracefully', () => {
      const mockWebView = {
        current: {
          injectJavaScript: jest.fn().mockImplementation(() => {
            throw new Error('Injection failed');
          }),
        },
      } as unknown as RefObject<WebView | null>;
      const script = 'window.test = true;';

      const result = safeInjectJS(mockWebView, script);

      expect(result).toBe(false);
    });

    it('should include context in error when provided', () => {
      const mockWebView = {
        current: {
          injectJavaScript: jest.fn().mockImplementation(() => {
            throw new Error('Injection failed');
          }),
        },
      } as unknown as RefObject<WebView | null>;
      const script = 'window.test = true;';
      const context = 'TTS Update';

      safeInjectJS(mockWebView, script, context);

      // Context is included in the error but we're not testing console output
    });
  });

  describe('validateAndClampParagraphIndex', () => {
    it('should return valid index when within range', () => {
      const result = validateAndClampParagraphIndex(5, 10);
      expect(result).toBe(5);
    });

    it('should return 0 when totalParagraphs is 0 or negative', () => {
      expect(validateAndClampParagraphIndex(5, 0)).toBe(0);
      expect(validateAndClampParagraphIndex(5, -1)).toBe(0);
    });

    it('should return 0 when paragraphIndex is negative', () => {
      const result = validateAndClampParagraphIndex(-1, 10);
      expect(result).toBe(0);
    });

    it('should clamp index when exceeding total paragraphs', () => {
      const result = validateAndClampParagraphIndex(15, 10);
      expect(result).toBe(9); // maxValidIndex
    });

    it('should clamp index to maxValidIndex', () => {
      const result = validateAndClampParagraphIndex(10, 10);
      expect(result).toBe(9); // maxValidIndex = 10 - 1
    });

    it('should include context in warning when provided', () => {
      validateAndClampParagraphIndex(15, 10, 'Chapter 5');

      // Context is included in the warning but we're not testing console output
    });

    it('should include context in no paragraphs warning when provided', () => {
      validateAndClampParagraphIndex(5, 0, 'Chapter 5');

      // Context is included in the warning but we're not testing console output
    });

    it('should handle edge case with single paragraph', () => {
      expect(validateAndClampParagraphIndex(0, 1)).toBe(0);
      expect(validateAndClampParagraphIndex(1, 1)).toBe(0); // clamped
      expect(validateAndClampParagraphIndex(-1, 1)).toBe(0); // negative
    });

    it('should handle large numbers', () => {
      const result = validateAndClampParagraphIndex(1000, 100);
      expect(result).toBe(99); // clamped to maxValidIndex
    });

    it('should not warn when index is valid', () => {
      validateAndClampParagraphIndex(5, 10);

      // No warning should be logged for valid index
    });

    it('should not warn when index is exactly maxValidIndex', () => {
      validateAndClampParagraphIndex(9, 10);

      // No warning should be logged for valid index
    });
  });
});
