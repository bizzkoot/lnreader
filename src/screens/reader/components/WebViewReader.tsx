import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  StatusBar,
  AppState,
} from 'react-native';
import WebView from 'react-native-webview';
import {
  READER_WEBVIEW_ORIGIN_WHITELIST,
  createMessageRateLimiter,
  createWebViewNonce,
  parseWebViewMessage,
  shouldAllowReaderWebViewRequest,
} from '@utils/webviewSecurity';
import color from 'color';

import { useTheme, useChapterReaderSettings } from '@hooks/persisted';
import { getString } from '@strings/translations';

import { getPlugin } from '@plugins/pluginManager';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import {
  CHAPTER_GENERAL_SETTINGS,
  CHAPTER_READER_SETTINGS,
  ChapterGeneralSettings,
  ChapterReaderSettings,
  initialChapterGeneralSettings,
  initialChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import { getBatteryLevelSync } from 'react-native-device-info';
import TTSHighlight from '@services/TTSHighlight';
import { PLUGIN_STORAGE } from '@utils/Storages';
import { useChapterContext } from '../ChapterContext';
import TTSResumeDialog from './TTSResumeDialog';
import TTSScrollSyncDialog from './TTSScrollSyncDialog';
import TTSManualModeDialog from './TTSManualModeDialog';
import TTSChapterSelectionDialog from './TTSChapterSelectionDialog';
import TTSSyncDialog from './TTSSyncDialog';
import Toast from '@components/Toast';
import { useBoolean, useBackHandler } from '@hooks';
import { extractParagraphs } from '@utils/htmlParagraphExtractor';
import {
  applyTtsUpdateToWebView,
  validateAndClampParagraphIndex,
} from './ttsHelpers';
import {
  getChapter as getChapterFromDb,
  markChaptersBeforePositionRead,
  resetFutureChaptersProgress,
  getRecentReadingChapters,
  updateChapterProgress as updateChapterProgressDb,
} from '@database/queries/ChapterQueries';
import TTSExitDialog from './TTSExitDialog';
import { useNavigation } from '@react-navigation/native';

type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number } | string[];
  startIndex?: number;
  autoStartTTS?: boolean;
  paragraphIndex?: number;
  ttsState?: any;
  chapterId?: number;
};

type WebViewReaderProps = {
  onPress(): void;
};

const onLogMessage = (payload: { nativeEvent: { data: string } }) => {
  const dataPayload = JSON.parse(payload.nativeEvent.data);
  if (dataPayload) {
    if (dataPayload.type === 'console') {
      /* eslint-disable no-console */
      console.info(`[Console] ${JSON.stringify(dataPayload.msg, null, 2)}`);
    }
  }
};

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

const assetsUriPrefix = __DEV__
  ? 'http://localhost:8081/assets'
  : 'file:///android_asset';

const WebViewReader: React.FC<WebViewReaderProps> = ({ onPress }) => {
  const {
    novel,
    chapter,
    chapterText: html,
    navigateChapter,
    saveProgress,
    nextChapter,
    prevChapter,
    webViewRef,
    savedParagraphIndex,
    getChapter,
  } = useChapterContext();
  const navigation = useNavigation();
  const theme = useTheme();

  const webViewNonceRef = useRef<string>(createWebViewNonce());
  const allowMessageRef = useRef(createMessageRateLimiter());

  // Move toast-related hooks to the top to avoid hoisting issues
  const {
    value: toastVisible,
    setTrue: showToast,
    setFalse: hideToast,
  } = useBoolean();

  const toastMessageRef = useRef<string>('');

  const showToastMessage = useCallback(
    (message: string) => {
      toastMessageRef.current = message;
      showToast();
    },
    [showToast],
  );
  const readerSettings = useMemo(
    () =>
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
      initialChapterReaderSettings,
    // needed to preserve settings during chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );
  const chapterGeneralSettings = useMemo(
    () => {
      const defaults = initialChapterGeneralSettings;
      const stored =
        getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) || {};

      // Robust merge: Ensure defaults are preserved if stored value is undefined/missing
      const merged = { ...defaults, ...stored };

      // Explicitly ensure showParagraphHighlight is set (fallback to true)
      if (merged.showParagraphHighlight === undefined) {
        merged.showParagraphHighlight = defaults.showParagraphHighlight ?? true;
      }

      console.log(
        '[WebViewReader] Initial Settings:',
        JSON.stringify(defaults),
      );
      console.log('[WebViewReader] Stored Settings:', JSON.stringify(stored));
      console.log('[WebViewReader] Merged Settings:', JSON.stringify(merged));

      return merged;
    },
    // needed to preserve settings during chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  // Track native TTS position fetched async (fallback for background TTS saves)
  const [nativeTTSPosition, setNativeTTSPosition] = useState<number>(-1);

  // FIX: Use a stable savedParagraphIndex that only updates when chapter changes.
  // This prevents the WebView from reloading (and resetting TTS) when progress is saved.
  // NEW: Also check MMKV and native SharedPreferences for the absolute latest progress
  const initialSavedParagraphIndex = useMemo(
    () => {
      const mmkvIndex =
        MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
      const dbIndex = savedParagraphIndex ?? -1;
      // Include native TTS position as fallback (covers background TTS saves)
      const nativeIndex = nativeTTSPosition;
      console.log(
        `WebViewReader: Initializing scroll. DB: ${dbIndex}, MMKV: ${mmkvIndex}, Native: ${nativeIndex}`,
      );
      return Math.max(dbIndex, mmkvIndex, nativeIndex);
    },
    // CRITICAL FIX: Only calculate once per chapter to prevent WebView reloads
    // when progress is saved (which would update savedParagraphIndex)
    // Include nativeTTSPosition to update when async fetch completes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id, nativeTTSPosition],
  );

  // Fetch native TTS position on chapter change (async fallback for background TTS saves)
  useEffect(() => {
    const fetchNativeTTSPosition = async () => {
      try {
        const position = await TTSHighlight.getSavedTTSPosition(chapter.id);
        if (position >= 0) {
          console.log(
            `WebViewReader: Native TTS position for chapter ${chapter.id}: ${position}`,
          );
          setNativeTTSPosition(position);
        }
      } catch (error) {
        // Best-effort: if native call fails, fall back to MMKV/DB values
        console.log(
          'WebViewReader: Failed to fetch native TTS position, using MMKV/DB fallback',
        );
      }
    };

    // Reset state for new chapter
    setNativeTTSPosition(-1);
    fetchNativeTTSPosition();
  }, [chapter.id]);

  // NEW: Create a stable chapter object that doesn't update on progress changes
  // This prevents the WebView from reloading when we save progress
  const stableChapter = useMemo(
    () => ({
      ...chapter,
      // Ensure we use the initial values for these if needed, or just spread
      // The key is that this object reference (and its stringified version)
      // won't change unless chapter.id changes
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);
  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
  const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;
  const nextChapterScreenVisible = useRef<boolean>(false);
  const autoStartTTSRef = useRef<boolean>(false);
  // NEW: When true, TTS auto-start will begin from paragraph 0 (used by notification prev/next chapter)
  const forceStartFromParagraphZeroRef = useRef<boolean>(false);
  const isTTSReadingRef = useRef<boolean>(false);
  const ttsStateRef = useRef<any>(null);
  const progressRef = useRef(chapter.progress);
  // NEW: Track latest paragraph index to survive settings injections
  const latestParagraphIndexRef = useRef(savedParagraphIndex);
  // NEW: Track if we need to start TTS directly from RN (background mode)
  const backgroundTTSPendingRef = useRef<boolean>(false);
  // NEW: Track previous chapter ID to detect chapter changes
  const prevChapterIdRef = useRef<number>(chapter.id);
  // NEW: Track if TTS is currently playing to prevent manual scroll from overwriting TTS position
  const isTTSPlayingRef = useRef<boolean>(false);
  // NEW: Track if user has manually scrolled to prevent TTS from overwriting user position
  const hasUserScrolledRef = useRef<boolean>(false);
  // NEW: Grace period timestamp to ignore stale save events after chapter change
  const chapterTransitionTimeRef = useRef<number>(0);
  // NEW: Track if WebView is synchronized with current chapter
  // During background TTS, WebView may still have old chapter loaded
  const isWebViewSyncedRef = useRef<boolean>(true);
  // When screen wakes while WebView was suspended during background TTS,
  // mark that we need to run the screen-wake sync after the new HTML loads.
  const pendingScreenWakeSyncRef = useRef<boolean>(false);
  // If true we should resume native playback after we've synced UI
  const autoResumeAfterWakeRef = useRef<boolean>(false);
  // TTS Cross-Chapter
  const lastTTSChapterIdRef = useRef<number | null>(
    MMKVStorage.getNumber('lastTTSChapterId') || null,
  );
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [exitDialogData, setExitDialogData] = useState<{
    ttsParagraph: number;
    readerParagraph: number;
  }>({ ttsParagraph: 0, readerParagraph: 0 });

  const [showChapterSelectionDialog, setShowChapterSelectionDialog] =
    useState(false);
  const [conflictingChapters, setConflictingChapters] = useState<
    Array<{ id: number; name: string; paragraph: number }>
  >([]);

  const updateLastTTSChapter = (id: number) => {
    lastTTSChapterIdRef.current = id;
    MMKVStorage.set('lastTTSChapterId', id);
  };

  const wasReadingBeforeWakeRef = useRef<boolean>(false);
  // CRITICAL FIX: Track the EXACT chapter ID and paragraph index at the moment of screen wake
  // These are used to verify we're resuming on the correct chapter after WebView reloads
  const wakeChapterIdRef = useRef<number | null>(null);
  const wakeParagraphIndexRef = useRef<number | null>(null);
  // BUG FIX: Track if wake transition is in progress to block stale events from updating refs
  // This prevents race conditions where onSpeechStart events mutate currentParagraphIndexRef
  // during the async pause/sync/resume sequence
  const wakeTransitionInProgressRef = useRef<boolean>(false);
  // BUG FIX: Capture the exact paragraph index at the moment of wake BEFORE any events can change it
  const capturedWakeParagraphIndexRef = useRef<number | null>(null);
  // NEW: TTS session tracking - incremented on each new speakBatch to detect stale queue states
  const ttsSessionRef = useRef<number>(0);
  // NEW: Track when wake resume completed to add grace period for queue modifications
  const wakeResumeGracePeriodRef = useRef<number>(0);
  // FIX Bug 12.8: Debounce rapid media actions to prevent queue corruption
  const lastMediaActionTimeRef = useRef<number>(0);
  const MEDIA_ACTION_DEBOUNCE_MS = 500;
  // Track source chapter ID when navigating via media controls
  // After 5 paragraphs in new chapter: NEXT marks this as 100%, PREV marks as "in progress"
  const mediaNavSourceChapterIdRef = useRef<number | null>(null);
  const PARAGRAPHS_TO_CONFIRM_NAVIGATION = 5;

  // State for TTS sync dialog (shown when screen wakes and chapter mismatch occurs)
  const [syncDialogVisible, setSyncDialogVisible] = useState(false);
  const [syncDialogStatus, setSyncDialogStatus] = useState<
    'syncing' | 'success' | 'failed'
  >('syncing');
  const [syncDialogInfo, setSyncDialogInfo] = useState<
    | {
        chapterName: string;
        paragraphIndex: number;
        totalParagraphs: number;
        progress: number;
      }
    | undefined
  >(undefined);
  // Track retry attempts to prevent infinite loops
  const syncRetryCountRef = useRef<number>(0);
  const MAX_SYNC_RETRIES = 2;

  // FIX: Refs to prevent stale closures in onQueueEmpty handler
  // The handler is created once (empty deps) but needs current values
  const nextChapterRef = useRef(nextChapter);
  const navigateChapterRef = useRef(navigateChapter);
  const saveProgressRef = useRef(saveProgress);

  useEffect(() => {
    progressRef.current = chapter.progress;
  }, [chapter.progress]);

  // NEW: Keep settings in refs to avoid stale closures in listeners
  const readerSettingsRef = useRef(readerSettings);
  const chapterGeneralSettingsRef = useRef(chapterGeneralSettings);

  useEffect(() => {
    readerSettingsRef.current = readerSettings;
    chapterGeneralSettingsRef.current = chapterGeneralSettings;
  }, [readerSettings, chapterGeneralSettings]);

  useEffect(() => {
    saveProgressRef.current = saveProgress;
  }, [saveProgress]);

  // Listen to live settings changes using the persisted hook; this will react
  // to changes coming from the settings screen and notify the WebView.
  const { tts: liveReaderTts } = useChapterReaderSettings();

  useEffect(() => {
    if (liveReaderTts) {
      // Check if voice/rate/pitch actually changed
      const oldTts = readerSettingsRef.current.tts;
      const voiceChanged =
        oldTts?.voice?.identifier !== liveReaderTts.voice?.identifier;
      const rateChanged = oldTts?.rate !== liveReaderTts.rate;
      const pitchChanged = oldTts?.pitch !== liveReaderTts.pitch;
      const settingsChanged = voiceChanged || rateChanged || pitchChanged;

      // Update our ref so other listeners will use the latest settings
      readerSettingsRef.current = {
        ...readerSettingsRef.current,
        tts: liveReaderTts,
      } as any;
      applyTtsUpdateToWebView(liveReaderTts, webViewRef);

      // BUG 1 FIX: If TTS is actively reading and voice/rate/pitch changed,
      // restart playback from current position with new settings
      if (
        settingsChanged &&
        isTTSReadingRef.current &&
        currentParagraphIndexRef.current >= 0
      ) {
        console.log(
          'WebViewReader: TTS settings changed while playing, restarting with new settings',
        );

        // CRITICAL: Set restart flag BEFORE stopping to prevent onQueueEmpty from firing
        TTSHighlight.setRestartInProgress(true);

        // Stop current playback
        TTSHighlight.stop();

        // Get current paragraph index and restart
        const idx = currentParagraphIndexRef.current;
        const paragraphs = extractParagraphs(html);

        if (paragraphs && paragraphs.length > idx) {
          const remaining = paragraphs.slice(idx);
          const ids = remaining.map(
            (_, i) => `chapter_${chapter.id}_utterance_${idx + i}`,
          );

          // Update TTS queue ref
          ttsQueueRef.current = {
            texts: remaining,
            startIndex: idx,
          };

          // Start batch playback with new settings
          // NOTE: speakBatch will clear restartInProgress on success
          TTSHighlight.speakBatch(remaining, ids, {
            voice: liveReaderTts.voice?.identifier,
            pitch: liveReaderTts.pitch || 1,
            rate: liveReaderTts.rate || 1,
          })
            .then(() => {
              console.log(
                'WebViewReader: TTS restarted with new settings from index',
                idx,
              );
              isTTSReadingRef.current = true;
            })
            .catch(err => {
              console.error(
                'WebViewReader: Failed to restart TTS with new settings',
                err,
              );
              isTTSReadingRef.current = false;
              // Clear restart flag on failure too
              TTSHighlight.setRestartInProgress(false);
              // FIX Case 9.1: Notify user of TTS failure
              showToastMessage('TTS failed to restart. Please try again.');
            });
        } else {
          // No paragraphs available, clear the restart flag
          TTSHighlight.setRestartInProgress(false);
        }
      }
    }
  }, [liveReaderTts, webViewRef, html, chapter.id, showToastMessage]);

  // FIX: Keep navigation refs synced to prevent stale closures in onQueueEmpty
  useEffect(() => {
    nextChapterRef.current = nextChapter;
    navigateChapterRef.current = navigateChapter;
  }, [nextChapter, navigateChapter]);

  // NEW: Effect to handle background TTS next chapter navigation
  // When chapter changes AND we have a pending background TTS request,
  // extract paragraphs from HTML and start TTS directly from RN
  useEffect(() => {
    // Check if chapter actually changed
    if (chapter.id === prevChapterIdRef.current) {
      return;
    }

    console.log(
      `WebViewReader: Chapter changed from ${prevChapterIdRef.current} to ${chapter.id}`,
    );
    prevChapterIdRef.current = chapter.id;

    // Set grace period timestamp to ignore stale save events from old chapter
    chapterTransitionTimeRef.current = Date.now();

    // Instead of unconditionally resetting paragraph indexes to 0 (which can
    // race with native TTS events and cause the UI to jump to paragraph 0
    // after a background advance), initialise them from the most recent
    // persisted or TTS state we have available.
    const mmkvIndex =
      MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
    const dbIndex = savedParagraphIndex ?? -1;
    let ttsStateIndex = -1;
    try {
      ttsStateIndex = stableChapter.ttsState
        ? (JSON.parse(stableChapter.ttsState).paragraphIndex ?? -1)
        : -1;
    } catch {
      ttsStateIndex = -1;
    }

    const initialIndex = Math.max(dbIndex, mmkvIndex, ttsStateIndex, -1);

    // Use -1 to mark "unknown" — caller checks >= 0 before acting.
    currentParagraphIndexRef.current = initialIndex >= 0 ? initialIndex : -1;
    latestParagraphIndexRef.current = initialIndex >= 0 ? initialIndex : -1;

    // Clear the old TTS queue since we're on a new chapter.
    ttsQueueRef.current = null;

    // Check if we need to start TTS directly (background mode)
    if (backgroundTTSPendingRef.current && html) {
      console.log(
        'WebViewReader: Background TTS pending, starting directly from RN',
      );
      backgroundTTSPendingRef.current = false;

      // CRITICAL: Mark WebView as NOT synced - it still has old chapter's HTML
      // This prevents us from trying to inject JS into the wrong chapter context
      isWebViewSyncedRef.current = false;

      // Extract paragraphs from HTML
      const paragraphs = extractParagraphs(html);
      console.log(
        `WebViewReader: Extracted ${paragraphs.length} paragraphs for background TTS`,
      );

      if (paragraphs.length > 0) {
        // Check if we should force start from paragraph 0 (notification prev/next chapter)
        const forceStartFromZero = forceStartFromParagraphZeroRef.current;
        if (forceStartFromZero) {
          forceStartFromParagraphZeroRef.current = false; // Reset the flag
          console.log(
            'WebViewReader: Forcing start from paragraph 0 due to notification chapter navigation',
          );
        }

        // Start from paragraph 0 if forced, otherwise use any previously known index
        // (for example when background advance already progressed the native TTS inside
        // the new chapter). Otherwise start at 0.
        // FIX Case 1.1: Validate and clamp paragraph index to valid range
        const rawIndex = forceStartFromZero
          ? 0
          : (currentParagraphIndexRef.current ?? 0);
        const startIndex = validateAndClampParagraphIndex(
          Math.max(0, rawIndex),
          paragraphs.length,
          'background TTS start',
        );

        // Only queue the paragraphs that remain to be spoken starting at
        // startIndex — prevents restarting from 0 when we already progressed.
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

        // DON'T call stop() here - it would release the foreground service
        // which we can't restart from background in Android 12+
        // Just call speakBatch which will QUEUE_FLUSH the old items

        // Start batch TTS (this will flush old queue and start new one)
        // If there are no remaining paragraphs (e.g. we already reached the
        // end), don't call speakBatch. Otherwise dispatch the slice.
        if (textsToSpeak.length > 0) {
          TTSHighlight.speakBatch(textsToSpeak, utteranceIds, {
            voice: readerSettingsRef.current.tts?.voice?.identifier,
            pitch: readerSettingsRef.current.tts?.pitch || 1,
            rate: readerSettingsRef.current.tts?.rate || 1,
          })
            .then(() => {
              console.log(
                'WebViewReader: Background TTS batch started successfully',
              );
              // CRITICAL FIX: Ensure isTTSReadingRef is true so onQueueEmpty can trigger next chapter
              isTTSReadingRef.current = true;
            })
            .catch(err => {
              console.error('WebViewReader: Background TTS batch failed:', err);
              isTTSReadingRef.current = false;
              // FIX Case 9.1: Notify user of TTS failure
              showToastMessage('TTS failed to start. Please try again.');
            });
        } else {
          console.warn('WebViewReader: No paragraphs extracted from HTML');
          isTTSReadingRef.current = false;
        }
      }
    }
  }, [
    chapter.id,
    html,
    savedParagraphIndex,
    showToastMessage,
    stableChapter.ttsState,
  ]);

  const memoizedHTML = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html lang="en" style="background-color: ${readerSettings.theme}">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="${assetsUriPrefix}/css/index.css">
          <link rel="stylesheet" href="${assetsUriPrefix}/css/pageReader.css">
          <link rel="stylesheet" href="${assetsUriPrefix}/css/toolWrapper.css">
          <link rel="stylesheet" href="${assetsUriPrefix}/css/tts.css">
          <style>
            :root {
              --StatusBar-currentHeight: ${StatusBar.currentHeight}px;
              --readerSettings-theme: ${readerSettings.theme};
              --readerSettings-padding: ${readerSettings.padding}px;
              --readerSettings-textSize: ${readerSettings.textSize}px;
              --readerSettings-textColor: ${readerSettings.textColor};
              --readerSettings-textAlign: ${readerSettings.textAlign};
              --readerSettings-lineHeight: ${readerSettings.lineHeight};
              --readerSettings-fontFamily: ${readerSettings.fontFamily};
              --theme-primary: ${theme.primary};
              --theme-onPrimary: ${theme.onPrimary};
              --theme-secondary: ${theme.secondary};
              --theme-tertiary: ${theme.tertiary};
              --theme-onTertiary: ${theme.onTertiary};
              --theme-onSecondary: ${theme.onSecondary};
              --theme-surface: ${theme.surface};
              --theme-surface-0-9: ${color(theme.surface)
                .alpha(0.9)
                .toString()};
              --theme-onSurface: ${theme.onSurface};
              --theme-surfaceVariant: ${theme.surfaceVariant};
              --theme-onSurfaceVariant: ${theme.onSurfaceVariant};
              --theme-outline: ${theme.outline};
              --theme-rippleColor: ${theme.rippleColor};
            }
            @font-face {
              font-family: ${readerSettings.fontFamily};
              src: url("file:///android_asset/fonts/${
                readerSettings.fontFamily
              }.ttf");
            }
          </style>
          <link rel="stylesheet" href="${pluginCustomCSS}">
          <style>
            ${readerSettings.customCSS}
          </style>
        </head>
        <body class="${chapterGeneralSettings.pageReader ? 'page-reader' : ''}">
          <div class="transition-chapter" style="transform: translateX(0%);${
            chapterGeneralSettings.pageReader ? '' : 'display: none'
          }">
            ${stableChapter.name}
          </div>
          <div id="LNReader-chapter">
            ${html}
          </div>
          <div id="reader-ui"></div>
        </body>
        <script>
          var initialPageReaderConfig = ${JSON.stringify({
            nextChapterScreenVisible: false,
          })};


          var initialReaderConfig = ${JSON.stringify({
            readerSettings,
            chapterGeneralSettings,
            novel,
            chapter: stableChapter,
            nextChapter,
            prevChapter,
            batteryLevel,
            autoSaveInterval: 2222,
            DEBUG: __DEV__,
            strings: {
              finished: `${getString(
                'readerScreen.finished',
              )}: ${stableChapter.name.trim()}`,
              nextChapter: getString('readerScreen.nextChapter', {
                name: nextChapter?.name,
              }),
              noNextChapter: getString('readerScreen.noNextChapter'),
            },
            savedParagraphIndex: initialSavedParagraphIndex ?? -1,
            ttsRestoreState: stableChapter.ttsState
              ? JSON.parse(stableChapter.ttsState)
              : null,
            ttsButtonPosition: MMKVStorage.getString('tts_button_position')
              ? JSON.parse(MMKVStorage.getString('tts_button_position')!)
              : null,
          })}
        </script>
        <script src="${assetsUriPrefix}/js/polyfill-onscrollend.js"></script>
        <script src="${assetsUriPrefix}/js/icons.js"></script>
        <script src="${assetsUriPrefix}/js/van.js"></script>
        <script src="${assetsUriPrefix}/js/text-vibe.js"></script>
        <script src="${assetsUriPrefix}/js/core.js"></script>
        <script src="${assetsUriPrefix}/js/index.js"></script>
        <script src="${pluginCustomJS}"></script>
        <script>
          ${readerSettings.customJS}
        </script>
      </html>
    `;
  }, [
    readerSettings,
    chapterGeneralSettings,
    stableChapter,
    html,
    novel,
    nextChapter,
    prevChapter,
    batteryLevel,
    initialSavedParagraphIndex,
    pluginCustomCSS,
    pluginCustomJS,
    theme,
  ]);

  const resumeTTS = (storedState: any) => {
    webViewRef.current?.injectJavaScript(`
      window.tts.restoreState({ 
        shouldResume: true,
        paragraphIndex: ${storedState.paragraphIndex},
        autoStart: true
      });
      true;
    `);
  };

  const {
    value: resumeDialogVisible,
    setTrue: showResumeDialog,
    setFalse: hideResumeDialog,
  } = useBoolean();

  const {
    value: scrollSyncDialogVisible,
    setTrue: showScrollSyncDialog,
    setFalse: hideScrollSyncDialog,
  } = useBoolean();

  const {
    value: manualModeDialogVisible,
    setTrue: showManualModeDialog,
    setFalse: hideManualModeDialog,
  } = useBoolean();

  const pendingResumeIndexRef = useRef<number>(-1);
  const ttsScrollPromptDataRef = useRef<{
    currentIndex: number;
    visibleIndex: number;
    isResume?: boolean;
  } | null>(null);

  // NEW: TTS Queue for background playback
  const ttsQueueRef = useRef<{ startIndex: number; texts: string[] } | null>(
    null,
  );
  const currentParagraphIndexRef = useRef<number>(-1);
  const totalParagraphsRef = useRef<number>(0);
  // Ref for log throttling
  const lastStaleLogTimeRef = useRef<number>(0);

  const isTTSPausedRef = useRef<boolean>(false);

  const updateTtsMediaNotificationState = useCallback(
    (nextIsPlaying: boolean) => {
      try {
        const novelName = novel?.name ?? 'LNReader';
        // Use the original chapter name/title from the source
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
    [chapter.id, html, updateTtsMediaNotificationState],
  );

  useEffect(() => {
    if (html) {
      // Calculate total paragraphs for progress tracking
      const paragraphs = extractParagraphs(html);
      totalParagraphsRef.current = paragraphs?.length || 0;

      // Best-effort: keep notification progress in sync when total becomes known
      updateTtsMediaNotificationState(isTTSReadingRef.current);
    }
  }, [html, updateTtsMediaNotificationState]);

  /**
   * Track how many additional chapters have been auto-played in this TTS session.
   * This is used to enforce the ttsContinueToNextChapter limit (5, 10, or continuous).
   * Reset when user manually starts TTS or navigates to a different chapter.
   */
  const chaptersAutoPlayedRef = useRef<number>(0);

  const handleResumeConfirm = () => {
    // Always set both refs to the last read paragraph before resuming
    const mmkvValue =
      MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
    const refValue = latestParagraphIndexRef.current ?? -1;
    const savedIndex = pendingResumeIndexRef.current;
    // Pick the highest index as the last read paragraph
    const lastReadParagraph = Math.max(refValue, mmkvValue, savedIndex);
    // Ensure both refs are updated
    pendingResumeIndexRef.current = lastReadParagraph;
    latestParagraphIndexRef.current = lastReadParagraph;
    // Confirm resume dialog always appears (showResumeDialog is called on request-tts-confirmation)
    const ttsState = chapter.ttsState ? JSON.parse(chapter.ttsState) : {};
    if (__DEV__) {
      console.log(
        'WebViewReader: Resuming TTS. Resolved index:',
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
      autoStart: true,
      shouldResume: true,
    });
  };

  const handleResumeCancel = () => {
    // User said No, so we tell TTS to mark as "resumed" (skipped) and start normally
    webViewRef.current?.injectJavaScript(`
      window.tts.hasAutoResumed = true;
      window.tts.start();
    `);
  };

  const handleRestartChapter = () => {
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
  };

  const handleTTSScrollSyncConfirm = () => {
    if (ttsScrollPromptDataRef.current) {
      const { visibleIndex, isResume } = ttsScrollPromptDataRef.current;
      // Change TTS position to the visible paragraph
      webViewRef.current?.injectJavaScript(`
        if (window.tts && window.tts.changeParagraphPosition) {
          window.tts.changeParagraphPosition(${visibleIndex});
          ${isResume ? 'window.tts.resume(true);' : ''}
        }
        true;
      `);
    }
    ttsScrollPromptDataRef.current = null;
  };

  const handleTTSScrollSyncCancel = () => {
    if (ttsScrollPromptDataRef.current) {
      const { isResume } = ttsScrollPromptDataRef.current;
      if (isResume) {
        // User chose to resume from original position
        webViewRef.current?.injectJavaScript(`
          if (window.tts && window.tts.resume) {
            window.tts.resume(true);
          }
          true;
        `);
      }
    }
    ttsScrollPromptDataRef.current = null;
  };

  const handleStopTTS = () => {
    // Stop TTS and switch to manual reading mode - inform JavaScript first
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.handleManualModeDialog) {
        window.tts.handleManualModeDialog('stop');
      }
      true;
    `);
    // FIX: Mark as not playing BEFORE calling stop to prevent race condition with onQueueEmpty
    isTTSReadingRef.current = false;
    isTTSPlayingRef.current = false;
    hasUserScrolledRef.current = false;
    TTSHighlight.stop();
    showToastMessage('Switched to manual reading mode');
    hideManualModeDialog();
  };

  const handleContinueFollowing = () => {
    // Continue with TTS following mode - inform JavaScript to resume from locked position
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.handleManualModeDialog) {
        window.tts.handleManualModeDialog('continue');
      }
      true;
    `);
    hideManualModeDialog();
  };

  useEffect(() => {
    const onSpeechDoneSubscription = TTSHighlight.addListener(
      'onSpeechDone',
      () => {
        // BUG FIX: Block during wake transition to prevent stale events
        if (wakeTransitionInProgressRef.current) {
          console.log(
            'WebViewReader: onSpeechDone ignored during wake transition',
          );
          return;
        }

        // Try to play next from queue first (Background/Robust Mode)
        if (ttsQueueRef.current && currentParagraphIndexRef.current >= 0) {
          const currentIdx = currentParagraphIndexRef.current;
          const queueStartIndex = ttsQueueRef.current.startIndex;
          const queueEndIndex =
            queueStartIndex + ttsQueueRef.current.texts.length;

          // BUG FIX: Validate current index is within queue bounds
          // If currentIdx < queueStart, the queue is from a newer session.
          // In Unified Batch Mode, this shouldn't happen often, but if it does,
          // we should just log it and NOT defer to WebView, because RN is now the driver.
          if (currentIdx < queueStartIndex) {
            console.log(
              `WebViewReader: onSpeechDone - currentIdx ${currentIdx} < queueStart ${queueStartIndex}, ignoring event`,
            );
            return;
          }

          // BUG FIX: If currentIdx >= queueEnd, we've gone past the queue - need fresh queue
          if (currentIdx >= queueEndIndex) {
            console.log(
              `WebViewReader: onSpeechDone - currentIdx ${currentIdx} >= queueEnd ${queueEndIndex}, deferring to WebView for new queue`,
            );
            webViewRef.current?.injectJavaScript('tts.next?.()');
            return;
          }

          const nextIndex = currentIdx + 1;

          if (nextIndex >= queueStartIndex && nextIndex < queueEndIndex) {
            const text = ttsQueueRef.current.texts[nextIndex - queueStartIndex];
            console.log(
              'WebViewReader: Playing from queue. Index:',
              nextIndex,
              `(queue: ${queueStartIndex}-${queueEndIndex - 1})`,
            );

            // Update refs with monotonic enforcement (should always be going forward)
            if (nextIndex <= currentParagraphIndexRef.current) {
              console.warn(
                `WebViewReader: Index not advancing! next=${nextIndex}, current=${currentParagraphIndexRef.current}`,
              );
            }
            currentParagraphIndexRef.current = nextIndex;

            // Sync State (Critical for Resume/Pause)
            if (ttsStateRef.current) {
              ttsStateRef.current = {
                ...ttsStateRef.current,
                paragraphIndex: nextIndex,
                timestamp: Date.now(),
              };
            }

            // Persist Progress (Critical for App Kill/Restart)
            // FIX: Calculate percentage based on total paragraphs
            const total = totalParagraphsRef.current;
            const percentage =
              total > 0
                ? Math.round(((nextIndex + 1) / total) * 100)
                : (progressRef.current ?? 0);
            saveProgressRef.current(percentage, nextIndex);

            // Check if we've read 5 paragraphs after media navigation
            // If yes, mark the source chapter as 100% complete
            if (
              mediaNavSourceChapterIdRef.current &&
              nextIndex >= PARAGRAPHS_TO_CONFIRM_NAVIGATION
            ) {
              const sourceChapterId = mediaNavSourceChapterIdRef.current;
              console.log(
                `WebViewReader: 5 paragraphs reached after media navigation, marking chapter ${sourceChapterId} as 100% complete`,
              );
              // Mark source chapter as 100% complete in database (don't use saveProgressRef as it targets current chapter)
              updateChapterProgressDb(sourceChapterId, 100);
              // Clear the ref so we don't mark it again
              mediaNavSourceChapterIdRef.current = null;
            }

            // Keep media notification progress updated
            updateTtsMediaNotificationState(isTTSReadingRef.current);

            // In batch mode, we DO NOT call speak() here because the native queue
            // is already playing the next item. Calling speak() would flush the queue!
            // We only need to update the UI and state.
            if (!chapterGeneralSettingsRef.current.ttsBackgroundPlayback) {
              // Only manually speak next if NOT in background/batch mode
              // BUG FIX: Generate chapter-aware utterance ID to prevent stale processing
              // and ensure onSpeechStart/onWordRange can validate against prevChapterIdRef
              const currentChapterId = prevChapterIdRef.current;
              const nextUtteranceId = `chapter_${currentChapterId}_utterance_${nextIndex}`;

              TTSHighlight.speak(text, {
                voice: readerSettingsRef.current.tts?.voice?.identifier,
                pitch: readerSettingsRef.current.tts?.pitch || 1,
                rate: readerSettingsRef.current.tts?.rate || 1,
                utteranceId: nextUtteranceId,
              });
            }

            // Sync WebView UI & Logic (fire and forget)
            // Added 'true;' and console logs for debugging
            // CRITICAL: Pass chapter ID to prevent stale events from wrong chapter
            // CRITICAL: Only inject JS if WebView is synced with current chapter
            if (webViewRef.current && isWebViewSyncedRef.current) {
              const currentChapterId = prevChapterIdRef.current;
              webViewRef.current.injectJavaScript(`
                    try {
                        if (window.tts) {
                            console.log('TTS: Syncing state to index ${nextIndex}');
                            window.tts.highlightParagraph(${nextIndex}, ${currentChapterId});
                            window.tts.updateState(${nextIndex}, ${currentChapterId});
                        } else {
                            console.warn('TTS: window.tts not found during sync');
                        }
                    } catch (e) {
                        console.error('TTS: Error syncing state:', e);
                    }
                    true;
                `);
            } else if (!isWebViewSyncedRef.current) {
              // WebView is not synced (background mode) - skip injection but log
              // Log removed to reduce noise: Skipping WebView sync (background mode)
            } else {
              console.warn(
                'WebViewReader: webViewRef is null during queue playback',
              );
            }
            return;
          }
        }

        // Fallback to WebView driven (Foreground Mode)
        webViewRef.current?.injectJavaScript('tts.next?.()');
      },
    );

    // Listen for native word-range updates to drive in-page highlighting
    const rangeSubscription = TTSHighlight.addListener('onWordRange', event => {
      try {
        // BUG FIX: Block events during wake transition to prevent ref mutation/JS injection
        if (wakeTransitionInProgressRef.current) {
          // console.log('WebViewReader: Ignoring onWordRange during wake transition'); (spammy)
          return;
        }

        const utteranceId = event?.utteranceId || '';
        let paragraphIndex = currentParagraphIndexRef.current ?? -1;

        // Parse utterance ID - may be "chapter_123_utterance_5" or legacy "utterance_5"
        if (typeof utteranceId === 'string') {
          // Check for chapter-aware format first
          const chapterMatch = utteranceId.match(
            /chapter_(\d+)_utterance_(\d+)/,
          );
          if (chapterMatch) {
            const eventChapterId = Number(chapterMatch[1]);
            // CRITICAL: Ignore events from old chapters to prevent paragraph sync issues
            if (eventChapterId !== Number(prevChapterIdRef.current)) {
              const now = Date.now();
              if (now - lastStaleLogTimeRef.current > 1000) {
                console.log(
                  `WebViewReader: Ignoring stale onWordRange from chapter ${eventChapterId}, current is ${prevChapterIdRef.current}`,
                );
                lastStaleLogTimeRef.current = now;
              }
              return;
            }
            paragraphIndex = Number(chapterMatch[2]);
          } else {
            // Legacy format or events without explicit ID
            const m = utteranceId.match(/utterance_(\d+)/);
            if (m) paragraphIndex = Number(m[1]);
          }
        }

        const start = Number(event?.start) || 0;
        const end = Number(event?.end) || 0;

        // CRITICAL: Only inject JS if WebView is synced with current chapter
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
        // Skip logging for word range to reduce spam
      } catch (e) {
        console.warn('WebViewReader: onWordRange handler error', e);
      }
    });

    // Listen for utterance start to ensure paragraph highlight and state are synced
    const startSubscription = TTSHighlight.addListener(
      'onSpeechStart',
      event => {
        try {
          // BUG FIX: Block events during wake transition to prevent ref mutation
          // This prevents race conditions where late events update currentParagraphIndexRef
          // during the async pause/sync/resume sequence
          if (wakeTransitionInProgressRef.current) {
            console.log(
              'WebViewReader: Ignoring onSpeechStart during wake transition',
            );
            return;
          }

          const utteranceId = event?.utteranceId || '';
          let paragraphIndex = currentParagraphIndexRef.current ?? -1;

          // Parse utterance ID - may be "chapter_123_utterance_5" or legacy "utterance_5"
          if (typeof utteranceId === 'string') {
            // Check for chapter-aware format first
            const chapterMatch = utteranceId.match(
              /chapter_(\d+)_utterance_(\d+)/,
            );
            if (chapterMatch) {
              const eventChapterId = Number(chapterMatch[1]);
              // CRITICAL: Ignore events from old chapters to prevent paragraph sync issues
              if (eventChapterId !== Number(prevChapterIdRef.current)) {
                const now = Date.now();
                if (now - lastStaleLogTimeRef.current > 1000) {
                  console.log(
                    `WebViewReader: Ignoring stale onSpeechStart from chapter ${eventChapterId}, current is ${prevChapterIdRef.current}`,
                  );
                  lastStaleLogTimeRef.current = now;
                }
                return;
              }
              paragraphIndex = Number(chapterMatch[2]);
            } else {
              // Legacy format
              const m = utteranceId.match(/utterance_(\d+)/);
              if (m) paragraphIndex = Number(m[1]);
            }
          }

          // Update current index
          if (paragraphIndex >= 0) {
            currentParagraphIndexRef.current = paragraphIndex;
            // Native TTS is actively playing
            isTTSPlayingRef.current = true;
            // Clear manual scroll marker since TTS advanced position
            hasUserScrolledRef.current = false;
          }

          // Keep media notification progress updated
          updateTtsMediaNotificationState(isTTSReadingRef.current);

          // CRITICAL: Only inject JS if WebView is synced with current chapter
          if (
            webViewRef.current &&
            paragraphIndex >= 0 &&
            isWebViewSyncedRef.current
          ) {
            // CRITICAL: Pass chapter ID to prevent stale events from wrong chapter
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
          // Log periodically for background mode (every 10 paragraphs)
          if (!isWebViewSyncedRef.current && paragraphIndex % 10 === 0) {
            console.log(
              `WebViewReader: Background TTS progress - paragraph ${paragraphIndex}`,
            );
          }
        } catch (e) {
          console.warn('WebViewReader: onSpeechStart handler error', e);
        }
      },
    );

    const mediaActionSubscription = TTSHighlight.addListener(
      'onMediaAction',
      async event => {
        const action = String(event?.action || '');

        // FIX Bug 12.8: Debounce rapid media actions to prevent queue corruption
        const now = Date.now();
        if (now - lastMediaActionTimeRef.current < MEDIA_ACTION_DEBOUNCE_MS) {
          console.log(
            `WebViewReader: Media action debounced (${now - lastMediaActionTimeRef.current}ms < ${MEDIA_ACTION_DEBOUNCE_MS}ms)`,
          );
          return;
        }
        lastMediaActionTimeRef.current = now;

        try {
          // Always ensure we have latest notification state before acting
          updateTtsMediaNotificationState(isTTSReadingRef.current);

          if (action === 'com.rajarsheechatterjee.LNReader.TTS.PLAY_PAUSE') {
            if (isTTSReadingRef.current) {
              // Pause (MVP): stop audio but keep service/notification

              // FIX Bug 12.6: Save progress BEFORE pausing to prevent data loss if app is killed
              const idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
              const total = totalParagraphsRef.current;
              if (idx >= 0 && total > 0) {
                const percentage = Math.round(((idx + 1) / total) * 100);
                saveProgressRef.current(percentage, idx);
                console.log(
                  `WebViewReader: Saved progress before pause (paragraph ${idx}/${total}, ${percentage}%)`,
                );
              }

              // FIX Bug 12.1: Set grace period in WebView to prevent scroll saves from overwriting TTS position
              webViewRef.current?.injectJavaScript(`
                window.ttsLastStopTime = Date.now();
                if (window.tts) window.tts.reading = false;
              `);

              isTTSReadingRef.current = false;
              isTTSPlayingRef.current = false;
              isTTSPausedRef.current = true;
              await TTSHighlight.pause();
              updateTtsMediaNotificationState(false);
              return;
            }

            // Resume: prefer native TTS position if available and last TTS chapter matches.
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
                  `WebViewReader: Resuming from native saved TTS position ${nativePos} instead of current ${idx}`,
                );
                idx = nativePos;
              } else {
                // Fallback: use stable latest paragraph match
                idx = Math.max(idx, latestParagraphIndexRef.current ?? idx);
              }
            } catch (e) {
              console.warn(
                'WebViewReader: Failed to read native TTS position',
                e,
              );
            }

            // Finally restart TTS from resolved index
            await restartTtsFromParagraphIndex(idx);
            return;
          }

          if (action === 'com.rajarsheechatterjee.LNReader.TTS.SEEK_FORWARD') {
            const idx = Math.max(0, currentParagraphIndexRef.current ?? 0);
            const total = Math.max(0, totalParagraphsRef.current);
            const last = total > 0 ? total - 1 : idx;
            const target = Math.min(last, idx + 5);
            await restartTtsFromParagraphIndex(target);
            return;
          }

          if (action === 'com.rajarsheechatterjee.LNReader.TTS.PREV_CHAPTER') {
            if (!prevChapter) {
              showToastMessage('No previous chapter');
              return;
            }

            // User presses PREV: Start from paragraph 0 (fresh start for re-reading)
            // The previous chapter (current one before navigation) will be marked
            // as "in progress" after 5 paragraphs of the new chapter are read
            console.log(
              'WebViewReader: PREV_CHAPTER - starting from paragraph 0',
            );

            // Track the current chapter to mark as incomplete after navigation
            mediaNavSourceChapterIdRef.current = chapter.id;

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

          if (action === 'com.rajarsheechatterjee.LNReader.TTS.NEXT_CHAPTER') {
            if (!nextChapter) {
              showToastMessage('No next chapter');
              return;
            }

            // User presses NEXT: Start from paragraph 0 (fresh start)
            // After 5 paragraphs in new chapter, the source chapter will be marked as 100% complete
            console.log(
              'WebViewReader: NEXT_CHAPTER - starting from paragraph 0',
            );

            // Track the current chapter to mark as 100% complete after 5 paragraphs
            mediaNavSourceChapterIdRef.current = chapter.id;

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
          // Best-effort: avoid crashing if action handled during state transition
        }
      },
    );

    // Listen for native TTS queue becoming empty (all utterances spoken).
    // This fires when the screen is off and WebView JS can't drive the next chapter.
    // We use this to trigger chapter navigation from React Native side.
    const queueEmptySubscription = TTSHighlight.addListener(
      'onQueueEmpty',
      () => {
        console.log('WebViewReader: onQueueEmpty event received');

        // BUG FIX: Don't proceed if a restart operation is in progress
        // This prevents false chapter navigation during settings change restarts
        if (TTSHighlight.isRestartInProgress()) {
          console.log(
            'WebViewReader: Queue empty ignored - restart in progress',
          );
          return;
        }

        // BUG FIX: Don't proceed if a refill operation is in progress
        // This prevents premature chapter navigation when async refill is still running
        if (TTSHighlight.isRefillInProgress()) {
          console.log(
            'WebViewReader: Queue empty ignored - refill in progress',
          );
          return;
        }

        // BUG FIX: Don't proceed if TTSAudioManager still has items to queue
        // The native queue may be empty, but JS queue may have more paragraphs waiting
        if (TTSHighlight.hasRemainingItems()) {
          console.log(
            'WebViewReader: Queue empty ignored - TTSAudioManager still has items to queue',
          );
          // Note: TTSAudioManager's onQueueEmpty handler will trigger refillQueue() automatically
          return;
        }

        // Only proceed if TTS was actually reading (and thus chapter end is meaningful)
        if (!isTTSReadingRef.current) {
          console.log(
            'WebViewReader: Queue empty but TTS was not reading, ignoring',
          );
          return;
        }

        // Check the ttsContinueToNextChapter setting
        const continueMode =
          chapterGeneralSettingsRef.current.ttsContinueToNextChapter || 'none';
        console.log('WebViewReader: Queue empty - continueMode:', continueMode);

        if (continueMode === 'none') {
          console.log(
            'WebViewReader: ttsContinueToNextChapter is "none", stopping',
          );
          isTTSReadingRef.current = false;
          isTTSPlayingRef.current = false;
          return;
        }

        // Check chapter limit
        if (continueMode !== 'continuous') {
          const limit = parseInt(continueMode, 10);
          if (chaptersAutoPlayedRef.current >= limit) {
            console.log(
              `WebViewReader: Chapter limit (${limit}) reached, stopping`,
            );
            chaptersAutoPlayedRef.current = 0;
            isTTSReadingRef.current = false;
            isTTSPlayingRef.current = false;
            return;
          }
        }

        // If we have a next chapter, navigate to it
        // FIX: Use refs to get current values (avoid stale closure from empty deps)
        if (nextChapterRef.current) {
          console.log(
            'WebViewReader: Navigating to next chapter via onQueueEmpty',
          );

          // FIX: Mark current chapter as 100% complete before navigating
          // This ensures intermediate chapters read via TTS are marked as read
          saveProgressRef.current(100);

          autoStartTTSRef.current = true;
          // NEW: Set background TTS pending flag so we can start TTS directly from RN
          // when the new chapter HTML is loaded (in case WebView is suspended)
          backgroundTTSPendingRef.current = true;
          chaptersAutoPlayedRef.current += 1;
          nextChapterScreenVisible.current = true;
          navigateChapterRef.current('NEXT');
        } else {
          // FIX Case 8.2: Show novel finished notification
          console.log(
            'WebViewReader: No next chapter available - novel reading complete',
          );
          isTTSReadingRef.current = false;
          isTTSPlayingRef.current = false;
          showToastMessage('Novel reading complete!');
        }
      },
    );

    // FIX Case 7.2: Listen for voice fallback notifications
    const voiceFallbackSubscription = TTSHighlight.addListener(
      'onVoiceFallback',
      event => {
        console.log('WebViewReader: Voice fallback occurred', event);
        const originalVoice = event?.originalVoice || 'selected voice';
        const fallbackVoice = event?.fallbackVoice || 'system default';
        showToastMessage(
          `Voice "${originalVoice}" unavailable, using "${fallbackVoice}"`,
        );
      },
    );

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (nextAppState === 'background') {
          if (ttsStateRef.current?.wasPlaying) {
            console.log(
              'WebViewReader: Saving TTS state on background',
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

          // NEW: Stop TTS if background playback is disabled
          if (!chapterGeneralSettingsRef.current.ttsBackgroundPlayback) {
            console.log(
              'WebViewReader: Stopping TTS (Background Playback Disabled)',
            );
            TTSHighlight.stop();
            isTTSReadingRef.current = false;
          }
        } else if (nextAppState === 'active') {
          // SCREEN WAKE HANDLING: When screen wakes during background TTS,
          // pause native playback, sync the WebView to the current paragraph
          // position to prevent stale scrolling, then resume playback once
          // the UI has been positioned.
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
              'WebViewReader: Screen wake detected, capturing paragraph index:',
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
              // Pause may internally call stop — that's acceptable: we'll
              // requeue & resume from the correct index after the UI sync.
              TTSHighlight.pause()
                .then(() => {
                  console.log(
                    'WebViewReader: Paused native TTS on wake for UI sync',
                  );
                })
                .catch(e => {
                  console.warn('WebViewReader: Failed to pause TTS on wake', e);
                });

              // mark as not currently playing while UI sync runs
              isTTSReadingRef.current = false;
            } catch (e) {
              console.warn(
                'WebViewReader: Error while attempting to pause TTS',
                e,
              );
            }
            console.log(
              'WebViewReader: Screen woke during TTS, syncing to paragraph',
              capturedParagraphIndex,
              'WebView synced:',
              isWebViewSyncedRef.current,
            );

            // Check if WebView is synced with current chapter
            if (!isWebViewSyncedRef.current) {
              // CRITICAL FIX: WebView has old chapter's HTML and TTS may have advanced
              // to a different chapter. We MUST:
              // 1. Save the EXACT chapter ID and paragraph index at this moment
              // 2. STOP TTS completely (not just pause) to prevent further queue processing
              // 3. Navigate back to the correct chapter if needed on reload

              // BUG FIX: Use the captured paragraph index for out-of-sync case too
              const wakeChapterId = prevChapterIdRef.current;
              const wakeParagraphIdx =
                capturedWakeParagraphIndexRef.current ??
                currentParagraphIndexRef.current;

              console.log(
                'WebViewReader: WebView out of sync - STOPPING TTS and saving position:',
                `Chapter ${wakeChapterId}, Paragraph ${wakeParagraphIdx}`,
              );

              // Save wake position for verification on reload
              wakeChapterIdRef.current = wakeChapterId;
              wakeParagraphIndexRef.current = wakeParagraphIdx;

              // CRITICAL: STOP TTS completely to prevent onQueueEmpty from advancing chapters
              // This is different from pause() which allows the queue to continue

              // FIX: Mark as not playing BEFORE calling stop to prevent race condition with onQueueEmpty
              isTTSReadingRef.current = false;
              backgroundTTSPendingRef.current = false; // Don't auto-start on next chapter

              TTSHighlight.stop()
                .then(() => {
                  console.log(
                    'WebViewReader: TTS stopped on wake (out-of-sync) for safe resume',
                  );
                })
                .catch(e => {
                  console.warn('WebViewReader: Failed to stop TTS on wake', e);
                });

              // BUG FIX: Clear wake transition flags for out-of-sync case
              // They will be set again when pending screen wake sync runs after WebView reloads
              wakeTransitionInProgressRef.current = false;
              capturedWakeParagraphIndexRef.current = null;

              // Mark that we need to sync position after WebView reloads
              pendingScreenWakeSyncRef.current = true;
              return;
            }

            // BUG 3 FIX: IMMEDIATELY set blocking flag to prevent calculatePages from scrolling
            // This must happen BEFORE the 300ms timeout to win the race condition
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                try {
                  // Block calculatePages and any stale scroll operations
                  window.ttsScreenWakeSyncPending = true;
                  window.ttsOperationActive = true;
                  reader.suppressSaveOnScroll = true;
                  console.log('TTS: Screen wake - blocking scroll operations');
                } catch (e) {
                  console.error('TTS: Screen wake block failed', e);
                }
                true;
              `);
            }

            // Give WebView a moment to stabilize after screen wake
            setTimeout(() => {
              if (webViewRef.current) {
                // BUG FIX: Use the captured paragraph index from when wake was detected
                // This is immune to race conditions with onSpeechStart events
                const capturedIndex = capturedWakeParagraphIndexRef.current;

                // Also check MMKV as a secondary source
                const mmkvIndex =
                  MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
                const refIndex = currentParagraphIndexRef.current;

                // Priority: captured index > MMKV > current ref
                // The captured index is the most reliable because it was taken BEFORE pause
                let syncIndex: number;
                if (capturedIndex !== null && capturedIndex >= 0) {
                  syncIndex = capturedIndex;
                  console.log(
                    `WebViewReader: Using captured wake index: ${capturedIndex}`,
                  );
                } else if (mmkvIndex >= 0) {
                  syncIndex = mmkvIndex;
                  console.log(`WebViewReader: Using MMKV index: ${mmkvIndex}`);
                } else {
                  syncIndex = refIndex;
                  console.log(`WebViewReader: Using ref index: ${refIndex}`);
                }

                // Update refs to match the chosen sync index
                currentParagraphIndexRef.current = syncIndex;
                latestParagraphIndexRef.current = syncIndex;

                const chapterId = prevChapterIdRef.current;

                // Force sync WebView to current TTS position with chapter validation
                // This overrides any stale operations that might be pending
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
                        
                        // FIX: Reset scroll lock to allow immediate taps after sync
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
                  // BUG FIX: Clear the wake transition flag now that sync is complete
                  wakeTransitionInProgressRef.current = false;
                  capturedWakeParagraphIndexRef.current = null;

                  if (
                    autoResumeAfterWakeRef.current &&
                    isTTSReadingRef.current === false
                  ) {
                    // BUG FIX: Use the sync index we already computed, not re-reading
                    // The sync index was already set to currentParagraphIndexRef in the outer timeout
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

                          // BUG FIX: Update queue ref for the fresh batch
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
                                'WebViewReader: Resumed TTS after wake (RN-side) from index',
                                idx,
                              );
                              isTTSReadingRef.current = true;
                              // BUG FIX: Set grace period to ignore stale WebView queue messages
                              wakeResumeGracePeriodRef.current = Date.now();
                            })
                            .catch(err => {
                              console.error(
                                'WebViewReader: Failed to resume TTS after wake',
                                err,
                              );
                            });
                        }
                      } catch (e) {
                        console.warn(
                          'WebViewReader: Cannot resume TTS after wake (failed extract)',
                          e,
                        );
                      }
                    }

                    autoResumeAfterWakeRef.current = false;
                  }
                }, 900);
              }
            }, 300);
          }
        }
      },
    );

    return () => {
      onSpeechDoneSubscription.remove();
      rangeSubscription.remove();
      startSubscription.remove();
      mediaActionSubscription.remove();
      queueEmptySubscription.remove();
      voiceFallbackSubscription.remove(); // FIX Case 7.2
      appStateSubscription.remove();
      TTSHighlight.stop();
      if (ttsStateRef.current?.wasPlaying) {
        console.log(
          'WebViewReader: Saving TTS state on unmount',
          ttsStateRef.current,
        );
        saveProgressRef.current(
          progressRef.current ?? 0,
          undefined,
          JSON.stringify({
            ...ttsStateRef.current,
            timestamp: Date.now(),
            autoStartOnReturn: true,
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
  ]);

  useEffect(() => {
    const mmkvListener = MMKVStorage.addOnValueChangedListener(key => {
      switch (key) {
        case CHAPTER_READER_SETTINGS:
          webViewRef.current?.injectJavaScript(
            `reader.readerSettings.val = ${MMKVStorage.getString(
              CHAPTER_READER_SETTINGS,
            )}`,
          );
          break;
        case CHAPTER_GENERAL_SETTINGS:
          const newSettings = MMKVStorage.getString(CHAPTER_GENERAL_SETTINGS);
          console.log(
            'WebViewReader: MMKV listener fired for CHAPTER_GENERAL_SETTINGS',
            newSettings,
          );
          webViewRef.current?.injectJavaScript(
            `if (window.reader && window.reader.generalSettings) {
               window.reader.generalSettings.val = ${newSettings};
               console.log('TTS: Updated general settings via listener');
             }`,
          );
          break;
      }
    });

    // Safety: Inject current settings on mount to ensure WebView is in sync
    // even if useMemo was stale or listener missed something.
    const currentSettings = MMKVStorage.getString(CHAPTER_GENERAL_SETTINGS);
    if (currentSettings) {
      webViewRef.current?.injectJavaScript(
        `setTimeout(() => {
           if (window.reader && window.reader.generalSettings) {
             const current = window.reader.generalSettings.val;
             const fresh = ${currentSettings};
             
             // Helper to sort keys for deep comparison
             const sortKeys = (obj) => {
               if (typeof obj !== 'object' || obj === null) return obj;
               return Object.keys(obj).sort().reduce((acc, key) => {
                 acc[key] = sortKeys(obj[key]);
                 return acc;
               }, {});
             };

             const currentStr = JSON.stringify(sortKeys(current));
             const freshStr = JSON.stringify(sortKeys(fresh));
             
             // Only inject if different
             if (currentStr !== freshStr) {
               console.log('TTS: Settings changed, injecting. Current len: ' + currentStr.length + ', Fresh len: ' + freshStr.length);
               window.reader.generalSettings.val = fresh;
             } else {
               console.log('TTS: Settings in sync');
             }
           }
         }, 1000);`,
      );
    }

    const subscription = deviceInfoEmitter.addListener(
      'RNDeviceInfo_batteryLevelDidChange',
      (level: number) => {
        webViewRef.current?.injectJavaScript(
          `reader.batteryLevel.val = ${level}`,
        );
      },
    );
    return () => {
      subscription.remove();
      mmkvListener.remove();
    };
  }, [webViewRef]);

  // Handle Android Back Button to confirm exit if TTS is playing
  useBackHandler(() => {
    // Skip if dialogs already showing
    if (showExitDialog || showChapterSelectionDialog) {
      return false;
    }

    // CASE 1: TTS is ACTIVELY playing -> Use TTS position directly (no prompt)
    // This is the most common case - user just wants to exit while listening
    if (isTTSReadingRef.current) {
      const ttsPosition = currentParagraphIndexRef.current ?? 0;
      console.log(
        `WebViewReader: Back pressed while TTS playing. Saving TTS position: ${ttsPosition}`,
      );

      // Stop TTS gracefully
      handleStopTTS();

      // Save the TTS position
      saveProgress(ttsPosition);

      // Navigate back immediately
      navigation.goBack();
      return true;
    }

    // CASE 2: TTS is STOPPED but we had a TTS session in this chapter
    // Check if visible position differs significantly from last TTS position
    const lastTTSPosition = latestParagraphIndexRef.current ?? -1;

    // Only show dialog if we had a TTS session (lastTTSPosition > 0)
    if (lastTTSPosition > 0) {
      // Query WebView for visible position to compare
      webViewRef.current?.injectJavaScript(`
        (function() {
          const visible = window.reader.getVisibleElementIndex ? window.reader.getVisibleElementIndex() : 0;
          const ttsIndex = ${lastTTSPosition};
          const GAP_THRESHOLD = 5; // paragraphs
          const nonce = window.__LNREADER_NONCE__;
          
          // Only prompt if there's a significant gap
          if (Math.abs(visible - ttsIndex) > GAP_THRESHOLD) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'request-tts-exit', 
               data: { visible, ttsIndex },
               nonce,
            }));
          } else {
            // Gap is small - just save TTS position and allow back
            window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'save',
               data: Math.round((ttsIndex / (reader.getReadableElements()?.length || 1)) * 100),
               paragraphIndex: ttsIndex,
               chapterId: ${chapter.id},
               nonce,
            }));
            // Signal that we can exit
            window.ReactNativeWebView.postMessage(JSON.stringify({
               type: 'exit-allowed',
               nonce,
            }));
          }
        })();
        true;
      `);
      return true; // Block while we check
    }

    return false; // Let default back happen (no TTS session)
  });

  const handleRequestTTSConfirmation = async (savedIndex: number) => {
    // SMART RESUME FIX:
    // If the user has manually scrolled in this session (indicated by latestParagraphIndexRef being set and valid),
    // and that position is significantly different from the saved index, we assume the user intends to read
    // from their current position. In this case, we suppress the resume prompt.
    const currentRef = latestParagraphIndexRef.current;
    if (
      currentRef !== undefined &&
      currentRef >= 0 &&
      Math.abs(currentRef - savedIndex) > 5
    ) {
      console.log(
        `WebViewReader: Smart Resume - User manually scrolled to ${currentRef}. Ignoring saved index ${savedIndex}.`,
      );
      handleResumeCancel(); // Forces start from current position without prompt
      return;
    }

    // Logic: fetch all recent chapters with active progress (inc. possibly lastTTSChapterId if it's active)
    try {
      const conflicts = await getRecentReadingChapters(novel.id, 4);
      // Filter out current chapter from conflicts list (it's handled separately as 'Start Here')
      const relevantConflicts = conflicts.filter(c => c.id !== chapter.id);

      if (relevantConflicts.length > 0) {
        // Map to display format
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

    // Default behavior: Show standard resume dialog
    updateLastTTSChapter(chapter.id);
    pendingResumeIndexRef.current = savedIndex;
    showResumeDialog();
  };

  const handleSelectChapter = async (targetChapterId: number) => {
    setShowChapterSelectionDialog(false);

    if (targetChapterId === chapter.id) {
      // User chose "Current Chapter / Start Here"
      // Logic: Cleanup everything before this chapter
      if (chapter.position !== undefined) {
        await markChaptersBeforePositionRead(novel.id, chapter.position);
      }
      // Reset future logic (optional setting)
      const resetMode =
        chapterGeneralSettingsRef.current.ttsForwardChapterReset || 'none';
      if (resetMode !== 'none') {
        await resetFutureChaptersProgress(novel.id, chapter.id, resetMode);
        showToastMessage(`Future progress reset: ${resetMode}`);
      }

      // Commit to this chapter
      updateLastTTSChapter(chapter.id);

      if (pendingResumeIndexRef.current >= 0) {
        showResumeDialog();
      }
    } else {
      // User chose a different chapter (Resume that one)
      // Logic: Switch to that chapter, but ALSO clean up relative to IT.
      const targetChapter = await getChapterFromDb(targetChapterId);
      if (targetChapter) {
        // Cleanup before THAT chapter
        if (targetChapter.position !== undefined) {
          await markChaptersBeforePositionRead(
            novel.id,
            targetChapter.position,
          );
        }
        // Reset future AFTER that chapter (if configured) - essentially resetting current chapter
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
        getChapter(targetChapter); // Navigate
      }
    }
  };

  return (
    <>
      <WebView
        ref={webViewRef}
        style={{ backgroundColor: readerSettings.theme }}
        allowFileAccess={true}
        originWhitelist={READER_WEBVIEW_ORIGIN_WHITELIST}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        webviewDebuggingEnabled={__DEV__}
        onShouldStartLoadWithRequest={shouldAllowReaderWebViewRequest}
        injectedJavaScriptBeforeContentLoaded={`
          (function(){
            try { window.__LNREADER_NONCE__ = ${JSON.stringify(
              webViewNonceRef.current,
            )}; } catch (e) {}
          })();
          true;
        `}
        onLoadEnd={() => {
          // Update battery level when WebView finishes loading
          const currentBatteryLevel = getBatteryLevelSync();
          webViewRef.current?.injectJavaScript(
            `if (window.reader && window.reader.batteryLevel) {
              window.reader.batteryLevel.val = ${currentBatteryLevel};
            }`,
          );

          // Mark WebView as synced with current chapter
          isWebViewSyncedRef.current = true;

          // FIX Case 1.1: Log paragraph count for debugging sync issues
          const paragraphs = extractParagraphs(html);
          const totalParagraphs = paragraphs?.length ?? 0;
          if (__DEV__) {
            console.log(
              `WebViewReader: onLoadEnd - Chapter ${chapter.id} synced.`,
              `Total paragraphs: ${totalParagraphs},`,
              `Saved index: ${currentParagraphIndexRef.current}`,
            );
          }

          // If the chapter was loaded as part of background TTS navigation
          // we may need to resume a screen-wake sync or skip WebView-driven start
          if (backgroundTTSPendingRef.current) {
            if (__DEV__) {
              console.log(
                'WebViewReader: onLoadEnd skipped TTS start - background TTS pending',
              );
            }
            return;
          }

          // CRITICAL FIX: Handle pending screen-wake sync with chapter verification
          // When screen woke while TTS was playing in background, we saved the exact
          // chapter ID and paragraph index. Now we must verify we're on the correct chapter.
          if (pendingScreenWakeSyncRef.current) {
            pendingScreenWakeSyncRef.current = false;

            const savedWakeChapterId = wakeChapterIdRef.current;
            const savedWakeParagraphIdx = wakeParagraphIndexRef.current;
            const currentChapterId = chapter.id;

            if (__DEV__) {
              console.log(
                'WebViewReader: Processing pending screen-wake sync.',
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
                `WebViewReader: Chapter mismatch! TTS was at chapter ${savedWakeChapterId} but WebView loaded chapter ${currentChapterId}.`,
                'Attempting to navigate to correct chapter...',
              );

              // Check retry count to prevent infinite loops
              if (syncRetryCountRef.current >= MAX_SYNC_RETRIES) {
                console.error(
                  'WebViewReader: Max sync retries reached, showing failure dialog',
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
                    setSyncDialogInfo({
                      chapterName:
                        savedChapter?.name ??
                        `Chapter ID: ${savedWakeChapterId}`,
                      paragraphIndex: paragraphIdx,
                      totalParagraphs: totalParagraphs,
                      progress: progressPercent,
                    });
                    setSyncDialogStatus('failed');
                    setSyncDialogVisible(true);
                  })
                  .catch(() => {
                    setSyncDialogInfo({
                      chapterName: `Chapter ID: ${savedWakeChapterId}`,
                      paragraphIndex: paragraphIdx,
                      totalParagraphs: totalParagraphs,
                      progress: progressPercent,
                    });
                    setSyncDialogStatus('failed');
                    setSyncDialogVisible(true);
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
              setSyncDialogStatus('syncing');
              setSyncDialogVisible(true);
              syncRetryCountRef.current += 1;

              // Fetch the saved chapter info and navigate to it
              getChapterFromDb(savedWakeChapterId)
                .then(savedChapter => {
                  if (savedChapter) {
                    console.log(
                      `WebViewReader: Navigating to saved chapter: ${savedChapter.name}`,
                    );
                    // Keep wake refs intact so we can resume after navigation
                    // Set flag so we continue the sync process on next load
                    pendingScreenWakeSyncRef.current = true;
                    // Navigate to the correct chapter
                    getChapter(savedChapter);
                  } else {
                    console.error(
                      `WebViewReader: Could not find chapter ${savedWakeChapterId} in database`,
                    );
                    setSyncDialogStatus('failed');
                    setSyncDialogInfo({
                      chapterName: `Unknown Chapter (ID: ${savedWakeChapterId})`,
                      paragraphIndex: savedWakeParagraphIdx ?? 0,
                      totalParagraphs: 0,
                      progress: 0,
                    });
                    // Clear refs
                    wakeChapterIdRef.current = null;
                    wakeParagraphIndexRef.current = null;
                    autoResumeAfterWakeRef.current = false;
                    wasReadingBeforeWakeRef.current = false;
                    syncRetryCountRef.current = 0;
                  }
                })
                .catch(err => {
                  console.error(
                    'WebViewReader: Failed to fetch saved chapter',
                    err,
                  );
                  setSyncDialogStatus('failed');
                  // Clear refs
                  wakeChapterIdRef.current = null;
                  wakeParagraphIndexRef.current = null;
                  autoResumeAfterWakeRef.current = false;
                  wasReadingBeforeWakeRef.current = false;
                  syncRetryCountRef.current = 0;
                });

              return;
            }

            // Chapter matches! Now we can safely sync and resume.
            // Reset retry counter on success
            syncRetryCountRef.current = 0;

            // Hide sync dialog if it was showing
            if (syncDialogVisible) {
              setSyncDialogStatus('success');
              // Auto-hide after a short delay
              setTimeout(() => setSyncDialogVisible(false), 1500);
            }
            const syncIndex =
              savedWakeParagraphIdx ?? currentParagraphIndexRef.current ?? 0;
            const chapterId = currentChapterId;

            console.log(
              `WebViewReader: Chapter verified, syncing to paragraph ${syncIndex}`,
            );

            // Clear wake refs
            wakeChapterIdRef.current = null;
            wakeParagraphIndexRef.current = null;

            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                try {
                  if (window.tts) {
                    console.log('TTS: Pending screen wake sync to index ${syncIndex}');
                    window.tts.isBackgroundPlaybackActive = true;
                    window.tts.reading = true;
                    window.tts.hasAutoResumed = true;
                    window.tts.started = true;

                    const readableElements = reader.getReadableElements();
                    if (readableElements && readableElements[${syncIndex}]) {
                      window.tts.currentElement = readableElements[${syncIndex}];
                      window.tts.prevElement = ${syncIndex} > 0 ? readableElements[${syncIndex} - 1] : null;
                      window.tts.scrollToElement(window.tts.currentElement);
                      
                      // FIX: Reset scroll lock to allow immediate taps after sync
                      setTimeout(() => { window.tts.resetScrollLock(); }, 600);
                      
                      window.tts.highlightParagraph(${syncIndex}, ${chapterId});
                      console.log('TTS: Pending screen wake sync complete - scrolled to paragraph ${syncIndex}');
                    } else {
                      console.warn('TTS: Pending screen wake - paragraph ${syncIndex} not found');
                    }
                  }
                } catch (e) {
                  console.error('TTS: Pending screen wake sync failed', e);
                }
                true;
              `);

              // Resume TTS playback from the verified position
              if (
                wasReadingBeforeWakeRef.current ||
                autoResumeAfterWakeRef.current
              ) {
                setTimeout(() => {
                  try {
                    const wakeParagraphs = extractParagraphs(html);
                    // FIX Case 1.1: Validate and clamp paragraph index to valid range
                    const validSyncIndex = validateAndClampParagraphIndex(
                      syncIndex,
                      wakeParagraphs?.length ?? 0,
                      'screen-wake TTS resume',
                    );

                    if (wakeParagraphs && wakeParagraphs.length > 0) {
                      const remaining = wakeParagraphs.slice(validSyncIndex);
                      const ids = remaining.map(
                        (_, i) =>
                          `chapter_${chapterId}_utterance_${
                            validSyncIndex + i
                          }`,
                      );

                      currentParagraphIndexRef.current = validSyncIndex;
                      latestParagraphIndexRef.current = validSyncIndex;

                      TTSHighlight.speakBatch(remaining, ids, {
                        voice: readerSettingsRef.current.tts?.voice?.identifier,
                        pitch: readerSettingsRef.current.tts?.pitch || 1,
                        rate: readerSettingsRef.current.tts?.rate || 1,
                      })
                        .then(() => {
                          console.log(
                            `WebViewReader: Resumed TTS after wake from chapter ${chapterId}, paragraph ${validSyncIndex}`,
                          );
                          isTTSReadingRef.current = true;
                        })
                        .catch(err => {
                          console.error(
                            'WebViewReader: Failed to resume TTS after wake',
                            err,
                          );
                        });
                    }
                  } catch (e) {
                    console.warn(
                      'WebViewReader: Cannot resume TTS after wake (failed extract)',
                      e,
                    );
                  }

                  autoResumeAfterWakeRef.current = false;
                  wasReadingBeforeWakeRef.current = false;
                }, 500);
              }
            }
            return; // Don't process autoStartTTSRef when handling wake sync
          }

          if (autoStartTTSRef.current) {
            autoStartTTSRef.current = false;
            const startFromZero = forceStartFromParagraphZeroRef.current;
            forceStartFromParagraphZeroRef.current = false; // Reset the flag

            setTimeout(() => {
              if (startFromZero) {
                // Force start from paragraph 0 (notification chapter nav)
                webViewRef.current?.injectJavaScript(`
                  (function() {
                    if (window.tts && reader.generalSettings.val.TTSEnable) {
                      setTimeout(() => {
                        // Use restoreState to start from paragraph 0
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
                // Normal auto-start (uses saved position)
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
        }}
        onMessage={(ev: { nativeEvent: { data: string } }) => {
          if (!allowMessageRef.current(Date.now())) {
            return;
          }

          const msg = parseWebViewMessage<string, unknown>(
            ev.nativeEvent.data,
            [
              'save',
              'request-tts-exit',
              'exit-allowed',
              'tts-update-settings',
              'hide',
              'next',
              'prev',
              'scroll-to',
              'log',
              // TTS-related message types
              'speak',
              'stop-speak',
              'tts-state',
              'request-tts-confirmation',
              'tts-scroll-prompt',
              'tts-manual-mode-prompt',
              'tts-apply-settings',
              'save-tts-position',
              'show-toast',
              'console',
            ] as const,
          );
          if (!msg || msg.nonce !== webViewNonceRef.current) {
            return;
          }

          __DEV__ && onLogMessage(ev);
          const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);

          switch (event.type) {
            case 'tts-update-settings': {
              if (event.data) {
                applyTtsUpdateToWebView(event.data, webViewRef);
              }
              break;
            }
            case 'hide':
              onPress();
              break;
            case 'next':
              nextChapterScreenVisible.current = true;
              if (event.autoStartTTS) {
                // Check if we should continue to next chapter based on setting
                const continueMode =
                  chapterGeneralSettingsRef.current.ttsContinueToNextChapter ||
                  'none';

                if (continueMode === 'none') {
                  // User chose to stop at end of chapter - don't auto-start TTS
                  autoStartTTSRef.current = false;
                  chaptersAutoPlayedRef.current = 0; // Reset counter
                } else if (continueMode === 'continuous') {
                  // Unlimited continuation
                  autoStartTTSRef.current = true;
                  chaptersAutoPlayedRef.current += 1;
                } else {
                  // Limited continuation (5 or 10 chapters)
                  const limit = parseInt(continueMode, 10);
                  if (chaptersAutoPlayedRef.current < limit) {
                    autoStartTTSRef.current = true;
                    chaptersAutoPlayedRef.current += 1;
                  } else {
                    // Limit reached - stop auto-continue
                    autoStartTTSRef.current = false;
                    chaptersAutoPlayedRef.current = 0; // Reset counter
                  }
                }
              }
              navigateChapter('NEXT');
              break;
            case 'prev':
              // Reset auto-play counter when user manually navigates
              chaptersAutoPlayedRef.current = 0;
              navigateChapter('PREV');
              break;
            case 'save':
              if (event.data && typeof event.data === 'number') {
                // CRITICAL: Validate chapterId to prevent stale save events from old chapter
                // corrupting new chapter's progress during transitions
                const GRACE_PERIOD_MS = 1000; // 1 second grace period after chapter change
                const timeSinceTransition =
                  Date.now() - chapterTransitionTimeRef.current;

                if (
                  event.chapterId !== undefined &&
                  event.chapterId !== chapter.id
                ) {
                  const now = Date.now();
                  if (now - lastStaleLogTimeRef.current > 1000) {
                    console.log(
                      `WebViewReader: Ignoring stale save event from chapter ${event.chapterId}, current is ${chapter.id}`,
                    );
                    lastStaleLogTimeRef.current = now;
                  }
                  break;
                }

                // BUG FIX: When TTS is actively reading, only accept saves from TTS itself
                // (identified by having a valid paragraphIndex). Scroll-based saves should be blocked.
                // This ensures TTS is the single source of truth for progress during playback.
                if (isTTSReadingRef.current) {
                  // TTS is reading - only allow saves that came from TTS (via tts-state or direct paragraph save)
                  // Scroll-based saves from core.js don't have ttsSource flag, so they'll be blocked
                  if (event.paragraphIndex === undefined) {
                    console.log(
                      'WebViewReader: Ignoring non-TTS save while TTS is reading',
                    );
                    break;
                  }
                  // If paragraph is going BACKWARDS, it's likely a scroll-based save trying to override TTS
                  const currentIdx = currentParagraphIndexRef.current ?? -1;
                  if (
                    typeof event.paragraphIndex === 'number' &&
                    currentIdx >= 0 &&
                    event.paragraphIndex < currentIdx - 1
                  ) {
                    console.log(
                      `WebViewReader: Ignoring backwards save (${event.paragraphIndex}) while TTS at ${currentIdx}`,
                    );
                    break;
                  }
                }

                // During the grace period, we should ignore legacy saves without
                // chapterId (old WebView) — and also avoid accepting early
                // save events that would overwrite recently-known TTS progress
                // (e.g. the WebView may send a default 0 index on load).
                if (timeSinceTransition < GRACE_PERIOD_MS) {
                  if (event.chapterId === undefined) {
                    console.log(
                      `WebViewReader: Ignoring save event without chapterId during grace period (${timeSinceTransition}ms)`,
                    );
                    break;
                  }

                  // If the event explicitly includes a paragraphIndex but that
                  // index is older/behind our current TTS progress (or is the
                  // initial 0) then ignore it to avoid clobbering the correct
                  // position written by the native TTS playback.
                  const incomingIdx =
                    typeof event.paragraphIndex === 'number'
                      ? event.paragraphIndex
                      : -1;
                  const currentIdx = currentParagraphIndexRef.current ?? -1;
                  const latestIdx = latestParagraphIndexRef.current ?? -1;

                  if (incomingIdx >= 0) {
                    // If incoming progress is strictly less than our last known
                    // progress, treat it as stale and ignore it.
                    if (latestIdx >= 0 && incomingIdx < latestIdx) {
                      console.log(
                        `WebViewReader: Ignoring early/stale save event (incoming=${incomingIdx} vs latest=${latestIdx})`,
                      );
                      break;
                    }

                    // Some WebView instances emit 0 as an initial save; if we
                    // already have a positive index for this chapter ignore the 0.
                    if (
                      incomingIdx === 0 &&
                      Math.max(currentIdx, latestIdx) > 0
                    ) {
                      console.log(
                        'WebViewReader: Ignoring initial 0 save during grace period',
                      );
                      break;
                    }
                  }
                }

                console.log(
                  'WebViewReader: Received save event. Progress:',
                  event.data,
                  'Paragraph:',
                  event.paragraphIndex,
                );
                // NEW: Track latest paragraph index
                if (event.paragraphIndex !== undefined) {
                  latestParagraphIndexRef.current = event.paragraphIndex;
                  // If TTS is not currently reading and not playing, this likely came from a manual scroll
                  if (!isTTSReadingRef.current && !isTTSPlayingRef.current) {
                    hasUserScrolledRef.current = true;
                  } else {
                    // TTS is updating the position, this is not a manual scroll
                    hasUserScrolledRef.current = false;
                  }

                  MMKVStorage.set(
                    `chapter_progress_${chapter.id}`,
                    event.paragraphIndex,
                  );
                }
                saveProgress(
                  event.data,
                  event.paragraphIndex as number | undefined,
                );
              }
              break;
            case 'speak':
              // BUG FIX: Block 'speak' requests during wake transition
              // The native side handles resume logic; allowing WebView to drive speak
              // here would cause race conditions and potentially resume with stale state.
              if (wakeTransitionInProgressRef.current) {
                console.log(
                  'WebViewReader: Ignoring speak request during wake transition',
                );
                break;
              }

              if (event.data && typeof event.data === 'string') {
                if (!isTTSReadingRef.current) {
                  isTTSReadingRef.current = true;
                }
                // Clear manual scroll flag when TTS starts from WebView
                hasUserScrolledRef.current = false;
                // Use chapter_N_utterance_N format so event handlers can validate chapter
                const paragraphIdx =
                  typeof event.paragraphIndex === 'number'
                    ? event.paragraphIndex
                    : currentParagraphIndexRef.current;
                const utteranceId =
                  paragraphIdx >= 0
                    ? `chapter_${chapter.id}_utterance_${paragraphIdx}`
                    : undefined;

                // Update current index
                if (paragraphIdx >= 0) {
                  currentParagraphIndexRef.current = paragraphIdx;
                }

                // UNIFIED BATCH MODE: Always use speakBatch to ensure queue consistency
                // This resolves sync issues where the foreground (single) references drift from
                // the background (queue) references.

                const textToSpeak = event.data as string;

                // 1. Extract paragraphs
                let paragraphs: string[] = [];
                try {
                  paragraphs = extractParagraphs(html);
                } catch (e) {
                  console.error(
                    'WebViewReader: Failed to extract paragraphs for batch start',
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
                    `WebViewReader: Starting Unified Batch from index ${paragraphIdx}`,
                  );

                  const remaining = paragraphs.slice(paragraphIdx);
                  const ids = remaining.map(
                    (_, i) =>
                      `chapter_${chapter.id}_utterance_${paragraphIdx + i}`,
                  );

                  // Update Queue Ref IMMEDIATELY to prevent race conditions
                  ttsQueueRef.current = {
                    startIndex: paragraphIdx,
                    texts: remaining,
                  };
                  currentParagraphIndexRef.current = paragraphIdx;

                  // Start Batch Playback
                  TTSHighlight.speakBatch(remaining, ids, {
                    voice: readerSettingsRef.current.tts?.voice?.identifier,
                    pitch: readerSettingsRef.current.tts?.pitch || 1,
                    rate: readerSettingsRef.current.tts?.rate || 1,
                  }).catch(err => {
                    console.error(
                      'WebViewReader: Failed to start Unified Batch',
                      err,
                    );
                    // Fallback to single speak if batch fails (unlikely)
                    TTSHighlight.speak(textToSpeak, {
                      voice: readerSettingsRef.current.tts?.voice?.identifier,
                      pitch: readerSettingsRef.current.tts?.pitch || 1,
                      rate: readerSettingsRef.current.tts?.rate || 1,
                      utteranceId,
                    });
                  });
                } else {
                  // Fallback for edge cases (invalid index or extraction failed)
                  console.warn(
                    'WebViewReader: Cannot start batch (invalid params), falling back to single speak',
                  );
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
              break;
            case 'stop-speak':
              TTSHighlight.fullStop();
              isTTSReadingRef.current = false;
              break;
            case 'tts-state':
              if (
                event.data &&
                !Array.isArray(event.data) &&
                typeof event.data === 'object'
              ) {
                ttsStateRef.current = event.data;
                if (typeof event.data.paragraphIndex === 'number') {
                  currentParagraphIndexRef.current = event.data.paragraphIndex;
                }
              }
              break;
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
              break;
            case 'exit-allowed':
              // User pressed back, positions are close - exit immediately
              navigation.goBack();
              break;
            case 'request-tts-confirmation':
              handleRequestTTSConfirmation(
                Number((event.data as any)?.savedIndex || 0),
              );
              break;
            case 'tts-scroll-prompt':
              if (
                event.data &&
                !Array.isArray(event.data) &&
                event.data.currentIndex !== undefined &&
                event.data.visibleIndex !== undefined
              ) {
                ttsScrollPromptDataRef.current = {
                  currentIndex: Number(event.data.currentIndex),
                  visibleIndex: Number(event.data.visibleIndex),
                };
                showScrollSyncDialog();
              }
              break;
            case 'tts-manual-mode-prompt':
              showManualModeDialog();
              break;
            case 'tts-resume-location-prompt':
              if (
                event.data &&
                !Array.isArray(event.data) &&
                event.data.currentIndex !== undefined &&
                event.data.visibleIndex !== undefined
              ) {
                ttsScrollPromptDataRef.current = {
                  currentIndex: Number(event.data.currentIndex),
                  visibleIndex: Number(event.data.visibleIndex),
                  isResume: true, // Mark as resume prompt
                };
                showScrollSyncDialog();
              }
              break;
            case 'show-toast':
              if (event.data && typeof event.data === 'string') {
                showToastMessage(event.data);
              }
              break;
            case 'tts-queue':
              if (
                event.data &&
                Array.isArray(event.data) &&
                typeof event.startIndex === 'number'
              ) {
                const incomingStart = event.startIndex;
                const currentIdx = currentParagraphIndexRef.current;

                // BUG FIX: Wake resume grace period - ignore queue updates right after wake
                // This prevents stale WebView queues from overwriting the fresh batch started by wake resume
                const timeSinceWakeResume =
                  Date.now() - wakeResumeGracePeriodRef.current;
                if (
                  timeSinceWakeResume < 500 &&
                  wakeResumeGracePeriodRef.current > 0
                ) {
                  console.log(
                    `WebViewReader: Ignoring tts-queue during wake grace period (${timeSinceWakeResume}ms)`,
                  );
                  break;
                }

                // UNIFIED BATCH MODE FIX: Ignore tts-queue messages if we are already playing a batch
                // that covers this range. This prevents redundant addToBatch calls that might cause duplicates.
                if (
                  isTTSReadingRef.current &&
                  ttsQueueRef.current &&
                  ttsQueueRef.current.startIndex <= incomingStart
                ) {
                  console.log(
                    `WebViewReader: Ignoring redundant tts-queue (incoming=${incomingStart} covered by active extracted batch start=${ttsQueueRef.current.startIndex})`,
                  );
                  break;
                }

                // BUG FIX: Validate incoming queue against current TTS position
                // If incoming queue starts BEFORE our current position, it's stale - IGNORE
                if (currentIdx >= 0 && incomingStart < currentIdx) {
                  console.log(
                    `WebViewReader: Ignoring stale tts-queue (starts at ${incomingStart}, currently at ${currentIdx})`,
                  );
                  break;
                }

                // If incoming queue starts MORE THAN 1 ahead, something is wrong - LOG but accept
                if (currentIdx >= 0 && incomingStart > currentIdx + 1) {
                  console.warn(
                    `WebViewReader: tts-queue gap detected (starts at ${incomingStart}, currently at ${currentIdx})`,
                  );
                }

                console.log(
                  `WebViewReader: Accepting tts-queue from ${incomingStart} (current: ${currentIdx})`,
                );
                ttsQueueRef.current = {
                  startIndex: event.startIndex,
                  texts: event.data as string[],
                };

                // Use batch TTS for background playback
                // BUG 2 FIX: Use addToBatch instead of speakBatch when queue is received
                // The first paragraph was already queued via the 'speak' event which uses QUEUE_FLUSH.
                // If we call speakBatch here, it would QUEUE_FLUSH again, clearing the first paragraph.
                // Instead, we use addToBatch to ADD remaining paragraphs to the queue.
                if (
                  chapterGeneralSettings.ttsBackgroundPlayback &&
                  event.data.length > 0 &&
                  typeof event.startIndex === 'number'
                ) {
                  const startIndex = event.startIndex;
                  // Include chapter ID in utterance IDs to prevent stale event processing
                  const utteranceIds = (event.data as string[]).map(
                    (_, i) =>
                      `chapter_${chapter.id}_utterance_${startIndex + i}`,
                  );

                  console.log(
                    `WebViewReader: Adding ${event.data.length} paragraphs to TTS queue from index ${startIndex}`,
                  );

                  // Use addToBatch to preserve the currently playing utterance
                  const addToBatchWithRetry = async (
                    texts: string[],
                    ids: string[],
                  ) => {
                    const maxAttempts = 3;
                    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                      try {
                        console.log(
                          `WebViewReader: addToBatch attempt ${attempt} startIndex=${startIndex} count=${texts.length}`,
                        );
                        await TTSHighlight.addToBatch(texts, ids);
                        console.log('WebViewReader: addToBatch succeeded');
                        return true;
                      } catch (err) {
                        console.error(
                          `WebViewReader: addToBatch failed (attempt ${attempt}):`,
                          err,
                        );
                        if (attempt < maxAttempts) {
                          await new Promise(r => setTimeout(r, 150 * attempt));
                        }
                      }
                    }
                    return false;
                  };

                  addToBatchWithRetry(
                    event.data as string[],
                    utteranceIds,
                  ).then(success => {
                    if (!success) {
                      console.error(
                        'WebViewReader: Add to batch failed after retries. Falling back to WebView-driven TTS',
                      );
                      // Fallback to WebView-driven TTS
                      webViewRef.current?.injectJavaScript('tts.next?.()');
                    }
                  });
                }
              }
              break;

            case 'save-tts-position':
              if (event.data && typeof event.data === 'object') {
                MMKVStorage.set(
                  'tts_button_position',
                  JSON.stringify(event.data),
                );
              }
              break;
            case 'tts-update-settings':
            case 'tts-apply-settings':
              // Handle live TTS settings updates from WebView
              if (
                event.data &&
                typeof event.data === 'object' &&
                !Array.isArray(event.data)
              ) {
                const ttsData = event.data as {
                  rate?: number;
                  pitch?: number;
                  voice?: string;
                  enabled?: boolean;
                  showParagraphHighlight?: boolean;
                };
                console.log(
                  'WebViewReader: Received TTS settings update:',
                  ttsData,
                );

                // Update the refs so future speak() calls use new params
                if (
                  ttsData.rate !== undefined ||
                  ttsData.pitch !== undefined ||
                  ttsData.voice !== undefined
                ) {
                  const currentTTS = readerSettingsRef.current.tts || {};
                  const currentVoice = currentTTS.voice;

                  readerSettingsRef.current = {
                    ...readerSettingsRef.current,
                    tts: {
                      ...currentTTS,
                      rate: ttsData.rate ?? currentTTS.rate,
                      pitch: ttsData.pitch ?? currentTTS.pitch,
                      // Only update voice if we have a valid current voice to spread from
                      voice:
                        ttsData.voice !== undefined && currentVoice
                          ? { ...currentVoice, identifier: ttsData.voice }
                          : currentVoice,
                    },
                  };
                }

                // Update general settings ref
                if (
                  ttsData.enabled !== undefined ||
                  ttsData.showParagraphHighlight !== undefined
                ) {
                  chapterGeneralSettingsRef.current = {
                    ...chapterGeneralSettingsRef.current,
                    TTSEnable:
                      ttsData.enabled ??
                      chapterGeneralSettingsRef.current.TTSEnable,
                    showParagraphHighlight:
                      ttsData.showParagraphHighlight ??
                      chapterGeneralSettingsRef.current.showParagraphHighlight,
                  };
                }

                // Note: For background/batch TTS, rate/pitch/voice changes will apply
                // on next paragraph or when TTS restarts. The native TTS engine doesn't
                // support changing parameters mid-utterance.
              }
              break;
          }
        }}
        source={{
          baseUrl: !chapter.isDownloaded ? plugin?.site : undefined,
          html: memoizedHTML,
        }}
      />
      <TTSChapterSelectionDialog
        visible={showChapterSelectionDialog}
        theme={theme}
        conflictingChapters={conflictingChapters}
        currentChapter={{
          id: chapter.id,
          name: chapter.name,
          paragraph: pendingResumeIndexRef.current,
        }}
        onSelectChapter={handleSelectChapter}
        onDismiss={() => setShowChapterSelectionDialog(false)}
      />
      <TTSExitDialog
        visible={showExitDialog}
        theme={theme}
        ttsParagraph={exitDialogData.ttsParagraph}
        readerParagraph={exitDialogData.readerParagraph}
        onExitTTS={() => {
          setShowExitDialog(false);
          // Stop TTS
          handleStopTTS();
          // Save at TTS position
          saveProgress(exitDialogData.ttsParagraph);
          // Navigate back
          navigation.goBack();
        }}
        onExitReader={() => {
          setShowExitDialog(false);
          // Stop TTS
          handleStopTTS();
          // Save at Reader position
          saveProgress(exitDialogData.readerParagraph);
          // Navigate back
          navigation.goBack();
        }}
        onCancel={() => setShowExitDialog(false)}
      />
      <TTSResumeDialog
        visible={resumeDialogVisible}
        theme={theme}
        onResume={handleResumeConfirm}
        onRestart={handleResumeCancel}
        onRestartChapter={handleRestartChapter}
        onDismiss={hideResumeDialog}
      />
      <TTSScrollSyncDialog
        visible={scrollSyncDialogVisible}
        theme={theme}
        currentIndex={ttsScrollPromptDataRef.current?.currentIndex || 0}
        visibleIndex={ttsScrollPromptDataRef.current?.visibleIndex || 0}
        onSyncToVisible={handleTTSScrollSyncConfirm}
        onKeepCurrent={handleTTSScrollSyncCancel}
        onDismiss={hideScrollSyncDialog}
      />
      <TTSManualModeDialog
        visible={manualModeDialogVisible}
        theme={theme}
        onStopTTS={handleStopTTS}
        onContinueFollowing={handleContinueFollowing}
        onDismiss={hideManualModeDialog}
      />
      <TTSSyncDialog
        visible={syncDialogVisible}
        theme={theme}
        status={syncDialogStatus}
        syncInfo={syncDialogInfo}
        onDismiss={() => {
          setSyncDialogVisible(false);
          syncRetryCountRef.current = 0;
        }}
        onRetry={() => {
          // Reset and try again
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
        }}
      />
      <Toast
        visible={toastVisible}
        message={toastMessageRef.current}
        theme={theme}
        onHide={hideToast}
      />
    </>
  );
};

export default memo(WebViewReader);
