/**
 * useTTSController Hook
 *
 * This hook encapsulates all TTS (Text-to-Speech) logic from WebViewReader.
 * It manages TTS state, native event listeners, dialog handlers, and WebView message processing.
 *
 * @module reader/hooks/useTTSController
 */
/* eslint-disable no-console */

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  RefObject,
  useMemo,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import WebView from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';

import TTSHighlight from '@services/TTSHighlight';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { extractParagraphs } from '@utils/htmlParagraphExtractor';
import { useBoolean } from '@hooks';
import {
  getChapter as getChapterFromDb,
  markChaptersBeforePositionRead,
  resetFutureChaptersProgress,
  getRecentReadingChapters,
  updateChapterProgress as updateChapterProgressDb,
  markChapterUnread,
  markChapterRead,
} from '@database/queries/ChapterQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import {
  ChapterGeneralSettings,
  ChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import { validateAndClampParagraphIndex } from '../components/ttsHelpers';

import {
  WebViewPostEvent,
  TTSScrollPromptData,
  ConflictingChapter,
  SyncDialogInfo,
  TTSQueueState,
  ExitDialogData,
  TTSPersistenceState,
  MediaNavDirection,
  SyncDialogStatus,
  TTS_CONSTANTS,
  TTS_MEDIA_ACTIONS,
} from '../types/tts';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters required by useTTSController hook
 */
export interface UseTTSControllerParams {
  // === Context Data ===
  /** Current chapter being read */
  chapter: ChapterInfo;
  /** Novel information */
  novel: NovelInfo;
  /** Chapter HTML content */
  html: string;

  // === Refs ===
  /** WebView reference for JS injection */
  webViewRef: RefObject<WebView | null>;

  // === Context Functions ===
  /** Save reading progress */
  saveProgress: (
    progress: number,
    paragraphIndex?: number,
    ttsState?: string,
  ) => void;
  /** Navigate to next/prev chapter */
  navigateChapter: (direction: 'NEXT' | 'PREV') => void;
  /** Get a specific chapter */
  getChapter: (chapter: ChapterInfo) => void;

  // === Adjacent Chapters ===
  /** Next chapter info (null/undefined if none) */
  nextChapter: ChapterInfo | null | undefined;
  /** Previous chapter info (null/undefined if none) */
  prevChapter: ChapterInfo | null | undefined;

  // === Initial State ===
  /** Saved paragraph index from database */
  savedParagraphIndex?: number;
  /** Initial paragraph index (calculated once per chapter) */
  initialSavedParagraphIndex: number;

  // === Settings Refs (to avoid stale closures) ===
  /** Reader settings ref */
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  /** Chapter general settings ref */
  chapterGeneralSettingsRef: RefObject<ChapterGeneralSettings>;

  // === Toast ===
  /** Show toast message function */
  showToastMessage: (message: string) => void;
}

/**
 * Return value from useTTSController hook
 */
export interface UseTTSControllerReturn {
  // === Current State ===
  /** Whether TTS is currently reading */
  isTTSReading: boolean;
  /** Current paragraph being read */
  currentParagraphIndex: number;
  /** Total paragraphs in chapter */
  totalParagraphs: number;
  /** Whether TTS is paused */
  isTTSPaused: boolean;

  // === Dialog Visibility ===
  /** Resume dialog visible */
  resumeDialogVisible: boolean;
  /** Scroll sync dialog visible */
  scrollSyncDialogVisible: boolean;
  /** Manual mode dialog visible */
  manualModeDialogVisible: boolean;
  /** Exit dialog visible */
  showExitDialog: boolean;
  /** Chapter selection dialog visible */
  showChapterSelectionDialog: boolean;
  /** Sync dialog visible */
  syncDialogVisible: boolean;

  // === Dialog Data ===
  /** Exit dialog position data */
  exitDialogData: ExitDialogData;
  /** Conflicting chapters for selection */
  conflictingChapters: ConflictingChapter[];
  /** Sync dialog status */
  syncDialogStatus: SyncDialogStatus;
  /** Sync dialog info */
  syncDialogInfo?: SyncDialogInfo;
  /** TTS scroll prompt data */
  ttsScrollPromptData: TTSScrollPromptData | null;
  /** Pending resume index */
  pendingResumeIndex: number;
  /** Current chapter info for dialog */
  currentChapterForDialog: { id: number; name: string; paragraph: number };

  // === Dialog Handlers ===
  /** Handle resume confirmation */
  handleResumeConfirm: () => void;
  /** Handle resume cancel */
  handleResumeCancel: () => void;
  /** Handle restart chapter */
  handleRestartChapter: () => void;
  /** Handle TTS scroll sync confirm */
  handleTTSScrollSyncConfirm: () => void;
  /** Handle TTS scroll sync cancel */
  handleTTSScrollSyncCancel: () => void;
  /** Handle stop TTS */
  handleStopTTS: () => void;
  /** Handle continue following */
  handleContinueFollowing: () => void;
  /** Handle select chapter */
  handleSelectChapter: (targetChapterId: number) => Promise<void>;
  /** Handle request TTS confirmation */
  handleRequestTTSConfirmation: (savedIndex: number) => Promise<void>;

  // === Dialog Dismiss ===
  /** Hide resume dialog */
  hideResumeDialog: () => void;
  /** Hide scroll sync dialog */
  hideScrollSyncDialog: () => void;
  /** Hide manual mode dialog */
  hideManualModeDialog: () => void;
  /** Set exit dialog visibility */
  setShowExitDialog: (show: boolean) => void;
  /** Set chapter selection dialog visibility */
  setShowChapterSelectionDialog: (show: boolean) => void;
  /** Set sync dialog visibility */
  setSyncDialogVisible: (visible: boolean) => void;
  /** Set exit dialog data */
  setExitDialogData: (data: ExitDialogData) => void;

  // === Exit Dialog Handlers ===
  /** Handle exit TTS (save TTS position) */
  handleExitTTS: () => void;
  /** Handle exit reader (save reader position) */
  handleExitReader: () => void;

  // === Sync Dialog Handlers ===
  /** Handle sync retry */
  handleSyncRetry: () => void;

  // === WebView Integration ===
  /** Handle TTS-related WebView message. Returns true if handled. */
  handleTTSMessage: (event: WebViewPostEvent) => boolean;
  /** Handle back press. Returns true if handled. */
  handleBackPress: () => boolean;
  /** Handle WebView load end */
  handleWebViewLoadEnd: () => void;

  // === Refs for External Access ===
  /** Auto-start TTS ref */
  autoStartTTSRef: RefObject<boolean>;
  /** Force start from paragraph zero ref */
  forceStartFromParagraphZeroRef: RefObject<boolean>;
  /** Background TTS pending ref */
  backgroundTTSPendingRef: RefObject<boolean>;
  /** Latest paragraph index ref */
  latestParagraphIndexRef: RefObject<number>;
  /** Is WebView synced ref */
  isWebViewSyncedRef: RefObject<boolean>;
  /** TTS state ref */
  ttsStateRef: RefObject<TTSPersistenceState | null>;
  /** Progress ref */
  progressRef: RefObject<number>;
  /** Chapters auto played ref */
  chaptersAutoPlayedRef: RefObject<number>;

  // === Utility Functions ===
  /** Resume TTS from stored state */
  resumeTTS: (storedState: TTSPersistenceState) => void;
  /** Update last TTS chapter ID */
  updateLastTTSChapter: (id: number) => void;
  /** Restart TTS from a specific paragraph index */
  restartTtsFromParagraphIndex: (targetIndex: number) => Promise<void>;
  /** Update TTS media notification state */
  updateTtsMediaNotificationState: (nextIsPlaying: boolean) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook that manages all TTS (Text-to-Speech) functionality.
 *
 * This hook extracts TTS logic from WebViewReader to improve maintainability
 * and testability. It handles:
 * - TTS state management (reading, paused, current position)
 * - Native TTS event listeners (speech done, word range, media actions)
 * - Dialog state and handlers (resume, scroll sync, manual mode, exit)
 * - WebView message processing for TTS-related events
 * - Background TTS and chapter navigation
 * - Screen wake/sleep handling
 *
 * @param params - Hook parameters
 * @returns TTS controller state and handlers
 */
export function useTTSController(
  params: UseTTSControllerParams,
): UseTTSControllerReturn {
  const {
    chapter,
    novel,
    html,
    webViewRef,
    saveProgress,
    navigateChapter,
    getChapter,
    nextChapter,
    prevChapter,
    savedParagraphIndex,
    initialSavedParagraphIndex: _initialSavedParagraphIndex,
    readerSettingsRef,
    chapterGeneralSettingsRef,
    showToastMessage,
  } = params;

  const navigation = useNavigation();

  // ===========================================================================
  // TTS State Refs
  // ===========================================================================

  // Core TTS state
  const isTTSReadingRef = useRef<boolean>(false);
  const isTTSPlayingRef = useRef<boolean>(false);
  const isTTSPausedRef = useRef<boolean>(false);
  const currentParagraphIndexRef = useRef<number>(-1);
  const latestParagraphIndexRef = useRef<number>(savedParagraphIndex ?? -1);
  const totalParagraphsRef = useRef<number>(0);

  // Queue management
  const ttsQueueRef = useRef<TTSQueueState>(null);
  const ttsStateRef = useRef<TTSPersistenceState | null>(null);
  // Reserved for full wake handling - will be used in background TTS effect
  // @ts-expect-error Reserved for background TTS effect implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const ttsSessionRef = useRef<number>(0);

  // Auto-start flags
  const autoStartTTSRef = useRef<boolean>(false);
  const forceStartFromParagraphZeroRef = useRef<boolean>(false);
  const backgroundTTSPendingRef = useRef<boolean>(false);

  // Wake handling (reserved refs for full wake implementation in Step 7)
  const isWebViewSyncedRef = useRef<boolean>(true);
  const pendingScreenWakeSyncRef = useRef<boolean>(false);
  // @ts-expect-error Reserved for background TTS effect implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const autoResumeAfterWakeRef = useRef<boolean>(false);
  // @ts-expect-error Reserved for background TTS effect implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const wasReadingBeforeWakeRef = useRef<boolean>(false);
  const wakeChapterIdRef = useRef<number | null>(null);
  // @ts-expect-error Reserved for background TTS effect implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const wakeParagraphIndexRef = useRef<number | null>(null);
  const wakeTransitionInProgressRef = useRef<boolean>(false);
  // @ts-expect-error Reserved for background TTS effect implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const capturedWakeParagraphIndexRef = useRef<number | null>(null);
  const wakeResumeGracePeriodRef = useRef<number>(0);

  // Chapter tracking
  const lastTTSChapterIdRef = useRef<number | null>(
    MMKVStorage.getNumber('lastTTSChapterId') ?? null,
  );
  const chaptersAutoPlayedRef = useRef<number>(0);
  const mediaNavSourceChapterIdRef = useRef<number | null>(null);
  const mediaNavDirectionRef = useRef<MediaNavDirection>(null);
  const prevChapterIdRef = useRef<number>(chapter.id);

  // Sync/retry
  const syncRetryCountRef = useRef<number>(0);

  // Dialog data refs
  const pendingResumeIndexRef = useRef<number>(-1);
  const ttsScrollPromptDataRef = useRef<TTSScrollPromptData | null>(null);

  // Timing refs
  const lastTTSPauseTimeRef = useRef<number>(0);
  const lastMediaActionTimeRef = useRef<number>(0);
  const lastStaleLogTimeRef = useRef<number>(0);
  // @ts-expect-error Reserved for background TTS effect implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const chapterTransitionTimeRef = useRef<number>(0);

  // Context function refs (to avoid stale closures)
  const nextChapterRef = useRef(nextChapter);
  const navigateChapterRef = useRef(navigateChapter);
  const saveProgressRef = useRef(saveProgress);
  const progressRef = useRef<number>(chapter.progress ?? 0);

  // User interaction tracking
  const hasUserScrolledRef = useRef<boolean>(false);
  const nextChapterScreenVisibleRef = useRef<boolean>(false);

  // ===========================================================================
  // Dialog State
  // ===========================================================================

  // Resume dialog
  const {
    value: resumeDialogVisible,
    setTrue: showResumeDialog,
    setFalse: hideResumeDialog,
  } = useBoolean();

  // Scroll sync dialog
  const {
    value: scrollSyncDialogVisible,
    setTrue: showScrollSyncDialog,
    setFalse: hideScrollSyncDialog,
  } = useBoolean();

  // Manual mode dialog
  const {
    value: manualModeDialogVisible,
    setTrue: showManualModeDialog,
    setFalse: hideManualModeDialog,
  } = useBoolean();

  // Exit dialog
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitDialogData, setExitDialogData] = useState<ExitDialogData>({
    ttsParagraph: 0,
    readerParagraph: 0,
  });

  // Chapter selection dialog
  const [showChapterSelectionDialog, setShowChapterSelectionDialog] =
    useState(false);
  const [conflictingChapters, setConflictingChapters] = useState<
    ConflictingChapter[]
  >([]);

  // Sync dialog
  const [syncDialogVisible, setSyncDialogVisible] = useState(false);
  const [syncDialogStatus, setSyncDialogStatus] =
    useState<SyncDialogStatus>('syncing');
  const [syncDialogInfo, _setSyncDialogInfo] = useState<
    SyncDialogInfo | undefined
  >(undefined);

  // ===========================================================================
  // Keep Refs Synced
  // ===========================================================================

  useEffect(() => {
    progressRef.current = chapter.progress ?? 0;
  }, [chapter.progress]);

  useEffect(() => {
    saveProgressRef.current = saveProgress;
  }, [saveProgress]);

  useEffect(() => {
    nextChapterRef.current = nextChapter;
    navigateChapterRef.current = navigateChapter;
  }, [nextChapter, navigateChapter]);

  // ===========================================================================
  // Chapter Change Effect
  // ===========================================================================

  /**
   * Sync chapter ID ref and manage WebView state on chapter changes
   * This is critical for:
   * 1. Preventing stale event detection (native listeners check prevChapterIdRef)
   * 2. Managing WebView sync state during transitions
   * 3. Clearing media navigation tracking after successful transitions
   */
  useEffect(() => {
    console.log(
      `useTTSController: Chapter changed to ${chapter.id} (prev: ${prevChapterIdRef.current})`,
    );

    // Update chapter ID ref IMMEDIATELY
    prevChapterIdRef.current = chapter.id;

    // Mark WebView as unsynced initially (new WebView loading)
    isWebViewSyncedRef.current = false;

    // Short delay to allow WebView to stabilize, then mark as synced
    const syncTimer = setTimeout(() => {
      isWebViewSyncedRef.current = true;
      console.log(
        `useTTSController: WebView marked as synced for chapter ${chapter.id}`,
      );

      // Clear media navigation tracking after successful transition
      if (mediaNavSourceChapterIdRef.current) {
        console.log(
          `useTTSController: Clearing media nav tracking (source: ${mediaNavSourceChapterIdRef.current})`,
        );
        // Small delay before clearing to allow confirmation logic to run
        setTimeout(() => {
          mediaNavSourceChapterIdRef.current = null;
          mediaNavDirectionRef.current = null;
        }, 2000);
      }
    }, 300);

    return () => clearTimeout(syncTimer);
  }, [chapter.id]);

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  /**
   * Update last TTS chapter ID in MMKV storage
   */
  const updateLastTTSChapter = useCallback((id: number) => {
    lastTTSChapterIdRef.current = id;
    MMKVStorage.set('lastTTSChapterId', id);
  }, []);

  /**
   * Update TTS media notification state
   */
  const updateTtsMediaNotificationState = useCallback(
    (nextIsPlaying: boolean) => {
      try {
        const novelName = novel?.name ?? 'LNReader';
        const chapterLabel = chapter.name || `Chapter ${chapter.id}`;

        const paragraphIndex = Math.max(0, currentParagraphIndexRef.current);
        const totalParagraphs = Math.max(0, totalParagraphsRef.current);

        TTSHighlight.updateMediaState({
          novelName,
          chapterLabel,
          chapterId: chapter.id,
          paragraphIndex,
          totalParagraphs,
          isPlaying: nextIsPlaying,
        }).catch(() => {
          // Best-effort: notification updates should never break TTS
        });
      } catch {
        // ignore
      }
    },
    [chapter.id, chapter.name, novel?.name],
  );

  /**
   * Restart TTS from a specific paragraph index
   */
  const restartTtsFromParagraphIndex = useCallback(
    async (targetIndex: number) => {
      const paragraphs = extractParagraphs(html);
      if (!paragraphs || paragraphs.length === 0) return;

      const clamped = validateAndClampParagraphIndex(
        targetIndex,
        paragraphs.length,
        'media control seek',
      );

      // Prevent false onQueueEmpty during stop/restart cycles
      TTSHighlight.setRestartInProgress(true);

      // Pause/stop audio but keep foreground notification
      await TTSHighlight.pause();

      const remaining = paragraphs.slice(clamped);
      const ids = remaining.map(
        (_, i) => `chapter_${chapter.id}_utterance_${clamped + i}`,
      );

      ttsQueueRef.current = {
        startIndex: clamped,
        texts: remaining,
      };

      currentParagraphIndexRef.current = clamped;
      latestParagraphIndexRef.current = clamped;
      isTTSPausedRef.current = false;
      isTTSPlayingRef.current = true;
      hasUserScrolledRef.current = false;

      await TTSHighlight.speakBatch(remaining, ids, {
        voice: readerSettingsRef.current.tts?.voice?.identifier,
        pitch: readerSettingsRef.current.tts?.pitch || 1,
        rate: readerSettingsRef.current.tts?.rate || 1,
      });

      isTTSReadingRef.current = true;
      updateTtsMediaNotificationState(true);
    },
    [chapter.id, html, readerSettingsRef, updateTtsMediaNotificationState],
  );

  /**
   * Resume TTS from stored state
   */
  const resumeTTS = useCallback(
    (storedState: TTSPersistenceState) => {
      webViewRef.current?.injectJavaScript(`
        window.tts.restoreState({ 
          shouldResume: true,
          paragraphIndex: ${storedState.paragraphIndex},
          autoStart: true
        });
        true;
      `);
    },
    [webViewRef],
  );

  // ===========================================================================
  // Dialog Handlers
  // ===========================================================================

  /**
   * Handle resume confirmation
   */
  const handleResumeConfirm = useCallback(() => {
    const mmkvValue =
      MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
    const refValue = latestParagraphIndexRef.current ?? -1;
    const savedIndex = pendingResumeIndexRef.current;
    const lastReadParagraph = Math.max(refValue, mmkvValue, savedIndex);

    pendingResumeIndexRef.current = lastReadParagraph;
    latestParagraphIndexRef.current = lastReadParagraph;

    const ttsState = chapter.ttsState ? JSON.parse(chapter.ttsState) : {};
    if (__DEV__) {
      console.log(
        'useTTSController: Resuming TTS. Resolved index:',
        lastReadParagraph,
        '(Ref:',
        refValue,
        'MMKV:',
        mmkvValue,
        'Prop:',
        savedIndex,
        ')',
      );
    }
    resumeTTS({
      ...ttsState,
      paragraphIndex: lastReadParagraph,
      timestamp: Date.now(),
    });
  }, [chapter.id, chapter.ttsState, resumeTTS]);

  /**
   * Handle resume cancel (start from beginning)
   */
  const handleResumeCancel = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      window.tts.hasAutoResumed = true;
      window.tts.start();
    `);
  }, [webViewRef]);

  /**
   * Handle restart chapter from beginning
   */
  const handleRestartChapter = useCallback(() => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          const elements = window.reader.getReadableElements();
          if (elements && elements.length > 0) {
            window.tts.start(elements[0]);
          } else {
            window.tts.start();
          }
        })();
      `);
    }
    hideResumeDialog();
  }, [webViewRef, hideResumeDialog]);

  /**
   * Handle TTS scroll sync confirm
   */
  const handleTTSScrollSyncConfirm = useCallback(() => {
    if (ttsScrollPromptDataRef.current) {
      const { visibleIndex, isResume } = ttsScrollPromptDataRef.current;
      webViewRef.current?.injectJavaScript(`
        if (window.tts && window.tts.changeParagraphPosition) {
          window.tts.changeParagraphPosition(${visibleIndex});
          ${isResume ? 'window.tts.resume(true);' : ''}
        }
        true;
      `);
    }
    ttsScrollPromptDataRef.current = null;
  }, [webViewRef]);

  /**
   * Handle TTS scroll sync cancel
   */
  const handleTTSScrollSyncCancel = useCallback(() => {
    if (ttsScrollPromptDataRef.current) {
      const { isResume } = ttsScrollPromptDataRef.current;
      if (isResume) {
        webViewRef.current?.injectJavaScript(`
          if (window.tts && window.tts.resume) {
            window.tts.resume(true);
          }
          true;
        `);
      }
    }
    ttsScrollPromptDataRef.current = null;
  }, [webViewRef]);

  /**
   * Handle stop TTS
   */
  const handleStopTTS = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.handleManualModeDialog) {
        window.tts.handleManualModeDialog('stop');
      }
      true;
    `);
    isTTSReadingRef.current = false;
    isTTSPlayingRef.current = false;
    hasUserScrolledRef.current = false;
    TTSHighlight.stop();
    showToastMessage('Switched to manual reading mode');
    hideManualModeDialog();
  }, [webViewRef, showToastMessage, hideManualModeDialog]);

  /**
   * Handle continue following
   */
  const handleContinueFollowing = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.handleManualModeDialog) {
        window.tts.handleManualModeDialog('continue');
      }
      true;
    `);
    hideManualModeDialog();
  }, [webViewRef, hideManualModeDialog]);

  /**
   * Handle request TTS confirmation
   */
  const handleRequestTTSConfirmation = useCallback(
    async (savedIndex: number) => {
      const currentRef = latestParagraphIndexRef.current;
      const timeSinceLastPause =
        Date.now() - (lastTTSPauseTimeRef.current || 0);
      const inGracePeriod = timeSinceLastPause < 3000;

      if (
        !inGracePeriod &&
        currentRef !== undefined &&
        currentRef >= 0 &&
        Math.abs(currentRef - savedIndex) > 5
      ) {
        console.log(
          `useTTSController: Smart Resume - User manually scrolled to ${currentRef}. Ignoring saved index ${savedIndex}.`,
        );
        handleResumeCancel();
        return;
      }

      try {
        const conflicts = await getRecentReadingChapters(novel.id, 4);
        const relevantConflicts = conflicts.filter(c => c.id !== chapter.id);

        if (relevantConflicts.length > 0) {
          const conflictsData = relevantConflicts.map(c => ({
            id: c.id,
            name: c.name || `Chapter ${c.chapterNumber}`,
            paragraph: MMKVStorage.getNumber(`chapter_progress_${c.id}`) || 0,
          }));

          setConflictingChapters(conflictsData);
          pendingResumeIndexRef.current = savedIndex;
          setShowChapterSelectionDialog(true);
          return;
        }
      } catch {
        // Ignore errors, proceed to start TTS
      }

      updateLastTTSChapter(chapter.id);
      pendingResumeIndexRef.current = savedIndex;
      showResumeDialog();
    },
    [
      novel.id,
      chapter.id,
      handleResumeCancel,
      updateLastTTSChapter,
      showResumeDialog,
    ],
  );

  /**
   * Handle select chapter from conflict dialog
   */
  const handleSelectChapter = useCallback(
    async (targetChapterId: number) => {
      setShowChapterSelectionDialog(false);

      if (targetChapterId === chapter.id) {
        if (chapter.position !== undefined) {
          await markChaptersBeforePositionRead(novel.id, chapter.position);
        }
        const resetMode =
          chapterGeneralSettingsRef.current.ttsForwardChapterReset || 'none';
        if (resetMode !== 'none') {
          await resetFutureChaptersProgress(novel.id, chapter.id, resetMode);
          showToastMessage(`Future progress reset: ${resetMode}`);
        }

        updateLastTTSChapter(chapter.id);

        if (pendingResumeIndexRef.current >= 0) {
          showResumeDialog();
        }
      } else {
        const targetChapter = await getChapterFromDb(targetChapterId);
        if (targetChapter) {
          if (targetChapter.position !== undefined) {
            await markChaptersBeforePositionRead(
              novel.id,
              targetChapter.position,
            );
          }
          const resetMode =
            chapterGeneralSettingsRef.current.ttsForwardChapterReset || 'none';
          if (resetMode !== 'none') {
            await resetFutureChaptersProgress(
              novel.id,
              targetChapter.id,
              resetMode,
            );
          }

          updateLastTTSChapter(targetChapter.id);
          getChapter(targetChapter);
        }
      }
    },
    [
      novel.id,
      chapter.id,
      chapter.position,
      chapterGeneralSettingsRef,
      showToastMessage,
      updateLastTTSChapter,
      showResumeDialog,
      getChapter,
    ],
  );

  // ===========================================================================
  // Exit Dialog Handlers
  // ===========================================================================

  const handleExitTTS = useCallback(() => {
    setShowExitDialog(false);
    handleStopTTS();
    saveProgress(exitDialogData.ttsParagraph);
    navigation.goBack();
  }, [handleStopTTS, saveProgress, exitDialogData.ttsParagraph, navigation]);

  const handleExitReader = useCallback(() => {
    setShowExitDialog(false);
    handleStopTTS();
    saveProgress(exitDialogData.readerParagraph);
    navigation.goBack();
  }, [handleStopTTS, saveProgress, exitDialogData.readerParagraph, navigation]);

  // ===========================================================================
  // Sync Dialog Handlers
  // ===========================================================================

  const handleSyncRetry = useCallback(() => {
    syncRetryCountRef.current = 0;
    if (wakeChapterIdRef.current) {
      pendingScreenWakeSyncRef.current = true;
      setSyncDialogStatus('syncing');
      getChapterFromDb(wakeChapterIdRef.current)
        .then(savedChapter => {
          if (savedChapter) {
            getChapter(savedChapter);
          } else {
            setSyncDialogStatus('failed');
          }
        })
        .catch(() => {
          setSyncDialogStatus('failed');
        });
    } else {
      setSyncDialogVisible(false);
    }
  }, [getChapter]);

  // ===========================================================================
  // Back Handler
  // ===========================================================================

  /**
   * Handle back press - returns true if handled
   */
  const handleBackPress = useCallback((): boolean => {
    if (showExitDialog || showChapterSelectionDialog) {
      return false;
    }

    if (isTTSReadingRef.current) {
      const ttsPosition = currentParagraphIndexRef.current ?? 0;
      console.log(
        `useTTSController: Back pressed while TTS playing. Saving TTS position: ${ttsPosition}`,
      );

      handleStopTTS();
      saveProgress(ttsPosition);
      navigation.goBack();
      return true;
    }

    const lastTTSPosition = latestParagraphIndexRef.current ?? -1;

    if (lastTTSPosition > 0) {
      webViewRef.current?.injectJavaScript(`
        (function() {
          const visible = window.reader.getVisibleElementIndex ? window.reader.getVisibleElementIndex() : 0;
          const ttsIndex = ${lastTTSPosition};
          const GAP_THRESHOLD = 5;
          const nonce = window.__LNREADER_NONCE__;
          
          if (Math.abs(visible - ttsIndex) > GAP_THRESHOLD) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'request-tts-exit', 
               data: { visible, ttsIndex },
               nonce,
            }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'save',
               data: Math.round((ttsIndex / (reader.getReadableElements()?.length || 1)) * 100),
               paragraphIndex: ttsIndex,
               chapterId: ${chapter.id},
               nonce,
            }));
            window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'exit-allowed',
               nonce,
            }));
          }
        })();
        true;
      `);
      return true;
    }

    return false;
  }, [
    showExitDialog,
    showChapterSelectionDialog,
    handleStopTTS,
    saveProgress,
    navigation,
    webViewRef,
    chapter.id,
  ]);

  // ===========================================================================
  // WebView Message Handler
  // ===========================================================================

  /**
   * Handle TTS-related WebView messages
   * Returns true if the message was handled, false otherwise
   */
  const handleTTSMessage = useCallback(
    (event: WebViewPostEvent): boolean => {
      switch (event.type) {
        case 'speak':
          // Block speak requests during wake transition
          if (wakeTransitionInProgressRef.current) {
            console.log(
              'useTTSController: Ignoring speak request during wake transition',
            );
            return true;
          }

          if (event.data && typeof event.data === 'string') {
            if (!isTTSReadingRef.current) {
              isTTSReadingRef.current = true;
            }
            hasUserScrolledRef.current = false;

            const paragraphIdx =
              typeof event.paragraphIndex === 'number'
                ? event.paragraphIndex
                : currentParagraphIndexRef.current;

            if (paragraphIdx >= 0) {
              currentParagraphIndexRef.current = paragraphIdx;
            }

            // UNIFIED BATCH MODE: Always use speakBatch
            const textToSpeak = event.data as string;
            let paragraphs: string[] = [];
            try {
              paragraphs = extractParagraphs(html);
            } catch (e) {
              console.error(
                'useTTSController: Failed to extract paragraphs for batch start',
                e,
              );
            }

            if (
              paragraphs &&
              paragraphs.length > 0 &&
              paragraphIdx >= 0 &&
              paragraphIdx < paragraphs.length
            ) {
              console.log(
                `useTTSController: Starting Unified Batch from index ${paragraphIdx}`,
              );

              const remaining = paragraphs.slice(paragraphIdx);
              const ids = remaining.map(
                (_, i) => `chapter_${chapter.id}_utterance_${paragraphIdx + i}`,
              );

              ttsQueueRef.current = {
                startIndex: paragraphIdx,
                texts: remaining,
              };
              currentParagraphIndexRef.current = paragraphIdx;

              TTSHighlight.speakBatch(remaining, ids, {
                voice: readerSettingsRef.current.tts?.voice?.identifier,
                pitch: readerSettingsRef.current.tts?.pitch || 1,
                rate: readerSettingsRef.current.tts?.rate || 1,
              }).catch(err => {
                console.error(
                  'useTTSController: Failed to start Unified Batch',
                  err,
                );
                // Fallback to single speak
                const utteranceId =
                  paragraphIdx >= 0
                    ? `chapter_${chapter.id}_utterance_${paragraphIdx}`
                    : undefined;
                TTSHighlight.speak(textToSpeak, {
                  voice: readerSettingsRef.current.tts?.voice?.identifier,
                  pitch: readerSettingsRef.current.tts?.pitch || 1,
                  rate: readerSettingsRef.current.tts?.rate || 1,
                  utteranceId,
                });
              });
            } else {
              console.warn(
                'useTTSController: Cannot start batch (invalid params), falling back to single speak',
              );
              const utteranceId =
                paragraphIdx >= 0
                  ? `chapter_${chapter.id}_utterance_${paragraphIdx}`
                  : undefined;
              TTSHighlight.speak(textToSpeak, {
                voice: readerSettingsRef.current.tts?.voice?.identifier,
                pitch: readerSettingsRef.current.tts?.pitch || 1,
                rate: readerSettingsRef.current.tts?.rate || 1,
                utteranceId,
              });
            }
          } else {
            webViewRef.current?.injectJavaScript('tts.next?.()');
          }
          return true;

        case 'stop-speak':
          TTSHighlight.fullStop();
          isTTSReadingRef.current = false;
          return true;

        case 'tts-state':
          if (
            event.data &&
            !Array.isArray(event.data) &&
            typeof event.data === 'object'
          ) {
            // Cast through unknown to handle the flexible WebView data shape
            ttsStateRef.current = event.data as unknown as TTSPersistenceState;
            if (typeof (event.data as any).paragraphIndex === 'number') {
              currentParagraphIndexRef.current = (
                event.data as any
              ).paragraphIndex;
            }
          }
          return true;

        case 'request-tts-exit':
          if (
            event.data &&
            typeof event.data === 'object' &&
            !Array.isArray(event.data)
          ) {
            const { visible, ttsIndex } = event.data as any;
            setExitDialogData({
              ttsParagraph: Number(ttsIndex) || 0,
              readerParagraph: Number(visible) || 0,
            });
            setShowExitDialog(true);
          }
          return true;

        case 'exit-allowed':
          navigation.goBack();
          return true;

        case 'request-tts-confirmation':
          handleRequestTTSConfirmation(
            Number((event.data as any)?.savedIndex || 0),
          );
          return true;

        case 'tts-scroll-prompt':
          if (
            event.data &&
            !Array.isArray(event.data) &&
            (event.data as any).currentIndex !== undefined &&
            (event.data as any).visibleIndex !== undefined
          ) {
            ttsScrollPromptDataRef.current = {
              currentIndex: Number((event.data as any).currentIndex),
              visibleIndex: Number((event.data as any).visibleIndex),
            };
            showScrollSyncDialog();
          }
          return true;

        case 'tts-manual-mode-prompt':
          showManualModeDialog();
          return true;

        case 'tts-resume-location-prompt':
          if (
            event.data &&
            !Array.isArray(event.data) &&
            (event.data as any).currentIndex !== undefined &&
            (event.data as any).visibleIndex !== undefined
          ) {
            ttsScrollPromptDataRef.current = {
              currentIndex: Number((event.data as any).currentIndex),
              visibleIndex: Number((event.data as any).visibleIndex),
              isResume: true,
            };
            showScrollSyncDialog();
          }
          return true;

        case 'tts-queue':
          if (
            event.data &&
            Array.isArray(event.data) &&
            typeof event.startIndex === 'number'
          ) {
            const incomingStart = event.startIndex;
            const currentIdx = currentParagraphIndexRef.current;

            // Wake resume grace period check
            const timeSinceWakeResume =
              Date.now() - wakeResumeGracePeriodRef.current;
            if (
              timeSinceWakeResume < 500 &&
              wakeResumeGracePeriodRef.current > 0
            ) {
              console.log(
                `useTTSController: Ignoring tts-queue during wake grace period`,
              );
              return true;
            }

            // Ignore if we already have a batch covering this range
            if (
              isTTSReadingRef.current &&
              ttsQueueRef.current &&
              ttsQueueRef.current.startIndex <= incomingStart
            ) {
              console.log(`useTTSController: Ignoring redundant tts-queue`);
              return true;
            }

            // Validate against current position
            if (currentIdx >= 0 && incomingStart < currentIdx) {
              console.log(
                `useTTSController: Ignoring stale tts-queue (starts at ${incomingStart}, currently at ${currentIdx})`,
              );
              return true;
            }

            if (currentIdx >= 0 && incomingStart > currentIdx + 1) {
              console.warn(
                `useTTSController: tts-queue gap detected (starts at ${incomingStart}, currently at ${currentIdx})`,
              );
            }

            console.log(
              `useTTSController: Accepting tts-queue from ${incomingStart}`,
            );
            ttsQueueRef.current = {
              startIndex: event.startIndex,
              texts: event.data as string[],
            };

            // Use batch TTS for background playback
            if (
              chapterGeneralSettingsRef.current.ttsBackgroundPlayback &&
              event.data.length > 0
            ) {
              const startIndex = event.startIndex;
              const utteranceIds = (event.data as string[]).map(
                (_, i) => `chapter_${chapter.id}_utterance_${startIndex + i}`,
              );

              console.log(
                `useTTSController: Adding ${event.data.length} paragraphs to TTS queue from index ${startIndex}`,
              );

              const addToBatchWithRetry = async (
                texts: string[],
                ids: string[],
              ) => {
                const maxAttempts = 3;
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                  try {
                    await TTSHighlight.addToBatch(texts, ids);
                    console.log('useTTSController: addToBatch succeeded');
                    return true;
                  } catch (err) {
                    console.error(
                      `useTTSController: addToBatch failed (attempt ${attempt}):`,
                      err,
                    );
                    if (attempt < maxAttempts) {
                      await new Promise(r => setTimeout(r, 150 * attempt));
                    }
                  }
                }
                return false;
              };

              addToBatchWithRetry(event.data as string[], utteranceIds).then(
                success => {
                  if (!success) {
                    console.error(
                      'useTTSController: Add to batch failed after retries. Falling back to WebView-driven TTS',
                    );
                    webViewRef.current?.injectJavaScript('tts.next?.()');
                  }
                },
              );
            }
          }
          return true;

        default:
          return false;
      }
    },
    [
      chapter.id,
      html,
      webViewRef,
      readerSettingsRef,
      chapterGeneralSettingsRef,
      navigation,
      handleRequestTTSConfirmation,
      showScrollSyncDialog,
      showManualModeDialog,
    ],
  );

  // ===========================================================================
  // WebView Load End Handler
  // ===========================================================================

  /**
   * Handle WebView load end
   */
  const handleWebViewLoadEnd = useCallback(() => {
    // Mark WebView as synced with current chapter
    isWebViewSyncedRef.current = true;

    // Handle paused TTS state
    if (isTTSPausedRef.current && currentParagraphIndexRef.current >= 0) {
      const correctParagraphIndex = currentParagraphIndexRef.current;
      webViewRef.current?.injectJavaScript(`
        window.ttsLastStopTime = Date.now();
        if (window.tts) window.tts.reading = false;
        initialReaderConfig.savedParagraphIndex = ${correctParagraphIndex};
        reader.hasPerformedInitialScroll = false;
        reader.suppressSaveOnScroll = true;
        console.log('TTS: Correcting scroll to paused position: ${correctParagraphIndex}');
        if (typeof calculatePages === 'function') {
          calculatePages();
        }
      `);
    }

    // Handle background TTS pending from media navigation
    if (backgroundTTSPendingRef.current) {
      if (__DEV__) {
        console.log(
          'useTTSController: onLoadEnd detected background TTS pending',
        );
      }

      // Clear flag and start TTS if autoStart is also set
      backgroundTTSPendingRef.current = false;

      if (autoStartTTSRef.current) {
        if (__DEV__) {
          console.log(
            'useTTSController: Starting TTS from background navigation',
          );
        }
        // Will be handled by autoStartTTS logic below
      } else {
        if (__DEV__) {
          console.log('useTTSController: Background TTS cleared, no autoStart');
        }
        return;
      }
    }

    // Handle pending screen-wake sync
    if (pendingScreenWakeSyncRef.current) {
      // This will be fully implemented when we migrate the complex wake sync logic
      pendingScreenWakeSyncRef.current = false;
      // ... wake sync logic ...
    }

    // Handle auto-start TTS
    if (autoStartTTSRef.current) {
      autoStartTTSRef.current = false;
      const startFromZero = forceStartFromParagraphZeroRef.current;
      forceStartFromParagraphZeroRef.current = false;

      setTimeout(() => {
        if (startFromZero) {
          webViewRef.current?.injectJavaScript(`
            (function() {
              if (window.tts && reader.generalSettings.val.TTSEnable) {
                setTimeout(() => {
                  window.tts.restoreState({ 
                    shouldResume: true,
                    paragraphIndex: 0,
                    autoStart: true
                  });
                  const controller = document.getElementById('TTS-Controller');
                  if (controller && controller.firstElementChild) {
                    controller.firstElementChild.innerHTML = pauseIcon;
                  }
                }, 500);
              }
            })();
          `);
        } else {
          webViewRef.current?.injectJavaScript(`
            (function() {
              if (window.tts && reader.generalSettings.val.TTSEnable) {
                setTimeout(() => {
                  tts.start();
                  const controller = document.getElementById('TTS-Controller');
                  if (controller && controller.firstElementChild) {
                    controller.firstElementChild.innerHTML = pauseIcon;
                  }
                }, 500);
              }
            })();
          `);
        }
      }, 300);
    }
  }, [webViewRef]);

  // ===========================================================================
  // Total Paragraphs Effect
  // ===========================================================================

  useEffect(() => {
    if (html) {
      const paragraphs = extractParagraphs(html);
      totalParagraphsRef.current = paragraphs?.length || 0;
      updateTtsMediaNotificationState(isTTSReadingRef.current);
    }
  }, [html, updateTtsMediaNotificationState]);

  // ===========================================================================
  // Native TTS Event Listeners Effect
  // ===========================================================================

  useEffect(() => {
    // onSpeechDone - Handle paragraph completion
    const onSpeechDoneSubscription = TTSHighlight.addListener(
      'onSpeechDone',
      () => {
        if (wakeTransitionInProgressRef.current) {
          console.log(
            'useTTSController: onSpeechDone ignored during wake transition',
          );
          return;
        }

        // Skip if WebView is not synced (during chapter transition)
        if (!isWebViewSyncedRef.current) {
          console.log(
            'useTTSController: onSpeechDone skipped during WebView transition',
          );
          return;
        }

        if (ttsQueueRef.current && currentParagraphIndexRef.current >= 0) {
          const currentIdx = currentParagraphIndexRef.current;
          const queueStartIndex = ttsQueueRef.current.startIndex;
          const queueEndIndex =
            queueStartIndex + ttsQueueRef.current.texts.length;

          if (currentIdx < queueStartIndex) {
            console.log(
              `useTTSController: onSpeechDone - currentIdx ${currentIdx} < queueStart ${queueStartIndex}, ignoring event`,
            );
            return;
          }

          if (currentIdx >= queueEndIndex) {
            console.log(
              `useTTSController: onSpeechDone - currentIdx ${currentIdx} >= queueEnd ${queueEndIndex}, deferring to WebView`,
            );
            webViewRef.current?.injectJavaScript('tts.next?.()');
            return;
          }

          const nextIndex = currentIdx + 1;

          if (nextIndex >= queueStartIndex && nextIndex < queueEndIndex) {
            const text = ttsQueueRef.current.texts[nextIndex - queueStartIndex];
            console.log(
              'useTTSController: Playing from queue. Index:',
              nextIndex,
              `(queue: ${queueStartIndex}-${queueEndIndex - 1})`,
            );

            if (nextIndex <= currentParagraphIndexRef.current) {
              console.warn(
                `useTTSController: Index not advancing! next=${nextIndex}, current=${currentParagraphIndexRef.current}`,
              );
            }
            currentParagraphIndexRef.current = nextIndex;

            if (ttsStateRef.current) {
              ttsStateRef.current = {
                ...ttsStateRef.current,
                paragraphIndex: nextIndex,
                timestamp: Date.now(),
              };
            }

            const total = totalParagraphsRef.current;
            const percentage =
              total > 0
                ? Math.round(((nextIndex + 1) / total) * 100)
                : (progressRef.current ?? 0);
            saveProgressRef.current(percentage, nextIndex);

            // Check media navigation confirmation
            if (
              mediaNavSourceChapterIdRef.current &&
              nextIndex >= TTS_CONSTANTS.PARAGRAPHS_TO_CONFIRM_NAVIGATION
            ) {
              const sourceChapterId = mediaNavSourceChapterIdRef.current;
              const direction = mediaNavDirectionRef.current;
              if (direction === 'NEXT') {
                console.log(
                  `useTTSController: 5 paragraphs reached after NEXT, marking chapter ${sourceChapterId} as 100%`,
                );
                updateChapterProgressDb(sourceChapterId, 100);
              } else if (direction === 'PREV') {
                console.log(
                  `useTTSController: 5 paragraphs reached after PREV, marking chapter ${sourceChapterId} as in-progress`,
                );
                try {
                  updateChapterProgressDb(sourceChapterId, 1);
                } catch (e) {
                  console.warn(
                    'useTTSController: Failed to mark source chapter in-progress',
                    e,
                  );
                }
              } else {
                updateChapterProgressDb(sourceChapterId, 100);
              }
              mediaNavSourceChapterIdRef.current = null;
              mediaNavDirectionRef.current = null;
            }

            updateTtsMediaNotificationState(isTTSReadingRef.current);

            // In batch mode, don't call speak() - native queue handles it
            if (!chapterGeneralSettingsRef.current.ttsBackgroundPlayback) {
              const currentChapterId = prevChapterIdRef.current;
              const nextUtteranceId = `chapter_${currentChapterId}_utterance_${nextIndex}`;

              TTSHighlight.speak(text, {
                voice: readerSettingsRef.current.tts?.voice?.identifier,
                pitch: readerSettingsRef.current.tts?.pitch || 1,
                rate: readerSettingsRef.current.tts?.rate || 1,
                utteranceId: nextUtteranceId,
              });
            }

            if (webViewRef.current && isWebViewSyncedRef.current) {
              const currentChapterId = prevChapterIdRef.current;
              webViewRef.current.injectJavaScript(`
                try {
                  if (window.tts) {
                    console.log('TTS: Syncing state to index ${nextIndex}');
                    window.tts.highlightParagraph(${nextIndex}, ${currentChapterId});
                    window.tts.updateState(${nextIndex}, ${currentChapterId});
                  }
                } catch (e) {
                  console.error('TTS: Error syncing state:', e);
                }
                true;
              `);
            }
            return;
          }
        }

        webViewRef.current?.injectJavaScript('tts.next?.()');
      },
    );

    // onWordRange - Handle word-level highlighting
    const rangeSubscription = TTSHighlight.addListener('onWordRange', event => {
      try {
        if (wakeTransitionInProgressRef.current) {
          return;
        }

        const utteranceId = event?.utteranceId || '';
        let paragraphIndex = currentParagraphIndexRef.current ?? -1;

        if (typeof utteranceId === 'string') {
          const chapterMatch = utteranceId.match(
            /chapter_(\d+)_utterance_(\d+)/,
          );
          if (chapterMatch) {
            const eventChapterId = Number(chapterMatch[1]);
            const currentChapterId = Number(prevChapterIdRef.current);

            // Strict chapter validation
            if (eventChapterId !== currentChapterId) {
              const now = Date.now();
              if (now - lastStaleLogTimeRef.current > 500) {
                console.log(
                  `useTTSController: [STALE] onWordRange chapter ${eventChapterId} != ${currentChapterId}`,
                );
                lastStaleLogTimeRef.current = now;
              }
              return;
            }
            paragraphIndex = Number(chapterMatch[2]);
          } else {
            const m = utteranceId.match(/utterance_(\d+)/);
            if (m) paragraphIndex = Number(m[1]);
          }
        }

        // Skip if WebView is not synced (during chapter transition)
        if (!isWebViewSyncedRef.current) {
          return;
        }

        const start = Number(event?.start) || 0;
        const end = Number(event?.end) || 0;

        if (
          webViewRef.current &&
          paragraphIndex >= 0 &&
          isWebViewSyncedRef.current
        ) {
          webViewRef.current.injectJavaScript(`
            try {
              if (window.tts && window.tts.highlightRange) {
                window.tts.highlightRange(${paragraphIndex}, ${start}, ${end});
              }
            } catch (e) { console.error('TTS: highlightRange inject failed', e); }
            true;
          `);
        }
      } catch (e) {
        console.warn('useTTSController: onWordRange handler error', e);
      }
    });

    // onSpeechStart - Handle utterance start
    const startSubscription = TTSHighlight.addListener(
      'onSpeechStart',
      event => {
        try {
          if (wakeTransitionInProgressRef.current) {
            console.log(
              'useTTSController: Ignoring onSpeechStart during wake transition',
            );
            return;
          }

          const utteranceId = event?.utteranceId || '';
          let paragraphIndex = currentParagraphIndexRef.current ?? -1;

          if (typeof utteranceId === 'string') {
            const chapterMatch = utteranceId.match(
              /chapter_(\d+)_utterance_(\d+)/,
            );
            if (chapterMatch) {
              const eventChapterId = Number(chapterMatch[1]);
              const currentChapterId = Number(prevChapterIdRef.current);

              // Strict chapter validation
              if (eventChapterId !== currentChapterId) {
                const now = Date.now();
                if (now - lastStaleLogTimeRef.current > 500) {
                  console.log(
                    `useTTSController: [STALE] onSpeechStart chapter ${eventChapterId} != ${currentChapterId}`,
                  );
                  lastStaleLogTimeRef.current = now;
                }
                return;
              }
              paragraphIndex = Number(chapterMatch[2]);
            } else {
              const m = utteranceId.match(/utterance_(\d+)/);
              if (m) paragraphIndex = Number(m[1]);
            }
          }

          // Skip if WebView is not synced (during chapter transition)
          if (!isWebViewSyncedRef.current) {
            console.log(
              `useTTSController: Skipping onSpeechStart during WebView transition`,
            );
            return;
          }

          if (paragraphIndex >= 0) {
            currentParagraphIndexRef.current = paragraphIndex;
            isTTSPlayingRef.current = true;
            hasUserScrolledRef.current = false;
          }

          updateTtsMediaNotificationState(isTTSReadingRef.current);

          if (
            webViewRef.current &&
            paragraphIndex >= 0 &&
            isWebViewSyncedRef.current
          ) {
            const currentChapterId = prevChapterIdRef.current;
            webViewRef.current.injectJavaScript(`
              try {
                if (window.tts) {
                  window.tts.highlightParagraph(${paragraphIndex}, ${currentChapterId});
                  window.tts.updateState(${paragraphIndex}, ${currentChapterId});
                }
              } catch (e) { console.error('TTS: start inject failed', e); }
              true;
            `);
          }

          if (!isWebViewSyncedRef.current && paragraphIndex % 10 === 0) {
            console.log(
              `useTTSController: Background TTS progress - paragraph ${paragraphIndex}`,
            );
          }
        } catch (e) {
          console.warn('useTTSController: onSpeechStart handler error', e);
        }
      },
    );

    // onMediaAction - Handle media notification controls
    const mediaActionSubscription = TTSHighlight.addListener(
      'onMediaAction',
      async event => {
        const action = String(event?.action || '');
        console.log(`useTTSController: onMediaAction received -> ${action}`);

        const now = Date.now();
        if (
          now - lastMediaActionTimeRef.current <
          TTS_CONSTANTS.MEDIA_ACTION_DEBOUNCE_MS
        ) {
          console.log(`useTTSController: Media action debounced`);
          return;
        }
        lastMediaActionTimeRef.current = now;

        try {
          updateTtsMediaNotificationState(isTTSReadingRef.current);

          if (action === TTS_MEDIA_ACTIONS.PLAY_PAUSE) {
            if (isTTSReadingRef.current) {
              const idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
              const total = totalParagraphsRef.current;
              if (idx >= 0 && total > 0) {
                const percentage = Math.round(((idx + 1) / total) * 100);
                saveProgressRef.current(percentage, idx);
                console.log(
                  `useTTSController: Saved progress before pause (paragraph ${idx}/${total}, ${percentage}%)`,
                );
              }

              webViewRef.current?.injectJavaScript(`
                window.ttsLastStopTime = Date.now();
                if (window.tts) window.tts.reading = false;
              `);

              lastTTSPauseTimeRef.current = Date.now();
              latestParagraphIndexRef.current = idx;
              autoStartTTSRef.current = false;
              isTTSReadingRef.current = false;
              isTTSPlayingRef.current = false;
              isTTSPausedRef.current = true;
              await TTSHighlight.pause();
              updateTtsMediaNotificationState(false);
              return;
            }

            let idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
            try {
              const nativePos = await TTSHighlight.getSavedTTSPosition(
                chapter.id,
              );
              if (
                nativePos >= 0 &&
                lastTTSChapterIdRef.current === chapter.id
              ) {
                console.log(
                  `useTTSController: Resuming from native saved TTS position ${nativePos}`,
                );
                idx = nativePos;
              } else {
                idx = Math.max(idx, latestParagraphIndexRef.current ?? idx);
              }
            } catch (e) {
              console.warn(
                'useTTSController: Failed to read native TTS position',
                e,
              );
            }

            await restartTtsFromParagraphIndex(idx);
            return;
          }

          if (action === TTS_MEDIA_ACTIONS.SEEK_FORWARD) {
            const idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
            const total = Math.max(0, totalParagraphsRef.current);
            const last = total > 0 ? total - 1 : idx;
            const target = Math.min(last, idx + 5);
            await restartTtsFromParagraphIndex(target);
            return;
          }

          if (action === TTS_MEDIA_ACTIONS.SEEK_BACK) {
            const idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
            const target = Math.max(0, idx - 5);
            console.log(
              `useTTSController: SEEK_BACK (current=${idx}) -> restarting from ${target}`,
            );

            try {
              await restartTtsFromParagraphIndex(target);
            } catch (err) {
              console.error(
                'useTTSController: SEEK_BACK restart failed, attempting fallback',
                err,
              );
              try {
                TTSHighlight.fullStop();
                await new Promise(r => setTimeout(r, 120));
                await restartTtsFromParagraphIndex(target);
              } catch (err2) {
                console.error(
                  'useTTSController: SEEK_BACK fallback also failed',
                  err2,
                );
              }
            }
            return;
          }

          if (action === TTS_MEDIA_ACTIONS.PREV_CHAPTER) {
            if (!prevChapter) {
              showToastMessage('No previous chapter');
              return;
            }

            console.log(
              `useTTSController: PREV_CHAPTER - navigating to chapter ${prevChapter.id}`,
            );

            // Mark WebView as unsynced BEFORE navigation
            isWebViewSyncedRef.current = false;

            mediaNavSourceChapterIdRef.current = chapter.id;
            mediaNavDirectionRef.current = 'PREV';

            try {
              await updateChapterProgressDb(chapter.id, 1);
              try {
                await markChapterUnread(chapter.id);
              } catch (e) {
                // ignore
              }
            } catch (e) {
              console.warn(
                'useTTSController: Failed to mark source chapter in-progress',
                e,
              );
            }

            try {
              await updateChapterProgressDb(prevChapter.id, 0);
              try {
                await markChapterUnread(prevChapter.id);
              } catch (e) {
                // ignore
              }
              try {
                MMKVStorage.set(`chapter_progress_${prevChapter.id}`, 0);
              } catch (e) {
                // ignore
              }
            } catch (e) {
              console.warn(
                'useTTSController: Failed to reset prev chapter progress',
                e,
              );
            }

            isTTSReadingRef.current = true;
            isTTSPausedRef.current = false;
            autoStartTTSRef.current = true;
            forceStartFromParagraphZeroRef.current = true;
            backgroundTTSPendingRef.current = true;
            currentParagraphIndexRef.current = 0;
            latestParagraphIndexRef.current = 0;

            navigateChapter('PREV');
            updateTtsMediaNotificationState(true);
            return;
          }

          if (action === TTS_MEDIA_ACTIONS.NEXT_CHAPTER) {
            if (!nextChapter) {
              showToastMessage('No next chapter');
              return;
            }

            console.log(
              `useTTSController: NEXT_CHAPTER - navigating to chapter ${nextChapter.id}`,
            );

            // Mark WebView as unsynced BEFORE navigation
            isWebViewSyncedRef.current = false;

            mediaNavSourceChapterIdRef.current = chapter.id;
            mediaNavDirectionRef.current = 'NEXT';

            try {
              await updateChapterProgressDb(chapter.id, 100);
              try {
                await markChapterRead(chapter.id);
              } catch (e) {
                // ignore
              }
            } catch (e) {
              console.warn(
                'useTTSController: Failed to mark source chapter read',
                e,
              );
            }

            try {
              await updateChapterProgressDb(nextChapter.id, 0);
              try {
                await markChapterUnread(nextChapter.id);
              } catch (e) {
                // ignore
              }
              try {
                MMKVStorage.set(`chapter_progress_${nextChapter.id}`, 0);
              } catch (e) {
                // ignore
              }
            } catch (e) {
              console.warn(
                'useTTSController: Failed to reset next chapter progress',
                e,
              );
            }

            isTTSReadingRef.current = true;
            isTTSPausedRef.current = false;
            autoStartTTSRef.current = true;
            forceStartFromParagraphZeroRef.current = true;
            backgroundTTSPendingRef.current = true;
            currentParagraphIndexRef.current = 0;
            latestParagraphIndexRef.current = 0;
            navigateChapter('NEXT');
            updateTtsMediaNotificationState(true);
          }
        } catch (e) {
          // Best-effort
        }
      },
    );

    // onQueueEmpty - Handle end of TTS queue
    const queueEmptySubscription = TTSHighlight.addListener(
      'onQueueEmpty',
      () => {
        console.log('useTTSController: onQueueEmpty event received');

        if (TTSHighlight.isRestartInProgress()) {
          console.log(
            'useTTSController: Queue empty ignored - restart in progress',
          );
          return;
        }

        if (TTSHighlight.isRefillInProgress()) {
          console.log(
            'useTTSController: Queue empty ignored - refill in progress',
          );
          return;
        }

        if (TTSHighlight.hasRemainingItems()) {
          console.log(
            'useTTSController: Queue empty ignored - TTSAudioManager still has items',
          );
          return;
        }

        if (!isTTSReadingRef.current) {
          console.log(
            'useTTSController: Queue empty but TTS was not reading, ignoring',
          );
          return;
        }

        const continueMode =
          chapterGeneralSettingsRef.current.ttsContinueToNextChapter || 'none';
        console.log(
          'useTTSController: Queue empty - continueMode:',
          continueMode,
        );

        if (continueMode === 'none') {
          console.log(
            'useTTSController: ttsContinueToNextChapter is "none", stopping',
          );
          isTTSReadingRef.current = false;
          isTTSPlayingRef.current = false;
          return;
        }

        if (continueMode !== 'continuous') {
          const limit = parseInt(continueMode, 10);
          if (chaptersAutoPlayedRef.current >= limit) {
            console.log(
              `useTTSController: Chapter limit (${limit}) reached, stopping`,
            );
            chaptersAutoPlayedRef.current = 0;
            isTTSReadingRef.current = false;
            isTTSPlayingRef.current = false;
            return;
          }
        }

        if (nextChapterRef.current) {
          console.log(
            'useTTSController: Navigating to next chapter via onQueueEmpty',
          );

          saveProgressRef.current(100);

          autoStartTTSRef.current = true;
          backgroundTTSPendingRef.current = true;
          chaptersAutoPlayedRef.current += 1;
          nextChapterScreenVisibleRef.current = true;
          navigateChapterRef.current('NEXT');
        } else {
          console.log(
            'useTTSController: No next chapter available - novel reading complete',
          );
          isTTSReadingRef.current = false;
          isTTSPlayingRef.current = false;
          showToastMessage('Novel reading complete!');
        }
      },
    );

    // onVoiceFallback - Handle voice fallback notification
    const voiceFallbackSubscription = TTSHighlight.addListener(
      'onVoiceFallback',
      event => {
        console.log('useTTSController: Voice fallback occurred', event);
        const originalVoice = event?.originalVoice || 'selected voice';
        const fallbackVoice = event?.fallbackVoice || 'system default';
        showToastMessage(
          `Voice "${originalVoice}" unavailable, using "${fallbackVoice}"`,
        );
      },
    );

    // AppState - Handle background/foreground transitions
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (nextAppState === 'background') {
          if (ttsStateRef.current) {
            console.log(
              'useTTSController: Saving TTS state on background',
              ttsStateRef.current,
            );
            saveProgressRef.current(
              progressRef.current ?? 0,
              undefined,
              JSON.stringify({
                ...ttsStateRef.current,
                timestamp: Date.now(),
              }),
            );
          }

          if (!chapterGeneralSettingsRef.current.ttsBackgroundPlayback) {
            console.log(
              'useTTSController: Stopping TTS (Background Playback Disabled)',
            );
            TTSHighlight.stop();
            isTTSReadingRef.current = false;
          }
        } else if (nextAppState === 'active') {
          // Screen wake handling would go here
          // For brevity, this is a simplified version
          if (
            isTTSReadingRef.current &&
            currentParagraphIndexRef.current >= 0
          ) {
            console.log('useTTSController: Screen wake detected');
            // Full wake handling logic would be implemented here
          }
        }
      },
    );

    // Cleanup
    return () => {
      onSpeechDoneSubscription.remove();
      rangeSubscription.remove();
      startSubscription.remove();
      mediaActionSubscription.remove();
      queueEmptySubscription.remove();
      voiceFallbackSubscription.remove();
      appStateSubscription.remove();
      TTSHighlight.stop();
      if (ttsStateRef.current) {
        console.log(
          'useTTSController: Saving TTS state on unmount',
          ttsStateRef.current,
        );
        saveProgressRef.current(
          progressRef.current ?? 0,
          undefined,
          JSON.stringify({
            ...ttsStateRef.current,
            timestamp: Date.now(),
          }),
        );
      }
    };
  }, [
    chapter.id,
    html,
    showToastMessage,
    webViewRef,
    navigateChapter,
    nextChapter,
    prevChapter,
    restartTtsFromParagraphIndex,
    updateTtsMediaNotificationState,
    chapterGeneralSettingsRef,
    readerSettingsRef,
  ]);

  // ===========================================================================
  // Return Value
  // ===========================================================================

  const currentChapterForDialog = useMemo(
    () => ({
      id: chapter.id,
      name: chapter.name,
      paragraph: pendingResumeIndexRef.current,
    }),
    [chapter.id, chapter.name],
  );

  return {
    // Current State
    isTTSReading: isTTSReadingRef.current,
    currentParagraphIndex: currentParagraphIndexRef.current,
    totalParagraphs: totalParagraphsRef.current,
    isTTSPaused: isTTSPausedRef.current,

    // Dialog Visibility
    resumeDialogVisible,
    scrollSyncDialogVisible,
    manualModeDialogVisible,
    showExitDialog,
    showChapterSelectionDialog,
    syncDialogVisible,

    // Dialog Data
    exitDialogData,
    conflictingChapters,
    syncDialogStatus,
    syncDialogInfo,
    ttsScrollPromptData: ttsScrollPromptDataRef.current,
    pendingResumeIndex: pendingResumeIndexRef.current,
    currentChapterForDialog,

    // Dialog Handlers
    handleResumeConfirm,
    handleResumeCancel,
    handleRestartChapter,
    handleTTSScrollSyncConfirm,
    handleTTSScrollSyncCancel,
    handleStopTTS,
    handleContinueFollowing,
    handleSelectChapter,
    handleRequestTTSConfirmation,

    // Dialog Dismiss
    hideResumeDialog,
    hideScrollSyncDialog,
    hideManualModeDialog,
    setShowExitDialog,
    setShowChapterSelectionDialog,
    setSyncDialogVisible,
    setExitDialogData,

    // Exit Dialog Handlers
    handleExitTTS,
    handleExitReader,

    // Sync Dialog Handlers
    handleSyncRetry,

    // WebView Integration
    handleTTSMessage,
    handleBackPress,
    handleWebViewLoadEnd,

    // Refs for External Access
    autoStartTTSRef,
    forceStartFromParagraphZeroRef,
    backgroundTTSPendingRef,
    latestParagraphIndexRef,
    isWebViewSyncedRef,
    ttsStateRef,
    progressRef,
    chaptersAutoPlayedRef,

    // Utility Functions
    resumeTTS,
    updateLastTTSChapter,
    restartTtsFromParagraphIndex,
    updateTtsMediaNotificationState,
  };
}

export default useTTSController;
