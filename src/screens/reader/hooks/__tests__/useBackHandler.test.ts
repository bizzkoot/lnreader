/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act } from '@testing-library/react-hooks';
import { useBackHandler } from '../useBackHandler';

describe('useBackHandler', () => {
  // Common test data
  const mockChapterId = 123;

  // Refs
  let mockWebViewRef: any;
  let isTTSReadingRef: any;
  let currentParagraphIndexRef: any;
  let latestParagraphIndexRef: any;

  // Mocks
  let mockSaveProgress: jest.Mock;
  let mockNavigation: any;
  let mockHandleStopTTS: jest.Mock;
  let mockInjectJavaScript: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize mocks
    mockInjectJavaScript = jest.fn();
    mockSaveProgress = jest.fn();
    mockHandleStopTTS = jest.fn();
    mockNavigation = { goBack: jest.fn() };

    // Initialize refs
    mockWebViewRef = {
      current: {
        injectJavaScript: mockInjectJavaScript,
      },
    };
    isTTSReadingRef = { current: false };
    currentParagraphIndexRef = { current: 0 };
    latestParagraphIndexRef = { current: undefined };
  });

  const renderTestHook = (
    showExitDialog = false,
    showChapterSelectionDialog = false,
  ) => {
    return renderHook(() =>
      useBackHandler({
        chapterId: mockChapterId,
        webViewRef: mockWebViewRef,
        saveProgress: mockSaveProgress,
        navigation: mockNavigation,
        showExitDialog,
        showChapterSelectionDialog,
        refs: {
          isTTSReadingRef,
          currentParagraphIndexRef,
          latestParagraphIndexRef,
        },
        callbacks: {
          handleStopTTS: mockHandleStopTTS,
        },
      }),
    );
  };

  // ========================================
  // Test Group 1: Initial State
  // ========================================
  describe('Initial State', () => {
    it('should return handleBackPress function', () => {
      const { result } = renderTestHook();
      expect(result.current.handleBackPress).toBeDefined();
      expect(typeof result.current.handleBackPress).toBe('function');
    });
  });

  // ========================================
  // Test Group 2: Dialog Priority
  // ========================================
  describe('Dialog Priority', () => {
    it('should return false if exit dialog is showing (let dialog handle back)', () => {
      const { result } = renderTestHook(true, false);

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(handled).toBe(false);
    });

    it('should return false if chapter selection dialog is showing', () => {
      const { result } = renderTestHook(false, true);

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(handled).toBe(false);
    });

    it('should return false if both dialogs are showing', () => {
      const { result } = renderTestHook(true, true);

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(handled).toBe(false);
    });
  });

  // ========================================
  // Test Group 3: TTS Playing State
  // ========================================
  describe('TTS Playing State', () => {
    it('should stop TTS when TTS is playing', () => {
      isTTSReadingRef.current = true;
      currentParagraphIndexRef.current = 25;

      const { result } = renderTestHook();

      act(() => {
        result.current.handleBackPress();
      });

      expect(mockHandleStopTTS).toHaveBeenCalledTimes(1);
    });

    it('should save TTS position when TTS is playing', () => {
      isTTSReadingRef.current = true;
      currentParagraphIndexRef.current = 42;

      const { result } = renderTestHook();

      act(() => {
        result.current.handleBackPress();
      });

      expect(mockSaveProgress).toHaveBeenCalledWith(42);
    });

    it('should navigate back when TTS is playing', () => {
      isTTSReadingRef.current = true;

      const { result } = renderTestHook();

      act(() => {
        result.current.handleBackPress();
      });

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('should return true (handled) when TTS is playing', () => {
      isTTSReadingRef.current = true;

      const { result } = renderTestHook();

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(handled).toBe(true);
    });

    it('should use 0 as default if currentParagraphIndexRef is undefined', () => {
      isTTSReadingRef.current = true;
      currentParagraphIndexRef.current = undefined;

      const { result } = renderTestHook();

      act(() => {
        result.current.handleBackPress();
      });

      expect(mockSaveProgress).toHaveBeenCalledWith(0);
    });
  });

  // ========================================
  // Test Group 4: TTS Paused State (Gap Check)
  // ========================================
  describe('TTS Paused State - Gap Check', () => {
    it('should inject JavaScript to check gap when lastTTSPosition > 0', () => {
      isTTSReadingRef.current = false; // TTS paused
      latestParagraphIndexRef.current = 10;

      const { result } = renderTestHook();

      act(() => {
        result.current.handleBackPress();
      });

      expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
      const injectedCode = mockInjectJavaScript.mock.calls[0][0];
      expect(injectedCode).toContain('const ttsIndex = 10');
      expect(injectedCode).toContain('const GAP_THRESHOLD = 5');
    });

    it('should return true (handled) when checking gap', () => {
      isTTSReadingRef.current = false;
      latestParagraphIndexRef.current = 15;

      const { result } = renderTestHook();

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(handled).toBe(true);
    });

    it('should NOT inject JavaScript if lastTTSPosition is 0', () => {
      isTTSReadingRef.current = false;
      latestParagraphIndexRef.current = 0;

      const { result } = renderTestHook();

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(mockInjectJavaScript).not.toHaveBeenCalled();
      expect(handled).toBe(false);
    });

    it('should NOT inject JavaScript if lastTTSPosition is negative', () => {
      isTTSReadingRef.current = false;
      latestParagraphIndexRef.current = -1;

      const { result } = renderTestHook();

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(mockInjectJavaScript).not.toHaveBeenCalled();
      expect(handled).toBe(false);
    });

    it('should use -1 as default if latestParagraphIndexRef is undefined', () => {
      isTTSReadingRef.current = false;
      latestParagraphIndexRef.current = undefined;

      const { result } = renderTestHook();

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(mockInjectJavaScript).not.toHaveBeenCalled();
      expect(handled).toBe(false);
    });

    it('should include chapter ID in injected JavaScript', () => {
      isTTSReadingRef.current = false;
      latestParagraphIndexRef.current = 20;

      const { result } = renderTestHook();

      act(() => {
        result.current.handleBackPress();
      });

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];
      expect(injectedCode).toContain(`chapterId: ${mockChapterId}`);
    });
  });

  // ========================================
  // Test Group 5: No TTS Activity
  // ========================================
  describe('No TTS Activity', () => {
    it('should return false if no TTS playing and no lastTTSPosition', () => {
      isTTSReadingRef.current = false;
      latestParagraphIndexRef.current = -1;

      const { result } = renderTestHook();

      let handled: boolean = false;
      act(() => {
        handled = result.current.handleBackPress();
      });

      expect(handled).toBe(false);
      expect(mockHandleStopTTS).not.toHaveBeenCalled();
      expect(mockSaveProgress).not.toHaveBeenCalled();
      expect(mockNavigation.goBack).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // Test Group 6: WebView Null Safety
  // ========================================
  describe('WebView Null Safety', () => {
    it('should handle webViewRef being null gracefully when checking gap', () => {
      mockWebViewRef.current = null;
      isTTSReadingRef.current = false;
      latestParagraphIndexRef.current = 10;

      const { result } = renderTestHook();

      expect(() => {
        act(() => {
          result.current.handleBackPress();
        });
      }).not.toThrow();
    });
  });
});
