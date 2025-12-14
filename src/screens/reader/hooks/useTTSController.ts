/**
 * useTTSController Hook
 *
 * This hook encapsulates all TTS (Text-to-Speech) logic from WebViewReader.
 * It manages TTS state, native event listeners, dialog handlers, and WebView message processing.
 *
 * @module reader/hooks/useTTSController
 */
/* eslint-disable no-console */

import { useRef, useCallback, useEffect, RefObject, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import WebView from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';

import TTSHighlight from '@services/TTSHighlight';
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
  /** Chapter transition time ref (for grace period validation) */
  chapterTransitionTimeRef: RefObject<number>;

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

  useChapterTransition({
    chapterId: chapter.id,
    refs: {
      prevChapterIdRef,
      chapterTransitionTimeRef,
      isWebViewSyncedRef,
      mediaNavSourceChapterIdRef,
      mediaNavDirectionRef,
    },
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

    console.log(
      'useTTSController: Background TTS pending for chapter',
      chapter.id,
    );

    // Clear the flag immediately
    backgroundTTSPendingRef.current = false;

    // CRITICAL FIX: When background TTS starts (app in background during chapter nav),
    // WebView won't actually load/render until app returns to foreground.
    // Mark as synced immediately so TTS events aren't blocked forever.
    // The Chapter Change Effect's timer won't fire because WebView onLoadEnd never triggers.
    isWebViewSyncedRef.current = true;
    console.log(
      'useTTSController: WebView marked as synced for background TTS (bypassing onLoadEnd)',
    );

    // Extract paragraphs from HTML
    const paragraphs = extractParagraphs(html);
    console.log(
      `useTTSController: Extracted ${paragraphs.length} paragraphs for background TTS`,
    );

    if (paragraphs.length === 0) {
      console.warn('useTTSController: No paragraphs extracted from HTML');
      isTTSReadingRef.current = false;
      return;
    }

    // Check if we should force start from paragraph 0 (notification prev/next chapter)
    const forceStartFromZero = forceStartFromParagraphZeroRef.current;
    if (forceStartFromZero) {
      forceStartFromParagraphZeroRef.current = false;
      console.log(
        'useTTSController: Forcing start from paragraph 0 due to notification chapter navigation',
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
      (_, i) => `chapter_${chapter.id}_utterance_${startIndex + i}`,
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
          console.log(
            'useTTSController: Background TTS batch started successfully from index',
            startIndex,
          );
          // CRITICAL: Ensure isTTSReadingRef is true so onQueueEmpty can trigger next chapter
          isTTSReadingRef.current = true;
          isTTSPlayingRef.current = true;
          hasUserScrolledRef.current = false;
          updateTtsMediaNotificationState(true);
        })
        .catch(err => {
          console.error('useTTSController: Background TTS batch failed:', err);
          isTTSReadingRef.current = false;
          isTTSPlayingRef.current = false;
          showToastMessage('TTS failed to start. Please try again.');
        });
    } else {
      console.warn('useTTSController: No paragraphs to speak');
      isTTSReadingRef.current = false;
    }
  }, [chapter.id, html, showToastMessage, updateTtsMediaNotificationState]);

  // ===========================================================================
  // Utility Functions
  // ===========================================================================

  // ===========================================================================
  // Dialog Handlers - Phase 2 Step 2: Extracted to useResumeDialogHandlers
  // ===========================================================================

  const resumeDialogHandlers = useResumeDialogHandlers({
    chapterId: chapter.id,
    chapterTtsState: chapter.ttsState,
    webViewRef,
    refs: {
      pendingResumeIndexRef,
      latestParagraphIndexRef,
    },
    callbacks: {
      resumeTTS,
      hideResumeDialog: dialogState.hideResumeDialog,
    },
  });

  // ===========================================================================
  // Scroll Sync Handlers (Phase 1: Extracted)
  // ===========================================================================

  const scrollSyncHandlers = useScrollSyncHandlers({
    webViewRef,
    refs: { ttsScrollPromptDataRef },
    callbacks: { hideScrollSyncDialog: dialogState.hideScrollSyncDialog },
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
    callbacks: { hideManualModeDialog: dialogState.hideManualModeDialog },
  });

  const { handleStopTTS, handleContinueFollowing } = manualModeHandlers;

  // ===========================================================================
  // TTS Confirmation Handler (Phase 2: Step 3)
  // ===========================================================================

  const ttsConfirmationHandler = useTTSConfirmationHandler({
    novelId: novel.id,
    chapterId: chapter.id,
    latestParagraphIndexRef,
    lastTTSPauseTimeRef,
    pendingResumeIndexRef,
    dialogState: {
      setConflictingChapters: dialogState.setConflictingChapters,
      setShowChapterSelectionDialog: dialogState.setShowChapterSelectionDialog,
      showResumeDialog: dialogState.showResumeDialog,
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
      setShowChapterSelectionDialog: dialogState.setShowChapterSelectionDialog,
      showResumeDialog: dialogState.showResumeDialog,
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
    chapterId: chapter.id,
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
            dialogState.setExitDialogData({
              ttsParagraph: Number(ttsIndex) || 0,
              readerParagraph: Number(visible) || 0,
            });
            dialogState.setShowExitDialog(true);
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
            dialogState.showScrollSyncDialog();
          }
          return true;

        case 'tts-manual-mode-prompt':
          dialogState.showManualModeDialog();
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
            dialogState.showScrollSyncDialog();
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
      dialogState.showScrollSyncDialog,
      dialogState.showManualModeDialog,
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
      const currentChapterId = chapter.id;

      if (__DEV__) {
        console.log(
          'useTTSController: Processing pending screen-wake sync.',
          `Saved: Chapter ${savedWakeChapterId}, Paragraph ${savedWakeParagraphIdx}.`,
          `Current: Chapter ${currentChapterId}`,
        );
      }

      // ENFORCE CHAPTER MATCH: If the loaded chapter doesn't match where TTS was,
      // attempt to navigate to the correct chapter automatically.
      if (
        savedWakeChapterId !== null &&
        savedWakeChapterId !== currentChapterId
      ) {
        console.warn(
          `useTTSController: Chapter mismatch! TTS was at chapter ${savedWakeChapterId} but WebView loaded chapter ${currentChapterId}.`,
          'Attempting to navigate to correct chapter...',
        );

        // Check retry count to prevent infinite loops
        const MAX_SYNC_RETRIES = 2;
        if (syncRetryCountRef.current >= MAX_SYNC_RETRIES) {
          console.error(
            'useTTSController: Max sync retries reached, showing failure dialog',
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
              dialogState.setSyncDialogInfo({
                chapterName:
                  savedChapter?.name ?? `Chapter ID: ${savedWakeChapterId}`,
                paragraphIndex: paragraphIdx,
                totalParagraphs: retryTotalParagraphs,
                progress: progressPercent,
              });
              dialogState.setSyncDialogStatus('failed');
              dialogState.setSyncDialogVisible(true);
            })
            .catch(() => {
              dialogState.setSyncDialogInfo({
                chapterName: `Chapter ID: ${savedWakeChapterId}`,
                paragraphIndex: paragraphIdx,
                totalParagraphs: retryTotalParagraphs,
                progress: progressPercent,
              });
              dialogState.setSyncDialogStatus('failed');
              dialogState.setSyncDialogVisible(true);
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
        dialogState.setSyncDialogStatus('syncing');
        dialogState.setSyncDialogVisible(true);
        syncRetryCountRef.current += 1;

        // Fetch the saved chapter info and navigate to it
        getChapterFromDb(savedWakeChapterId)
          .then(savedChapter => {
            if (savedChapter) {
              console.log(
                `useTTSController: Navigating to saved chapter: ${
                  savedChapter?.name || savedWakeChapterId
                }`,
              );
              // Keep wake refs intact so we can resume after navigation
              // Set flag so we continue the sync process on next load
              pendingScreenWakeSyncRef.current = true;
              // Navigate to the correct chapter
              getChapter(savedChapter);
            } else {
              console.error(
                `useTTSController: Could not find chapter ${savedWakeChapterId} in database`,
              );
              dialogState.setSyncDialogStatus('failed');
              dialogState.setSyncDialogInfo({
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
            console.error('useTTSController: Database query failed');
            dialogState.setSyncDialogStatus('failed');
            dialogState.setSyncDialogVisible(true);
          });

        return;
      }

      // ===========================================================================
      // CHAPTER MATCH - PROCEED WITH WAKE RESUME
      // ===========================================================================
      console.log(
        'useTTSController: Chapter match verified, proceeding with wake resume',
      );

      // Hide sync dialog if it was showing
      if (dialogState.syncDialogVisible) {
        dialogState.setSyncDialogStatus('success');
        setTimeout(() => {
          dialogState.setSyncDialogVisible(false);
        }, 1000);
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
          console.log(
            'useTTSController: Resuming TTS after wake sync from paragraph',
            savedWakeParagraphIdx,
          );

          const paragraphs = extractParagraphs(html);
          if (paragraphs && paragraphs.length > savedWakeParagraphIdx) {
            const remaining = paragraphs.slice(savedWakeParagraphIdx);
            const ids = remaining.map(
              (_, i) =>
                `chapter_${chapter.id}_utterance_${savedWakeParagraphIdx + i}`,
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
                console.log('useTTSController: TTS resumed after wake sync');
                isTTSReadingRef.current = true;
                isTTSPlayingRef.current = true;
                updateTtsMediaNotificationState(true);
              })
              .catch(err => {
                console.error(
                  'useTTSController: Failed to resume TTS after wake sync',
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
      }, 500);

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
      console.log(
        'useTTSController: onLoadEnd detected pending wake resume, injecting blocking flags',
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
  }, [
    chapter.id,
    html,
    webViewRef,
    dialogState.syncDialogVisible,
    getChapter,
    updateTtsMediaNotificationState,
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

            console.log(
              'useTTSController: Screen wake detected, capturing paragraph index:',
              capturedParagraphIndex,
              'session:',
              ttsSessionRef.current,
            );

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
                  console.log(
                    'useTTSController: Paused native TTS on wake for UI sync',
                  );
                })
                .catch(e => {
                  console.warn(
                    'useTTSController: Failed to pause TTS on wake',
                    e,
                  );
                });

              // Mark as not currently playing while UI sync runs
              isTTSReadingRef.current = false;
              isTTSPlayingRef.current = false;
            } catch (e) {
              console.warn(
                'useTTSController: Error while attempting to pause TTS',
                e,
              );
            }

            console.log(
              'useTTSController: Screen woke during TTS, syncing to paragraph',
              capturedParagraphIndex,
              'WebView synced:',
              isWebViewSyncedRef.current,
            );

            // =====================================================================
            // Check if WebView is synced with current chapter
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

              console.log(
                'useTTSController: WebView out of sync - STOPPING TTS and saving position:',
                `Chapter ${wakeChapterId}, Paragraph ${wakeParagraphIdx}`,
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
                  console.log(
                    'useTTSController: TTS stopped on wake (out-of-sync) for safe resume',
                  );
                })
                .catch(e => {
                  console.warn(
                    'useTTSController: Failed to stop TTS on wake',
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
                  MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
                const refIndex = currentParagraphIndexRef.current;

                // Priority: captured index > MMKV > current ref
                let syncIndex: number;
                if (capturedIndex !== null && capturedIndex >= 0) {
                  syncIndex = capturedIndex;
                  console.log(
                    `useTTSController: Using captured wake index: ${capturedIndex}`,
                  );
                } else if (mmkvIndex >= 0) {
                  syncIndex = mmkvIndex;
                  console.log(
                    `useTTSController: Using MMKV index: ${mmkvIndex}`,
                  );
                } else {
                  syncIndex = refIndex;
                  console.log(`useTTSController: Using ref index: ${refIndex}`);
                }

                // Update refs to match the chosen sync index
                currentParagraphIndexRef.current = syncIndex;
                latestParagraphIndexRef.current = syncIndex;

                const chapterId = prevChapterIdRef.current;

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
                      
                      // Update TTS internal state for proper continuation
                      const readableElements = reader.getReadableElements();
                      if (readableElements && readableElements[${syncIndex}]) {
                        window.tts.currentElement = readableElements[${syncIndex}];
                        window.tts.prevElement = ${syncIndex} > 0 ? readableElements[${syncIndex} - 1] : null;
                        
                        // Force scroll to current TTS position
                        window.tts.scrollToElement(window.tts.currentElement);
                        
                        // Reset scroll lock to allow immediate taps after sync
                        setTimeout(() => { window.tts.resetScrollLock(); }, 600);
                        
                        // Highlight current paragraph with chapter validation
                        window.tts.highlightParagraph(${syncIndex}, ${chapterId});
                        
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
                    }, 500);
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
                              `chapter_${chapter.id}_utterance_${idx + i}`,
                          );

                          // Update queue ref for the fresh batch
                          ttsQueueRef.current = {
                            startIndex: idx,
                            texts: remaining,
                          };

                          // Start batch playback from the resolved index
                          TTSHighlight.speakBatch(remaining, ids, {
                            voice:
                              readerSettingsRef.current.tts?.voice?.identifier,
                            pitch: readerSettingsRef.current.tts?.pitch || 1,
                            rate: readerSettingsRef.current.tts?.rate || 1,
                          })
                            .then(() => {
                              console.log(
                                'useTTSController: Resumed TTS after wake from index',
                                idx,
                              );
                              isTTSReadingRef.current = true;
                              isTTSPlayingRef.current = true;
                              // Set grace period to ignore stale WebView queue messages
                              wakeResumeGracePeriodRef.current = Date.now();
                              updateTtsMediaNotificationState(true);
                            })
                            .catch(err => {
                              console.error(
                                'useTTSController: Failed to resume TTS after wake',
                                err,
                              );
                            });
                        }
                      } catch (e) {
                        console.warn(
                          'useTTSController: Cannot resume TTS after wake (failed extract)',
                          e,
                        );
                      }
                    }

                    autoResumeAfterWakeRef.current = false;
                    wasReadingBeforeWakeRef.current = false;
                  }
                }, 900);
              }
            }, 300);
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

    // Utility Functions (from utilities)
    resumeTTS,
    updateLastTTSChapter,
    restartTtsFromParagraphIndex,
    updateTtsMediaNotificationState,
  };
}

export default useTTSController;
