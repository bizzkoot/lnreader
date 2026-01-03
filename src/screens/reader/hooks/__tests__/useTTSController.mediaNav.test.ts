/**
 * Tests: TTS State Cleanup on Media Navigation
 *
 * Verify that ALL TTS state is cleared when user navigates
 * via media notification controls (PREV/NEXT chapter).
 */

import { MMKVStorage } from '@utils/mmkv/mmkv';
import { renderHook, act } from '@testing-library/react-native';
import { useTTSController } from '../useTTSController';

// Mock all dependencies
jest.mock('@services/TTSHighlight', () => ({
  __esModule: true,
  default: {
    updateMediaState: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    fullStop: jest.fn().mockResolvedValue(undefined),
    speak: jest.fn().mockResolvedValue(undefined),
    speakBatch: jest.fn().mockResolvedValue(undefined),
    addToBatch: jest.fn().mockResolvedValue(undefined),
    setLastSpokenIndex: jest.fn(),
    setOnDriftEnforceCallback: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    hasRemainingItems: jest.fn(() => false),
    hasQueuedNativeInCurrentSession: jest.fn(() => false),
  },
}));

jest.mock('@services/TTSAudioManager', () => ({
  __esModule: true,
  default: {
    updateMediaState: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    speakBatch: jest.fn().mockResolvedValue(undefined),
    setLastSpokenIndex: jest.fn(),
  },
}));

// Mock MMKVStorage with actual in-memory storage
const mockMMKVStorage: Record<string, any> = {};

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    set: jest.fn((key: string, value: any) => {
      mockMMKVStorage[key] = value;
    }),
    getNumber: jest.fn((key: string) => {
      const value = mockMMKVStorage[key];
      return value !== undefined ? value : undefined;
    }),
    getString: jest.fn((key: string) => {
      return mockMMKVStorage[key] ?? null;
    }),
    delete: jest.fn((key: string) => {
      delete mockMMKVStorage[key];
    }),
    clearAll: jest.fn(() => {
      Object.keys(mockMMKVStorage).forEach(key => delete mockMMKVStorage[key]);
    }),
    getBoolean: jest.fn((key: string) => mockMMKVStorage[key] ?? false),
    getArray: jest.fn((key: string) => mockMMKVStorage[key] ?? null),
  },
}));

jest.mock('@services/TTSState', () => ({
  __esModule: true,
  TTSState: {
    canTransition: jest.fn(() => true),
    transition: jest.fn(),
  },
}));

jest.mock('@utils/rateLimitedLogger', () => ({
  createRateLimitedLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: jest.fn().mockImplementation((id: number) =>
    Promise.resolve({
      id,
      name: `Chapter ${id}`,
      novelId: 1,
      position: id,
      page: 1,
    }),
  ),
  updateChapterProgress: jest.fn().mockResolvedValue(undefined),
  markChapterUnread: jest.fn().mockResolvedValue(undefined),
  markChapterRead: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@database/db', () => {
  const mockDb = {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
  };

  // Return empty array by default (no skipped chapters)
  mockDb.getAllAsync.mockResolvedValue([]);

  return {
    db: mockDb,
  };
});

jest.mock('@utils/htmlParagraphExtractor', () => ({
  extractParagraphs: jest.fn(() => ['Para 1', 'Para 2', 'Para 3']),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: 'novel-storage',
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));

jest.mock('@utils/error', () => ({
  ignoreError: jest.fn(),
}));

jest.mock('@services/tts/AutoStopService', () => ({
  autoStopService: {
    clearAutoStop: jest.fn(),
  },
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
}));

jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock all the extracted hooks
jest.mock('../useDialogState', () => ({
  useDialogState: jest.fn(() => ({
    dialogState: { showResumeDialog: false },
    setDialogState: jest.fn(),
  })),
}));

jest.mock('../useRefSync', () => ({
  useRefSync: jest.fn(() => ({})),
}));

jest.mock('../useTTSUtilities', () => ({
  useTTSUtilities: jest.fn(() => ({
    updateTtsMediaNotificationState: jest.fn(),
    updateLastTTSChapter: jest.fn(),
    restartTtsFromParagraphIndex: jest.fn(),
    resumeTTS: jest.fn(),
  })),
}));

jest.mock('../useExitDialogHandlers', () => ({
  useExitDialogHandlers: jest.fn(() => ({})),
}));

jest.mock('../useSyncDialogHandlers', () => ({
  useSyncDialogHandlers: jest.fn(() => ({})),
}));

jest.mock('../useScrollSyncHandlers', () => ({
  useScrollSyncHandlers: jest.fn(() => ({})),
}));

jest.mock('../useManualModeHandlers', () => ({
  useManualModeHandlers: jest.fn(() => ({})),
}));

jest.mock('../useChapterTransition', () => ({
  useChapterTransition: jest.fn(() => ({})),
}));

jest.mock('../useResumeDialogHandlers', () => ({
  useResumeDialogHandlers: jest.fn(() => ({})),
}));

jest.mock('../useTTSConfirmationHandler', () => ({
  useTTSConfirmationHandler: jest.fn(() => ({})),
}));

jest.mock('../useChapterSelectionHandler', () => ({
  useChapterSelectionHandler: jest.fn(() => ({})),
}));

jest.mock('../useBackHandler', () => ({
  useBackHandler: jest.fn(() => ({})),
}));

describe('TTS State Cleanup - Media Navigation', () => {
  // Mock props for useTTSController
  const createMockProps = (chapterId: number = 10) => ({
    chapter: {
      id: chapterId,
      name: `Chapter ${chapterId}`,
      novelId: 1,
      position: chapterId,
      page: 1,
    } as any,
    novel: { id: 1, name: 'Test Novel' } as any,
    html: '<p>Test content</p>',
    webViewRef: {
      current: {
        injectJavaScript: jest.fn(),
      },
    } as any,
    saveProgress: jest.fn(),
    readerSettings: { tts: { voice: {}, rate: 1.0, pitch: 1.0 } } as any,
    savedParagraphIndex: -1,
    prevChapter: {
      id: 7,
      name: 'Chapter 7',
      novelId: 1,
      position: 7,
      page: 1,
    } as any,
    nextChapter: {
      id: 11,
      name: 'Chapter 11',
      novelId: 1,
      position: 11,
      page: 1,
    } as any,
    navigateChapter: jest.fn(),
    showToastMessage: jest.fn(),
    syncChapterList: jest.fn(),
    refreshChaptersFromContext: jest.fn(),
    getChapter: jest.fn(),
    initialSavedParagraphIndex: -1,
    readerSettingsRef: {
      current: { tts: { voice: {}, rate: 1.0, pitch: 1.0 } },
    } as any,
    chapterGeneralSettingsRef: { current: {} } as any,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear MMKV before each test
    MMKVStorage.clearAll();
    // Setup mock TTS state
    MMKVStorage.set('pendingTTSResumeChapterId', 10);
    MMKVStorage.set('lastTTSChapterId', 10);
    MMKVStorage.set('chapter_progress_10', 45);
    MMKVStorage.set('chapter_progress_9', 30);
    MMKVStorage.set('chapter_progress_8', 15);
    MMKVStorage.set('tts_button_position', JSON.stringify({ x: 100, y: 200 }));
  });

  it('should clear all TTS state when calling cleanup function', async () => {
    // Verify initial state BEFORE rendering hook
    expect(MMKVStorage.getNumber('pendingTTSResumeChapterId')).toBe(10);
    expect(MMKVStorage.getNumber('lastTTSChapterId')).toBe(10);
    expect(MMKVStorage.getNumber('chapter_progress_10')).toBe(45);

    const { result } = renderHook(() => useTTSController(createMockProps()));

    // Call cleanup function
    await act(async () => {
      await result.current.cleanupAllTTSState([10, 9]);
    });

    // Verify all state cleared
    expect(MMKVStorage.getNumber('pendingTTSResumeChapterId')).toBeUndefined();
    expect(MMKVStorage.getNumber('lastTTSChapterId')).toBeUndefined();
    expect(MMKVStorage.getNumber('chapter_progress_10')).toBeUndefined();
    expect(MMKVStorage.getNumber('chapter_progress_9')).toBeUndefined();
    expect(MMKVStorage.getString('tts_button_position')).toBeNull();
  });

  it('should clear ttsStateRef when calling cleanup function', async () => {
    const { result } = renderHook(() => useTTSController(createMockProps()));

    // Setup initial state
    act(() => {
      if (result.current.ttsStateRef) {
        result.current.ttsStateRef.current = {
          chapterId: 10,
          paragraphIndex: 45,
          timestamp: Date.now(),
        };
      }
    });

    expect(result.current.ttsStateRef?.current).not.toBeNull();

    // Call cleanup function
    await act(async () => {
      await result.current.cleanupAllTTSState([10]);
    });

    // Verify ref cleared
    expect(result.current.ttsStateRef?.current).toBeNull();
  });

  describe('PREV_CHAPTER Navigation - State Cleanup', () => {
    it('should cleanup all TTS state when calling cleanup with chapter IDs', async () => {
      // Setup: User at Ch10, various state set
      const mockProps = createMockProps(10);
      const { result } = renderHook(() => useTTSController(mockProps));

      // Setup initial TTS state AFTER hook renders
      act(() => {
        MMKVStorage.set('pendingTTSResumeChapterId', 10);
        MMKVStorage.set('lastTTSChapterId', 10);
        MMKVStorage.set('chapter_progress_10', 45);
        MMKVStorage.set('chapter_progress_9', 30);
        MMKVStorage.set('chapter_progress_8', 15);
        MMKVStorage.set('chapter_progress_7', 5);
        MMKVStorage.set(
          'tts_button_position',
          JSON.stringify({ x: 100, y: 200 }),
        );

        if (result.current.ttsStateRef) {
          result.current.ttsStateRef.current = {
            chapterId: 10,
            paragraphIndex: 45,
            timestamp: Date.now(),
          };
        }
      });

      // Verify initial state
      expect(MMKVStorage.getNumber('pendingTTSResumeChapterId')).toBe(10);
      expect(MMKVStorage.getNumber('lastTTSChapterId')).toBe(10);
      expect(MMKVStorage.getNumber('chapter_progress_10')).toBe(45);
      expect(MMKVStorage.getNumber('chapter_progress_9')).toBe(30);
      expect(MMKVStorage.getNumber('chapter_progress_8')).toBe(15);
      expect(MMKVStorage.getNumber('chapter_progress_7')).toBe(5);
      expect(result.current.ttsStateRef?.current).not.toBeNull();

      // Call cleanup directly with source, target, and skipped chapters
      // This simulates what happens in PREV_CHAPTER handler
      await act(async () => {
        await result.current.cleanupAllTTSState([10, 7, 8, 9]);
      });

      // Verify ALL state cleared (Ch7, Ch8, Ch9, Ch10)
      expect(
        MMKVStorage.getNumber('pendingTTSResumeChapterId'),
      ).toBeUndefined();
      expect(MMKVStorage.getNumber('lastTTSChapterId')).toBeUndefined();
      expect(MMKVStorage.getNumber('chapter_progress_10')).toBeUndefined();
      expect(MMKVStorage.getNumber('chapter_progress_9')).toBeUndefined();
      expect(MMKVStorage.getNumber('chapter_progress_8')).toBeUndefined();
      expect(MMKVStorage.getNumber('chapter_progress_7')).toBeUndefined();
      expect(MMKVStorage.getString('tts_button_position')).toBeNull();

      // Verify in-memory state cleared
      expect(result.current.ttsStateRef?.current).toBeNull();
    });
  });

  describe('NEXT_CHAPTER Navigation - State Cleanup', () => {
    it('should cleanup all TTS state when navigating to next chapter', async () => {
      // Setup: User at Ch5, various state set
      const mockProps = createMockProps(5);
      mockProps.nextChapter = {
        id: 6,
        name: 'Chapter 6',
        novelId: 1,
        position: 6,
        page: 1,
      } as any;

      const { result } = renderHook(() => useTTSController(mockProps));

      // Setup initial TTS state AFTER hook renders
      act(() => {
        MMKVStorage.set('pendingTTSResumeChapterId', 5);
        MMKVStorage.set('lastTTSChapterId', 5);
        MMKVStorage.set('chapter_progress_5', 100);
        MMKVStorage.set(
          'tts_button_position',
          JSON.stringify({ x: 100, y: 200 }),
        );

        if (result.current.ttsStateRef) {
          result.current.ttsStateRef.current = {
            chapterId: 5,
            paragraphIndex: 100,
            timestamp: Date.now(),
          };
        }
      });

      // Verify initial state
      expect(MMKVStorage.getNumber('pendingTTSResumeChapterId')).toBe(5);
      expect(MMKVStorage.getNumber('lastTTSChapterId')).toBe(5);
      expect(MMKVStorage.getNumber('chapter_progress_5')).toBe(100);
      expect(result.current.ttsStateRef?.current).not.toBeNull();

      // Call cleanup directly with source and target chapters
      // This simulates what should happen in NEXT_CHAPTER handler
      await act(async () => {
        await result.current.cleanupAllTTSState([5, 6]);
      });

      // Verify ALL state cleared
      expect(
        MMKVStorage.getNumber('pendingTTSResumeChapterId'),
      ).toBeUndefined();
      expect(MMKVStorage.getNumber('lastTTSChapterId')).toBeUndefined();
      expect(MMKVStorage.getNumber('chapter_progress_5')).toBeUndefined();
      expect(MMKVStorage.getString('tts_button_position')).toBeNull();

      // Verify in-memory state cleared
      expect(result.current.ttsStateRef?.current).toBeNull();
    });
  });
});
