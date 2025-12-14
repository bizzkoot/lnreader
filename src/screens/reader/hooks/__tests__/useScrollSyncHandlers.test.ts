/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act } from '@testing-library/react-hooks';
import { useScrollSyncHandlers } from '../useScrollSyncHandlers';

describe('useScrollSyncHandlers', () => {
  // Refs
  let mockWebViewRef: any;
  let ttsScrollPromptDataRef: any;

  // Mocks
  let mockHideScrollSyncDialog: jest.Mock;
  let mockInjectJavaScript: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize mocks
    mockInjectJavaScript = jest.fn();
    mockHideScrollSyncDialog = jest.fn();

    // Initialize refs
    mockWebViewRef = {
      current: {
        injectJavaScript: mockInjectJavaScript,
      },
    };
    ttsScrollPromptDataRef = { current: null };
  });

  const renderTestHook = () => {
    return renderHook(() =>
      useScrollSyncHandlers({
        webViewRef: mockWebViewRef,
        refs: {
          ttsScrollPromptDataRef,
        },
        callbacks: {
          hideScrollSyncDialog: mockHideScrollSyncDialog,
        },
      }),
    );
  };

  // ========================================
  // Test Group 1: Initial State
  // ========================================
  describe('Initial State', () => {
    it('should return handleTTSScrollSyncConfirm and handleTTSScrollSyncCancel functions', () => {
      const { result } = renderTestHook();
      expect(result.current.handleTTSScrollSyncConfirm).toBeDefined();
      expect(typeof result.current.handleTTSScrollSyncConfirm).toBe('function');
      expect(result.current.handleTTSScrollSyncCancel).toBeDefined();
      expect(typeof result.current.handleTTSScrollSyncCancel).toBe('function');
    });
  });

  // ========================================
  // Test Group 2: handleTTSScrollSyncConfirm
  // ========================================
  describe('handleTTSScrollSyncConfirm', () => {
    it('should inject JavaScript to change paragraph position', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 25,
        isResume: false,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncConfirm();
      });

      expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
      const injectedCode = mockInjectJavaScript.mock.calls[0][0];
      expect(injectedCode).toContain('window.tts.changeParagraphPosition(25)');
    });

    it('should inject resume call if isResume is true', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 30,
        isResume: true,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncConfirm();
      });

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];
      expect(injectedCode).toContain('window.tts.resume(true)');
    });

    it('should NOT inject resume call if isResume is false', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 30,
        isResume: false,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncConfirm();
      });

      const injectedCode = mockInjectJavaScript.mock.calls[0][0];
      expect(injectedCode).not.toContain('window.tts.resume');
    });

    it('should clear ttsScrollPromptDataRef after confirm', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 10,
        isResume: false,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncConfirm();
      });

      expect(ttsScrollPromptDataRef.current).toBeNull();
    });

    it('should hide scroll sync dialog', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 10,
        isResume: false,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncConfirm();
      });

      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if ttsScrollPromptDataRef is null', () => {
      ttsScrollPromptDataRef.current = null;

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncConfirm();
      });

      expect(mockInjectJavaScript).not.toHaveBeenCalled();
      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(1); // Still hides dialog
    });

    it('should handle webViewRef being null gracefully', () => {
      mockWebViewRef.current = null;
      ttsScrollPromptDataRef.current = {
        visibleIndex: 10,
        isResume: false,
      };

      const { result } = renderTestHook();

      expect(() => {
        act(() => {
          result.current.handleTTSScrollSyncConfirm();
        });
      }).not.toThrow();

      expect(ttsScrollPromptDataRef.current).toBeNull();
      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Test Group 3: handleTTSScrollSyncCancel
  // ========================================
  describe('handleTTSScrollSyncCancel', () => {
    it('should inject resume call if isResume is true', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 50,
        isResume: true,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncCancel();
      });

      expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
      const injectedCode = mockInjectJavaScript.mock.calls[0][0];
      expect(injectedCode).toContain('window.tts.resume(true)');
    });

    it('should NOT inject any JavaScript if isResume is false', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 50,
        isResume: false,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncCancel();
      });

      expect(mockInjectJavaScript).not.toHaveBeenCalled();
    });

    it('should clear ttsScrollPromptDataRef after cancel', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 20,
        isResume: true,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncCancel();
      });

      expect(ttsScrollPromptDataRef.current).toBeNull();
    });

    it('should hide scroll sync dialog', () => {
      ttsScrollPromptDataRef.current = {
        visibleIndex: 20,
        isResume: true,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncCancel();
      });

      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(1);
    });

    it('should do nothing if ttsScrollPromptDataRef is null', () => {
      ttsScrollPromptDataRef.current = null;

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncCancel();
      });

      expect(mockInjectJavaScript).not.toHaveBeenCalled();
      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(1); // Still hides dialog
    });

    it('should handle webViewRef being null gracefully when isResume is true', () => {
      mockWebViewRef.current = null;
      ttsScrollPromptDataRef.current = {
        visibleIndex: 10,
        isResume: true,
      };

      const { result } = renderTestHook();

      expect(() => {
        act(() => {
          result.current.handleTTSScrollSyncCancel();
        });
      }).not.toThrow();

      expect(ttsScrollPromptDataRef.current).toBeNull();
      expect(mockHideScrollSyncDialog).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // Test Group 4: Execution Order
  // ========================================
  describe('Execution Order', () => {
    it('should inject JavaScript before hiding dialog (confirm)', () => {
      const callOrder: string[] = [];

      mockInjectJavaScript.mockImplementation(() => {
        callOrder.push('injectJS');
      });
      mockHideScrollSyncDialog.mockImplementation(() => {
        callOrder.push('hideDialog');
      });

      ttsScrollPromptDataRef.current = {
        visibleIndex: 15,
        isResume: false,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncConfirm();
      });

      expect(callOrder).toEqual(['injectJS', 'hideDialog']);
    });

    it('should inject JavaScript before hiding dialog (cancel with resume)', () => {
      const callOrder: string[] = [];

      mockInjectJavaScript.mockImplementation(() => {
        callOrder.push('injectJS');
      });
      mockHideScrollSyncDialog.mockImplementation(() => {
        callOrder.push('hideDialog');
      });

      ttsScrollPromptDataRef.current = {
        visibleIndex: 15,
        isResume: true,
      };

      const { result } = renderTestHook();

      act(() => {
        result.current.handleTTSScrollSyncCancel();
      });

      expect(callOrder).toEqual(['injectJS', 'hideDialog']);
    });
  });
});
