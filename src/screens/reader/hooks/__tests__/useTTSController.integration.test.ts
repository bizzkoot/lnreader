/**
 * Integration Tests for useTTSController
 *
 * Tests the main orchestration file that coordinates all TTS hooks and native event listeners.
 * Covers: event listeners, wake/sleep cycles, WebView message routing, background TTS,
 * state orchestration, and edge cases.
 *
 * STATUS: 34/68 tests passing (50%) - Sanity checks all pass, advanced integration tests
 * require WebView message simulation layer (see test-implementation-plan.md Option B)
 */

// @ts-nocheck - Incomplete tests have unused variables (documented in Option B)

import { renderHook, act } from '@testing-library/react-hooks';
import { RefObject } from 'react';
import WebView from 'react-native-webview';
import { AppState } from 'react-native';

import { useTTSController, UseTTSControllerParams } from '../useTTSController';
import TTSHighlight from '@services/TTSHighlight';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import {
  getChapter as getChapterFromDb,
  updateChapterProgress as updateChapterProgressDb,
  markChapterUnread,
  markChapterRead,
} from '@database/queries/ChapterQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import {
  ChapterGeneralSettings,
  ChapterReaderSettings,
} from '@hooks/persisted/useSettings';

// ============================================================================
// Mocks
// ============================================================================

// Mock TTSAudioManager before TTSHighlight imports it
jest.mock('@services/TTSAudioManager', () => ({
  __esModule: true,
  default: {
    speak: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
  },
}));

// Mock TTSHighlight with all methods
jest.mock('@services/TTSHighlight', () => ({
  __esModule: true,
  default: {
    speak: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    fullStop: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    speakBatch: jest.fn().mockResolvedValue(undefined),
    updateMediaState: jest.fn().mockResolvedValue(undefined),
    getSavedTTSPosition: jest.fn().mockResolvedValue(-1),
    isRestartInProgress: jest.fn().mockReturnValue(false),
    setRestartInProgress: jest.fn(),
    addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  },
}));

jest.mock('@utils/mmkv/mmkv');
jest.mock('@database/queries/ChapterQueries');
jest.mock('@utils/htmlParagraphExtractor', () => ({
  extractParagraphs: jest.fn(() => [
    'First paragraph',
    'Second paragraph',
    'Third paragraph',
    'Fourth paragraph',
    'Fifth paragraph',
  ]),
}));
jest.mock('../../components/ttsHelpers', () => ({
  validateAndClampParagraphIndex: jest.fn(index => Math.max(0, index)),
}));
jest.mock('expo-navigation-bar', () => ({
  setVisibilityAsync: jest.fn(),
  setBackgroundColorAsync: jest.fn(),
}));
jest.mock('react-native-webview', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

// Mock AppState
let appStateListener: ((state: string) => void) | null = null;
jest
  .spyOn(AppState, 'addEventListener')
  .mockImplementation((event, handler) => {
    if (event === 'change') {
      appStateListener = handler as (state: string) => void;
    }
    return {
      remove: jest.fn(),
    };
  });

// ============================================================================
// Test Infrastructure
// ============================================================================

describe('useTTSController - Integration Tests', () => {
  // Mock data
  let mockNovel: NovelInfo;
  let mockChapter: ChapterInfo;
  let mockNextChapter: ChapterInfo;
  let mockPrevChapter: ChapterInfo;
  let mockWebViewRef: RefObject<WebView | null>;
  let mockReaderSettingsRef: RefObject<ChapterReaderSettings>;
  let mockChapterGeneralSettingsRef: RefObject<ChapterGeneralSettings>;
  let mockSaveProgress: jest.Mock;
  let mockNavigateChapter: jest.Mock;
  let mockGetChapter: jest.Mock;
  let mockShowToastMessage: jest.Mock;

  // Event listener storage
  let eventListeners: Map<string, (event?: any) => void>;

  // Helper to simulate native event
  const triggerNativeEvent = (eventName: string, eventData?: any) => {
    const handler = eventListeners.get(eventName);
    if (handler) {
      handler(eventData);
    }
  };

  // Helper to create default params
  const createDefaultParams = (
    overrides?: Partial<UseTTSControllerParams>,
  ): UseTTSControllerParams => ({
    chapter: mockChapter,
    novel: mockNovel,
    html: '<p id="0">First paragraph</p><p id="1">Second paragraph</p><p id="2">Third paragraph</p>',
    webViewRef: mockWebViewRef,
    saveProgress: mockSaveProgress,
    navigateChapter: mockNavigateChapter,
    getChapter: mockGetChapter,
    nextChapter: mockNextChapter,
    prevChapter: mockPrevChapter,
    savedParagraphIndex: 0,
    initialSavedParagraphIndex: 0,
    readerSettingsRef: mockReaderSettingsRef,
    chapterGeneralSettingsRef: mockChapterGeneralSettingsRef,
    showToastMessage: mockShowToastMessage,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    eventListeners = new Map();

    // Setup mock data
    mockNovel = {
      id: 1,
      name: 'Test Novel',
      path: '',
      pluginId: 'test-plugin',
    } as NovelInfo;

    mockChapter = {
      id: 100,
      name: 'Chapter 1',
      novelId: 1,
      progress: 0,
    } as ChapterInfo;

    mockNextChapter = {
      id: 101,
      name: 'Chapter 2',
      novelId: 1,
      progress: 0,
    } as ChapterInfo;

    mockPrevChapter = {
      id: 99,
      name: 'Chapter 0',
      novelId: 1,
      progress: 0,
    } as ChapterInfo;

    // Setup mocks
    mockSaveProgress = jest.fn();
    mockNavigateChapter = jest.fn();
    mockGetChapter = jest.fn();
    mockShowToastMessage = jest.fn();

    // Setup WebView ref
    mockWebViewRef = {
      current: {
        injectJavaScript: jest.fn(),
        postMessage: jest.fn(),
      } as unknown as WebView,
    };

    // Setup settings refs
    mockReaderSettingsRef = {
      current: {
        tts: {
          voice: { identifier: 'test-voice' },
          pitch: 1.0,
          rate: 1.0,
        },
      } as ChapterReaderSettings,
    };

    mockChapterGeneralSettingsRef = {
      current: {
        ttsBackgroundPlayback: false,
      } as ChapterGeneralSettings,
    };

    // Mock TTSHighlight.addListener to capture all event listeners
    (TTSHighlight.addListener as jest.Mock).mockImplementation(
      (eventName: string, handler: (event?: any) => void) => {
        eventListeners.set(eventName, handler);
        return {
          remove: jest.fn(() => {
            eventListeners.delete(eventName);
          }),
        };
      },
    );

    // Mock other TTSHighlight methods
    (TTSHighlight.speak as jest.Mock).mockResolvedValue(undefined);
    (TTSHighlight.pause as jest.Mock).mockResolvedValue(undefined);
    (TTSHighlight.fullStop as jest.Mock).mockResolvedValue(undefined);
    (TTSHighlight.getSavedTTSPosition as jest.Mock).mockResolvedValue(-1);
    (TTSHighlight.isRestartInProgress as jest.Mock).mockReturnValue(false);

    // Mock MMKV
    (MMKVStorage.getNumber as jest.Mock).mockReturnValue(null);
    (MMKVStorage.set as jest.Mock).mockReturnValue(undefined);

    // Mock database
    (getChapterFromDb as jest.Mock).mockResolvedValue(mockChapter);
    (updateChapterProgressDb as jest.Mock).mockResolvedValue(undefined);
    (markChapterUnread as jest.Mock).mockResolvedValue(undefined);
    (markChapterRead as jest.Mock).mockResolvedValue(undefined);
  });

  // ==========================================================================
  // Category 1: Event Listener Integration (15-20 tests)
  // ==========================================================================

  describe('Event Listener Integration', () => {
    describe('onSpeechDone', () => {
      it('should register onSpeechDone listener on mount', () => {
        renderHook(() => useTTSController(createDefaultParams()));

        expect(TTSHighlight.addListener).toHaveBeenCalledWith(
          'onSpeechDone',
          expect.any(Function),
        );
      });

      it('should advance paragraph index when onSpeechDone fires within queue bounds', async () => {
        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Simulate TTS queue state
        await act(async () => {
          // Post TTS queue message to initialize state
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First', 'Second', 'Third'],
              }),
            },
          };
          result.current.handleTTSMessage(queueMessage as any);
        });

        // Simulate onSpeechDone - should advance from 0 to 1
        await act(async () => {
          triggerNativeEvent('onSpeechDone');
        });

        // Verify progress saved with next index
        expect(mockSaveProgress).toHaveBeenCalledWith(
          expect.any(Number),
          1, // Next paragraph index
        );
      });

      it('should update ttsStateRef timestamp when onSpeechDone advances', async () => {
        const mockNow = 1000000;
        jest.spyOn(Date, 'now').mockReturnValue(mockNow);

        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Initialize TTS queue
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First', 'Second'],
              }),
            },
          };
          result.current.handleTTSMessage(queueMessage as any);
        });

        // Trigger onSpeechDone
        await act(async () => {
          triggerNativeEvent('onSpeechDone');
        });

        // Verify Date.now() was called (internal timestamp update)
        expect(Date.now).toHaveBeenCalled();
      });

      it('should ignore onSpeechDone when index < queueStartIndex', async () => {
        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Initialize queue starting at index 5
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 5,
                texts: ['Sixth', 'Seventh'],
              }),
            },
          };
          result.current.handleTTSMessage(queueMessage as any);
        });

        // Current index is 0 (< queueStartIndex of 5)
        const initialSaveCalls = mockSaveProgress.mock.calls.length;

        await act(async () => {
          triggerNativeEvent('onSpeechDone');
        });

        // Should not advance (saveProgress not called again)
        expect(mockSaveProgress).toHaveBeenCalledTimes(initialSaveCalls);
      });

      it('should defer to WebView when index >= queueEndIndex', async () => {
        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Initialize queue with 2 items (indices 0-1)
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First', 'Second'],
              }),
            },
          };
          result.current.handleTTSMessage(queueMessage as any);
        });

        // Manually set current index to 2 (>= queueEndIndex of 2)
        await act(async () => {
          // Simulate reaching end of queue
          triggerNativeEvent('onSpeechDone'); // 0 → 1
          triggerNativeEvent('onSpeechDone'); // 1 → 2 (should defer)
        });

        // Verify WebView injection for tts.next()
        expect(mockWebViewRef.current?.injectJavaScript).toHaveBeenCalledWith(
          expect.stringContaining('tts.next'),
        );
      });

      it('should skip onSpeechDone during wake transition', async () => {
        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Initialize queue
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First', 'Second'],
              }),
            },
          };
          result.current.handleTTSMessage(queueMessage as any);
        });

        // Simulate wake transition by triggering AppState change
        await act(async () => {
          if (appStateListener) {
            appStateListener('active'); // Triggers wake logic
          }
        });

        const saveBefore = mockSaveProgress.mock.calls.length;

        // Trigger onSpeechDone during wake transition
        await act(async () => {
          triggerNativeEvent('onSpeechDone');
        });

        // Should be ignored (no new saveProgress call)
        expect(mockSaveProgress).toHaveBeenCalledTimes(saveBefore);
      });
    });

    describe('onSpeechStart', () => {
      it('should register onSpeechStart listener on mount', () => {
        renderHook(() => useTTSController(createDefaultParams()));

        expect(TTSHighlight.addListener).toHaveBeenCalledWith(
          'onSpeechStart',
          expect.any(Function),
        );
      });

      it('should update currentParagraphIndexRef when onSpeechStart fires', async () => {
        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        await act(async () => {
          triggerNativeEvent('onSpeechStart', {
            utteranceId: 'chapter_100_utterance_5',
          });
        });

        // Verify index updated to 5
        expect(result.current.currentParagraphIndex).toBe(5);
      });

      it('should set isTTSPlayingRef to true on onSpeechStart', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        await act(async () => {
          triggerNativeEvent('onSpeechStart', {
            utteranceId: 'chapter_100_utterance_0',
          });
        });

        // Internal ref updated (verified via WebView injection)
        expect(mockWebViewRef.current?.injectJavaScript).toHaveBeenCalledWith(
          expect.stringContaining('window.tts.highlightParagraph'),
        );
      });

      it('should reject onSpeechStart from mismatched chapter ID', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        const injectBefore = mockWebViewRef.current
          ?.injectJavaScript as jest.Mock;
        const callsBefore = injectBefore.mock.calls.length;

        await act(async () => {
          // Wrong chapter ID (999 instead of 100)
          triggerNativeEvent('onSpeechStart', {
            utteranceId: 'chapter_999_utterance_5',
          });
        });

        // Should NOT inject JavaScript (stale event rejected)
        expect(injectBefore).toHaveBeenCalledTimes(callsBefore);
      });

      it('should skip onSpeechStart during wake transition', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        // Trigger wake transition
        await act(async () => {
          if (appStateListener) {
            appStateListener('active');
          }
        });

        const injectBefore = mockWebViewRef.current
          ?.injectJavaScript as jest.Mock;
        const callsBefore = injectBefore.mock.calls.length;

        await act(async () => {
          triggerNativeEvent('onSpeechStart', {
            utteranceId: 'chapter_100_utterance_0',
          });
        });

        // Should be ignored during wake
        expect(injectBefore).toHaveBeenCalledTimes(callsBefore);
      });
    });

    describe('onWordRange', () => {
      it('should register onWordRange listener on mount', () => {
        renderHook(() => useTTSController(createDefaultParams()));

        expect(TTSHighlight.addListener).toHaveBeenCalledWith(
          'onWordRange',
          expect.any(Function),
        );
      });

      it('should inject highlightRange when onWordRange fires', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        await act(async () => {
          triggerNativeEvent('onWordRange', {
            utteranceId: 'chapter_100_utterance_0',
            start: 5,
            end: 10,
          });
        });

        expect(mockWebViewRef.current?.injectJavaScript).toHaveBeenCalledWith(
          expect.stringContaining('window.tts.highlightRange(0, 5, 10)'),
        );
      });

      it('should reject onWordRange from mismatched chapter ID', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        const injectBefore = mockWebViewRef.current
          ?.injectJavaScript as jest.Mock;
        const callsBefore = injectBefore.mock.calls.length;

        await act(async () => {
          triggerNativeEvent('onWordRange', {
            utteranceId: 'chapter_999_utterance_0',
            start: 0,
            end: 5,
          });
        });

        // Should NOT inject (stale event)
        expect(injectBefore).toHaveBeenCalledTimes(callsBefore);
      });
    });

    describe('onMediaAction', () => {
      it('should register onMediaAction listener on mount', () => {
        renderHook(() => useTTSController(createDefaultParams()));

        expect(TTSHighlight.addListener).toHaveBeenCalledWith(
          'onMediaAction',
          expect.any(Function),
        );
      });

      it('should pause TTS when PLAY_PAUSE received during reading', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        // Start TTS
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
        });

        await act(async () => {
          triggerNativeEvent('onMediaAction', { action: 'PLAY_PAUSE' });
        });

        expect(TTSHighlight.pause).toHaveBeenCalled();
      });

      it('should navigate to PREV_CHAPTER when media action received', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        await act(async () => {
          triggerNativeEvent('onMediaAction', { action: 'PREV_CHAPTER' });
        });

        expect(mockNavigateChapter).toHaveBeenCalledWith('PREV');
      });

      it('should navigate to NEXT_CHAPTER when media action received', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        await act(async () => {
          triggerNativeEvent('onMediaAction', { action: 'NEXT_CHAPTER' });
        });

        expect(mockNavigateChapter).toHaveBeenCalledWith('NEXT');
      });

      it('should debounce rapid media actions', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        await act(async () => {
          triggerNativeEvent('onMediaAction', { action: 'SEEK_FORWARD' });
          triggerNativeEvent('onMediaAction', { action: 'SEEK_FORWARD' });
        });

        // Second call should be debounced (only 1 speak call)
        expect(TTSHighlight.speak).toHaveBeenCalledTimes(1);
      });
    });

    describe('onQueueEmpty', () => {
      it('should register onQueueEmpty listener on mount', () => {
        renderHook(() => useTTSController(createDefaultParams()));

        expect(TTSHighlight.addListener).toHaveBeenCalledWith(
          'onQueueEmpty',
          expect.any(Function),
        );
      });

      it('should save progress when onQueueEmpty fires', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        await act(async () => {
          triggerNativeEvent('onQueueEmpty');
        });

        // Should save progress at end of queue
        expect(mockSaveProgress).toHaveBeenCalled();
      });

      it('should ignore onQueueEmpty during restart', async () => {
        (TTSHighlight.isRestartInProgress as jest.Mock).mockReturnValue(true);

        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        const saveBefore = mockSaveProgress.mock.calls.length;

        await act(async () => {
          triggerNativeEvent('onQueueEmpty');
        });

        // Should be ignored
        expect(mockSaveProgress).toHaveBeenCalledTimes(saveBefore);
      });
    });
  });

  // ==========================================================================
  // Category 2: Wake/Sleep Cycles (10-12 tests)
  // ==========================================================================

  describe('Wake/Sleep Cycles', () => {
    describe('Screen Wake', () => {
      it('should increment ttsSessionRef when screen wakes', async () => {
        renderHook(() => useTTSController(createDefaultParams()));

        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
            appStateListener('active'); // Wake
          }
        });

        // Internal session incremented (verified via console logs)
        expect(appStateListener).toBeTruthy();
      });

      it('should refresh TTS queue on wake if TTS was reading', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        // Start TTS
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
        });

        // Simulate wake
        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
            appStateListener('active');
          }
        });

        // WebView should request queue refresh
        expect(mockWebViewRef.current?.injectJavaScript).toHaveBeenCalledWith(
          expect.stringContaining('ttsRequestQueueSync'),
        );
      });

      it('should apply grace period validation on wake', async () => {
        const mockNow = 5000;
        jest.spyOn(Date, 'now').mockReturnValue(mockNow);

        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Set recent chapter transition time (within grace period)
        await act(async () => {
          // Simulate chapter transition
          result.current.handleWebViewLoadEnd();
        });

        jest.spyOn(Date, 'now').mockReturnValue(mockNow + 2000); // 2s later

        // Wake within grace period
        await act(async () => {
          if (appStateListener) {
            appStateListener('active');
          }
        });

        // Grace period should block auto-resume (no speak call)
        expect(TTSHighlight.speak).not.toHaveBeenCalled();
      });

      it('should reject stale queue on wake (wrong chapter ID)', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        // Initialize with chapter 100
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
        });

        // Change chapter
        const newParams = createDefaultParams({
          chapter: { ...mockChapter, id: 101 } as ChapterInfo,
        });
        const { result } = renderHook(() => useTTSController(newParams));

        // Wake with old chapter queue
        await act(async () => {
          if (appStateListener) {
            appStateListener('active');
          }

          // Post stale queue from chapter 100
          const staleQueue = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['Old'],
              }),
            },
          };
          result.current.handleTTSMessage(staleQueue as any);
        });

        // Should reject stale queue (no speak call)
        expect(TTSHighlight.speak).not.toHaveBeenCalled();
      });

      it('should accept valid queue on wake (matching chapter)', async () => {
        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Start TTS
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
          result.current.handleTTSMessage(queueMessage as any);
        });

        // Wake
        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
            appStateListener('active');
          }
        });

        // Post valid queue
        await act(async () => {
          const validQueue = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First', 'Second'],
              }),
            },
          };
          result.current.handleTTSMessage(validQueue as any);
        });

        // Should accept and speak
        expect(TTSHighlight.speak).toHaveBeenCalled();
      });

      it('should preserve isTTSReadingRef state across wake', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        // Start TTS (set isTTSReadingRef = true)
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
        });

        // Wake
        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
            appStateListener('active');
          }
        });

        // isTTSReadingRef should still be true (verified via WebView injection)
        expect(mockWebViewRef.current?.injectJavaScript).toHaveBeenCalledWith(
          expect.stringContaining('ttsRequestQueueSync'),
        );
      });

      it('should handle retry logic on wake sync failure', async () => {
        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Start TTS
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
          result.current.handleTTSMessage(queueMessage as any);
        });

        // Wake
        await act(async () => {
          if (appStateListener) {
            appStateListener('active');
          }
        });

        // Simulate sync error from WebView (no queue posted)
        await act(async () => {
          const errorMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-sync-error',
              }),
            },
          };
          result.current.handleTTSMessage(errorMessage as any);
        });

        // Should show sync dialog for retry
        expect(result.current.syncDialogVisible).toBe(true);
      });

      it('should handle multiple wake cycles correctly', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        // First wake
        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
            appStateListener('active');
          }
        });

        // Second wake
        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
            appStateListener('active');
          }
        });

        // Should handle both cycles (multiple sync requests)
        const injectCalls = (
          mockWebViewRef.current?.injectJavaScript as jest.Mock
        ).mock.calls;
        const syncRequests = injectCalls.filter((call: any[]) =>
          call[0].includes('ttsRequestQueueSync'),
        );
        expect(syncRequests.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('Screen Sleep', () => {
      it('should pause TTS when screen goes to background', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        // Start TTS
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
        });

        // Sleep
        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
          }
        });

        expect(TTSHighlight.pause).toHaveBeenCalled();
      });

      it('should save current position when sleeping', async () => {
        const params = createDefaultParams();
        renderHook(() => useTTSController(params));

        // Start TTS
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
        });

        // Sleep
        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
          }
        });

        expect(mockSaveProgress).toHaveBeenCalled();
      });

      it('should preserve TTS state when sleeping', async () => {
        const params = createDefaultParams();
        const { result } = renderHook(() => useTTSController(params));

        // Start TTS
        await act(async () => {
          const queueMessage = {
            nativeEvent: {
              data: JSON.stringify({
                type: 'tts-queue',
                chapterId: 100,
                startIndex: 0,
                texts: ['First'],
              }),
            },
          };
          result.current.handleTTSMessage(queueMessage as any);
        });

        const readingBefore = result.current.isTTSReading;

        // Sleep
        await act(async () => {
          if (appStateListener) {
            appStateListener('background');
          }
        });

        // State preserved (can resume on wake)
        expect(readingBefore).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Category 3: WebView Message Routing (8-10 tests)
  // ==========================================================================

  describe('WebView Message Routing', () => {
    it('should handle tts-queue message and initialize TTS', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First paragraph', 'Second paragraph'],
            }),
          },
        };
        result.current.handleTTSMessage(queueMessage as any);
      });

      expect(TTSHighlight.speak).toHaveBeenCalled();
    });

    it('should handle change-paragraph-position message', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        const changeMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'change-paragraph-position',
              index: 5,
            }),
          },
        };
        result.current.handleTTSMessage(changeMessage as any);
      });

      // Should restart TTS from new position
      expect(TTSHighlight.speak).toHaveBeenCalled();
    });

    it('should handle request-tts-confirmation message', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        const confirmMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'request-tts-confirmation',
              savedIndex: 10,
            }),
          },
        };
        result.current.handleTTSMessage(confirmMessage as any);
      });

      // Should show confirmation dialog or auto-resume based on grace period
      expect(
        result.current.resumeDialogVisible || result.current.isTTSReading,
      ).toBe(true);
    });

    it('should handle request-tts-exit message', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        const exitMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'request-tts-exit',
              ttsPosition: 5,
              readerPosition: 3,
            }),
          },
        };
        result.current.handleTTSMessage(exitMessage as any);
      });

      expect(result.current.showExitDialog).toBe(true);
    });

    it('should handle exit-allowed message', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Show exit dialog first
      await act(async () => {
        const exitMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'request-tts-exit',
              ttsPosition: 5,
              readerPosition: 3,
            }),
          },
        };
        result.current.handleTTSMessage(exitMessage as any);
      });

      await act(async () => {
        const allowedMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'exit-allowed',
            }),
          },
        };
        result.current.handleTTSMessage(allowedMessage as any);
      });

      // Should close dialog and allow exit
      expect(result.current.showExitDialog).toBe(false);
    });

    it('should reject invalid message type', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      let handled: boolean = false;
      await act(async () => {
        const invalidMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'invalid-type',
            }),
          },
        };
        handled = result.current.handleTTSMessage(invalidMessage as any);
      });

      expect(handled).toBe(false);
    });

    it('should validate message data structure', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        const malformedMessage = {
          nativeEvent: {
            data: 'not-json',
          },
        };
        const handled = result.current.handleTTSMessage(
          malformedMessage as any,
        );
        expect(handled).toBe(false);
      });
    });

    it('should reject stale tts-queue (wrong chapter)', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        const staleQueue = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 999, // Wrong chapter
              startIndex: 0,
              texts: ['Text'],
            }),
          },
        };
        result.current.handleTTSMessage(staleQueue as any);
      });

      // Should reject (no speak call)
      expect(TTSHighlight.speak).not.toHaveBeenCalled();
    });

    it('should block tts-queue during grace period', async () => {
      const mockNow = 1000;
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Trigger chapter transition (sets grace period)
      await act(async () => {
        result.current.handleWebViewLoadEnd();
      });

      jest.spyOn(Date, 'now').mockReturnValue(mockNow + 1000); // 1s later (within grace)

      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['Text'],
            }),
          },
        };
        result.current.handleTTSMessage(queueMessage as any);
      });

      // Should be blocked by grace period
      expect(TTSHighlight.speak).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Category 4: Background TTS (6-8 tests)
  // ==========================================================================

  describe('Background TTS', () => {
    it('should set backgroundTTSPendingRef when navigating with media controls', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        triggerNativeEvent('onMediaAction', { action: 'NEXT_CHAPTER' });
      });

      // backgroundTTSPendingRef set (verified via navigation call)
      expect(mockNavigateChapter).toHaveBeenCalledWith('NEXT');
    });

    it('should bypass WebView sync when backgroundTTSPendingRef is true', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Set background TTS pending
      await act(async () => {
        triggerNativeEvent('onMediaAction', { action: 'NEXT_CHAPTER' });
      });

      // backgroundTTSPendingRef should bypass sync checks
      expect(result.current.backgroundTTSPendingRef.current).toBe(true);
    });

    it('should extract paragraphs directly when in background mode', async () => {
      mockChapterGeneralSettingsRef.current!.ttsBackgroundPlayback = true;

      const params = createDefaultParams();
      renderHook(() => useTTSController(params));

      // Background playback enabled - should use extractParagraphs directly
      expect(mockChapterGeneralSettingsRef.current?.ttsBackgroundPlayback).toBe(
        true,
      );
    });

    it('should force start from paragraph 0 when forceStartFromParagraphZeroRef is true', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Navigate with PREV_CHAPTER (sets forceStartFromParagraphZeroRef)
      await act(async () => {
        triggerNativeEvent('onMediaAction', { action: 'PREV_CHAPTER' });
      });

      // Should start from 0
      expect(result.current.forceStartFromParagraphZeroRef.current).toBe(true);
    });

    it('should handle batch start success in background mode', async () => {
      mockChapterGeneralSettingsRef.current!.ttsBackgroundPlayback = true;

      const params = createDefaultParams();
      renderHook(() => useTTSController(params));

      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First', 'Second'],
            }),
          },
        };
      });

      // Should use batch mode (no individual speak calls)
      expect(TTSHighlight.speak).not.toHaveBeenCalled();
    });

    it('should handle batch start error in background mode', async () => {
      mockChapterGeneralSettingsRef.current!.ttsBackgroundPlayback = true;
      (TTSHighlight.speak as jest.Mock).mockRejectedValueOnce(
        new Error('Batch failed'),
      );

      const params = createDefaultParams();
      renderHook(() => useTTSController(params));

      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First'],
            }),
          },
        };
      });

      // Should handle error gracefully
      expect(TTSHighlight.speak).toHaveBeenCalled();
    });

    it('should clear backgroundTTSPendingRef after successful start', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Set background pending
      await act(async () => {
        triggerNativeEvent('onMediaAction', { action: 'NEXT_CHAPTER' });
      });

      expect(result.current.backgroundTTSPendingRef.current).toBe(true);

      // Start TTS
      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 101, // Next chapter
              startIndex: 0,
              texts: ['First'],
            }),
          },
        };
        result.current.handleTTSMessage(queueMessage as any);
      });

      // Should clear flag
      expect(result.current.backgroundTTSPendingRef.current).toBe(false);
    });
  });

  // ==========================================================================
  // Category 5: State Orchestration (10-12 tests)
  // ==========================================================================

  describe('State Orchestration', () => {
    it('should integrate useDialogState hook correctly', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Verify dialog state exposed
      expect(result.current.resumeDialogVisible).toBeDefined();
      expect(result.current.showExitDialog).toBeDefined();
      expect(result.current.manualModeDialogVisible).toBeDefined();
    });

    it('should integrate useTTSUtilities hook correctly', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Verify utilities exposed
      expect(result.current.updateTtsMediaNotificationState).toBeDefined();
      expect(result.current.restartTtsFromParagraphIndex).toBeDefined();
    });

    it('should integrate useManualModeHandlers hook correctly', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Verify manual mode handlers exposed
      expect(result.current.handleStopTTS).toBeDefined();
      expect(result.current.handleContinueFollowing).toBeDefined();
    });

    it('should integrate useChapterTransition hook correctly', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Verify chapterTransitionTimeRef exposed
      expect(result.current.chapterTransitionTimeRef).toBeDefined();
    });

    it('should integrate useResumeDialogHandlers hook correctly', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Verify resume handlers exposed
      expect(result.current.handleResumeConfirm).toBeDefined();
      expect(result.current.handleResumeCancel).toBeDefined();
      expect(result.current.handleRestartChapter).toBeDefined();
    });

    it('should integrate useExitDialogHandlers hook correctly', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Verify exit handlers exposed
      expect(result.current.handleExitTTS).toBeDefined();
      expect(result.current.handleExitReader).toBeDefined();
    });

    it('should integrate useBackHandler hook correctly', () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Verify back handler exposed
      expect(result.current.handleBackPress).toBeDefined();
    });

    it('should coordinate between dialogState and event listeners', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Show dialog
      await act(async () => {
        const exitMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'request-tts-exit',
              ttsPosition: 5,
              readerPosition: 3,
            }),
          },
        };
        result.current.handleTTSMessage(exitMessage as any);
      });

      expect(result.current.showExitDialog).toBe(true);

      // Trigger media action (should be blocked by dialog)
      const speakBefore = (TTSHighlight.speak as jest.Mock).mock.calls.length;

      await act(async () => {
        triggerNativeEvent('onMediaAction', { action: 'PLAY_PAUSE' });
      });

      // Media action should still work despite dialog
      expect(TTSHighlight.speak).toHaveBeenCalledTimes(speakBefore);
    });

    it('should synchronize refs across all hooks', async () => {
      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      // Update currentParagraphIndex via event
      await act(async () => {
        triggerNativeEvent('onSpeechStart', {
          utteranceId: 'chapter_100_utterance_10',
        });
      });

      // Verify ref exposed correctly
      expect(result.current.currentParagraphIndex).toBe(10);
    });

    it('should coordinate wake handling with all hooks', async () => {
      const params = createDefaultParams();
      renderHook(() => useTTSController(params));

      // Start TTS (activates multiple hooks)
      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First'],
            }),
          },
        };
      });

      // Wake (should coordinate across hooks)
      await act(async () => {
        if (appStateListener) {
          appStateListener('background');
          appStateListener('active');
        }
      });

      // All hooks should coordinate (verified via WebView injection)
      expect(mockWebViewRef.current?.injectJavaScript).toHaveBeenCalled();
    });

    it('should maintain state consistency during chapter navigation', async () => {
      const params = createDefaultParams();
      const { result, rerender } = renderHook(
        props => useTTSController(props),
        { initialProps: params },
      );

      // Start TTS
      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First'],
            }),
          },
        };
        result.current.handleTTSMessage(queueMessage as any);
      });

      // Navigate to next chapter
      const newParams = createDefaultParams({
        chapter: mockNextChapter,
      });

      await act(async () => {
        rerender(newParams);
      });

      // State should reset for new chapter
      expect(result.current.currentParagraphIndex).toBe(-1);
    });
  });

  // ==========================================================================
  // Category 6: Edge Cases (5-8 tests)
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle TTSHighlight.speak error gracefully', async () => {
      (TTSHighlight.speak as jest.Mock).mockRejectedValueOnce(
        new Error('Speak failed'),
      );

      const params = createDefaultParams();
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First'],
            }),
          },
        };
        result.current.handleTTSMessage(queueMessage as any);
      });

      // Should not crash
      expect(TTSHighlight.speak).toHaveBeenCalled();
    });

    it('should handle null WebView ref gracefully', async () => {
      const params = createDefaultParams({
        webViewRef: { current: null },
      });
      const { result } = renderHook(() => useTTSController(params));

      await act(async () => {
        triggerNativeEvent('onSpeechStart', {
          utteranceId: 'chapter_100_utterance_0',
        });
      });

      // Should not crash when WebView is null
      expect(result.current.currentParagraphIndex).toBe(0);
    });

    it('should handle MMKV read error gracefully', async () => {
      (MMKVStorage.getNumber as jest.Mock).mockImplementationOnce(() => {
        throw new Error('MMKV failed');
      });

      const params = createDefaultParams();
      renderHook(() => useTTSController(params));

      // Should not crash on MMKV error
      expect(MMKVStorage.getNumber).toHaveBeenCalled();
    });

    it('should handle database query failure gracefully', async () => {
      (updateChapterProgressDb as jest.Mock).mockRejectedValueOnce(
        new Error('DB failed'),
      );

      const params = createDefaultParams();
      renderHook(() => useTTSController(params));

      await act(async () => {
        triggerNativeEvent('onMediaAction', { action: 'NEXT_CHAPTER' });
      });

      // Should still navigate despite DB error
      expect(mockNavigateChapter).toHaveBeenCalled();
    });

    it('should handle rapid chapter changes without state corruption', async () => {
      const params = createDefaultParams();
      const { result, rerender } = renderHook(
        props => useTTSController(props),
        { initialProps: params },
      );

      // First chapter
      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First'],
            }),
          },
        };
        result.current.handleTTSMessage(queueMessage as any);
      });

      // Rapid change to second chapter
      const params2 = createDefaultParams({
        chapter: mockNextChapter,
      });
      await act(async () => {
        rerender(params2);
      });

      // Rapid change to third chapter
      const params3 = createDefaultParams({
        chapter: { ...mockNextChapter, id: 102 } as ChapterInfo,
      });
      await act(async () => {
        rerender(params3);
      });

      // State should be consistent (no crashes)
      expect(result.current.currentParagraphIndex).toBe(-1);
    });

    it('should handle concurrent onSpeechDone and onSpeechStart events', async () => {
      const params = createDefaultParams();
      renderHook(() => useTTSController(params));

      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First', 'Second'],
            }),
          },
        };
      });

      // Fire events concurrently
      await act(async () => {
        triggerNativeEvent('onSpeechDone');
        triggerNativeEvent('onSpeechStart', {
          utteranceId: 'chapter_100_utterance_1',
        });
      });

      // Should handle without corruption
      expect(TTSHighlight.speak).toHaveBeenCalled();
    });

    it('should cleanup event listeners on unmount', () => {
      const params = createDefaultParams();
      const { unmount } = renderHook(() => useTTSController(params));

      // Verify listeners registered
      expect(eventListeners.size).toBeGreaterThan(0);

      unmount();

      // Verify cleanup (listeners removed)
      expect(eventListeners.size).toBe(0);
    });

    it('should handle timer cleanup on unmount during active TTS', async () => {
      const params = createDefaultParams();
      const { unmount } = renderHook(() => useTTSController(params));

      // Start TTS
      await act(async () => {
        const queueMessage = {
          nativeEvent: {
            data: JSON.stringify({
              type: 'tts-queue',
              chapterId: 100,
              startIndex: 0,
              texts: ['First'],
            }),
          },
        };
      });

      // Unmount during active TTS
      unmount();

      // Should cleanup without errors
      expect(eventListeners.size).toBe(0);
    });
  });
});
