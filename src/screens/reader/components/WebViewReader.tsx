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

type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number } | string[];
  startIndex?: number;
  autoStartTTS?: boolean;
  paragraphIndex?: number;
  ttsState?: any;
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
    () =>
      getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) ||
      initialChapterGeneralSettings,
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

  const handleResumeConfirm = () => {
    const savedIndex = pendingResumeIndexRef.current;
    // User said Yes, so we tell TTS to resume from the saved index
    // We prefer savedIndex (from chapter progress) over ttsState.paragraphIndex
    // because chapter progress is saved more frequently and reliably.
    // CRITICAL FIX: Use the latest tracked index, not stale MMKV
    // We use Math.max because we want to avoid "phantom resets" where the WebView
    // momentarily reports a lower paragraph (e.g. 5) during load, poisoning the Ref.
    // If the confirmation payload (savedIndex) says 10, we trust it over the Ref's 5.
    const refValue = latestParagraphIndexRef.current ?? -1;
    const mmkvValue =
      MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;

    const latestSavedIndex = Math.max(refValue, mmkvValue, savedIndex);

    const ttsState = chapter.ttsState ? JSON.parse(chapter.ttsState) : {};
    console.log(
      'WebViewReader: Resuming TTS. Resolved index:',
      latestSavedIndex,
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
      paragraphIndex: latestSavedIndex,
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

            // Speak next
            TTSHighlight.speak(text, {
              voice: readerSettingsRef.current.tts?.voice?.identifier,
              pitch: readerSettingsRef.current.tts?.pitch || 1,
              rate: readerSettingsRef.current.tts?.rate || 1,
            });

            // Sync WebView UI & Logic (fire and forget)
            // Added 'true;' and console logs for debugging
            if (webViewRef.current) {
              webViewRef.current.injectJavaScript(`
                    try {
                        if (window.tts) {
                            console.log('TTS: Syncing state to index ${nextIndex}');
                            window.tts.highlightParagraph(${nextIndex});
                            window.tts.updateState(${nextIndex});
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
        }
      },
    );

    return () => {
      onSpeechDoneSubscription.remove();
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
                autoStartTTSRef.current = true;
              }
              navigateChapter('NEXT');
              break;
            case 'prev':
              navigateChapter('PREV');
              break;
            case 'save':
              if (event.data && typeof event.data === 'number') {
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
                TTSHighlight.speak(event.data, {
                  voice: readerSettings.tts?.voice?.identifier,
                  pitch: readerSettings.tts?.pitch || 1,
                  rate: readerSettings.tts?.rate || 1,
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
