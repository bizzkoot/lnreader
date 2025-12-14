/**
 * WebViewReader Component (Refactored)
 *
 * This version uses the useTTSController hook for TTS functionality.
 * Non-TTS logic (HTML generation, settings, WebView rendering) remains in this file.
 *
 * @module reader/components/WebViewReader
 */

import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { NativeEventEmitter, NativeModules, StatusBar } from 'react-native';
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
import { applyTtsUpdateToWebView } from './ttsHelpers';
import TTSExitDialog from './TTSExitDialog';

// Import the TTS hook
import { useTTSController } from '../hooks/useTTSController';
import { WebViewPostEvent } from '../types/tts';

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

const WebViewReaderRefactored: React.FC<WebViewReaderProps> = ({ onPress }) => {
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
  const theme = useTheme();

  const webViewNonceRef = useRef<string>(createWebViewNonce());
  const allowMessageRef = useRef(createMessageRateLimiter());

  // Toast state
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

  // Settings
  const readerSettings = useMemo(
    () =>
      getMMKVObject<ChapterReaderSettings>(CHAPTER_READER_SETTINGS) ||
      initialChapterReaderSettings,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  const chapterGeneralSettings = useMemo(
    () => {
      const defaults = initialChapterGeneralSettings;
      const stored =
        getMMKVObject<ChapterGeneralSettings>(CHAPTER_GENERAL_SETTINGS) || {};
      const merged = { ...defaults, ...stored };

      if (merged.showParagraphHighlight === undefined) {
        merged.showParagraphHighlight = defaults.showParagraphHighlight ?? true;
      }

      return merged;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  // Settings refs (for stale closure prevention)
  const readerSettingsRef = useRef(readerSettings);
  const chapterGeneralSettingsRef = useRef(chapterGeneralSettings);

  useEffect(() => {
    readerSettingsRef.current = readerSettings;
    chapterGeneralSettingsRef.current = chapterGeneralSettings;
  }, [readerSettings, chapterGeneralSettings]);

  // Native TTS position fetch
  const [nativeTTSPosition, setNativeTTSPosition] = useState<number>(-1);

  useEffect(() => {
    const fetchNativeTTSPosition = async () => {
      try {
        const position = await TTSHighlight.getSavedTTSPosition(chapter.id);
        if (position >= 0) {
          console.log(
            `WebViewReader: Native TTS position for chapter ${chapter.id}: ${position}`,
          );
          setNativeTTSPosition(position);
        } else {
          setNativeTTSPosition(-1);
        }
      } catch (error) {
        console.log(
          'WebViewReader: Failed to fetch native TTS position, using MMKV/DB fallback',
        );
        setNativeTTSPosition(-1);
      }
    };

    setNativeTTSPosition(-1);
    fetchNativeTTSPosition();
  }, [chapter.id]);

  // Calculate initial saved paragraph index
  const initialSavedParagraphIndex = useMemo(
    () => {
      const mmkvIndex =
        MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
      const dbIndex = savedParagraphIndex ?? -1;
      const nativeIndex = nativeTTSPosition;
      console.log(
        `WebViewReader: Initializing scroll. DB: ${dbIndex}, MMKV: ${mmkvIndex}, Native: ${nativeIndex}`,
      );
      if (nativeIndex >= 0) return nativeIndex;
      const jsMax = Math.max(dbIndex, mmkvIndex);
      if (jsMax >= 0) return jsMax;
      return 0;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id, nativeTTSPosition],
  );

  // Stable chapter object
  const stableChapter = useMemo(
    () => ({ ...chapter }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);
  const plugin = getPlugin(novel?.pluginId);
  const pluginCustomJS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.js`;
  const pluginCustomCSS = `file://${PLUGIN_STORAGE}/${plugin?.id}/custom.css`;

  // ============================================================================
  // TTS Controller Hook
  // ============================================================================

  const tts = useTTSController({
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
    initialSavedParagraphIndex,
    readerSettingsRef,
    chapterGeneralSettingsRef,
    showToastMessage,
  });

  // ============================================================================
  // Live TTS Settings Listener
  // ============================================================================

  const { tts: liveReaderTts } = useChapterReaderSettings();

  useEffect(() => {
    if (liveReaderTts) {
      const oldTts = readerSettingsRef.current.tts;
      const voiceChanged =
        oldTts?.voice?.identifier !== liveReaderTts.voice?.identifier;
      const rateChanged = oldTts?.rate !== liveReaderTts.rate;
      const pitchChanged = oldTts?.pitch !== liveReaderTts.pitch;
      const settingsChanged = voiceChanged || rateChanged || pitchChanged;

      readerSettingsRef.current = {
        ...readerSettingsRef.current,
        tts: liveReaderTts,
      } as any;
      applyTtsUpdateToWebView(liveReaderTts, webViewRef);

      // Restart TTS if settings changed during playback
      if (
        settingsChanged &&
        tts.isTTSReading &&
        tts.currentParagraphIndex >= 0
      ) {
        console.log(
          'WebViewReader: TTS settings changed while playing, restarting with new settings',
        );

        TTSHighlight.setRestartInProgress(true);
        TTSHighlight.stop();

        const idx = tts.currentParagraphIndex;
        const paragraphs = extractParagraphs(html);

        if (paragraphs && paragraphs.length > idx) {
          tts.restartTtsFromParagraphIndex(idx);
        } else {
          TTSHighlight.setRestartInProgress(false);
        }
      }
    }
  }, [liveReaderTts, webViewRef, html, tts]);

  // ============================================================================
  // Back Handler
  // ============================================================================

  useBackHandler(() => {
    return tts.handleBackPress();
  });

  // ============================================================================
  // MMKV Settings Listener
  // ============================================================================

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

    const currentSettings = MMKVStorage.getString(CHAPTER_GENERAL_SETTINGS);
    if (currentSettings) {
      webViewRef.current?.injectJavaScript(
        `setTimeout(() => {
           if (window.reader && window.reader.generalSettings) {
             const current = window.reader.generalSettings.val;
             const fresh = ${currentSettings};
             const sortKeys = (obj) => {
               if (typeof obj !== 'object' || obj === null) return obj;
               return Object.keys(obj).sort().reduce((acc, key) => {
                 acc[key] = sortKeys(obj[key]);
                 return acc;
               }, {});
             };
             const currentStr = JSON.stringify(sortKeys(current));
             const freshStr = JSON.stringify(sortKeys(fresh));
             if (currentStr !== freshStr) {
               console.log('TTS: Settings changed, injecting');
               window.reader.generalSettings.val = fresh;
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

  // ============================================================================
  // HTML Generation
  // ============================================================================

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
              --theme-surface-0-9: ${color(theme.surface).alpha(0.9).toString()};
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
    theme,
  ]);

  // ============================================================================
  // WebView Message Handler
  // ============================================================================

  const handleMessage = useCallback(
    (ev: { nativeEvent: { data: string } }) => {
      if (!allowMessageRef.current(Date.now())) {
        return;
      }

      const msg = parseWebViewMessage<string, unknown>(ev.nativeEvent.data, [
        'save',
        'request-tts-exit',
        'exit-allowed',
        'tts-update-settings',
        'hide',
        'next',
        'prev',
        'scroll-to',
        'log',
        'speak',
        'stop-speak',
        'tts-state',
        'request-tts-confirmation',
        'tts-resume-location-prompt',
        'tts-scroll-prompt',
        'tts-manual-mode-prompt',
        'tts-positioned',
        'tts-queue',
        'tts-apply-settings',
        'save-tts-position',
        'show-toast',
        'console',
      ] as const);
      if (!msg || msg.nonce !== webViewNonceRef.current) {
        return;
      }

      __DEV__ && onLogMessage(ev);
      const event: WebViewPostEvent = JSON.parse(ev.nativeEvent.data);

      // Try TTS handler first
      if (tts.handleTTSMessage(event)) {
        return;
      }

      // Handle non-TTS messages
      switch (event.type) {
        case 'tts-update-settings':
          if (event.data) {
            applyTtsUpdateToWebView(event.data, webViewRef);
          }
          break;
        case 'hide':
          onPress();
          break;
        case 'next':
          if (event.autoStartTTS) {
            const continueMode =
              chapterGeneralSettingsRef.current.ttsContinueToNextChapter ||
              'none';

            if (continueMode === 'none') {
              tts.autoStartTTSRef.current = false;
              tts.chaptersAutoPlayedRef.current = 0;
            } else if (continueMode === 'continuous') {
              tts.autoStartTTSRef.current = true;
              tts.chaptersAutoPlayedRef.current += 1;
            } else {
              const limit = parseInt(continueMode, 10);
              if (tts.chaptersAutoPlayedRef.current < limit) {
                tts.autoStartTTSRef.current = true;
                tts.chaptersAutoPlayedRef.current += 1;
              } else {
                tts.autoStartTTSRef.current = false;
                tts.chaptersAutoPlayedRef.current = 0;
              }
            }
          }
          navigateChapter('NEXT');
          break;
        case 'prev':
          tts.chaptersAutoPlayedRef.current = 0;
          navigateChapter('PREV');
          break;
        case 'save':
          if (event.data && typeof event.data === 'number') {
            // Validate chapterId to prevent stale saves
            if (
              event.chapterId !== undefined &&
              event.chapterId !== chapter.id
            ) {
              console.log(
                `WebViewReader: Ignoring stale save event from chapter ${event.chapterId}, current is ${chapter.id}`,
              );
              break;
            }

            // Block non-TTS saves when TTS is reading
            if (tts.isTTSReading) {
              if (event.paragraphIndex === undefined) {
                console.log(
                  'WebViewReader: Ignoring non-TTS save while TTS is reading',
                );
                break;
              }
              const currentIdx = tts.currentParagraphIndex ?? -1;
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

            console.log(
              'WebViewReader: Received save event. Progress:',
              event.data,
              'Paragraph:',
              event.paragraphIndex,
            );

            if (event.paragraphIndex !== undefined) {
              tts.latestParagraphIndexRef.current = event.paragraphIndex;
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
        case 'show-toast':
          if (event.data && typeof event.data === 'string') {
            showToastMessage(event.data);
          }
          break;
        case 'save-tts-position':
          if (event.data && typeof event.data === 'object') {
            MMKVStorage.set('tts_button_position', JSON.stringify(event.data));
          }
          break;
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
                  voice:
                    ttsData.voice !== undefined && currentVoice
                      ? { ...currentVoice, identifier: ttsData.voice }
                      : currentVoice,
                },
              };
            }

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
          }
          break;
      }
    },
    [
      tts,
      webViewRef,
      onPress,
      navigateChapter,
      chapter.id,
      saveProgress,
      showToastMessage,
    ],
  );

  // ============================================================================
  // Render
  // ============================================================================

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
          // Update battery level
          const currentBatteryLevel = getBatteryLevelSync();
          webViewRef.current?.injectJavaScript(
            `if (window.reader && window.reader.batteryLevel) {
              window.reader.batteryLevel.val = ${currentBatteryLevel};
            }`,
          );

          // Call hook's load end handler
          tts.handleWebViewLoadEnd();
        }}
        onMessage={handleMessage}
        source={{
          baseUrl: !chapter.isDownloaded ? plugin?.site : undefined,
          html: memoizedHTML,
        }}
      />

      {/* TTS Dialogs */}
      <TTSChapterSelectionDialog
        visible={tts.showChapterSelectionDialog}
        theme={theme}
        conflictingChapters={tts.conflictingChapters}
        currentChapter={tts.currentChapterForDialog}
        onSelectChapter={tts.handleSelectChapter}
        onDismiss={() => tts.setShowChapterSelectionDialog(false)}
      />
      <TTSExitDialog
        visible={tts.showExitDialog}
        theme={theme}
        ttsParagraph={tts.exitDialogData.ttsParagraph}
        readerParagraph={tts.exitDialogData.readerParagraph}
        onExitTTS={tts.handleExitTTS}
        onExitReader={tts.handleExitReader}
        onCancel={() => tts.setShowExitDialog(false)}
      />
      <TTSResumeDialog
        visible={tts.resumeDialogVisible}
        theme={theme}
        onResume={tts.handleResumeConfirm}
        onRestart={tts.handleResumeCancel}
        onRestartChapter={tts.handleRestartChapter}
        onDismiss={tts.hideResumeDialog}
      />
      <TTSScrollSyncDialog
        visible={tts.scrollSyncDialogVisible}
        theme={theme}
        currentIndex={tts.ttsScrollPromptData?.currentIndex || 0}
        visibleIndex={tts.ttsScrollPromptData?.visibleIndex || 0}
        onSyncToVisible={tts.handleTTSScrollSyncConfirm}
        onKeepCurrent={tts.handleTTSScrollSyncCancel}
        onDismiss={tts.hideScrollSyncDialog}
      />
      <TTSManualModeDialog
        visible={tts.manualModeDialogVisible}
        theme={theme}
        onStopTTS={tts.handleStopTTS}
        onContinueFollowing={tts.handleContinueFollowing}
        onDismiss={tts.hideManualModeDialog}
      />
      <TTSSyncDialog
        visible={tts.syncDialogVisible}
        theme={theme}
        status={tts.syncDialogStatus}
        syncInfo={tts.syncDialogInfo}
        onDismiss={() => {
          tts.setSyncDialogVisible(false);
        }}
        onRetry={tts.handleSyncRetry}
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

export default memo(WebViewReaderRefactored);
