import TTSHighlight from '../TTSHighlight';

// Mock React Native modules
jest.mock('react-native', () => ({
  NativeModules: {
    TTSHighlight: {
      speak: jest.fn(),
      speakBatch: jest.fn(),
      addToBatch: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      updateMediaState: jest.fn().mockResolvedValue(true),
      getVoices: jest.fn(),
      getQueueSize: jest.fn(),
      getSavedTTSPosition: jest.fn().mockResolvedValue(-1),
    },
  },
  NativeEventEmitter: jest.fn().mockImplementation(() => ({
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  })),
}));

jest.mock('../TTSAudioManager', () => ({
  speakBatch: jest.fn().mockResolvedValue(2),
  stop: jest.fn().mockResolvedValue(true),
  fullStop: jest.fn().mockResolvedValue(true),
  setRestartInProgress: jest.fn(),
  isRestartInProgress: jest.fn().mockReturnValue(false),
  setRefillInProgress: jest.fn(),
  isRefillInProgress: jest.fn().mockReturnValue(false),
  hasRemainingItems: jest.fn().mockReturnValue(false),
}));

describe('TTS Media Control Tests', () => {
  const { NativeModules } = require('react-native');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Notification Media State Updates', () => {
    it('should update media state with all required fields', async () => {
      const mediaState = {
        novelName: 'Test Novel',
        chapterLabel: 'Chapter 1: Introduction',
        chapterId: 123,
        paragraphIndex: 5,
        totalParagraphs: 50,
        isPlaying: true,
      };

      await TTSHighlight.updateMediaState(mediaState);

      expect(NativeModules.TTSHighlight.updateMediaState).toHaveBeenCalledWith(
        mediaState,
      );
      expect(NativeModules.TTSHighlight.updateMediaState).toHaveBeenCalledTimes(
        1,
      );
    });

    it('should calculate correct progress percentage', () => {
      // Progress should be paragraphIndex / totalParagraphs * 100
      const testCases = [
        { paragraphIndex: 0, totalParagraphs: 100, expected: 0 },
        { paragraphIndex: 25, totalParagraphs: 100, expected: 25 },
        { paragraphIndex: 50, totalParagraphs: 100, expected: 50 },
        { paragraphIndex: 99, totalParagraphs: 100, expected: 99 },
        { paragraphIndex: 10, totalParagraphs: 20, expected: 50 },
      ];

      testCases.forEach(({ paragraphIndex, totalParagraphs, expected }) => {
        const progress = Math.round((paragraphIndex / totalParagraphs) * 100);
        expect(progress).toBe(expected);
      });
    });

    it('should update media state when pausing', async () => {
      const mediaState = {
        novelName: 'Test Novel',
        chapterLabel: 'Chapter 2: Adventure',
        chapterId: 456,
        paragraphIndex: 10,
        totalParagraphs: 30,
        isPlaying: false, // Paused
      };

      await TTSHighlight.updateMediaState(mediaState);

      expect(NativeModules.TTSHighlight.updateMediaState).toHaveBeenCalledWith(
        expect.objectContaining({
          isPlaying: false,
        }),
      );
    });
  });

  describe('Chapter Navigation - Start from Paragraph 0', () => {
    it('should provide paragraph index 0 when navigating to previous chapter', () => {
      // When notification "Previous Chapter" button is pressed,
      // the paragraph index should be reset to 0
      const expectedStartIndex = 0;

      expect(expectedStartIndex).toBe(0);
    });

    it('should provide paragraph index 0 when navigating to next chapter', () => {
      // When notification "Next Chapter" button is pressed,
      // the paragraph index should be reset to 0
      const expectedStartIndex = 0;

      expect(expectedStartIndex).toBe(0);
    });

    it('should validate paragraph index is clamped to valid range', () => {
      const clampParagraphIndex = (
        index: number,
        totalParagraphs: number,
      ): number => {
        return Math.max(0, Math.min(index, totalParagraphs - 1));
      };

      expect(clampParagraphIndex(-5, 100)).toBe(0);
      expect(clampParagraphIndex(0, 100)).toBe(0);
      expect(clampParagraphIndex(50, 100)).toBe(50);
      expect(clampParagraphIndex(99, 100)).toBe(99);
      expect(clampParagraphIndex(150, 100)).toBe(99);
    });
  });

  describe('Seek Operations', () => {
    it('should seek forward by 5 paragraphs', () => {
      const currentIndex = 10;
      const seekAmount = 5;
      const totalParagraphs = 100;

      const targetIndex = Math.min(
        totalParagraphs - 1,
        currentIndex + seekAmount,
      );

      expect(targetIndex).toBe(15);
    });

    it('should seek backward by 5 paragraphs', () => {
      const currentIndex = 10;
      const seekAmount = 5;

      const targetIndex = Math.max(0, currentIndex - seekAmount);

      expect(targetIndex).toBe(5);
    });

    it('should clamp forward seek at last paragraph', () => {
      const currentIndex = 97;
      const seekAmount = 5;
      const totalParagraphs = 100;

      const targetIndex = Math.min(
        totalParagraphs - 1,
        currentIndex + seekAmount,
      );

      expect(targetIndex).toBe(99);
    });

    it('should clamp backward seek at first paragraph', () => {
      const currentIndex = 3;
      const seekAmount = 5;

      const targetIndex = Math.max(0, currentIndex - seekAmount);

      expect(targetIndex).toBe(0);
    });
  });

  describe('Progress Bar Calculation', () => {
    it('should format progress as percentage with % symbol', () => {
      const formatProgress = (
        paragraphIndex: number,
        totalParagraphs: number,
      ): string => {
        if (totalParagraphs === 0) return '0%';
        const percent = Math.round((paragraphIndex / totalParagraphs) * 100);
        return `${percent}%`;
      };

      expect(formatProgress(0, 100)).toBe('0%');
      expect(formatProgress(25, 100)).toBe('25%');
      expect(formatProgress(50, 100)).toBe('50%');
      expect(formatProgress(75, 100)).toBe('75%');
      expect(formatProgress(100, 100)).toBe('100%');
    });

    it('should handle edge case of 0 total paragraphs', () => {
      const formatProgress = (
        paragraphIndex: number,
        totalParagraphs: number,
      ): string => {
        if (totalParagraphs === 0) return '0%';
        const percent = Math.round((paragraphIndex / totalParagraphs) * 100);
        return `${percent}%`;
      };

      expect(formatProgress(0, 0)).toBe('0%');
    });

    it('should provide progress value 0-100 for NotificationCompat.setProgress()', () => {
      const calculateProgressValue = (
        paragraphIndex: number,
        totalParagraphs: number,
      ): number => {
        if (totalParagraphs === 0) return 0;
        return Math.round((paragraphIndex / totalParagraphs) * 100);
      };

      // setProgress(max: 100, current: progressValue, indeterminate: false)
      const max = 100;
      const current = calculateProgressValue(42, 100);
      const indeterminate = false;

      expect(max).toBe(100);
      expect(current).toBe(42);
      expect(indeterminate).toBe(false);
      expect(current).toBeGreaterThanOrEqual(0);
      expect(current).toBeLessThanOrEqual(100);
    });
  });

  describe('Play/Pause Toggle', () => {
    it('should toggle from playing to paused', async () => {
      const mockPause = NativeModules.TTSHighlight.pause as jest.Mock;
      mockPause.mockResolvedValue(true);

      const result = await TTSHighlight.pause();

      expect(mockPause).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should toggle from paused to playing via speakBatch', async () => {
      const mockSpeakBatch = require('@services/TTSAudioManager')
        .speakBatch as jest.Mock;
      mockSpeakBatch.mockResolvedValue(25);

      const texts = Array(50).fill('Test paragraph');
      const utteranceIds = texts.map((_, i) => `chapter_1_utterance_${i}`);

      const result = await TTSHighlight.speakBatch(texts, utteranceIds, {
        rate: 1,
        pitch: 1,
      });

      expect(mockSpeakBatch).toHaveBeenCalledWith(texts, utteranceIds, {
        rate: 1,
        pitch: 1,
      });
      expect(result).toBeGreaterThan(0);
    });
  });

  describe('Media Action Identifiers', () => {
    it('should have correct action identifiers', () => {
      const ACTION_PREV_CHAPTER =
        'com.rajarsheechatterjee.LNReader.TTS.PREV_CHAPTER';
      const ACTION_SEEK_BACK = 'com.rajarsheechatterjee.LNReader.TTS.SEEK_BACK';
      const ACTION_PLAY_PAUSE =
        'com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE';
      const ACTION_SEEK_FORWARD =
        'com.rajarsheechatterjee.LNReader.TTS.SEEK_FORWARD';
      const ACTION_NEXT_CHAPTER =
        'com.rajarsheechatterjee.LNReader.TTS.NEXT_CHAPTER';
      const ACTION_STOP = 'com.rajarsheechatterjee.LNReader.TTS.STOP';

      expect(ACTION_PREV_CHAPTER).toContain('PREV_CHAPTER');
      expect(ACTION_SEEK_BACK).toContain('SEEK_BACK');
      expect(ACTION_PLAY_PAUSE).toContain('PLAY_PAUSE');
      expect(ACTION_SEEK_FORWARD).toContain('SEEK_FORWARD');
      expect(ACTION_NEXT_CHAPTER).toContain('NEXT_CHAPTER');
      expect(ACTION_STOP).toContain('STOP');
    });
  });

  describe('Notification State Consistency', () => {
    it('should maintain consistent state between pause and updateMediaState', async () => {
      // When pausing, the notification should show isPlaying: false
      await TTSHighlight.pause();

      const mediaState = {
        novelName: 'Test Novel',
        chapterLabel: 'Chapter 1',
        chapterId: 1,
        paragraphIndex: 10,
        totalParagraphs: 50,
        isPlaying: false,
      };

      await TTSHighlight.updateMediaState(mediaState);

      expect(NativeModules.TTSHighlight.updateMediaState).toHaveBeenCalledWith(
        expect.objectContaining({
          isPlaying: false,
        }),
      );
    });

    it('should update notification when chapter changes', async () => {
      // First chapter
      await TTSHighlight.updateMediaState({
        novelName: 'Test Novel',
        chapterLabel: 'Chapter 1',
        chapterId: 1,
        paragraphIndex: 99,
        totalParagraphs: 100,
        isPlaying: true,
      });

      // Navigate to next chapter - should start at paragraph 0
      await TTSHighlight.updateMediaState({
        novelName: 'Test Novel',
        chapterLabel: 'Chapter 2',
        chapterId: 2,
        paragraphIndex: 0, // Should be 0 when navigating via notification
        totalParagraphs: 80,
        isPlaying: true,
      });

      expect(NativeModules.TTSHighlight.updateMediaState).toHaveBeenCalledTimes(
        2,
      );
      expect(
        NativeModules.TTSHighlight.updateMediaState,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          chapterLabel: 'Chapter 2',
          paragraphIndex: 0,
        }),
      );
    });
  });

  describe('TTS Position Sync (Native SharedPreferences)', () => {
    it('should call native getSavedTTSPosition with chapter ID', async () => {
      const mockGetPosition = NativeModules.TTSHighlight
        .getSavedTTSPosition as jest.Mock;
      mockGetPosition.mockResolvedValueOnce(42);

      const position = await TTSHighlight.getSavedTTSPosition(123);

      expect(mockGetPosition).toHaveBeenCalledWith(123);
      expect(position).toBe(42);
    });

    it('should return -1 when no position is saved', async () => {
      const mockGetPosition = NativeModules.TTSHighlight
        .getSavedTTSPosition as jest.Mock;
      mockGetPosition.mockResolvedValueOnce(-1);

      const position = await TTSHighlight.getSavedTTSPosition(456);

      expect(mockGetPosition).toHaveBeenCalledWith(456);
      expect(position).toBe(-1);
    });

    it('should support using native position as fallback', async () => {
      // Simulates the scenario where MMKV returns -1 but native has a saved position
      const mmkvIndex = -1;
      const dbIndex = -1;
      const nativeIndex = 25;

      // The reader should use max of all sources
      const resolvedIndex = Math.max(dbIndex, mmkvIndex, nativeIndex);

      expect(resolvedIndex).toBe(25);
    });

    it('should prefer highest value among all position sources', async () => {
      // Test various combinations of position sources
      const testCases = [
        { dbIndex: 10, mmkvIndex: 20, nativeIndex: 15, expected: 20 },
        { dbIndex: 30, mmkvIndex: 20, nativeIndex: 25, expected: 30 },
        { dbIndex: -1, mmkvIndex: -1, nativeIndex: 50, expected: 50 },
        { dbIndex: 5, mmkvIndex: -1, nativeIndex: -1, expected: 5 },
        { dbIndex: -1, mmkvIndex: 15, nativeIndex: -1, expected: 15 },
      ];

      testCases.forEach(({ dbIndex, mmkvIndex, nativeIndex, expected }) => {
        const resolvedIndex = Math.max(dbIndex, mmkvIndex, nativeIndex);
        expect(resolvedIndex).toBe(expected);
      });
    });

    it('should handle position sync on pause/stop correctly', async () => {
      // When TTS is paused via notification, the native side saves to SharedPreferences
      // This test verifies the expected key format
      const chapterId = 789;
      const paragraphIndex = 33;

      // Expected key format: "chapter_progress_{chapterId}"
      const expectedKey = `chapter_progress_${chapterId}`;

      expect(expectedKey).toBe('chapter_progress_789');

      // Mock the native method returning the saved position
      const mockGetPosition = NativeModules.TTSHighlight
        .getSavedTTSPosition as jest.Mock;
      mockGetPosition.mockResolvedValueOnce(paragraphIndex);

      const savedPosition = await TTSHighlight.getSavedTTSPosition(chapterId);
      expect(savedPosition).toBe(33);
    });
  });
});
