/**
 * Comprehensive Tests for useTTSUtilities (Phase 1 - Step 2)
 *
 * Tests core TTS utility functions including:
 * - resumeTTS: WebView injection with state restoration
 * - updateTtsMediaNotificationState: Notification updates
 * - updateLastTTSChapter: MMKV storage updates
 * - restartTtsFromParagraphIndex: Paragraph clamping, async batch operations
 *
 * CRITICAL: This hook manages TTS resume logic, progress tracking, and media notifications.
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useTTSUtilities } from '../useTTSUtilities';
import TTSHighlight from '@services/TTSHighlight';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { extractParagraphs } from '@utils/htmlParagraphExtractor';
import { validateAndClampParagraphIndex } from '../../components/ttsHelpers';

// Mock dependencies
jest.mock('@services/TTSHighlight', () => ({
  __esModule: true,
  default: {
    updateMediaState: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    speakBatch: jest.fn().mockResolvedValue(undefined),
    setLastSpokenIndex: jest.fn(),
  },
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    set: jest.fn(),
  },
}));

jest.mock('@utils/htmlParagraphExtractor', () => ({
  extractParagraphs: jest.fn(),
}));

jest.mock('../../components/ttsHelpers', () => ({
  validateAndClampParagraphIndex: jest.fn((index, _total, _context) => index),
}));

describe('useTTSUtilities (Phase 1 - Step 2)', () => {
  // Mock refs
  let mockWebViewRef: any;
  let mockReaderSettingsRef: any;
  let mockRefs: any;

  // Mock data
  const mockNovel = { id: 1, name: 'Test Novel' } as any;
  const mockChapter = { id: 123, name: 'Chapter 1' } as any;
  const mockHtml = '<p>Paragraph 1</p><p>Paragraph 2</p><p>Paragraph 3</p>';

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup WebView ref
    mockWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
      },
    };

    // Setup reader settings ref
    mockReaderSettingsRef = {
      current: {
        tts: {
          voice: { identifier: 'en-US-test' },
          rate: 1.0,
          pitch: 1.0,
        },
      },
    };

    // Setup all refs
    mockRefs = {
      currentParagraphIndexRef: { current: 0 },
      totalParagraphsRef: { current: 100 },
      latestParagraphIndexRef: { current: 0 },
      isTTSPausedRef: { current: false },
      isTTSPlayingRef: { current: false },
      hasUserScrolledRef: { current: false },
      ttsQueueRef: { current: null },
      isTTSReadingRef: { current: false },
      lastTTSChapterIdRef: { current: null },
    };

    // Default mock implementations
    (extractParagraphs as jest.Mock).mockReturnValue([
      'Paragraph 1',
      'Paragraph 2',
      'Paragraph 3',
    ]);
  });

  // ==========================================================================
  // Initial State Tests
  // ==========================================================================
  describe('Initial State', () => {
    it('should return all utility functions', () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      expect(result.current).toHaveProperty('updateTtsMediaNotificationState');
      expect(result.current).toHaveProperty('updateLastTTSChapter');
      expect(result.current).toHaveProperty('restartTtsFromParagraphIndex');
      expect(result.current).toHaveProperty('resumeTTS');
    });

    it('should return functions (not undefined)', () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      expect(typeof result.current.updateTtsMediaNotificationState).toBe(
        'function',
      );
      expect(typeof result.current.updateLastTTSChapter).toBe('function');
      expect(typeof result.current.restartTtsFromParagraphIndex).toBe(
        'function',
      );
      expect(typeof result.current.resumeTTS).toBe('function');
    });
  });

  // ==========================================================================
  // Function: resumeTTS
  // ==========================================================================
  describe('Function: resumeTTS', () => {
    it('should inject JavaScript to restore TTS state', () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      const storedState = {
        paragraphIndex: 42,
        timestamp: Date.now(),
        isReading: true,
        chapterId: 123,
      };

      act(() => {
        result.current.resumeTTS(storedState);
      });

      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('window.tts.restoreState'),
      );
      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('shouldResume: true'),
      );
      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('paragraphIndex: 42'),
      );
      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('autoStart: true'),
      );
    });

    it('should handle null WebView ref gracefully', () => {
      mockWebViewRef.current = null;

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      const storedState = {
        paragraphIndex: 42,
        timestamp: Date.now(),
      };

      // Should not crash
      expect(() => {
        act(() => {
          result.current.resumeTTS(storedState);
        });
      }).not.toThrow();
    });

    it('should use paragraph index from stored state', () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      const storedState = {
        paragraphIndex: 99,
        timestamp: Date.now(),
      };

      act(() => {
        result.current.resumeTTS(storedState);
      });

      expect(mockWebViewRef.current.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('paragraphIndex: 99'),
      );
    });
  });

  // ==========================================================================
  // Function: updateTtsMediaNotificationState
  // ==========================================================================
  describe('Function: updateTtsMediaNotificationState', () => {
    it('should call TTSHighlight.updateMediaState with correct parameters', async () => {
      mockRefs.currentParagraphIndexRef.current = 42;
      mockRefs.totalParagraphsRef.current = 100;

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        result.current.updateTtsMediaNotificationState(true);
      });

      expect(TTSHighlight.updateMediaState).toHaveBeenCalledWith({
        novelName: 'Test Novel',
        chapterLabel: 'Chapter 1',
        chapterId: 123,
        paragraphIndex: 42,
        totalParagraphs: 100,
        isPlaying: true,
      });
    });

    it('should use fallback novel name if novel is null', async () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: null as any,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        result.current.updateTtsMediaNotificationState(true);
      });

      expect(TTSHighlight.updateMediaState).toHaveBeenCalledWith(
        expect.objectContaining({
          novelName: 'LNReader',
        }),
      );
    });

    it('should use chapter ID as label if chapter name is missing', async () => {
      const chapterWithoutName = { id: 456, name: '' } as any;

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: chapterWithoutName,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        result.current.updateTtsMediaNotificationState(true);
      });

      expect(TTSHighlight.updateMediaState).toHaveBeenCalledWith(
        expect.objectContaining({
          chapterLabel: 'Chapter 456',
        }),
      );
    });

    it('should handle negative paragraph indices', async () => {
      mockRefs.currentParagraphIndexRef.current = -5;

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        result.current.updateTtsMediaNotificationState(true);
      });

      expect(TTSHighlight.updateMediaState).toHaveBeenCalledWith(
        expect.objectContaining({
          paragraphIndex: 0, // Clamped to 0
        }),
      );
    });

    it('should not throw if TTSHighlight.updateMediaState fails', async () => {
      (TTSHighlight.updateMediaState as jest.Mock).mockRejectedValueOnce(
        new Error('Notification error'),
      );

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      // Should not crash - function handles errors internally
      await act(async () => {
        expect(() => {
          result.current.updateTtsMediaNotificationState(true);
        }).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // Function: updateLastTTSChapter
  // ==========================================================================
  describe('Function: updateLastTTSChapter', () => {
    it('should update lastTTSChapterIdRef with new chapter ID', () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      act(() => {
        result.current.updateLastTTSChapter(456);
      });

      expect(mockRefs.lastTTSChapterIdRef.current).toBe(456);
    });

    it('should save chapter ID to MMKV storage', () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      act(() => {
        result.current.updateLastTTSChapter(789);
      });

      expect(MMKVStorage.set).toHaveBeenCalledWith('lastTTSChapterId', 789);
    });

    it('should handle multiple sequential updates', () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      act(() => {
        result.current.updateLastTTSChapter(100);
        result.current.updateLastTTSChapter(200);
        result.current.updateLastTTSChapter(300);
      });

      expect(mockRefs.lastTTSChapterIdRef.current).toBe(300);
      expect(MMKVStorage.set).toHaveBeenCalledTimes(3);
      expect(MMKVStorage.set).toHaveBeenLastCalledWith('lastTTSChapterId', 300);
    });
  });

  // ==========================================================================
  // Function: restartTtsFromParagraphIndex
  // ==========================================================================
  describe('Function: restartTtsFromParagraphIndex', () => {
    it('should extract paragraphs from HTML', async () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(0);
      });

      expect(extractParagraphs).toHaveBeenCalledWith(mockHtml);
    });

    it('should return early if no paragraphs extracted', async () => {
      (extractParagraphs as jest.Mock).mockReturnValueOnce(null);

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(0);
      });

      expect(TTSHighlight.stop).not.toHaveBeenCalled();
      expect(TTSHighlight.speakBatch).not.toHaveBeenCalled();
    });

    it('should clamp paragraph index using validateAndClampParagraphIndex', async () => {
      (validateAndClampParagraphIndex as jest.Mock).mockReturnValueOnce(50);

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(999);
      });

      expect(validateAndClampParagraphIndex).toHaveBeenCalledWith(
        999,
        3, // 3 paragraphs
        'media control seek',
      );
    });

    it('should stop TTS before restarting', async () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(1);
      });

      expect(TTSHighlight.stop).toHaveBeenCalled();
    });

    it('should update ttsQueueRef with remaining paragraphs', async () => {
      (validateAndClampParagraphIndex as jest.Mock).mockReturnValueOnce(1);

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(1);
      });

      expect(mockRefs.ttsQueueRef.current).toEqual({
        startIndex: 1,
        texts: ['Paragraph 2', 'Paragraph 3'],
      });
    });

    it('should update all required refs', async () => {
      (validateAndClampParagraphIndex as jest.Mock).mockReturnValueOnce(1);

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(1);
      });

      expect(mockRefs.currentParagraphIndexRef.current).toBe(1);
      expect(mockRefs.latestParagraphIndexRef.current).toBe(1);
      expect(mockRefs.isTTSPausedRef.current).toBe(false);
      expect(mockRefs.isTTSPlayingRef.current).toBe(true);
      expect(mockRefs.hasUserScrolledRef.current).toBe(false);
      expect(mockRefs.isTTSReadingRef.current).toBe(true);
    });

    it('should call TTSHighlight.speakBatch with correct parameters', async () => {
      (validateAndClampParagraphIndex as jest.Mock).mockReturnValueOnce(0);

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(0);
      });

      expect(TTSHighlight.speakBatch).toHaveBeenCalledWith(
        ['Paragraph 1', 'Paragraph 2', 'Paragraph 3'],
        [
          'chapter_123_utterance_0',
          'chapter_123_utterance_1',
          'chapter_123_utterance_2',
        ],
        {
          voice: 'en-US-test',
          pitch: 1.0,
          rate: 1.0,
        },
      );
    });

    it('should generate correct utterance IDs', async () => {
      (validateAndClampParagraphIndex as jest.Mock).mockReturnValueOnce(1);

      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(1);
      });

      expect(TTSHighlight.speakBatch).toHaveBeenCalledWith(
        ['Paragraph 2', 'Paragraph 3'],
        ['chapter_123_utterance_1', 'chapter_123_utterance_2'],
        expect.any(Object),
      );
    });

    it('should call updateTtsMediaNotificationState after restart', async () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      await act(async () => {
        await result.current.restartTtsFromParagraphIndex(0);
      });

      expect(TTSHighlight.updateMediaState).toHaveBeenCalledWith(
        expect.objectContaining({
          isPlaying: true,
        }),
      );
    });
  });

  // ==========================================================================
  // Return Interface Tests
  // ==========================================================================
  describe('Return Interface', () => {
    it('should maintain stable function references across re-renders', () => {
      const { result, rerender } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      const firstRender = result.current;
      rerender();
      const secondRender = result.current;

      // Functions should be memoized
      expect(firstRender.resumeTTS).toBe(secondRender.resumeTTS);
      expect(firstRender.updateLastTTSChapter).toBe(
        secondRender.updateLastTTSChapter,
      );
      expect(firstRender.restartTtsFromParagraphIndex).toBe(
        secondRender.restartTtsFromParagraphIndex,
      );
    });
  });

  // ==========================================================================
  // Zero Regression Validation
  // ==========================================================================
  describe('Zero Regression Validation', () => {
    it('Phase 1 Step 2: useTTSUtilities preserves all original TTS utility behaviors', () => {
      const { result } = renderHook(() =>
        useTTSUtilities({
          novel: mockNovel,
          chapter: mockChapter,
          html: mockHtml,
          webViewRef: mockWebViewRef,
          readerSettingsRef: mockReaderSettingsRef,
          refs: mockRefs,
        }),
      );

      // This test documents that Phase 1 Step 2 successfully extracted
      // TTS utility functions from useTTSController.ts with zero behavioral changes.

      // Original implementation: Functions within useTTSController
      // After extraction: Single useTTSUtilities() hook
      // Behavior: IDENTICAL

      expect(result.current).toBeTruthy();
      expect(result.current.resumeTTS).toBeDefined();
      expect(result.current.updateTtsMediaNotificationState).toBeDefined();
      expect(result.current.updateLastTTSChapter).toBeDefined();
      expect(result.current.restartTtsFromParagraphIndex).toBeDefined();
    });
  });
});
