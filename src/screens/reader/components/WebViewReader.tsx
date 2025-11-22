import React, { memo, useEffect, useMemo, useRef } from 'react';
import { NativeEventEmitter, NativeModules, StatusBar, AppState, Alert } from 'react-native';
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


type WebViewPostEvent = {
  type: string;
  data?: { [key: string]: string | number };
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
  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);
  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
  const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;
  const nextChapterScreenVisible = useRef<boolean>(false);
  const autoStartTTSRef = useRef<boolean>(false);
  const isTTSReadingRef = useRef<boolean>(false);
  const ttsStateRef = useRef<any>(null);
  const progressRef = useRef(chapter.progress);

  useEffect(() => {
    progressRef.current = chapter.progress;
  }, [chapter.progress]);

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

  const handleTTSConfirmation = (savedIndex: number) => {
    console.log('WebViewReader: Handling TTS confirmation. Setting:', chapterGeneralSettings.ttsAutoResume);

    Alert.alert(
      'Resume TTS',
      'Do you want to resume reading from where you left off?',
      [
        {
          text: 'No',
          style: 'cancel',
          onPress: () => {
            // User said No, so we tell TTS to mark as "resumed" (skipped) and start normally
            webViewRef.current?.injectJavaScript(`
              window.tts.hasAutoResumed = true;
              window.tts.start();
            `);
          },
        },
        {
          text: 'Yes',
          onPress: () => {
            // User said Yes, so we tell TTS to resume from the saved index
            // We prefer savedIndex (from chapter progress) over ttsState.paragraphIndex
            // because chapter progress is saved more frequently and reliably.
            // CRITICAL FIX: Read directly from MMKV to get the latest value, as the prop might be stale.
            const latestSavedIndex = MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? savedIndex;
            const ttsState = chapter.ttsState ? JSON.parse(chapter.ttsState) : {};
            console.log('WebViewReader: Resuming TTS. latestSavedIndex:', latestSavedIndex, 'ttsState:', ttsState);

            resumeTTS({
              ...ttsState,
              paragraphIndex: latestSavedIndex,
              autoStart: true,
              shouldResume: true
            });
          },
        },
      ],
    );
  };





  useEffect(() => {
    const onSpeechDoneSubscription = TTSHighlight.addListener(
      'onSpeechDone',
      () => {
        webViewRef.current?.injectJavaScript('tts.next?.()');
      },
    );

    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'background' && ttsStateRef.current?.wasPlaying) {
        console.log('WebViewReader: Saving TTS state on background', ttsStateRef.current);
        saveProgress(progressRef.current ?? 0, undefined, JSON.stringify({
          ...ttsStateRef.current,
          timestamp: Date.now(),
        }));
      }
    });

    return () => {
      onSpeechDoneSubscription.remove();
      appStateSubscription.remove();
      TTSHighlight.stop();
      if (ttsStateRef.current?.wasPlaying) {
        console.log('WebViewReader: Saving TTS state on unmount', ttsStateRef.current);
        saveProgress(progressRef.current ?? 0, undefined, JSON.stringify({
          ...ttsStateRef.current,
          timestamp: Date.now(),
          autoStartOnReturn: true,
        }));
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
          console.log('WebViewReader: MMKV listener fired for CHAPTER_GENERAL_SETTINGS', newSettings);
          webViewRef.current?.injectJavaScript(
            `if (window.reader && window.reader.generalSettings) {
               window.reader.generalSettings.val = ${newSettings};
               console.log('TTS: Updated general settings via listener');
             }`
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
                 window.reader.generalSettings.val = ${currentSettings};
                 console.log('TTS: Injected fresh settings on mount');
               }
             }, 1000);`
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
              console.log('WebViewReader: Received save event. Progress:', event.data, 'Paragraph:', event.paragraphIndex);
              saveProgress(event.data, event.paragraphIndex as number | undefined);
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
            isTTSReadingRef.current = false;
            break;
          case 'tts-state':
            if (event.data && typeof event.data === 'object') {
              ttsStateRef.current = event.data;
            }
            break;
          case 'request-tts-confirmation':
            if (event.data?.savedIndex !== undefined) {
              handleTTSConfirmation(Number(event.data.savedIndex));
            }
            break;
        }
      }}
      source={{
        baseUrl: !chapter.isDownloaded ? plugin?.site : undefined,
        headers: plugin?.imageRequestInit?.headers,
        method: plugin?.imageRequestInit?.method,
        body: plugin?.imageRequestInit?.body,
        html: ` 
        <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
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
                  src: url("file:///android_asset/fonts/${readerSettings.fontFamily
          }.ttf");
                }
                </style>

              <link rel="stylesheet" href="${pluginCustomCSS}">
              <style>
                ${readerSettings.customCSS}
              </style>
            </head>
            <body class="${chapterGeneralSettings.pageReader ? 'page-reader' : ''
          }">
              <div class="transition-chapter" style="transform: ${nextChapterScreenVisible.current
            ? 'translateX(-100%)'
            : 'translateX(0%)'
          };
              ${chapterGeneralSettings.pageReader ? '' : 'display: none'}"
              ">${chapter.name}</div>
              <div id="LNReader-chapter">
                ${html}  
              </div>
              <div id="reader-ui"></div>
              </body>
              <script>
                var initialPageReaderConfig = ${JSON.stringify({
            nextChapterScreenVisible: nextChapterScreenVisible.current,
          })};


                var initialReaderConfig = ${JSON.stringify({
            readerSettings,
            chapterGeneralSettings,
            novel,
            chapter,
            nextChapter,
            prevChapter,
            batteryLevel,
            autoSaveInterval: 2222,
            DEBUG: __DEV__,
            strings: {
              finished: `${getString(
                'readerScreen.finished',
              )}: ${chapter.name.trim()}`,
              nextChapter: getString('readerScreen.nextChapter', {
                name: nextChapter?.name,
              }),
              noNextChapter: getString('readerScreen.noNextChapter'),
            },
            savedParagraphIndex: savedParagraphIndex ?? -1,
            ttsRestoreState: chapter.ttsState ? JSON.parse(chapter.ttsState) : null,
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
          `,
      }}
    />
  );
};

export default memo(WebViewReader);
