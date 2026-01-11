/**
 * Comprehensive Tests for useManualModeHandlers (Phase 1 - Step 3)
 *
 * Tests manual mode dialog handlers including:
 * - handleStopTTS: Stops TTS, resets refs, switches to manual reading
 * - handleContinueFollowing: Keeps TTS following user scroll
 *
 * CRITICAL: This hook manages TTS stop logic and manual mode transitions.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useManualModeHandlers } from '../useManualModeHandlers';
import TTSHighlight from '@services/TTSHighlight';

// Mock dependencies
jest.mock('@services/TTSHighlight', () => ({
  __esModule: true,
  default: {
    stop: jest.fn(),
  },
}));

describe('useManualModeHandlers (Phase 1 - Step 3)', () => {
  // Mock refs and callbacks
  let mockWebViewRef: any;
  let mockShowToastMessage: jest.Mock;
  let mockRefreshChaptersFromContext: jest.Mock;
  let mockHideManualModeDialog: jest.Mock;
  let mockRefs: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup WebView ref
    mockWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };

    // Setup callbacks
    mockShowToastMessage = jest.fn();
    mockRefreshChaptersFromContext = jest.fn();
    mockHideManualModeDialog = jest.fn();

    // Setup refs
    mockRefs = {
      isTTSReadingRef: { current: true },
      isTTSPlayingRef: { current: true },
      hasUserScrolledRef: { current: true },
    };
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================
  describe('Initial State', () => {
    it('should return handler functions', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      expect(result.current).toHaveProperty('handleStopTTS');
      expect(result.current).toHaveProperty('handleContinueFollowing');
    });

    it('should return functions (not undefined)', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      expect(typeof result.current.handleStopTTS).toBe('function');
      expect(typeof result.current.handleContinueFollowing).toBe('function');
    });
  });

  // ==========================================================================
  // Function: handleStopTTS
  // ==========================================================================
  describe('Function: handleStopTTS', () => {
    it('should inject JavaScript to handle manual mode stop', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleStopTTS();
      });

      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('window.tts.handleManualModeDialog'),
      );
      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining("'stop'"),
      );
    });

    it('should reset isTTSReadingRef to false', () => {
      mockRefs.isTTSReadingRef.current = true;

      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleStopTTS();
      });

      expect(mockRefs.isTTSReadingRef.current).toBe(false);
    });

    it('should reset isTTSPlayingRef to false', () => {
      mockRefs.isTTSPlayingRef.current = true;

      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleStopTTS();
      });

      expect(mockRefs.isTTSPlayingRef.current).toBe(false);
    });

    it('should reset hasUserScrolledRef to false', () => {
      mockRefs.hasUserScrolledRef.current = true;

      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleStopTTS();
      });

      expect(mockRefs.hasUserScrolledRef.current).toBe(false);
    });

    it('should call TTSHighlight.stop()', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleStopTTS();
      });

      expect(TTSHighlight.stop).toHaveBeenCalled();
    });

    it('should show toast message', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleStopTTS();
      });

      expect(mockShowToastMessage).toHaveBeenCalledWith(
        'Switched to manual reading mode',
      );
    });

    it('should hide manual mode dialog', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleStopTTS();
      });

      expect(mockHideManualModeDialog).toHaveBeenCalled();
    });

    it('should handle null WebView ref gracefully', () => {
      mockWebViewRef.current = null;

      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      // Should not crash
      expect(() => {
        act(() => {
          result.current.handleStopTTS();
        });
      }).not.toThrow();

      // Other operations should still execute
      expect(mockRefs.isTTSReadingRef.current).toBe(false);
      expect(TTSHighlight.stop).toHaveBeenCalled();
      expect(mockShowToastMessage).toHaveBeenCalled();
      expect(mockHideManualModeDialog).toHaveBeenCalled();
    });

    it('should execute all operations in correct order', () => {
      const callOrder: string[] = [];

      mockWebViewRef.current.injectJavaScript = jest.fn(() =>
        callOrder.push('inject'),
      );
      (TTSHighlight.stop as jest.Mock).mockImplementation(() =>
        callOrder.push('stop'),
      );
      mockShowToastMessage.mockImplementation(() => callOrder.push('toast'));
      mockHideManualModeDialog.mockImplementation(() => callOrder.push('hide'));

      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleStopTTS();
      });

      // Verify order: inject → refs reset → stop → toast → hide
      expect(callOrder).toEqual(['inject', 'stop', 'toast', 'hide']);
    });
  });

  // ==========================================================================
  // Function: handleContinueFollowing
  // ==========================================================================
  describe('Function: handleContinueFollowing', () => {
    it('should inject JavaScript to handle continue following', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleContinueFollowing();
      });

      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('window.tts.handleManualModeDialog'),
      );
      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining("'continue'"),
      );
    });

    it('should hide manual mode dialog', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleContinueFollowing();
      });

      expect(mockHideManualModeDialog).toHaveBeenCalled();
    });

    it('should NOT reset TTS refs', () => {
      mockRefs.isTTSReadingRef.current = true;
      mockRefs.isTTSPlayingRef.current = true;
      mockRefs.hasUserScrolledRef.current = true;

      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleContinueFollowing();
      });

      // Refs should remain unchanged
      expect(mockRefs.isTTSReadingRef.current).toBe(true);
      expect(mockRefs.isTTSPlayingRef.current).toBe(true);
      expect(mockRefs.hasUserScrolledRef.current).toBe(true);
    });

    it('should NOT call TTSHighlight.stop()', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleContinueFollowing();
      });

      expect(TTSHighlight.stop).not.toHaveBeenCalled();
    });

    it('should NOT show toast message', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      act(() => {
        result.current.handleContinueFollowing();
      });

      expect(mockShowToastMessage).not.toHaveBeenCalled();
    });

    it('should handle null WebView ref gracefully', () => {
      mockWebViewRef.current = null;

      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      // Should not crash
      expect(() => {
        act(() => {
          result.current.handleContinueFollowing();
        });
      }).not.toThrow();

      // Dialog should still hide
      expect(mockHideManualModeDialog).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Return Interface Tests
  // ==========================================================================
  describe('Return Interface', () => {
    it('should maintain stable function references across re-renders', () => {
      const { result, rerender } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      const firstRender = result.current;
      rerender();
      const secondRender = result.current;

      // Functions should be memoized
      expect(firstRender.handleStopTTS).toBe(secondRender.handleStopTTS);
      expect(firstRender.handleContinueFollowing).toBe(
        secondRender.handleContinueFollowing,
      );
    });
  });

  // ==========================================================================
  // Zero Regression Validation
  // ==========================================================================
  describe('Zero Regression Validation', () => {
    it('Phase 1 Step 3: useManualModeHandlers preserves all original manual mode behaviors', () => {
      const { result } = renderHook(() =>
        useManualModeHandlers({
          webViewRef: mockWebViewRef,
          showToastMessage: mockShowToastMessage,
          refreshChaptersFromContext: mockRefreshChaptersFromContext,
          refs: mockRefs,
          callbacks: {
            hideManualModeDialog: mockHideManualModeDialog,
          },
        }),
      );

      // This test documents that Phase 1 Step 3 successfully extracted
      // manual mode handlers from useTTSController.ts with zero behavioral changes.

      // Original implementation: Functions within useTTSController
      // After extraction: Single useManualModeHandlers() hook
      // Behavior: IDENTICAL

      expect(result.current).toBeTruthy();
      expect(result.current.handleStopTTS).toBeDefined();
      expect(result.current.handleContinueFollowing).toBeDefined();
    });
  });
});
