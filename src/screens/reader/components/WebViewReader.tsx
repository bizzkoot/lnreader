import React, { memo, useEffect, useMemo, useRef } from 'react';
import {
  NativeEventEmitter,
  NativeModules,
  StatusBar,
  AppState,
} from 'react-native';
import WebView from 'react-native-webview';
import color from 'color';

import { useTheme } from '@hooks/persisted';
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
import Toast from '@components/Toast';
import { useBoolean } from '@hooks';
import { extractParagraphs } from '@utils/htmlParagraphExtractor';

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
  } = useChapterContext();
  const theme = useTheme();
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
      const stored = getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) || {};

      // Robust merge: Ensure defaults are preserved if stored value is undefined/missing
      const merged = { ...defaults, ...stored };

      // Explicitly ensure showParagraphHighlight is set (fallback to true)
      if (merged.showParagraphHighlight === undefined) {
        merged.showParagraphHighlight = defaults.showParagraphHighlight ?? true;
      }

      console.log('[WebViewReader] Initial Settings:', JSON.stringify(defaults));
      console.log('[WebViewReader] Stored Settings:', JSON.stringify(stored));
      console.log('[WebViewReader] Merged Settings:', JSON.stringify(merged));

      return merged;
    },
    // needed to preserve settings during chapter change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  // FIX: Use a stable savedParagraphIndex that only updates when chapter changes.
  // This prevents the WebView from reloading (and resetting TTS) when progress is saved.
  // NEW: Also check MMKV for the absolute latest progress (covers background TTS/manual scroll)
  const initialSavedParagraphIndex = useMemo(
    () => {
      const mmkvIndex =
        MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
      const dbIndex = savedParagraphIndex ?? -1;
      console.log(
        `WebViewReader: Initializing scroll. DB: ${dbIndex}, MMKV: ${mmkvIndex}`,
      );
      return Math.max(dbIndex, mmkvIndex);
    },
    // CRITICAL FIX: Only calculate once per chapter to prevent WebView reloads
    // when progress is saved (which would update savedParagraphIndex)
    [chapter.id],
  );

  // NEW: Create a stable chapter object that doesn't update on progress changes
  // This prevents the WebView from reloading when we save progress
  const stableChapter = useMemo(
    () => ({
      ...chapter,
      // Ensure we use the initial values for these if needed, or just spread
      // The key is that this object reference (and its stringified version)
      // won't change unless chapter.id changes
    }),
    [chapter.id],
  );

  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);
  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
  const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;
  const nextChapterScreenVisible = useRef<boolean>(false);
  const autoStartTTSRef = useRef<boolean>(false);
  const isTTSReadingRef = useRef<boolean>(false);
  const ttsStateRef = useRef<any>(null);
  const progressRef = useRef(chapter.progress);
  // NEW: Track latest paragraph index to survive settings injections
  const latestParagraphIndexRef = useRef(savedParagraphIndex);
  // NEW: Track if we need to start TTS directly from RN (background mode)
  const backgroundTTSPendingRef = useRef<boolean>(false);
  // NEW: Track previous chapter ID to detect chapter changes
  const prevChapterIdRef = useRef<number>(chapter.id);
  // NEW: Grace period timestamp to ignore stale save events after chapter change
  const chapterTransitionTimeRef = useRef<number>(0);

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

  // NEW: Effect to handle background TTS next chapter navigation
  // When chapter changes AND we have a pending background TTS request,
  // extract paragraphs from HTML and start TTS directly from RN
  useEffect(() => {
    // Check if chapter actually changed
    if (chapter.id === prevChapterIdRef.current) {
      return;
    }
    
    console.log(`WebViewReader: Chapter changed from ${prevChapterIdRef.current} to ${chapter.id}`);
    prevChapterIdRef.current = chapter.id;
    
    // Set grace period timestamp to ignore stale save events from old chapter
    chapterTransitionTimeRef.current = Date.now();
    
    // Reset paragraph index for new chapter
    currentParagraphIndexRef.current = 0;
    latestParagraphIndexRef.current = 0;
    
    // Clear the old TTS queue since we're on a new chapter
    ttsQueueRef.current = null;
    
    // Check if we need to start TTS directly (background mode)
    if (backgroundTTSPendingRef.current && html) {
      console.log('WebViewReader: Background TTS pending, starting directly from RN');
      backgroundTTSPendingRef.current = false;
      
      // Extract paragraphs from HTML
      const paragraphs = extractParagraphs(html);
      console.log(`WebViewReader: Extracted ${paragraphs.length} paragraphs for background TTS`);
      
      if (paragraphs.length > 0) {
        // Create utterance IDs with chapter ID to prevent stale event processing
        const utteranceIds = paragraphs.map((_, i) => `chapter_${chapter.id}_utterance_${i}`);
        
        // Update TTS queue ref
        ttsQueueRef.current = {
          startIndex: 0,
          texts: paragraphs,
        };
        
        // Start from paragraph 0
        currentParagraphIndexRef.current = 0;
        
        // DON'T call stop() here - it would release the foreground service
        // which we can't restart from background in Android 12+
        // Just call speakBatch which will QUEUE_FLUSH the old items
        
        // Start batch TTS (this will flush old queue and start new one)
        TTSHighlight.speakBatch(paragraphs, utteranceIds, {
          voice: readerSettingsRef.current.tts?.voice?.identifier,
          pitch: readerSettingsRef.current.tts?.pitch || 1,
          rate: readerSettingsRef.current.tts?.rate || 1,
        })
          .then(() => {
            console.log('WebViewReader: Background TTS batch started successfully');
          })
          .catch(err => {
            console.error('WebViewReader: Background TTS batch failed:', err);
            isTTSReadingRef.current = false;
          });
      } else {
        console.warn('WebViewReader: No paragraphs extracted from HTML');
        isTTSReadingRef.current = false;
      }
    }
  }, [chapter.id, html]);

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
              src: url("file:///android_asset/fonts/${readerSettings.fontFamily}.ttf");
            }
          </style>
          <link rel="stylesheet" href="${pluginCustomCSS}">
          <style>
            ${readerSettings.customCSS}
          </style>
        </head>
        <body class="${chapterGeneralSettings.pageReader ? 'page-reader' : ''}">
          <div class="transition-chapter" style="transform: translateX(0%);${chapterGeneralSettings.pageReader ? '' : 'display: none'}">
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
            finished: `${getString('readerScreen.finished')}: ${stableChapter.name.trim()}`,
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
    assetsUriPrefix,
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

  const {
    value: toastVisible,
    setTrue: showToast,
    setFalse: hideToast,
  } = useBoolean();

  const pendingResumeIndexRef = useRef<number>(-1);
  const ttsScrollPromptDataRef = useRef<{
    currentIndex: number;
    visibleIndex: number;
    isResume?: boolean;
  } | null>(null);
  const toastMessageRef = useRef<string>('');

  // NEW: TTS Queue for background playback
  const ttsQueueRef = useRef<{ startIndex: number; texts: string[] } | null>(
    null,
  );
  const currentParagraphIndexRef = useRef<number>(-1);

  /**
   * Track how many additional chapters have been auto-played in this TTS session.
   * This is used to enforce the ttsContinueToNextChapter limit (5, 10, or continuous).
   * Reset when user manually starts TTS or navigates to a different chapter.
   */
  const chaptersAutoPlayedRef = useRef<number>(0);

  const handleResumeConfirm = () => {
    // Always set both refs to the last read paragraph before resuming
    const mmkvValue = MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
    const refValue = latestParagraphIndexRef.current ?? -1;
    const savedIndex = pendingResumeIndexRef.current;
    // Pick the highest index as the last read paragraph
    const lastReadParagraph = Math.max(refValue, mmkvValue, savedIndex);
    // Ensure both refs are updated
    pendingResumeIndexRef.current = lastReadParagraph;
    latestParagraphIndexRef.current = lastReadParagraph;
    // Confirm resume dialog always appears (showResumeDialog is called on request-tts-confirmation)
    const ttsState = chapter.ttsState ? JSON.parse(chapter.ttsState) : {};
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

  const showToastMessage = (message: string) => {
    toastMessageRef.current = message;
    showToast();
  };

  useEffect(() => {
    const onSpeechDoneSubscription = TTSHighlight.addListener(
      'onSpeechDone',
      () => {
        // Try to play next from queue first (Background/Robust Mode)
        if (ttsQueueRef.current && currentParagraphIndexRef.current >= 0) {
          const nextIndex = currentParagraphIndexRef.current + 1;
          const queueStartIndex = ttsQueueRef.current.startIndex;
          const queueEndIndex =
            queueStartIndex + ttsQueueRef.current.texts.length;

          if (nextIndex >= queueStartIndex && nextIndex < queueEndIndex) {
            const text = ttsQueueRef.current.texts[nextIndex - queueStartIndex];
            console.log('WebViewReader: Playing from queue. Index:', nextIndex);

            // Update refs
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
            saveProgress(progressRef.current ?? 0, nextIndex);

            // In batch mode, we DO NOT call speak() here because the native queue
            // is already playing the next item. Calling speak() would flush the queue!
            // We only need to update the UI and state.
            if (!chapterGeneralSettingsRef.current.ttsBackgroundPlayback) {
              // Only manually speak next if NOT in background/batch mode
              TTSHighlight.speak(text, {
                voice: readerSettingsRef.current.tts?.voice?.identifier,
                pitch: readerSettingsRef.current.tts?.pitch || 1,
                rate: readerSettingsRef.current.tts?.rate || 1,
              });
            }

            // Sync WebView UI & Logic (fire and forget)
            // Added 'true;' and console logs for debugging
            // CRITICAL: Pass chapter ID to prevent stale events from wrong chapter
            if (webViewRef.current) {
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
    const rangeSubscription = TTSHighlight.addListener('onWordRange', (event) => {
      try {
        const utteranceId = event?.utteranceId || '';
        let paragraphIndex = currentParagraphIndexRef.current ?? -1;
        
        // Parse utterance ID - may be "chapter_123_utterance_5" or legacy "utterance_5"
        if (typeof utteranceId === 'string') {
          // Check for chapter-aware format first
          const chapterMatch = utteranceId.match(/chapter_(\d+)_utterance_(\d+)/);
          if (chapterMatch) {
            const eventChapterId = Number(chapterMatch[1]);
            // CRITICAL: Ignore events from old chapters to prevent paragraph sync issues
            if (eventChapterId !== prevChapterIdRef.current) {
              console.log(`WebViewReader: Ignoring stale onWordRange from chapter ${eventChapterId}, current is ${prevChapterIdRef.current}`);
              return;
            }
            paragraphIndex = Number(chapterMatch[2]);
          } else {
            // Legacy format
            const m = utteranceId.match(/utterance_(\d+)/);
            if (m) paragraphIndex = Number(m[1]);
          }
        }

        const start = Number(event?.start) || 0;
        const end = Number(event?.end) || 0;

        if (webViewRef.current && paragraphIndex >= 0) {
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
        console.warn('WebViewReader: onWordRange handler error', e);
      }
    });

    // Listen for utterance start to ensure paragraph highlight and state are synced
    const startSubscription = TTSHighlight.addListener('onSpeechStart', (event) => {
      try {
        const utteranceId = event?.utteranceId || '';
        let paragraphIndex = currentParagraphIndexRef.current ?? -1;
        
        // Parse utterance ID - may be "chapter_123_utterance_5" or legacy "utterance_5"
        if (typeof utteranceId === 'string') {
          // Check for chapter-aware format first
          const chapterMatch = utteranceId.match(/chapter_(\d+)_utterance_(\d+)/);
          if (chapterMatch) {
            const eventChapterId = Number(chapterMatch[1]);
            // CRITICAL: Ignore events from old chapters to prevent paragraph sync issues
            if (eventChapterId !== prevChapterIdRef.current) {
              console.log(`WebViewReader: Ignoring stale onSpeechStart from chapter ${eventChapterId}, current is ${prevChapterIdRef.current}`);
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
        if (paragraphIndex >= 0) currentParagraphIndexRef.current = paragraphIndex;

        if (webViewRef.current && paragraphIndex >= 0) {
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
      } catch (e) {
        console.warn('WebViewReader: onSpeechStart handler error', e);
      }
    });

    // Listen for native TTS queue becoming empty (all utterances spoken).
    // This fires when the screen is off and WebView JS can't drive the next chapter.
    // We use this to trigger chapter navigation from React Native side.
    const queueEmptySubscription = TTSHighlight.addListener('onQueueEmpty', () => {
      console.log('WebViewReader: onQueueEmpty event received');

      // Only proceed if TTS was actually reading (and thus chapter end is meaningful)
      if (!isTTSReadingRef.current) {
        console.log('WebViewReader: Queue empty but TTS was not reading, ignoring');
        return;
      }

      // Check the ttsContinueToNextChapter setting
      const continueMode = chapterGeneralSettingsRef.current.ttsContinueToNextChapter || 'none';
      console.log('WebViewReader: Queue empty - continueMode:', continueMode);

      if (continueMode === 'none') {
        console.log('WebViewReader: ttsContinueToNextChapter is "none", stopping');
        isTTSReadingRef.current = false;
        return;
      }

      // Check chapter limit
      if (continueMode !== 'continuous') {
        const limit = parseInt(continueMode, 10);
        if (chaptersAutoPlayedRef.current >= limit) {
          console.log(`WebViewReader: Chapter limit (${limit}) reached, stopping`);
          chaptersAutoPlayedRef.current = 0;
          isTTSReadingRef.current = false;
          return;
        }
      }

      // If we have a next chapter, navigate to it
      if (nextChapter) {
        console.log('WebViewReader: Navigating to next chapter via onQueueEmpty');
        autoStartTTSRef.current = true;
        // NEW: Set background TTS pending flag so we can start TTS directly from RN
        // when the new chapter HTML is loaded (in case WebView is suspended)
        backgroundTTSPendingRef.current = true;
        chaptersAutoPlayedRef.current += 1;
        nextChapterScreenVisible.current = true;
        navigateChapter('NEXT');
      } else {
        console.log('WebViewReader: No next chapter available');
        isTTSReadingRef.current = false;
      }
    });

    const appStateSubscription = AppState.addEventListener(
      'change',
      nextAppState => {
        if (nextAppState === 'background') {
          if (ttsStateRef.current?.wasPlaying) {
            console.log(
              'WebViewReader: Saving TTS state on background',
              ttsStateRef.current,
            );
            saveProgress(
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
          // sync the WebView to the current paragraph position to prevent stale scrolling
          if (isTTSReadingRef.current && currentParagraphIndexRef.current >= 0) {
            console.log(
              'WebViewReader: Screen woke during TTS, syncing to paragraph',
              currentParagraphIndexRef.current,
            );
            
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
                const syncIndex = currentParagraphIndexRef.current;
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
      queueEmptySubscription.remove();
      appStateSubscription.remove();
      TTSHighlight.stop();
      if (ttsStateRef.current?.wasPlaying) {
        console.log(
          'WebViewReader: Saving TTS state on unmount',
          ttsStateRef.current,
        );
        saveProgress(
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
  }, []);

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
  return (
    <>
      <WebView
        ref={webViewRef}
        style={{ backgroundColor: readerSettings.theme }}
        allowFileAccess={true}
        originWhitelist={['*']}
        scalesPageToFit={true}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        webviewDebuggingEnabled={__DEV__}
        onLoadEnd={() => {
          // Skip WebView-driven TTS start if background mode is handling it
          if (backgroundTTSPendingRef.current) {
            console.log('WebViewReader: onLoadEnd skipped - background TTS pending');
            return;
          }
          
          if (autoStartTTSRef.current) {
            autoStartTTSRef.current = false;
            setTimeout(() => {
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
            }, 300);
          }
        }}
        onMessage={(ev: { nativeEvent: { data: string } }) => {
          __DEV__ && onLogMessage(ev);
          const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);
          switch (event.type) {
            case 'hide':
              onPress();
              break;
            case 'next':
              nextChapterScreenVisible.current = true;
              if (event.autoStartTTS) {
                // Check if we should continue to next chapter based on setting
                const continueMode = chapterGeneralSettingsRef.current.ttsContinueToNextChapter || 'none';
                
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
                const timeSinceTransition = Date.now() - chapterTransitionTimeRef.current;
                
                if (event.chapterId !== undefined && event.chapterId !== chapter.id) {
                  console.log(
                    `WebViewReader: Ignoring stale save event from chapter ${event.chapterId}, current is ${chapter.id}`,
                  );
                  break;
                }
                
                // During grace period, also reject events without chapterId (legacy WebView)
                if (timeSinceTransition < GRACE_PERIOD_MS && event.chapterId === undefined) {
                  console.log(
                    `WebViewReader: Ignoring save event without chapterId during grace period (${timeSinceTransition}ms)`,
                  );
                  break;
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
              if (event.data && typeof event.data === 'string') {
                if (!isTTSReadingRef.current) {
                  isTTSReadingRef.current = true;
                }
                // Use chapter_N_utterance_N format so event handlers can validate chapter
                const paragraphIdx = typeof event.paragraphIndex === 'number' 
                  ? event.paragraphIndex 
                  : currentParagraphIndexRef.current;
                const utteranceId = paragraphIdx >= 0 
                  ? `chapter_${chapter.id}_utterance_${paragraphIdx}` 
                  : undefined;
                
                // Update current index
                if (paragraphIdx >= 0) {
                  currentParagraphIndexRef.current = paragraphIdx;
                }
                
                TTSHighlight.speak(event.data, {
                  voice: readerSettings.tts?.voice?.identifier,
                  pitch: readerSettings.tts?.pitch || 1,
                  rate: readerSettings.tts?.rate || 1,
                  utteranceId,
                });
              } else {
                webViewRef.current?.injectJavaScript('tts.next?.()');
              }
              break;
            case 'stop-speak':
              TTSHighlight.stop();
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
            case 'request-tts-confirmation':
              if (
                event.data &&
                !Array.isArray(event.data) &&
                event.data.savedIndex !== undefined
              ) {
                // handleTTSConfirmation(Number(event.data.savedIndex));
                pendingResumeIndexRef.current = Number(event.data.savedIndex);
                showResumeDialog();
              }
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
                ttsQueueRef.current = {
                  startIndex: event.startIndex,
                  texts: event.data as string[],
                };

                // Use batch TTS for background playback
                // BUG 2 FIX: Use addToBatch instead of speakBatch when queue is received
                // The first paragraph was already queued via the 'speak' event which uses QUEUE_FLUSH.
                // If we call speakBatch here, it would QUEUE_FLUSH again, clearing the first paragraph.
                // Instead, we use addToBatch to ADD remaining paragraphs to the queue.
                if (chapterGeneralSettings.ttsBackgroundPlayback && event.data.length > 0 && typeof event.startIndex === 'number') {
                  const startIndex = event.startIndex;
                  // Include chapter ID in utterance IDs to prevent stale event processing
                  const utteranceIds = (event.data as string[]).map((_, i) =>
                    `chapter_${chapter.id}_utterance_${startIndex + i}`
                  );

                  console.log(`WebViewReader: Adding ${event.data.length} paragraphs to TTS queue from index ${startIndex}`);

                  // Use addToBatch to preserve the currently playing utterance
                  TTSHighlight.addToBatch(
                    event.data as string[],
                    utteranceIds,
                  ).catch(err => {
                    console.error('WebViewReader: Add to batch failed:', err);
                    // Fallback to WebView-driven TTS
                    webViewRef.current?.injectJavaScript('tts.next?.()');
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
          }
        }}
        source={{
          baseUrl: !chapter.isDownloaded ? plugin?.site : undefined,
          html: memoizedHTML,
        }}
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
