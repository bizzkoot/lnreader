/**
 * useTTSController Hook
 *
 * This hook encapsulates all TTS (Text-to-Speech) logic from WebViewReader.
 * It manages TTS state, native event listeners, dialog handlers, and WebView message processing.
 *
 * @module reader/hooks/useTTSController
 */

import { useRef, useCallback, useEffect, RefObject, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import WebView from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@navigators/types';

import TTSHighlight from '@services/TTSHighlight';
import TTSAudioManager from '@services/TTSAudioManager';
import { TTSState } from '@services/TTSState';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { extractParagraphs } from '@utils/htmlParagraphExtractor';
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
import { validateAndClampParagraphIndex } from '../components/ttsHelpers';
import NativeFile from '@specs/NativeFile';
import { NOVEL_STORAGE } from '@utils/Storages';
import { getString } from '@strings/translations';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';
import { ignoreError } from '@utils/error';
import { autoStopService } from '@services/tts/AutoStopService';

// Phase 1 Extracted Hooks
import { useDialogState } from './useDialogState';
import { useRefSync } from './useRefSync';
import { useTTSUtilities } from './useTTSUtilities';
import { useExitDialogHandlers } from './useExitDialogHandlers';
import { useSyncDialogHandlers } from './useSyncDialogHandlers';
import { useScrollSyncHandlers } from './useScrollSyncHandlers';
import { useManualModeHandlers } from './useManualModeHandlers';

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
  isTTSPersistenceEventData,
  isTTSExitDialogData,
  isTTSConfirmationData,
  isTTSScrollPromptEventData,
} from '../types/tts';
import { useChapterTransition } from './useChapterTransition';
import { useResumeDialogHandlers } from './useResumeDialogHandlers';
import { useTTSConfirmationHandler } from './useTTSConfirmationHandler';
import { useChapterSelectionHandler } from './useChapterSelectionHandler';
import { useBackHandler } from './useBackHandler';

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

const ttsCtrlLog = createRateLimitedLogger('useTTSController', {
  windowMs: 1200,
});

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
  /**Progress ref */
  progressRef: RefObject<number>;
  /** Chapters auto played ref */
  chaptersAutoPlayedRef: RefObject<number>;
  /** Chapter transition time ref (for grace period validation) */
  chapterTransitionTimeRef: RefObject<number>;
  /** Previous chapter ID ref (for TTS chapterId parameter in WebView commands) */
  prevChapterIdRef: RefObject<number>;

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

  const novelId = novel.id;
  const novelName = novel.name;
  const novelPluginId = novel.pluginId;

  const chapterId = chapter.id;
  const chapterName = chapter.name;

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

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
  const ttsSessionRef = useRef<number>(0);

  // Auto-start flags
  const autoStartTTSRef = useRef<boolean>(false);
  const forceStartFromParagraphZeroRef = useRef<boolean>(false);
  const backgroundTTSPendingRef = useRef<boolean>(false);

  // Wake handling (reserved refs for full wake implementation in Step 7)
  const isWebViewSyncedRef = useRef<boolean>(true);
  const pendingScreenWakeSyncRef = useRef<boolean>(false);
  const autoResumeAfterWakeRef = useRef<boolean>(false);
  const wasReadingBeforeWakeRef = useRef<boolean>(false);
  const wakeChapterIdRef = useRef<number | null>(null);
  const wakeParagraphIndexRef = useRef<number | null>(null);
  const wakeTransitionInProgressRef = useRef<boolean>(false);
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
  // Track manual mode dialog visibility to avoid stale closure in AppState listener
  const manualModeDialogVisibleRef = useRef<boolean>(false);

  // Timing refs
  const lastTTSPauseTimeRef = useRef<number>(0);
  const lastMediaActionTimeRef = useRef<number>(0);
  const lastStaleLogTimeRef = useRef<number>(0);
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
  // Dialog State (Phase 1: Extracted)
  // ===========================================================================

  const dialogState = useDialogState();

  // Stable refs/values for hooks deps
  const dialogStateRef = useRef(dialogState);
  useEffect(() => {
    dialogStateRef.current = dialogState;
  }, [dialogState]);

  const showScrollSyncDialog = useCallback(() => {
    dialogStateRef.current.showScrollSyncDialog();
  }, []);

  const showManualModeDialog = useCallback(() => {
    dialogStateRef.current.showManualModeDialog();
  }, []);

  const hideResumeDialog = useCallback(() => {
    dialogStateRef.current.hideResumeDialog();
  }, []);

  const hideScrollSyncDialog = useCallback(() => {
    dialogStateRef.current.hideScrollSyncDialog();
  }, []);

  const hideManualModeDialog = useCallback(() => {
    dialogStateRef.current.hideManualModeDialog();
  }, []);

  // ===========================================================================
  // Keep Refs Synced (Phase 1: Extracted)
  // ===========================================================================

  useRefSync({
    progress: chapter.progress ?? 0,
    saveProgress,
    nextChapter,
    navigateChapter,
    refs: {
      progressRef,
      saveProgressRef,
      nextChapterRef,
      navigateChapterRef,
    },
  });

  // Keep manual mode dialog visibility ref synced for AppState listener
  // (avoids stale closure issue - Case 5.3 fix)
  useEffect(() => {
    manualModeDialogVisibleRef.current = dialogState.manualModeDialogVisible;
  }, [dialogState.manualModeDialogVisible]);

  // ===========================================================================
  // Utility Functions (Phase 1: Extracted)
  // ===========================================================================

  const utilities = useTTSUtilities({
    novel,
    chapter,
    html,
    webViewRef,
    readerSettingsRef,
    refs: {
      currentParagraphIndexRef,
      totalParagraphsRef,
      latestParagraphIndexRef,
      isTTSPausedRef,
      isTTSPlayingRef,
      hasUserScrolledRef,
      ttsQueueRef,
      isTTSReadingRef,
      lastTTSChapterIdRef,
    },
  });

  // Destructure for easier access
  const {
    updateTtsMediaNotificationState,
    updateLastTTSChapter,
    restartTtsFromParagraphIndex,
    resumeTTS,
  } = utilities;

  // ===========================================================================
  // Chapter Change Effect - Phase 2 Step 1: Extracted to useChapterTransition
  // ===========================================================================

  // Memoize refs object to prevent useEffect re-runs
  // (Creating a new object literal on every render causes dependency change)
  const chapterTransitionRefs = useMemo(
    () => ({
      prevChapterIdRef,
      chapterTransitionTimeRef,
      isWebViewSyncedRef,
      mediaNavSourceChapterIdRef,
      mediaNavDirectionRef,
    }),
    [], // Empty deps - refs are stable, this object should never change
  );

  useChapterTransition({
    chapterId,
    refs: chapterTransitionRefs,
  });

  // ===========================================================================
  // Background TTS Chapter Navigation Effect
  // ===========================================================================

  /**
   * Handle background TTS chapter navigation
   *
   * When navigating to a new chapter via media controls (PREV/NEXT) while screen is off,
   * the WebView may not be loaded yet. This effect detects the pending flag and starts
   * TTS directly from React Native using speakBatch.
   *
   * This replicates the original WebViewReader effect (lines 500-620) that handled
   * background chapter navigation after media control actions.
   */
  useEffect(() => {
    // Only proceed if background TTS is pending AND we have HTML
    if (!backgroundTTSPendingRef.current || !html) {
      return;
    }

    ttsCtrlLog.info('background-pending', `chapter=${chapterId}`);

    // Clear the flag immediately
    backgroundTTSPendingRef.current = false;

    // CRITICAL FIX: When background TTS starts (app in background during chapter nav),
    // WebView won't actually load/render until app returns to foreground.
    // Mark as synced immediately so TTS events aren't blocked forever.
    // The Chapter Change Effect's timer won't fire because WebView onLoadEnd never triggers.
    isWebViewSyncedRef.current = true;
    ttsCtrlLog.debug('webview-synced-background');

    // Extract paragraphs from HTML
    const paragraphs = extractParagraphs(html);
    ttsCtrlLog.debug('background-paragraphs', `count=${paragraphs.length}`);

    if (paragraphs.length === 0) {
      ttsCtrlLog.warn('no-paragraphs', 'No paragraphs extracted from HTML');
      isTTSReadingRef.current = false;
      return;
    }

    // Check if we should force start from paragraph 0 (notification prev/next chapter)
    const forceStartFromZero = forceStartFromParagraphZeroRef.current;
    if (forceStartFromZero) {
      forceStartFromParagraphZeroRef.current = false;
      ttsCtrlLog.info(
        'notification-nav-force-start',
        'Forcing start from paragraph 0 due to notification chapter navigation',
      );
    }

    // Start from paragraph 0 if forced, otherwise use any previously known index
    // (for example when background advance already progressed the native TTS inside
    // the new chapter). Otherwise start at 0.
    const rawIndex = forceStartFromZero
      ? 0
      : Math.max(0, currentParagraphIndexRef.current ?? 0);

    // Validate and clamp paragraph index to valid range
    const startIndex = validateAndClampParagraphIndex(
      rawIndex,
      paragraphs.length,
      'background TTS start',
    );

    // Only queue the paragraphs that remain to be spoken starting at startIndex
    const textsToSpeak = paragraphs.slice(startIndex);

    // Create utterance IDs with chapter ID to prevent stale event processing
    const utteranceIds = textsToSpeak.map(
      (_, i) => `chapter_${chapterId}_utterance_${startIndex + i}`,
    );

    // Update TTS queue ref so event handlers know where the batch starts
    ttsQueueRef.current = {
      startIndex: startIndex,
      texts: textsToSpeak,
    };

    // Start from the resolved startIndex (may be > 0)
    currentParagraphIndexRef.current = startIndex;
    latestParagraphIndexRef.current = startIndex;

    // Start batch TTS (this will flush old queue and start new one)
    if (textsToSpeak.length > 0) {
      TTSHighlight.speakBatch(textsToSpeak, utteranceIds, {
        voice: readerSettingsRef.current.tts?.voice?.identifier,
        pitch: readerSettingsRef.current.tts?.pitch || 1,
        rate: readerSettingsRef.current.tts?.rate || 1,
      })
        .then(() => {
          ttsCtrlLog.info(
            'batch-start-success',
            'Background TTS batch started successfully from index',
            startIndex,
          );
          // CRITICAL: Ensure isTTSReadingRef is true so onQueueEmpty can trigger next chapter
          isTTSReadingRef.current = true;
          isTTSPlayingRef.current = true;
          hasUserScrolledRef.current = false;
          updateTtsMediaNotificationState(true);
        })
        .catch(err => {
          ttsCtrlLog.error(
            'batch-start-failed',
            'Background TTS batch failed',
            err,
          );
          isTTSReadingRef.current = false;
          isTTSPlayingRef.current = false;
          showToastMessage('TTS failed to start. Please try again.');
        });
    } else {
      ttsCtrlLog.warn('no-paragraphs', 'No paragraphs to speak');
      isTTSReadingRef.current = false;
    }
  }, [
    chapterId,
    html,
    readerSettingsRef,
    showToastMessage,
    updateTtsMediaNotificationState,
  ]);

  // ===========================================================================
  // Pending Resume Check Effect
  // ===========================================================================

  useEffect(() => {
    const pendingResumeId = MMKVStorage.getNumber('pendingTTSResumeChapterId');
    if (pendingResumeId === chapterId) {
      ttsCtrlLog.debug(
        'pending-resume-flag',
        'Found pending resume flag for chapter',
        chapterId,
      );
      MMKVStorage.delete('pendingTTSResumeChapterId');

      // Force show resume dialog if saved progress exists
      const savedIndex =
        MMKVStorage.getNumber(`chapter_progress_${chapterId}`) ?? -1;

      if (savedIndex >= 0) {
        pendingResumeIndexRef.current = savedIndex;
        // Small timeout to ensure listeners/components are ready
        setTimeout(() => {
          dialogStateRef.current.showResumeDialog();
        }, 100);
      }
    }
  }, [chapterId]);

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  // ===========================================================================
  // Dialog Handlers - Phase 2 Step 2: Extracted to useResumeDialogHandlers
  // ===========================================================================

  const resumeDialogHandlers = useResumeDialogHandlers({
    chapterId,
    chapterTtsState: chapter.ttsState,
    webViewRef,
    refs: {
      pendingResumeIndexRef,
      latestParagraphIndexRef,
    },
    callbacks: {
      resumeTTS,
      hideResumeDialog,
    },
  });

  // ===========================================================================
  // Scroll Sync Handlers (Phase 1: Extracted)
  // ===========================================================================

  const scrollSyncHandlers = useScrollSyncHandlers({
    webViewRef,
    refs: { ttsScrollPromptDataRef },
    callbacks: {
      hideScrollSyncDialog,
      restartTtsFromParagraphIndex, // FIX: Pass restart callback for non-stitched sync
    },
  });

  const { handleTTSScrollSyncConfirm, handleTTSScrollSyncCancel } =
    scrollSyncHandlers;

  // ===========================================================================
  // Manual Mode Handlers (Phase 1: Extracted)
  // ===========================================================================

  const manualModeHandlers = useManualModeHandlers({
    webViewRef,
    showToastMessage,
    refs: { isTTSReadingRef, isTTSPlayingRef, hasUserScrolledRef },
    callbacks: { hideManualModeDialog },
  });

  const { handleStopTTS, handleContinueFollowing } = manualModeHandlers;

  // ===========================================================================
  // TTS Confirmation Handler (Phase 2: Step 3)
  // ===========================================================================

  const ttsConfirmationHandler = useTTSConfirmationHandler({
    novelId,
    chapterId,
    latestParagraphIndexRef,
    lastTTSPauseTimeRef,
    pendingResumeIndexRef,
    dialogState: {
      setConflictingChapters: dialogStateRef.current.setConflictingChapters,
      setShowChapterSelectionDialog:
        dialogStateRef.current.setShowChapterSelectionDialog,
      showResumeDialog: dialogStateRef.current.showResumeDialog,
    },
    handleResumeCancel: resumeDialogHandlers.handleResumeCancel,
    updateLastTTSChapter,
  });

  const { handleRequestTTSConfirmation } = ttsConfirmationHandler;

  // ===========================================================================
  // Chapter Selection Handler (Phase 2: Step 4)
  // ===========================================================================

  const chapterSelectionHandler = useChapterSelectionHandler({
    novel,
    chapter,
    chapterGeneralSettingsRef,
    pendingResumeIndexRef,
    dialogState: {
      setShowChapterSelectionDialog:
        dialogStateRef.current.setShowChapterSelectionDialog,
      showResumeDialog: dialogStateRef.current.showResumeDialog,
    },
    showToastMessage,
    updateLastTTSChapter,
    getChapter,
  });

  const { handleSelectChapter } = chapterSelectionHandler;

  // ===========================================================================
  // Exit Dialog Handlers (Phase 1: Extracted)
  // ===========================================================================

  const exitDialogHandlers = useExitDialogHandlers({
    exitDialogData: dialogState.exitDialogData,
    saveProgress,
    navigation,
    callbacks: {
      handleStopTTS,
      setShowExitDialog: dialogState.setShowExitDialog,
    },
  });

  const { handleExitTTS, handleExitReader } = exitDialogHandlers;

  // ===========================================================================
  // Sync Dialog Handlers (Phase 1: Extracted)
  // ===========================================================================

  const syncDialogHandlers = useSyncDialogHandlers({
    getChapter,
    refs: { syncRetryCountRef, wakeChapterIdRef, pendingScreenWakeSyncRef },
    callbacks: {
      setSyncDialogStatus: dialogState.setSyncDialogStatus,
      setSyncDialogVisible: dialogState.setSyncDialogVisible,
    },
  });

  const { handleSyncRetry } = syncDialogHandlers;

  // ===========================================================================
  // Back Handler (Phase 2: Step 5)
  // ===========================================================================

  const backHandler = useBackHandler({
    chapterId,
    webViewRef,
    saveProgress,
    navigation,
    showExitDialog: dialogState.showExitDialog,
    showChapterSelectionDialog: dialogState.showChapterSelectionDialog,
    refs: {
      isTTSReadingRef,
      currentParagraphIndexRef,
      latestParagraphIndexRef,
    },
    callbacks: {
      handleStopTTS,
    },
  });

  const { handleBackPress } = backHandler;

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
            ttsCtrlLog.debug(
              'speak-wake-transition',
              'Ignoring speak request during wake transition',
            );
            return true;
          }

          // CRITICAL: Clear any stitched chapters before TTS starts
          // Multi-chapter DOM causes paragraph index misalignment
          webViewRef.current?.injectJavaScript(
            'if (window.reader && window.reader.clearStitchedChapters) { window.reader.clearStitchedChapters(); } true;',
          );

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
              ttsCtrlLog.error('extract-paragraphs-failed', e);
            }

            if (
              paragraphs &&
              paragraphs.length > 0 &&
              paragraphIdx >= 0 &&
              paragraphIdx < paragraphs.length
            ) {
              ttsCtrlLog.info(
                'start-batch',
                `index=${paragraphIdx} chapter=${chapterId}`,
              );

              // Initialize auto-stop service when manually starting TTS
              const autoStopMode =
                chapterGeneralSettingsRef.current.ttsAutoStopMode ?? 'off';
              const autoStopAmount =
                chapterGeneralSettingsRef.current.ttsAutoStopAmount ?? 0;

              autoStopService.start(
                { mode: autoStopMode, amount: autoStopAmount },
                reason => {
                  TTSHighlight.stop();

                  // Show toast notification
                  const messages = {
                    minutes: `Auto-stop: ${autoStopAmount} minute${autoStopAmount !== 1 ? 's' : ''} elapsed`,
                    paragraphs: `Auto-stop: ${autoStopAmount} paragraph${autoStopAmount !== 1 ? 's' : ''} read`,
                    chapters: `Auto-stop: ${autoStopAmount} chapter${autoStopAmount !== 1 ? 's' : ''} complete`,
                  };
                  showToastMessage(messages[reason]);
                },
              );

              const remaining = paragraphs.slice(paragraphIdx);
              const ids = remaining.map(
                (_, i) => `chapter_${chapterId}_utterance_${paragraphIdx + i}`,
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
                ttsCtrlLog.error('start-batch-failed', err);
                // Fallback to single speak
                const utteranceId =
                  paragraphIdx >= 0
                    ? `chapter_${chapterId}_utterance_${paragraphIdx}`
                    : undefined;
                TTSHighlight.speak(textToSpeak, {
                  voice: readerSettingsRef.current.tts?.voice?.identifier,
                  pitch: readerSettingsRef.current.tts?.pitch || 1,
                  rate: readerSettingsRef.current.tts?.rate || 1,
                  utteranceId,
                });
              });
            } else {
              ttsCtrlLog.warn(
                'start-batch-invalid-params',
                `index=${paragraphIdx} total=${paragraphs?.length ?? 0} chapter=${chapterId}`,
              );
              const utteranceId =
                paragraphIdx >= 0
                  ? `chapter_${chapterId}_utterance_${paragraphIdx}`
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
          if (isTTSPersistenceEventData(event.data)) {
            ttsStateRef.current = event.data;
            if (typeof event.data.paragraphIndex === 'number') {
              currentParagraphIndexRef.current = event.data.paragraphIndex;
            }
          }
          return true;

        case 'request-tts-exit':
          if (isTTSExitDialogData(event.data)) {
            const { visible, ttsIndex } = event.data;
            dialogStateRef.current.setExitDialogData({
              ttsParagraph: Number(ttsIndex) || 0,
              readerParagraph: Number(visible) || 0,
              totalParagraphs: totalParagraphsRef.current,
            });
            dialogStateRef.current.setShowExitDialog(true);
          }
          return true;

        case 'exit-allowed':
          navigation.goBack();
          return true;

        case 'request-tts-confirmation':
          if (isTTSConfirmationData(event.data)) {
            handleRequestTTSConfirmation(Number(event.data.savedIndex || 0));
          }
          return true;

        case 'tts-scroll-prompt':
          if (isTTSScrollPromptEventData(event.data)) {
            const { currentIndex, visibleIndex } = event.data;
            ttsScrollPromptDataRef.current = {
              currentIndex: Number(currentIndex),
              visibleIndex: Number(visibleIndex),
            };
            showScrollSyncDialog();
          }
          return true;

        case 'tts-manual-mode-prompt':
          // Show dialog to ask user if they want to stop TTS or continue following
          // Note: TTS continues playing while dialog is shown - user can read ahead
          showManualModeDialog();
          return true;

        case 'tts-resume-location-prompt':
          if (isTTSScrollPromptEventData(event.data)) {
            const {
              currentIndex,
              visibleIndex,
              currentChapterName,
              visibleChapterName,
              isStitched,
            } = event.data;
            ttsScrollPromptDataRef.current = {
              currentIndex: Number(currentIndex),
              visibleIndex: Number(visibleIndex),
              currentChapterName,
              visibleChapterName,
              isStitched,
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
              timeSinceWakeResume < TTS_CONSTANTS.WAKE_RESUME_DEBOUNCE_MS &&
              wakeResumeGracePeriodRef.current > 0
            ) {
              if (__DEV__) {
                ttsCtrlLog.debug('tts-queue-ignore-wake-grace');
              }
              return true;
            }

            // Ignore if we already have a batch covering this range
            if (
              isTTSReadingRef.current &&
              ttsQueueRef.current &&
              ttsQueueRef.current.startIndex <= incomingStart
            ) {
              if (__DEV__) {
                ttsCtrlLog.debug('tts-queue-ignore-redundant');
              }
              return true;
            }

            // Validate against current position
            if (currentIdx >= 0 && incomingStart < currentIdx) {
              if (__DEV__) {
                ttsCtrlLog.debug(
                  'tts-queue-ignore-stale',
                  `start=${incomingStart} current=${currentIdx}`,
                );
              }
              return true;
            }

            if (currentIdx >= 0 && incomingStart > currentIdx + 1) {
              ttsCtrlLog.warn(
                'queue-gap',
                `Queue gap detected (starts at ${incomingStart}, currently at ${currentIdx})`,
              );
            }

            ttsCtrlLog.info('tts-queue-accept', `start=${incomingStart}`);
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
                (_, i) => `chapter_${chapterId}_utterance_${startIndex + i}`,
              );

              ttsCtrlLog.debug(
                'add-to-batch',
                `Adding ${event.data.length} paragraphs to TTS queue from index ${startIndex}`,
              );

              const addToBatchWithRetry = async (
                texts: string[],
                ids: string[],
              ) => {
                const maxAttempts = 3;
                for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                  try {
                    await TTSHighlight.addToBatch(texts, ids);
                    ttsCtrlLog.debug(
                      'add-to-batch-success',
                      'addToBatch succeeded',
                    );
                    return true;
                  } catch (err) {
                    ttsCtrlLog.error(
                      'add-to-batch-failed',
                      `addToBatch failed (attempt ${attempt})`,
                      err,
                    );
                    if (attempt < maxAttempts) {
                      await new Promise(r => setTimeout(r, 150 * attempt));
                    }
                  }
                }
                return false;
              };

              addToBatchWithRetry(event.data as string[], utteranceIds)
                .then(success => {
                  if (!success) {
                    ttsCtrlLog.error(
                      'add-to-batch-retries-exhausted',
                      'Add to batch failed after retries. Falling back to WebView-driven TTS',
                    );
                    webViewRef.current?.injectJavaScript('tts.next?.()');
                  }
                })
                .catch(err => {
                  ttsCtrlLog.error(
                    'add-to-batch-unexpected-error',
                    'Unexpected error adding to batch. Falling back to WebView-driven TTS',
                    err,
                  );
                  webViewRef.current?.injectJavaScript('tts.next?.()');
                });
            }
          }
          return true;

        default:
          return false;
      }
    },
    [
      chapterId,
      html,
      webViewRef,
      readerSettingsRef,
      chapterGeneralSettingsRef,
      navigation,
      handleRequestTTSConfirmation,
      showScrollSyncDialog,
      showManualModeDialog,
      showToastMessage,
    ],
  );

  // ===========================================================================
  // WebView Load End Handler
  // ===========================================================================

  /**
   * Handle WebView load end
   */
  const handleWebViewLoadEnd = useCallback(() => {
    // ===========================================================================
    // PENDING SCREEN WAKE SYNC WITH CHAPTER VERIFICATION
    // ===========================================================================
    // After screen wake, if we detected a chapter mismatch, this block
    // attempts to navigate to the correct chapter automatically.

    if (pendingScreenWakeSyncRef.current) {
      pendingScreenWakeSyncRef.current = false;

      const savedWakeChapterId = wakeChapterIdRef.current;
      const savedWakeParagraphIdx = wakeParagraphIndexRef.current;
      const currentChapterId = chapterId;

      ttsCtrlLog.debug(
        'wake-sync-process',
        'Processing pending screen-wake sync',
        `Saved: Chapter ${savedWakeChapterId}, Paragraph ${savedWakeParagraphIdx}`,
        `Current: Chapter ${currentChapterId}`,
      );

      // ENFORCE CHAPTER MATCH: If the loaded chapter doesn't match where TTS was,
      // attempt to navigate to the correct chapter automatically.
      if (
        savedWakeChapterId !== null &&
        savedWakeChapterId !== currentChapterId
      ) {
        ttsCtrlLog.warn(
          'wake-chapter-mismatch',
          `Chapter mismatch! TTS was at chapter ${savedWakeChapterId} but WebView loaded chapter ${currentChapterId}. Attempting to navigate to correct chapter...`,
        );

        // Check retry count to prevent infinite loops
        const MAX_SYNC_RETRIES = 2;
        if (syncRetryCountRef.current >= MAX_SYNC_RETRIES) {
          ttsCtrlLog.error(
            'sync-retries-exhausted',
            'Max sync retries reached, showing failure dialog',
          );

          // Calculate progress info for the error dialog
          const retryParagraphs = extractParagraphs(html);
          const retryTotalParagraphs = retryParagraphs?.length ?? 0;
          const paragraphIdx = savedWakeParagraphIdx ?? 0;
          const progressPercent =
            retryTotalParagraphs > 0
              ? (paragraphIdx / retryTotalParagraphs) * 100
              : 0;

          // Try to get chapter name from DB
          getChapterFromDb(savedWakeChapterId)
            .then(savedChapter => {
              dialogStateRef.current.setSyncDialogInfo({
                chapterName:
                  savedChapter?.name ?? `Chapter ID: ${savedWakeChapterId}`,
                paragraphIndex: paragraphIdx,
                totalParagraphs: retryTotalParagraphs,
                progress: progressPercent,
              });
              dialogStateRef.current.setSyncDialogStatus('failed');
              dialogStateRef.current.setSyncDialogVisible(true);
            })
            .catch(() => {
              dialogStateRef.current.setSyncDialogInfo({
                chapterName: `Chapter ID: ${savedWakeChapterId}`,
                paragraphIndex: paragraphIdx,
                totalParagraphs: retryTotalParagraphs,
                progress: progressPercent,
              });
              dialogStateRef.current.setSyncDialogStatus('failed');
              dialogStateRef.current.setSyncDialogVisible(true);
            });

          // Clear wake refs since we're not resuming
          wakeChapterIdRef.current = null;
          wakeParagraphIndexRef.current = null;
          autoResumeAfterWakeRef.current = false;
          wasReadingBeforeWakeRef.current = false;
          syncRetryCountRef.current = 0;
          return;
        }

        // Show syncing dialog
        dialogStateRef.current.setSyncDialogStatus('syncing');
        dialogStateRef.current.setSyncDialogVisible(true);
        syncRetryCountRef.current += 1;

        // Fetch the saved chapter info and navigate to it
        getChapterFromDb(savedWakeChapterId)
          .then(savedChapter => {
            if (savedChapter) {
              ttsCtrlLog.info(
                'navigate-to-saved-chapter',
                `Navigating to saved chapter: ${savedChapter?.name || savedWakeChapterId}`,
              );
              // Keep wake refs intact so we can resume after navigation
              // Set flag so we continue the sync process on next load
              pendingScreenWakeSyncRef.current = true;
              // Navigate to the correct chapter
              getChapter(savedChapter);
            } else {
              ttsCtrlLog.error(
                'saved-chapter-not-found',
                `Could not find chapter ${savedWakeChapterId} in database`,
              );
              dialogStateRef.current.setSyncDialogStatus('failed');
              dialogStateRef.current.setSyncDialogInfo({
                chapterName: `Unknown Chapter (ID: ${savedWakeChapterId})`,
                paragraphIndex: savedWakeParagraphIdx ?? 0,
                totalParagraphs: 0,
                progress: 0,
              });
              // Clear refs
              wakeChapterIdRef.current = null;
              wakeParagraphIndexRef.current = null;
            }
          })
          .catch(() => {
            ttsCtrlLog.error('db-query-failed', 'Database query failed');
            dialogStateRef.current.setSyncDialogStatus('failed');
            dialogStateRef.current.setSyncDialogVisible(true);
          });

        return;
      }

      // ===========================================================================
      // CHAPTER MATCH - PROCEED WITH WAKE RESUME
      // ===========================================================================
      ttsCtrlLog.debug(
        'wake-chapter-match',
        'Chapter match verified, proceeding with wake resume',
      );

      // Hide sync dialog if it was showing
      if (dialogStateRef.current.syncDialogVisible) {
        dialogStateRef.current.setSyncDialogStatus('success');
        setTimeout(() => {
          dialogStateRef.current.setSyncDialogVisible(false);
        }, TTS_CONSTANTS.WAKE_RESUBE_ADDITIONAL_DEBOUNCE_MS);
      }

      // Reset retry counter on success
      syncRetryCountRef.current = 0;

      // Schedule resume of TTS playback
      setTimeout(() => {
        if (
          autoResumeAfterWakeRef.current &&
          savedWakeParagraphIdx !== null &&
          savedWakeParagraphIdx >= 0
        ) {
          ttsCtrlLog.debug(
            'wake-resume-tts',
            'Resuming TTS after wake sync from paragraph',
            savedWakeParagraphIdx,
          );

          const paragraphs = extractParagraphs(html);
          if (paragraphs && paragraphs.length > savedWakeParagraphIdx) {
            const remaining = paragraphs.slice(savedWakeParagraphIdx);
            const ids = remaining.map(
              (_, i) =>
                `chapter_${chapterId}_utterance_${savedWakeParagraphIdx + i}`,
            );

            ttsQueueRef.current = {
              startIndex: savedWakeParagraphIdx,
              texts: remaining,
            };

            currentParagraphIndexRef.current = savedWakeParagraphIdx;
            latestParagraphIndexRef.current = savedWakeParagraphIdx;

            TTSHighlight.speakBatch(remaining, ids, {
              voice: readerSettingsRef.current.tts?.voice?.identifier,
              pitch: readerSettingsRef.current.tts?.pitch || 1,
              rate: readerSettingsRef.current.tts?.rate || 1,
            })
              .then(() => {
                ttsCtrlLog.info(
                  'wake-resume-success',
                  'TTS resumed after wake sync',
                );
                isTTSReadingRef.current = true;
                isTTSPlayingRef.current = true;
                updateTtsMediaNotificationState(true);
              })
              .catch(err => {
                ttsCtrlLog.error(
                  'wake-resume-failed',
                  'Failed to resume TTS after wake sync',
                  err,
                );
              });
          }

          // Clear wake refs
          wakeChapterIdRef.current = null;
          wakeParagraphIndexRef.current = null;
          autoResumeAfterWakeRef.current = false;
          wasReadingBeforeWakeRef.current = false;
        }
      }, TTS_CONSTANTS.WAKE_TRANSITION_RETRY_MS);

      // Early return - don't process rest of onLoadEnd logic
      return;
    }

    // ===========================================================================
    // NORMAL onLoadEnd LOGIC
    // ===========================================================================

    // Mark WebView as synced with current chapter
    isWebViewSyncedRef.current = true;

    // CRITICAL FIX: If we're in the middle of a wake resume, re-inject the blocking flags
    // IMMEDIATELY to prevent the WebView from treating the upcoming scroll as user input.
    // This must happen BEFORE any other WebView JS processing.
    if (autoResumeAfterWakeRef.current && wasReadingBeforeWakeRef.current) {
      ttsCtrlLog.debug(
        'wake-resume-inject-flags',
        'onLoadEnd detected pending wake resume, injecting blocking flags',
      );

      webViewRef.current?.injectJavaScript(`
        try {
          window.ttsScreenWakeSyncPending = true;
          window.ttsOperationActive = true;
          reader.suppressSaveOnScroll = true;
          window.ttsIsBackgroundPlaybackActive = true;
          // CRITICAL: Mark as already resumed to prevent Smart Resume prompt
          if (window.tts) {
            window.tts.hasAutoResumed = true;
            window.tts.isBackgroundPlaybackActive = true;
            window.tts.reading = true;
            window.tts.started = true;
          }
          console.log('TTS: onLoadEnd - Re-injected wake sync blocking flags + hasAutoResumed');
        } catch (e) {
          console.error('TTS: onLoadEnd - Failed to inject wake sync flags', e);
        }
        true;
      `);
    }

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
      ttsCtrlLog.debug(
        'background-tts-pending',
        'onLoadEnd detected background TTS pending',
      );

      // Clear flag and start TTS if autoStart is also set
      backgroundTTSPendingRef.current = false;

      if (autoStartTTSRef.current) {
        ttsCtrlLog.debug(
          'background-tts-start',
          'Starting TTS from background navigation',
        );
        // Will be handled by autoStartTTS logic below
      } else {
        ttsCtrlLog.debug(
          'background-tts-cleared',
          'Background TTS cleared, no autoStart',
        );
        return;
      }
    }

    // Handle auto-start TTS
    if (autoStartTTSRef.current) {
      autoStartTTSRef.current = false;
      const startFromZero = forceStartFromParagraphZeroRef.current;
      forceStartFromParagraphZeroRef.current = false;

      const autoStopMode =
        chapterGeneralSettingsRef.current.ttsAutoStopMode ?? 'off';
      const autoStopAmount =
        chapterGeneralSettingsRef.current.ttsAutoStopAmount ?? 0;

      autoStopService.start(
        { mode: autoStopMode, amount: autoStopAmount },
        reason => {
          TTSHighlight.stop();

          // Show toast notification
          const messages = {
            minutes: `Auto-stop: ${autoStopAmount} minute${autoStopAmount !== 1 ? 's' : ''} elapsed`,
            paragraphs: `Auto-stop: ${autoStopAmount} paragraph${autoStopAmount !== 1 ? 's' : ''} read`,
            chapters: `Auto-stop: ${autoStopAmount} chapter${autoStopAmount !== 1 ? 's' : ''} complete`,
          };
          showToastMessage(messages[reason]);
        },
      );

      if (startFromZero) {
        autoStopService.resetCounters();
      }

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
      }, TTS_CONSTANTS.CHAPTER_TRANSITION_DELAY_MS);
    }
  }, [
    chapterId,
    html,
    getChapter,
    webViewRef,
    readerSettingsRef,
    chapterGeneralSettingsRef,
    updateTtsMediaNotificationState,
    showToastMessage,
  ]);

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
    // These are captured at mount time for cleanup/unmount only
    const saveProgressOnUnmount = saveProgressRef.current;
    const getProgressOnUnmount = () => progressRef.current ?? 0;

    // Set up drift enforcement callback to auto-restart TTS from correct position
    // when cache drift exceeds threshold
    TTSHighlight.setOnDriftEnforceCallback((correctIndex: number) => {
      ttsCtrlLog.info(
        'drift-enforce-callback',
        `Restarting TTS from correct index ${correctIndex} due to cache drift`,
      );

      // Use the same restart logic as media controls
      restartTtsFromParagraphIndex(correctIndex).catch(err => {
        ttsCtrlLog.error(
          'drift-enforce-failed',
          'Failed to restart TTS after drift enforcement',
          err,
        );
      });
    });

    // onSpeechDone - Handle paragraph completion
    const onSpeechDoneSubscription = TTSHighlight.addListener(
      'onSpeechDone',
      () => {
        if (wakeTransitionInProgressRef.current) {
          ttsCtrlLog.debug(
            'speech-done-wake-transition',
            'onSpeechDone ignored during wake transition',
          );
          return;
        }

        // Skip if WebView is not synced (during chapter transition)
        if (!isWebViewSyncedRef.current) {
          ttsCtrlLog.debug(
            'speech-done-webview-transition',
            'onSpeechDone skipped during WebView transition',
          );
          return;
        }

        if (ttsQueueRef.current && currentParagraphIndexRef.current >= 0) {
          const currentIdx = currentParagraphIndexRef.current;
          const queueStartIndex = ttsQueueRef.current.startIndex;
          const queueEndIndex =
            queueStartIndex + ttsQueueRef.current.texts.length;

          if (currentIdx < queueStartIndex) {
            ttsCtrlLog.debug(
              'speech-done-before-queue',
              `onSpeechDone - currentIdx ${currentIdx} < queueStart ${queueStartIndex}, ignoring event`,
            );
            return;
          }

          if (currentIdx >= queueEndIndex) {
            ttsCtrlLog.debug(
              'speech-done-after-queue',
              `onSpeechDone - currentIdx ${currentIdx} >= queueEnd ${queueEndIndex}, deferring to WebView`,
            );
            webViewRef.current?.injectJavaScript('tts.next?.()');
            return;
          }

          const nextIndex = currentIdx + 1;

          if (nextIndex >= queueStartIndex && nextIndex < queueEndIndex) {
            const text = ttsQueueRef.current.texts[nextIndex - queueStartIndex];
            ttsCtrlLog.debug(
              'playing-from-queue',
              `Playing from queue. Index: ${nextIndex} (queue: ${queueStartIndex}-${queueEndIndex - 1})`,
            );

            if (nextIndex <= currentParagraphIndexRef.current) {
              ttsCtrlLog.warn(
                'index-not-advancing',
                `Index not advancing! next=${nextIndex}, current=${currentParagraphIndexRef.current}`,
              );
            }
            currentParagraphIndexRef.current = nextIndex;

            // CRITICAL: Update lastSpokenIndex in TTSAudioManager
            // This ensures drift enforcement uses correct paragraph position
            // We use currentIdx (just finished) as the last spoken index
            TTSAudioManager.setLastSpokenIndex(currentIdx);

            autoStopService.onParagraphSpoken();

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
            // FIX: Use ref.current directly to avoid stale closure
            // saveProgressRef is kept in sync by useRefSync hook
            saveProgressRef.current(percentage, nextIndex);

            // Check media navigation confirmation
            if (
              mediaNavSourceChapterIdRef.current &&
              nextIndex >= TTS_CONSTANTS.PARAGRAPHS_TO_CONFIRM_NAVIGATION
            ) {
              const sourceChapterId = mediaNavSourceChapterIdRef.current;
              const direction = mediaNavDirectionRef.current;
              if (direction === 'NEXT') {
                ttsCtrlLog.debug(
                  'media-nav-next',
                  `5 paragraphs reached after NEXT, marking chapter ${sourceChapterId} as 100%`,
                );
                updateChapterProgressDb(sourceChapterId, 100);
              } else if (direction === 'PREV') {
                ttsCtrlLog.debug(
                  'media-nav-prev',
                  `5 paragraphs reached after PREV, marking chapter ${sourceChapterId} as in-progress`,
                );
                try {
                  updateChapterProgressDb(sourceChapterId, 1);
                } catch (e) {
                  ttsCtrlLog.warn(
                    'mark-in-progress-failed',
                    'Failed to mark source chapter in-progress',
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
              if (
                now - lastStaleLogTimeRef.current >
                TTS_CONSTANTS.STALE_LOG_DEBOUNCE_MS
              ) {
                ttsCtrlLog.debug(
                  'stale-word-range-chapter',
                  `[STALE] onWordRange chapter ${eventChapterId} != ${currentChapterId}`,
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
        ttsCtrlLog.warn('word-range-error', 'onWordRange handler error', e);
      }
    });

    // onSpeechStart - Handle utterance start
    const startSubscription = TTSHighlight.addListener(
      'onSpeechStart',
      event => {
        try {
          if (wakeTransitionInProgressRef.current) {
            ttsCtrlLog.debug(
              'speech-start-wake-transition',
              'Ignoring onSpeechStart during wake transition',
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
                if (
                  now - lastStaleLogTimeRef.current >
                  TTS_CONSTANTS.STALE_LOG_DEBOUNCE_MS
                ) {
                  ttsCtrlLog.debug(
                    'stale-speech-start-chapter',
                    `[STALE] onSpeechStart chapter ${eventChapterId} != ${currentChapterId}`,
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
            ttsCtrlLog.debug(
              'speech-start-webview-transition',
              'Skipping onSpeechStart during WebView transition',
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
            ttsCtrlLog.debug(
              'background-tts-progress',
              `Background TTS progress - paragraph ${paragraphIndex}`,
            );
          }
        } catch (e) {
          ttsCtrlLog.warn(
            'speech-start-error',
            'onSpeechStart handler error',
            e,
          );
        }
      },
    );

    // onMediaAction - Handle media notification controls
    const mediaActionSubscription = TTSHighlight.addListener(
      'onMediaAction',
      async event => {
        const action = String(event?.action || '');
        ttsCtrlLog.info('media-action', action);

        const now = Date.now();
        if (
          now - lastMediaActionTimeRef.current <
          TTS_CONSTANTS.MEDIA_ACTION_DEBOUNCE_MS
        ) {
          if (__DEV__) {
            ttsCtrlLog.debug('media-action-debounced');
          }
          return;
        }
        lastMediaActionTimeRef.current = now;

        try {
          if (action === TTS_MEDIA_ACTIONS.PLAY_PAUSE) {
            if (isTTSReadingRef.current) {
              const idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
              const total = totalParagraphsRef.current;
              if (idx >= 0 && total > 0) {
                const percentage = Math.round(((idx + 1) / total) * 100);
                saveProgressRef.current(percentage, idx);
                if (__DEV__) {
                  ttsCtrlLog.info(
                    'pause-save-progress',
                    `idx=${idx} total=${total} pct=${percentage}`,
                  );
                }
              }

              webViewRef.current?.injectJavaScript(`
                window.ttsLastStopTime = Date.now();
                if (window.tts) {
                  window.tts.reading = false;
                  // Update button icon to show resume/play icon
                  const controller = document.getElementById('TTS-Controller');
                  if (controller?.firstElementChild && window.tts.resumeIcon) {
                    controller.firstElementChild.innerHTML = window.tts.resumeIcon;
                  }
                }
              `);

              lastTTSPauseTimeRef.current = Date.now();
              latestParagraphIndexRef.current = idx;
              autoStartTTSRef.current = false;
              isTTSReadingRef.current = false;
              isTTSPlayingRef.current = false;
              isTTSPausedRef.current = true;
              autoStopService.stop();
              await TTSHighlight.pause();
              updateTtsMediaNotificationState(false);
              return;
            }

            const idx = Math.max(
              0,
              currentParagraphIndexRef.current ?? 0,
              latestParagraphIndexRef.current ?? 0,
            );

            await restartTtsFromParagraphIndex(idx);
            autoStopService.resetCounters();
            return;
          }

          if (action === TTS_MEDIA_ACTIONS.SEEK_FORWARD) {
            const idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
            const total = Math.max(0, totalParagraphsRef.current);
            const last = total > 0 ? total - 1 : idx;
            const target = Math.min(last, idx + 5);
            await restartTtsFromParagraphIndex(target);
            autoStopService.resetCounters();
            return;
          }

          if (action === TTS_MEDIA_ACTIONS.SEEK_BACK) {
            const idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
            const target = Math.max(0, idx - 5);
            ttsCtrlLog.debug(
              'seek-back',
              `SEEK_BACK (current=${idx}) -> restarting from ${target}`,
            );

            try {
              await restartTtsFromParagraphIndex(target);
              autoStopService.resetCounters();
            } catch (err) {
              ttsCtrlLog.error(
                'seek-back-failed',
                'SEEK_BACK restart failed, attempting fallback',
                err,
              );
              try {
                TTSHighlight.fullStop();
                await new Promise(r =>
                  setTimeout(r, TTS_CONSTANTS.SEEK_BACK_FALLBACK_DELAY_MS),
                );
                await restartTtsFromParagraphIndex(target);
                autoStopService.resetCounters();
              } catch (err2) {
                ttsCtrlLog.error(
                  'seek-back-fallback-failed',
                  'SEEK_BACK fallback also failed',
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

            ttsCtrlLog.debug(
              'prev-chapter',
              `PREV_CHAPTER - navigating to chapter ${prevChapter.id}`,
            );

            // Mark WebView as unsynced BEFORE navigation
            isWebViewSyncedRef.current = false;

            mediaNavSourceChapterIdRef.current = chapterId;
            mediaNavDirectionRef.current = 'PREV';

            try {
              await updateChapterProgressDb(chapterId, 1);
              try {
                await markChapterUnread(chapterId);
              } catch (e) {
                ignoreError(e, 'markChapterUnread (source in-progress)');
              }
            } catch (e) {
              ttsCtrlLog.warn(
                'mark-source-in-progress-failed',
                'Failed to mark source chapter in-progress',
                e,
              );
            }

            try {
              await updateChapterProgressDb(prevChapter.id, 0);
              try {
                await markChapterUnread(prevChapter.id);
              } catch (e) {
                ignoreError(e, 'markChapterUnread (reset prev)');
              }
              try {
                MMKVStorage.set(`chapter_progress_${prevChapter.id}`, 0);
              } catch (e) {
                ignoreError(e, 'MMKVStorage.set (reset prev progress)');
              }
            } catch (e) {
              ttsCtrlLog.warn(
                'reset-prev-chapter-failed',
                'Failed to reset prev chapter progress',
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

            ttsCtrlLog.debug(
              'next-chapter',
              `NEXT_CHAPTER - navigating to chapter ${nextChapter.id}`,
            );

            // Mark WebView as unsynced BEFORE navigation
            isWebViewSyncedRef.current = false;

            mediaNavSourceChapterIdRef.current = chapterId;
            mediaNavDirectionRef.current = 'NEXT';

            try {
              await updateChapterProgressDb(chapterId, 100);
              try {
                await markChapterRead(chapterId);
              } catch (e) {
                ignoreError(e, 'markChapterRead (source read)');
              }
            } catch (e) {
              ttsCtrlLog.warn(
                'mark-source-read-failed',
                'Failed to mark source chapter read',
                e,
              );
            }

            try {
              await updateChapterProgressDb(nextChapter.id, 0);
              try {
                await markChapterUnread(nextChapter.id);
              } catch (e) {
                ignoreError(e, 'markChapterUnread (reset next)');
              }
              try {
                MMKVStorage.set(`chapter_progress_${nextChapter.id}`, 0);
              } catch (e) {
                ignoreError(e, 'MMKVStorage.set (reset next progress)');
              }
            } catch (e) {
              ttsCtrlLog.warn(
                'reset-next-chapter-failed',
                'Failed to reset next chapter progress',
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
          // Best-effort - ignore any errors in media action handler
          ignoreError(e, 'onMediaAction handler');
        }
      },
    );

    // onQueueEmpty - Handle end of TTS queue
    const queueEmptySubscription = TTSHighlight.addListener(
      'onQueueEmpty',
      async () => {
        ttsCtrlLog.debug('queue-empty-received', 'onQueueEmpty event received');

        const currentState = TTSAudioManager.getState();
        if (
          currentState === TTSState.STARTING ||
          currentState === TTSState.STOPPING
        ) {
          ttsCtrlLog.debug(
            'queue-empty-restart-progress',
            `Queue empty ignored - state is ${currentState}`,
          );
          return;
        }

        if (currentState === TTSState.REFILLING) {
          ttsCtrlLog.debug(
            'queue-empty-refill-progress',
            `Queue empty ignored - state is ${currentState}`,
          );
          return;
        }

        if (TTSHighlight.hasRemainingItems()) {
          ttsCtrlLog.debug(
            'queue-empty-has-items',
            'Queue empty ignored - TTSAudioManager still has items',
          );
          return;
        }

        // If we never successfully queued audio for this session, treat this as a failure-to-start
        // rather than end-of-chapter. This prevents accidental chapter jumps.
        if (!TTSHighlight.hasQueuedNativeInCurrentSession()) {
          ttsCtrlLog.warn(
            'queue-empty-no-audio',
            'Queue empty but no native audio was queued (batch start likely failed). Stopping without advancing.',
          );
          isTTSReadingRef.current = false;
          isTTSPlayingRef.current = false;
          showToastMessage('TTS failed to start. Not advancing chapter.');
          return;
        }

        if (!isTTSReadingRef.current) {
          ttsCtrlLog.debug(
            'queue-empty-not-reading',
            'Queue empty but TTS was not reading, ignoring',
          );
          return;
        }

        // Mark current chapter as finished for Auto-Stop (chapters mode)
        autoStopService.onChapterFinished();

        const autoStopMode =
          chapterGeneralSettingsRef.current.ttsAutoStopMode ?? 'off';
        const autoStopAmount =
          chapterGeneralSettingsRef.current.ttsAutoStopAmount ?? 0;

        // If Auto-Stop is set to 'off' (continuous) or 'chapters', we allow continuing.
        // For 'off', continue indefinitely. For 'chapters', continue until limit is reached.
        // For 'minutes'/'paragraphs', stop at end-of-chapter.
        if (autoStopMode !== 'off' && autoStopMode !== 'chapters') {
          ttsCtrlLog.debug(
            'queue-empty-stop-no-chapter-mode',
            `Queue empty - autoStopMode=${autoStopMode}, stopping at end of chapter`,
          );
          isTTSReadingRef.current = false;
          isTTSPlayingRef.current = false;
          return;
        }

        // For 'off' mode, skip validation and continue to next chapter indefinitely
        if (autoStopMode === 'off') {
          ttsCtrlLog.debug(
            'queue-empty-continuous-mode',
            'Queue empty - continuous mode (off), proceeding to next chapter',
          );
          // Continue to next chapter logic below
        } else if (autoStopMode === 'chapters') {
          // For 'chapters' mode, validate amount and check limit
          if (!Number.isFinite(autoStopAmount) || autoStopAmount <= 0) {
            ttsCtrlLog.debug(
              'queue-empty-stop-invalid-limit',
              `Queue empty - invalid autoStopAmount=${autoStopAmount}, stopping`,
            );
            isTTSReadingRef.current = false;
            isTTSPlayingRef.current = false;
            return;
          }

          if (chaptersAutoPlayedRef.current >= autoStopAmount) {
            ttsCtrlLog.info(
              'auto-stop-chapter-limit-reached',
              `Auto-stop chapter limit (${autoStopAmount}) reached, stopping`,
            );
            chaptersAutoPlayedRef.current = 0;
            isTTSReadingRef.current = false;
            isTTSPlayingRef.current = false;
            return;
          }
        }

        if (nextChapterRef.current) {
          const nextChap = nextChapterRef.current;
          const filePath = `${NOVEL_STORAGE}/${novelPluginId}/${novelId}/${nextChap.id}/index.html`;

          // Check if next chapter is already downloaded
          const isDownloaded = NativeFile.exists(filePath);

          if (!isDownloaded) {
            ttsCtrlLog.info(
              'next-chapter-not-downloaded',
              'Next chapter not downloaded, waiting...',
            );
            showToastMessage(
              getString('readerScreen.tts.downloadingNextChapter'),
            );

            // Update notification to show downloading status
            TTSHighlight.updateMediaState({
              novelName,
              chapterLabel: `${getString('readerScreen.tts.downloadingNextChapter')}`,
              chapterId,
              paragraphIndex: totalParagraphsRef.current - 1,
              totalParagraphs: totalParagraphsRef.current,
              isPlaying: true,
            });

            // Wait for download to complete (poll every 1.5s, 30s timeout)
            const checkInterval = 1500;
            const timeoutMs = 30000;
            const startTime = Date.now();
            let downloaded = false;

            while (Date.now() - startTime < timeoutMs) {
              await new Promise(r => setTimeout(r, checkInterval));
              if (NativeFile.exists(filePath)) {
                downloaded = true;
                break;
              }
            }

            if (!downloaded) {
              ttsCtrlLog.debug(
                'download-timeout',
                'Download timeout for next chapter',
              );
              showToastMessage(getString('readerScreen.tts.downloadTimeout'));
              isTTSReadingRef.current = false;
              isTTSPlayingRef.current = false;
              TTSHighlight.updateMediaState({
                novelName,
                chapterLabel: chapterName,
                chapterId,
                paragraphIndex: totalParagraphsRef.current - 1,
                totalParagraphs: totalParagraphsRef.current,
                isPlaying: false,
              });
              return;
            }

            if (__DEV__) {
              ttsCtrlLog.info(
                'next-chapter-download-complete',
                'Next chapter download complete',
              );
            }
            showToastMessage(getString('readerScreen.tts.downloadComplete'));
          }

          ttsCtrlLog.debug(
            'navigate-next-chapter',
            'Navigating to next chapter via onQueueEmpty',
          );

          saveProgressRef.current(100);

          autoStartTTSRef.current = true;
          backgroundTTSPendingRef.current = true;
          forceStartFromParagraphZeroRef.current = true;
          currentParagraphIndexRef.current = 0;
          latestParagraphIndexRef.current = 0;
          autoStopService.resetCounters();
          chaptersAutoPlayedRef.current += 1;
          nextChapterScreenVisibleRef.current = true;
          navigateChapterRef.current('NEXT');
        } else {
          ttsCtrlLog.info(
            'novel-complete',
            'No next chapter available - novel reading complete',
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
        ttsCtrlLog.debug('voice-fallback', 'Voice fallback occurred', event);
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
          // =====================================================================
          // Case 5.3 Fix: Auto-dismiss Manual Mode Dialog on background
          // =====================================================================
          // If the Manual Mode Dialog is visible when the app goes to background,
          // auto-dismiss it. TTS continues playing in background - we just need
          // to clear the dialog state so it doesn't persist across wake cycles.
          if (manualModeDialogVisibleRef.current) {
            ttsCtrlLog.debug(
              'auto-dismiss-manual-mode',
              'Auto-dismissing Manual Mode Dialog on background',
            );

            // Clear dialog state in React
            dialogStateRef.current.hideManualModeDialog();

            // Clear dialogActive in WebView when it unfreezes
            // (This injects JS that will execute when WebView becomes active again)
            webViewRef.current?.injectJavaScript(`
              if (window.tts) {
                window.tts.dialogActive = false;
                window.tts.lockedCurrentElement = null;
                window.tts.lockedParagraphIndex = null;
              }
              true;
            `);
          }

          if (ttsStateRef.current) {
            ttsCtrlLog.debug(
              'save-tts-state-background',
              'Saving TTS state on background',
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
            ttsCtrlLog.debug(
              'stop-tts-background-disabled',
              'Stopping TTS (Background Playback Disabled)',
            );
            TTSHighlight.stop();
            isTTSReadingRef.current = false;
          }
        } else if (nextAppState === 'active') {
          // =====================================================================
          // SCREEN WAKE HANDLING
          // =====================================================================
          // When screen wakes during background TTS, pause native playback,
          // sync the WebView to the current paragraph position to prevent
          // stale scrolling, then resume playback once the UI has been positioned.

          if (
            isTTSReadingRef.current &&
            currentParagraphIndexRef.current >= 0
          ) {
            // BUG FIX: IMMEDIATELY capture the current paragraph index BEFORE any async operations
            // This prevents race conditions where onSpeechStart events mutate the ref during pause
            const capturedParagraphIndex = currentParagraphIndexRef.current;
            capturedWakeParagraphIndexRef.current = capturedParagraphIndex;

            // BUG FIX: Set wake transition flag to block all native events from updating refs
            wakeTransitionInProgressRef.current = true;

            // BUG FIX: Clear stale queue at start of wake transition
            // Will be repopulated after resume with a fresh batch
            ttsQueueRef.current = null;

            // Increment session to help detect stale operations
            ttsSessionRef.current += 1;

            if (__DEV__) {
              ttsCtrlLog.info(
                'wake-detected',
                `idx=${capturedParagraphIndex} session=${ttsSessionRef.current}`,
              );
            }

            // BUG FIX: Immediately set screen wake sync flag to block all scroll saves
            // This must happen FIRST before any other processing
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                try {
                  window.ttsScreenWakeSyncPending = true;
                  window.ttsOperationActive = true;
                  reader.suppressSaveOnScroll = true;
                  console.log('TTS: Screen wake - IMMEDIATELY blocking scroll operations');
                } catch (e) {}
                true;
              `);
            }

            // Pause native playback immediately so we don't keep playing
            // while the UI syncs. Mark we should resume after the sync.
            try {
              wasReadingBeforeWakeRef.current = true;
              autoResumeAfterWakeRef.current = true;

              TTSHighlight.pause()
                .then(() => {
                  ttsCtrlLog.info('wake-paused-native');
                })
                .catch(e => {
                  ttsCtrlLog.warn(
                    'pause-tts-wake-failed',
                    'Failed to pause TTS on wake',
                    e,
                  );
                });

              // Mark as not currently playing while UI sync runs
              isTTSReadingRef.current = false;
              isTTSPlayingRef.current = false;
            } catch (e) {
              ttsCtrlLog.warn(
                'pause-tts-wake-failed',
                'Error while attempting to pause TTS',
                e,
              );
            }

            ttsCtrlLog.debug(
              'screen-wake-syncing',
              `Screen woke during TTS, syncing to paragraph ${capturedParagraphIndex}, WebView synced: ${isWebViewSyncedRef.current}`,
            );
            // =====================================================================
            if (!isWebViewSyncedRef.current) {
              // CRITICAL FIX: WebView has old chapter's HTML and TTS may have advanced
              // to a different chapter. We MUST:
              // 1. Save the EXACT chapter ID and paragraph index at this moment
              // 2. STOP TTS completely (not just pause) to prevent further queue processing
              // 3. Navigate back to the correct chapter if needed on reload

              const wakeChapterId = prevChapterIdRef.current;
              const wakeParagraphIdx =
                capturedWakeParagraphIndexRef.current ??
                currentParagraphIndexRef.current;

              ttsCtrlLog.debug(
                'webview-out-of-sync',
                `WebView out of sync - STOPPING TTS and saving position: Chapter ${wakeChapterId}, Paragraph ${wakeParagraphIdx}`,
              );

              // Save wake position for verification on reload
              wakeChapterIdRef.current = wakeChapterId;
              wakeParagraphIndexRef.current = wakeParagraphIdx;

              // CRITICAL: STOP TTS completely to prevent onQueueEmpty from advancing chapters
              isTTSReadingRef.current = false;
              isTTSPlayingRef.current = false;
              backgroundTTSPendingRef.current = false; // Don't auto-start on next chapter

              TTSHighlight.stop()
                .then(() => {
                  ttsCtrlLog.debug(
                    'tts-stopped-wake-out-of-sync',
                    'TTS stopped on wake (out-of-sync) for safe resume',
                  );
                })
                .catch(e => {
                  ttsCtrlLog.warn(
                    'stop-tts-wake-failed',
                    'Failed to stop TTS on wake',
                    e,
                  );
                });

              // BUG FIX: Clear wake transition flags for out-of-sync case
              // They will be set again when pending screen wake sync runs after WebView reloads
              wakeTransitionInProgressRef.current = false;
              capturedWakeParagraphIndexRef.current = null;

              // Mark that we need to sync position after WebView reloads
              pendingScreenWakeSyncRef.current = true;
              return;
            }

            // =====================================================================
            // WebView IS synced - perform in-place sync
            // =====================================================================

            // Give WebView a moment to stabilize after screen wake
            setTimeout(() => {
              if (webViewRef.current) {
                // Use the captured paragraph index from when wake was detected
                const capturedIndex = capturedWakeParagraphIndexRef.current;

                // Also check MMKV as a secondary source
                const mmkvIndex =
                  MMKVStorage.getNumber(`chapter_progress_${chapterId}`) ?? -1;
                const refIndex = currentParagraphIndexRef.current;

                // Priority: captured index > MMKV > current ref
                let syncIndex: number;
                if (capturedIndex !== null && capturedIndex >= 0) {
                  syncIndex = capturedIndex;
                  ttsCtrlLog.debug(
                    'using-captured-index',
                    `Using captured wake index: ${capturedIndex}`,
                  );
                } else if (mmkvIndex >= 0) {
                  syncIndex = mmkvIndex;
                  ttsCtrlLog.debug(
                    'using-mmkv-index',
                    `Using MMKV index: ${mmkvIndex}`,
                  );
                } else {
                  syncIndex = refIndex;
                  ttsCtrlLog.debug(
                    'using-ref-index',
                    `Using ref index: ${refIndex}`,
                  );
                }

                // Update refs to match the chosen sync index
                currentParagraphIndexRef.current = syncIndex;
                latestParagraphIndexRef.current = syncIndex;

                const prevChapterId = prevChapterIdRef.current;

                // Force sync WebView to current TTS position with chapter validation

                webViewRef.current.injectJavaScript(`
                  try {
                    if (window.tts) {
                      console.log('TTS: Screen wake sync to index ${syncIndex}');
                      // Mark as background playback to prevent resume prompts
                      window.tts.isBackgroundPlaybackActive = true;
                      window.tts.reading = true;
                      window.tts.hasAutoResumed = true;
                      window.tts.started = true;
                      
                      // BUG FIX: Update TTS button icon to show 'Pause' when TTS is running
                      // This ensures the button reflects the actual state after resume from notification
                      const controller = document.getElementById('TTS-Controller');
                      if (controller && controller.firstElementChild && window.tts.pauseIcon) {
                        controller.firstElementChild.innerHTML = window.tts.pauseIcon;
                        console.log('TTS: Screen wake - updated button to Pause icon');
                      }
                      
                      // Update TTS internal state for proper continuation
                      const readableElements = reader.getReadableElements();
                      if (readableElements && readableElements[${syncIndex}]) {
                        window.tts.currentElement = readableElements[${syncIndex}];
                        window.tts.prevElement = ${syncIndex} > 0 ? readableElements[${syncIndex} - 1] : null;
                        
                        // Force scroll to current TTS position
                        window.tts.scrollToElement(window.tts.currentElement);
                        
                        // Reset scroll lock to allow immediate taps after sync
                        setTimeout(() => { window.tts.resetScrollLock(); }, ${TTS_CONSTANTS.SCROLL_LOCK_RESET_MS});
                        
                        // Highlight current paragraph with chapter validation
                        window.tts.highlightParagraph(${syncIndex}, ${prevChapterId});
                        
                        console.log('TTS: Screen wake sync complete - scrolled to paragraph ${syncIndex}');
                      } else {
                        console.warn('TTS: Screen wake - paragraph ${syncIndex} not found');
                      }
                    }
                    
                    // Release blocking flags after sync is complete
                    setTimeout(() => {
                      window.ttsScreenWakeSyncPending = false;
                      window.ttsOperationActive = false;
                      reader.suppressSaveOnScroll = false;
                      console.log('TTS: Screen wake sync - released blocking flags');
                    }, ${TTS_CONSTANTS.TTS_START_DELAY_MS});
                  } catch (e) {
                    console.error('TTS: Screen wake sync failed', e);
                    // Release flags even on error
                    window.ttsScreenWakeSyncPending = false;
                    window.ttsOperationActive = false;
                    reader.suppressSaveOnScroll = false;
                  }
                  true;
                `);

                // Schedule a resume on RN side if we paused native playback earlier
                setTimeout(() => {
                  // Clear the wake transition flag now that sync is complete
                  wakeTransitionInProgressRef.current = false;
                  capturedWakeParagraphIndexRef.current = null;

                  if (
                    autoResumeAfterWakeRef.current &&
                    isTTSReadingRef.current === false
                  ) {
                    // Use the sync index we already computed
                    const idx = currentParagraphIndexRef.current ?? -1;

                    if (idx >= 0) {
                      // Attempt to resume using native batch playback
                      try {
                        const paragraphs = extractParagraphs(html);
                        if (paragraphs && paragraphs.length > idx) {
                          const remaining = paragraphs.slice(idx);
                          const ids = remaining.map(
                            (_, i) =>
                              `chapter_${chapterId}_utterance_${idx + i}`,
                          );

                          // Update queue ref for the fresh batch
                          ttsQueueRef.current = {
                            startIndex: idx,
                            texts: remaining,
                          };

                          // Restart auto-stop service for wake resume
                          const autoStopMode =
                            chapterGeneralSettingsRef.current.ttsAutoStopMode ??
                            'off';
                          const autoStopAmount =
                            chapterGeneralSettingsRef.current
                              .ttsAutoStopAmount ?? 0;

                          autoStopService.start(
                            { mode: autoStopMode, amount: autoStopAmount },
                            reason => {
                              TTSHighlight.stop();

                              // Show toast notification
                              const messages = {
                                minutes: `Auto-stop: ${autoStopAmount} minute${autoStopAmount !== 1 ? 's' : ''} elapsed`,
                                paragraphs: `Auto-stop: ${autoStopAmount} paragraph${autoStopAmount !== 1 ? 's' : ''} read`,
                                chapters: `Auto-stop: ${autoStopAmount} chapter${autoStopAmount !== 1 ? 's' : ''} complete`,
                              };
                              showToastMessage(messages[reason]);
                            },
                          );

                          // Start batch playback from the resolved index
                          TTSHighlight.speakBatch(remaining, ids, {
                            voice:
                              readerSettingsRef.current.tts?.voice?.identifier,
                            pitch: readerSettingsRef.current.tts?.pitch || 1,
                            rate: readerSettingsRef.current.tts?.rate || 1,
                          })
                            .then(() => {
                              if (__DEV__) {
                                ttsCtrlLog.debug(
                                  'wake-resume-after-wake',
                                  `Resumed TTS after wake from index ${idx}`,
                                );
                              }
                              isTTSReadingRef.current = true;
                              isTTSPlayingRef.current = true;
                              // Set grace period to ignore stale WebView queue messages
                              wakeResumeGracePeriodRef.current = Date.now();
                              updateTtsMediaNotificationState(true);
                            })
                            .catch(err => {
                              ttsCtrlLog.error(
                                'wake-resume-failed',
                                'Failed to resume TTS after wake',
                                err,
                              );
                            });
                        }
                      } catch (e) {
                        ttsCtrlLog.warn(
                          'wake-resume-extract-failed',
                          'Cannot resume TTS after wake (failed extract)',
                          e,
                        );
                      }
                    }

                    autoResumeAfterWakeRef.current = false;
                    wasReadingBeforeWakeRef.current = false;
                  }
                }, TTS_CONSTANTS.WAKE_TRANSITION_DELAY_MS);
              }
            }, TTS_CONSTANTS.WAKE_TRANSITION_RETRY_MS);
          } else if (
            isTTSPausedRef.current &&
            (latestParagraphIndexRef.current >= 0 ||
              currentParagraphIndexRef.current >= 0)
          ) {
            // =====================================================================
            // PAUSED STATE POSITION RESTORATION
            // =====================================================================
            // When user pauses TTS from notification panel and returns to app,
            // we need to restore the visual position (scroll + highlight) but
            // NOT auto-resume TTS (respect user's pause action).
            //
            // Root cause: The wake sync logic above only handles active reading
            // (isTTSReadingRef.current === true). When paused from notification,
            // isTTSReadingRef is FALSE, so no position restoration happened.

            const pausedParagraphIndex = Math.max(
              0,
              latestParagraphIndexRef.current ?? 0,
              currentParagraphIndexRef.current ?? 0,
            );

            ttsCtrlLog.info(
              'paused-wake-restore',
              `Restoring paused position: paragraph ${pausedParagraphIndex}`,
            );

            // Restore visual position in WebView (scroll + highlight)
            if (webViewRef.current && isWebViewSyncedRef.current) {
              webViewRef.current.injectJavaScript(`
                try {
                  const syncIndex = ${pausedParagraphIndex};
                  const elements = document.querySelectorAll('[id^="paragraph-"], p[id]');
                  
                  if (elements && elements.length > syncIndex) {
                    const targetElement = elements[syncIndex];
                    
                    // Scroll to element
                    if (targetElement) {
                      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      
                      // Highlight the paragraph
                      if (window.reader && window.reader.highlightElement) {
                        window.reader.highlightElement(syncIndex);
                      } else if (window.tts && window.tts.highlightElement) {
                        window.tts.highlightElement(syncIndex);
                      }
                      
                      console.log('TTS: Restored paused position to paragraph ' + syncIndex);
                    }
                  }
                } catch (e) {
                  console.error('TTS: Failed to restore paused position', e);
                }
                true;
              `);
            }

            // Update media notification to show paused state
            updateTtsMediaNotificationState(false);
          }
        }
      },
    );

    // Cleanup
    return () => {
      // Remove all subscriptions with error handling to ensure complete cleanup
      try {
        onSpeechDoneSubscription.remove();
      } catch (e) {
        ttsCtrlLog.warn(
          'cleanup-error',
          'Failed to remove onSpeechDone subscription',
          e,
        );
      }
      try {
        rangeSubscription.remove();
      } catch (e) {
        ttsCtrlLog.warn(
          'cleanup-error',
          'Failed to remove onWordRange subscription',
          e,
        );
      }
      try {
        startSubscription.remove();
      } catch (e) {
        ttsCtrlLog.warn(
          'cleanup-error',
          'Failed to remove onSpeechStart subscription',
          e,
        );
      }
      try {
        mediaActionSubscription.remove();
      } catch (e) {
        ttsCtrlLog.warn(
          'cleanup-error',
          'Failed to remove onMediaAction subscription',
          e,
        );
      }
      try {
        queueEmptySubscription.remove();
      } catch (e) {
        ttsCtrlLog.warn(
          'cleanup-error',
          'Failed to remove onQueueEmpty subscription',
          e,
        );
      }
      try {
        voiceFallbackSubscription.remove();
      } catch (e) {
        ttsCtrlLog.warn(
          'cleanup-error',
          'Failed to remove onVoiceFallback subscription',
          e,
        );
      }
      try {
        appStateSubscription.remove();
      } catch (e) {
        ttsCtrlLog.warn(
          'cleanup-error',
          'Failed to remove AppState subscription',
          e,
        );
      }

      // Clear drift enforcement callback
      TTSHighlight.setOnDriftEnforceCallback(undefined);

      try {
        TTSHighlight.stop();
      } catch (e) {
        ttsCtrlLog.warn('cleanup-error', 'Failed to stop TTSHighlight', e);
      }
      if (ttsStateRef.current) {
        ttsCtrlLog.debug(
          'save-tts-state-unmount',
          'Saving TTS state on unmount',
          ttsStateRef.current,
        );
        saveProgressOnUnmount(
          getProgressOnUnmount(),
          undefined,
          JSON.stringify({
            ...ttsStateRef.current,
            timestamp: Date.now(),
          }),
        );
      }
    };
  }, [
    chapterId,
    chapterName,
    html,
    novelId,
    novelName,
    novelPluginId,
    showToastMessage,
    navigateChapter,
    nextChapter,
    prevChapter,
    restartTtsFromParagraphIndex,
    updateTtsMediaNotificationState,
    chapterGeneralSettingsRef,
    readerSettingsRef,
    webViewRef,
  ]);

  // ===========================================================================
  // Return Value
  // ===========================================================================

  const currentChapterForDialog = useMemo(
    () => ({
      id: chapterId,
      name: chapterName,
      paragraph: pendingResumeIndexRef.current,
    }),
    [chapterId, chapterName],
  );

  return {
    // Current State
    isTTSReading: isTTSReadingRef.current,
    currentParagraphIndex: currentParagraphIndexRef.current,
    totalParagraphs: totalParagraphsRef.current,
    isTTSPaused: isTTSPausedRef.current,

    // Dialog Visibility (from dialogState)
    resumeDialogVisible: dialogState.resumeDialogVisible,
    scrollSyncDialogVisible: dialogState.scrollSyncDialogVisible,
    manualModeDialogVisible: dialogState.manualModeDialogVisible,
    showExitDialog: dialogState.showExitDialog,
    showChapterSelectionDialog: dialogState.showChapterSelectionDialog,
    syncDialogVisible: dialogState.syncDialogVisible,

    // Dialog Data (from dialogState)
    exitDialogData: dialogState.exitDialogData,
    conflictingChapters: dialogState.conflictingChapters,
    syncDialogStatus: dialogState.syncDialogStatus,
    syncDialogInfo: dialogState.syncDialogInfo,
    ttsScrollPromptData: ttsScrollPromptDataRef.current,
    pendingResumeIndex: pendingResumeIndexRef.current,
    currentChapterForDialog,

    // Dialog Handlers
    handleResumeConfirm: resumeDialogHandlers.handleResumeConfirm,
    handleResumeCancel: resumeDialogHandlers.handleResumeCancel,
    handleRestartChapter: resumeDialogHandlers.handleRestartChapter,
    handleTTSScrollSyncConfirm,
    handleTTSScrollSyncCancel,
    handleStopTTS,
    handleContinueFollowing,
    handleSelectChapter,
    handleRequestTTSConfirmation,

    // Dialog Dismiss (from dialogState)
    hideResumeDialog: dialogState.hideResumeDialog,
    hideScrollSyncDialog: dialogState.hideScrollSyncDialog,
    hideManualModeDialog: dialogState.hideManualModeDialog,
    setShowExitDialog: dialogState.setShowExitDialog,
    setShowChapterSelectionDialog: dialogState.setShowChapterSelectionDialog,
    setSyncDialogVisible: dialogState.setSyncDialogVisible,
    setExitDialogData: dialogState.setExitDialogData,

    // Exit Dialog Handlers (from exitDialogHandlers)
    handleExitTTS,
    handleExitReader,

    // Sync Dialog Handlers (from syncDialogHandlers)
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
    chapterTransitionTimeRef,
    prevChapterIdRef,

    // Utility Functions (from utilities)
    resumeTTS,
    updateLastTTSChapter,
    restartTtsFromParagraphIndex,
    updateTtsMediaNotificationState,
  };
}

export default useTTSController;
