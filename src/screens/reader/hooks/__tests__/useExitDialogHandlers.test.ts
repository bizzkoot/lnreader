/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderHook, act } from '@testing-library/react-hooks';
import { useExitDialogHandlers } from '../useExitDialogHandlers';

describe('useExitDialogHandlers', () => {
  // Common test data
  const mockExitDialogData = {
    ttsParagraph: 42,
    readerParagraph: 25,
  };

  // Mocks
  let mockSaveProgress: jest.Mock;
  let mockNavigation: any;
  let mockHandleStopTTS: jest.Mock;
  let mockSetShowExitDialog: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Initialize mocks
    mockSaveProgress = jest.fn();
    mockNavigation = {
      goBack: jest.fn(),
    };
    mockHandleStopTTS = jest.fn();
    mockSetShowExitDialog = jest.fn();
  });

  const renderTestHook = (
    exitDialogData: {
      ttsParagraph: number;
      readerParagraph: number;
    } = mockExitDialogData,
  ) => {
    return renderHook(() =>
      useExitDialogHandlers({
        exitDialogData,
        saveProgress: mockSaveProgress,
        navigation: mockNavigation,
        callbacks: {
          handleStopTTS: mockHandleStopTTS,
          setShowExitDialog: mockSetShowExitDialog,
        },
      }),
    );
  };

  // ========================================
  // Test Group 1: Initial State
  // ========================================
  describe('Initial State', () => {
    it('should return handleExitTTS and handleExitReader functions', () => {
      const { result } = renderTestHook();

      expect(result.current.handleExitTTS).toBeDefined();
      expect(typeof result.current.handleExitTTS).toBe('function');
      expect(result.current.handleExitReader).toBeDefined();
      expect(typeof result.current.handleExitReader).toBe('function');
    });
  });

  // ========================================
  // Test Group 2: handleExitTTS
  // ========================================
  describe('handleExitTTS', () => {
    it('should hide exit dialog', () => {
      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitTTS();
      });

      expect(mockSetShowExitDialog).toHaveBeenCalledWith(false);
    });

    it('should call handleStopTTS to stop TTS playback', () => {
      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitTTS();
      });

      expect(mockHandleStopTTS).toHaveBeenCalledTimes(1);
    });

    it('should save TTS position (exitDialogData.ttsParagraph)', () => {
      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitTTS();
      });

      expect(mockSaveProgress).toHaveBeenCalledWith(
        mockExitDialogData.ttsParagraph,
      );
    });

    it('should navigate back after saving', () => {
      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitTTS();
      });

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('should execute in correct order: dialog hide -> stop TTS -> save progress -> navigate', () => {
      const callOrder: string[] = [];

      mockSetShowExitDialog.mockImplementation(() => {
        callOrder.push('hideDialog');
      });
      mockHandleStopTTS.mockImplementation(() => {
        callOrder.push('stopTTS');
      });
      mockSaveProgress.mockImplementation(() => {
        callOrder.push('saveProgress');
      });
      mockNavigation.goBack.mockImplementation(() => {
        callOrder.push('navigate');
      });

      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitTTS();
      });

      expect(callOrder).toEqual([
        'hideDialog',
        'stopTTS',
        'saveProgress',
        'navigate',
      ]);
    });

    it('should use exitDialogData.ttsParagraph (not readerParagraph)', () => {
      const customDialogData = {
        ttsParagraph: 100,
        readerParagraph: 50,
      };

      const { result } = renderTestHook(customDialogData);

      act(() => {
        result.current.handleExitTTS();
      });

      expect(mockSaveProgress).toHaveBeenCalledWith(100); // TTS position
      expect(mockSaveProgress).not.toHaveBeenCalledWith(50); // Reader position
    });
  });

  // ========================================
  // Test Group 3: handleExitReader
  // ========================================
  describe('handleExitReader', () => {
    it('should hide exit dialog', () => {
      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitReader();
      });

      expect(mockSetShowExitDialog).toHaveBeenCalledWith(false);
    });

    it('should call handleStopTTS to stop TTS playback', () => {
      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitReader();
      });

      expect(mockHandleStopTTS).toHaveBeenCalledTimes(1);
    });

    it('should save reader position (exitDialogData.readerParagraph)', () => {
      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitReader();
      });

      expect(mockSaveProgress).toHaveBeenCalledWith(
        mockExitDialogData.readerParagraph,
      );
    });

    it('should navigate back after saving', () => {
      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitReader();
      });

      expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('should execute in correct order: dialog hide -> stop TTS -> save progress -> navigate', () => {
      const callOrder: string[] = [];

      mockSetShowExitDialog.mockImplementation(() => {
        callOrder.push('hideDialog');
      });
      mockHandleStopTTS.mockImplementation(() => {
        callOrder.push('stopTTS');
      });
      mockSaveProgress.mockImplementation(() => {
        callOrder.push('saveProgress');
      });
      mockNavigation.goBack.mockImplementation(() => {
        callOrder.push('navigate');
      });

      const { result } = renderTestHook();

      act(() => {
        result.current.handleExitReader();
      });

      expect(callOrder).toEqual([
        'hideDialog',
        'stopTTS',
        'saveProgress',
        'navigate',
      ]);
    });

    it('should use exitDialogData.readerParagraph (not ttsParagraph)', () => {
      const customDialogData = {
        ttsParagraph: 100,
        readerParagraph: 50,
      };

      const { result } = renderTestHook(customDialogData);

      act(() => {
        result.current.handleExitReader();
      });

      expect(mockSaveProgress).toHaveBeenCalledWith(50); // Reader position
      expect(mockSaveProgress).not.toHaveBeenCalledWith(100); // TTS position
    });
  });

  // ========================================
  // Test Group 4: Callback Stability
  // ========================================
  describe('Callback Stability', () => {
    it('should not recreate callbacks unnecessarily when same props provided', () => {
      const { result, rerender } = renderTestHook();

      const originalExitTTS = result.current.handleExitTTS;
      const originalExitReader = result.current.handleExitReader;

      // Rerender with same props
      rerender({
        exitDialogData: mockExitDialogData,
        saveProgress: mockSaveProgress,
        navigation: mockNavigation,
        callbacks: {
          handleStopTTS: mockHandleStopTTS,
          setShowExitDialog: mockSetShowExitDialog,
        },
      });

      // Callbacks should be the same reference (useCallback optimization)
      expect(result.current.handleExitTTS).toBe(originalExitTTS);
      expect(result.current.handleExitReader).toBe(originalExitReader);
    });
  });
});
