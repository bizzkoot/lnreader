/**
 * WebViewReader Component (Refactored)
 *
 * This version uses the useTTSController hook for TTS functionality.
 * Non-TTS logic (HTML generation, settings, WebView rendering) remains in this file.
 *
 * @module reader/components/WebViewReader
 */

/* eslint-disable no-console */

import React, {
  memo,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useState,
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
  getChapter as getDbChapter,
  getNextChapter,
} from '@database/queries/ChapterQueries';
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
import { fetchChapter } from '@services/plugin/fetch';
import { PLUGIN_STORAGE, NOVEL_STORAGE } from '@utils/Storages';
import NativeFile from '@specs/NativeFile';
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
import { getNovelTtsSettings } from '@services/tts/novelTtsSettings';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

// Import the TTS hook
import { useTTSController } from '../hooks/useTTSController';
import { WebViewPostEvent } from '../types/tts';

type WebViewReaderProps = {
  onPress(): void;
};

const { RNDeviceInfo } = NativeModules;
const deviceInfoEmitter = new NativeEventEmitter(RNDeviceInfo);

const assetsUriPrefix = __DEV__
  ? 'http://localhost:8081/assets'
  : 'file:///android_asset';

const readerLog = createRateLimitedLogger('WebViewReader', { windowMs: 1500 });

/**
 * Validates continuous scrolling settings to prevent invalid values from causing issues.
 * Provides defensive checks against corrupted storage or invalid inputs.
 */
const validateContinuousScrollSettings = (
  stitchThreshold: number | undefined,
  transitionThreshold: number | undefined,
): { stitchThreshold: number; transitionThreshold: number } => {
  // Validate stitch threshold (valid range: 50-95)
  const validStitchThreshold = Math.max(
    50,
    Math.min(95, Number(stitchThreshold) || 90),
  );

  // Validate transition threshold (valid range: 5-20)
  const validTransitionThreshold = Math.max(
    5,
    Math.min(20, Number(transitionThreshold) || 15),
  );

  return {
    stitchThreshold: validStitchThreshold,
    transitionThreshold: validTransitionThreshold,
  };
};

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
    setAdjacentChapter,
  } = useChapterContext();
  const theme = useTheme();

  const webViewNonceRef = useRef<string>(createWebViewNonce());
  const allowMessageRef = useRef(createMessageRateLimiter());

  // Chapter transition state for invisible reload
  const [isTransitioning, setIsTransitioning] = useState(false);
  const transitionReadyRef = useRef(false);

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

  // Apply per-novel TTS overrides (if enabled) on chapter/novel changes.
  useEffect(() => {
    try {
      if (!novel?.id) return;

      const stored = getNovelTtsSettings(novel.id);
      if (stored?.enabled && stored.tts) {
        const nextReaderSettings = {
          ...readerSettingsRef.current,
          tts: {
            ...readerSettingsRef.current.tts,
            ...stored.tts,
          },
        } as ChapterReaderSettings;

        readerSettingsRef.current = nextReaderSettings;
        applyTtsUpdateToWebView(nextReaderSettings.tts, webViewRef);
      }
    } catch {
      // Best-effort: never block reader load
    }
  }, [novel?.id, chapter.id, webViewRef]);

  // CRITICAL FIX: Capture initial nextChapter/prevChapter to prevent HTML regeneration
  // These values are only used for initial WebView load. Updates after that are via injectJavaScript.
  const initialNextChapter = useRef(nextChapter);
  const initialPrevChapter = useRef(prevChapter);

  // Update adjacent chapter refs when they change (needed for chapter transitions)
  useEffect(() => {
    initialNextChapter.current = nextChapter;
    initialPrevChapter.current = prevChapter;
    readerLog.debug(
      'adjacent-refs',
      `next=${nextChapter?.id ?? 'none'} prev=${prevChapter?.id ?? 'none'}`,
    );
  }, [nextChapter, prevChapter]);

  useEffect(() => {
    readerSettingsRef.current = readerSettings;
    chapterGeneralSettingsRef.current = chapterGeneralSettings;
  }, [readerSettings, chapterGeneralSettings]);

  // Calculate initial saved paragraph index - MMKV is single source of truth
  const initialSavedParagraphIndex = useMemo(() => {
    const mmkvIndex =
      MMKVStorage.getNumber(`chapter_progress_${chapter.id}`) ?? -1;
    readerLog.debug('init-scroll', `mmkvIndex=${mmkvIndex}`);
    return mmkvIndex >= 0 ? mmkvIndex : 0;
  }, [chapter.id]);

  // Stable chapter object
  const stableChapter = useMemo(
    () => ({ ...chapter }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter.id],
  );

  const batteryLevel = useMemo(() => getBatteryLevelSync(), []);

  // Validate continuous scrolling settings to prevent invalid values
  const validatedScrollSettings = useMemo(
    () =>
      validateContinuousScrollSettings(
        chapterGeneralSettings.continuousScrollStitchThreshold,
        chapterGeneralSettings.continuousScrollTransitionThreshold,
      ),
    [
      chapterGeneralSettings.continuousScrollStitchThreshold,
      chapterGeneralSettings.continuousScrollTransitionThreshold,
    ],
  );

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

  // Track previous TTS values to detect genuine changes
  const previousTtsRef = useRef(liveReaderTts);

  useEffect(() => {
    if (liveReaderTts) {
      // Compare against PREVIOUS values, not current ref
      const oldTts = previousTtsRef.current;

      // Compare actual values BEFORE updating the ref
      const voiceChanged =
        oldTts?.voice?.identifier !== liveReaderTts.voice?.identifier;
      const rateChanged = oldTts?.rate !== liveReaderTts.rate;
      const pitchChanged = oldTts?.pitch !== liveReaderTts.pitch;
      const settingsChanged = voiceChanged || rateChanged || pitchChanged;

      // Only proceed if settings actually changed
      if (settingsChanged) {
        // Update both refs with new settings
        previousTtsRef.current = liveReaderTts;
        readerSettingsRef.current = {
          ...readerSettingsRef.current,
          tts: liveReaderTts,
        } as any;

        // Apply to WebView
        applyTtsUpdateToWebView(liveReaderTts, webViewRef);

        // Restart TTS if currently playing
        if (tts.isTTSReading && tts.currentParagraphIndex >= 0) {
          if (__DEV__) {
            console.log(
              'WebViewReader: TTS settings changed while playing, restarting with new settings',
            );
          }

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
          if (__DEV__) {
            console.log(
              'WebViewReader: MMKV listener fired for CHAPTER_GENERAL_SETTINGS',
              newSettings,
            );
          }
          webViewRef.current?.injectJavaScript(
            `if (window.reader && window.reader.generalSettings) {
               window.reader.generalSettings.val = ${newSettings};
               if (${__DEV__}) { console.log('TTS: Updated general settings via listener'); }
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
               if (${__DEV__}) { console.log('TTS: Settings changed, injecting'); }
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
            chapterGeneralSettings: {
              ...chapterGeneralSettings,
              continuousScrollStitchThreshold:
                validatedScrollSettings.stitchThreshold,
              continuousScrollTransitionThreshold:
                validatedScrollSettings.transitionThreshold,
            },
            novel,
            chapter: stableChapter,
            nextChapter: initialNextChapter.current,
            prevChapter: initialPrevChapter.current,
            batteryLevel,
            autoSaveInterval: 2222,
            DEBUG: __DEV__,
            strings: {
              finished: `${getString('readerScreen.finished')}: ${stableChapter.name.trim()}`,
              nextChapter: getString('readerScreen.nextChapter', {
                name: initialNextChapter.current?.name,
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
    validatedScrollSettings,
    stableChapter,
    html,
    novel,
    // REMOVED: nextChapter, prevChapter - these are updated via injectJavaScript, don't regenerate HTML
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
        'fetch-chapter-content',
        'chapter-appended',
        'stitched-chapters-cleared',
        'chapter-transition',
      ] as const);
      if (!msg) {
        return;
      }

      // Security: enforce nonce for inbound WebView messages.
      if (msg.nonce !== webViewNonceRef.current) {
        return;
      }

      const event = msg as unknown as WebViewPostEvent;

      // Handle console logs in dev mode
      if (event.type === 'console') {
        if (__DEV__) {
          console.info(
            `[WebView Console] ${JSON.stringify(event.data, null, 2)}`,
          );
        }
        return;
      }

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
          if (
            typeof event.data === 'number' ||
            typeof event.paragraphIndex === 'number'
          ) {
            const eventChapterId =
              typeof event.chapterId === 'number'
                ? event.chapterId
                : typeof event.chapterId === 'string'
                  ? Number(event.chapterId)
                  : NaN;

            if (!Number.isFinite(eventChapterId)) {
              readerLog.warn('save-ignore-missing-chapterId');
              break;
            }
            if (eventChapterId !== chapter.id) {
              readerLog.debug(
                'save-ignore-stale-chapter',
                `from=${String(event.chapterId)} current=${chapter.id}`,
              );
              break;
            }

            const savePercent =
              typeof event.data === 'number'
                ? event.data
                : typeof (event.data as any)?.percent === 'number'
                  ? (event.data as any).percent
                  : undefined;

            // Block non-TTS saves when TTS is reading
            if (tts.isTTSReading) {
              if (event.paragraphIndex === undefined) {
                readerLog.debug('save-ignore-non-tts-while-reading');
                break;
              }
              const currentIdx = tts.currentParagraphIndex ?? -1;
              if (
                typeof event.paragraphIndex === 'number' &&
                currentIdx >= 0 &&
                event.paragraphIndex < currentIdx - 1
              ) {
                readerLog.debug(
                  'save-ignore-backwards',
                  `save=${event.paragraphIndex} current=${currentIdx}`,
                );
                break;
              }
            }

            readerLog.info(
              'save',
              `percent=${savePercent ?? 'n/a'} paragraph=${event.paragraphIndex ?? 'n/a'}`,
            );

            if (event.paragraphIndex !== undefined) {
              tts.latestParagraphIndexRef.current = event.paragraphIndex;
              MMKVStorage.set(
                `chapter_progress_${chapter.id}`,
                event.paragraphIndex,
              );
            }
            if (savePercent !== undefined) {
              saveProgress(
                savePercent,
                event.paragraphIndex as number | undefined,
              );
            }
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
            if (__DEV__) {
              console.log(
                'WebViewReader: Received TTS settings update:',
                ttsData,
              );
            }

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
        case 'fetch-chapter-content':
          // DOM Stitching: Fetch next chapter content and send back to WebView
          if (event.data && typeof event.data === 'object') {
            const eventData = event.data as unknown as {
              chapter: { id: number; name: string; path: string };
            };
            const targetChapter = eventData.chapter;
            if (__DEV__) {
              console.log(
                `WebViewReader: Fetching chapter content for ${targetChapter.name}`,
              );
            }

            const getChapterContent = async () => {
              try {
                // 1. Try to read from local storage (downloaded)
                if (novel?.pluginId && novel?.id) {
                  const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${targetChapter.id}/index.html`;
                  if (NativeFile.exists(filePath)) {
                    if (__DEV__) {
                      console.log('WebViewReader: Reading from local file');
                    }
                    return NativeFile.readFile(filePath);
                  }
                }
              } catch (e) {
                if (__DEV__) {
                  console.warn('WebViewReader: Error reading local file', e);
                }
              }

              // 2. Fallback to network fetch
              if (__DEV__) {
                console.log(
                  'WebViewReader: Local file not found, fetching from network',
                );
              }
              return await fetchChapter(
                novel?.pluginId || '',
                targetChapter.path,
              );
            };

            // Use our new helper
            getChapterContent()
              .then(chapterHtml => {
                if (__DEV__) {
                  console.log(
                    `WebViewReader: Got chapter HTML (${chapterHtml.length} chars)`,
                  );
                }
                // Send chapter content back to WebView
                webViewRef.current?.injectJavaScript(`
                  if (window.reader && window.reader.receiveChapterContent) {
                    window.reader.receiveChapterContent(
                      ${targetChapter.id},
                      ${JSON.stringify(targetChapter.name)},
                      ${JSON.stringify(chapterHtml)}
                    );
                  }
                  true;
                `);
              })
              .catch(err => {
                if (__DEV__) {
                  console.error('WebViewReader: Failed to fetch chapter', err);
                }
                webViewRef.current?.injectJavaScript(`
                  if (window.reader) {
                    window.reader.isNavigating = false;
                    window.reader.pendingChapterFetch = false;
                  }
                  true;
                `);
              });
          }
          break;
        case 'chapter-appended':
          // DOM Stitching: Chapter was appended to DOM
          if (event.data && typeof event.data === 'object') {
            const eventData = event.data as unknown as {
              chapterId: number;
              chapterName: string;
              loadedChapters: number[];
            };
            if (__DEV__) {
              console.log(
                `WebViewReader: Chapter appended - ${eventData.chapterName}, total: ${eventData.loadedChapters.length}`,
              );
            }

            // FIX: Update nextChapter after successful append
            const appendedChapterId = eventData.chapterId;
            getDbChapter(appendedChapterId)
              .then(async appendedChapter => {
                if (!appendedChapter) {
                  if (__DEV__) {
                    console.error(
                      `WebViewReader: Appended chapter ${appendedChapterId} not found in DB`,
                    );
                  }
                  return;
                }

                // Get next chapter after the appended one
                const newNextChapter = await getNextChapter(
                  appendedChapter.novelId,
                  appendedChapter.position!,
                  appendedChapter.page,
                );

                if (newNextChapter) {
                  if (__DEV__) {
                    console.log(
                      `WebViewReader: Updated nextChapter to ${newNextChapter.id} (${newNextChapter.name})`,
                    );
                  }
                  // Update React state
                  setAdjacentChapter([newNextChapter, prevChapter!]);

                  // Inject updated nextChapter to WebView
                  webViewRef.current?.injectJavaScript(`
                    if (window.reader) {
                      window.reader.nextChapter = ${JSON.stringify({
                        id: newNextChapter.id,
                        name: newNextChapter.name,
                      })};
                    }
                    true;
                  `);
                } else {
                  if (__DEV__) {
                    console.log(
                      `WebViewReader: No more chapters after ${appendedChapterId}`,
                    );
                  }
                  // Clear nextChapter - set both to undefined
                  setAdjacentChapter([undefined, undefined]);
                  webViewRef.current?.injectJavaScript(`
                    if (window.reader) {
                      window.reader.nextChapter = null;
                    }
                    true;
                  `);
                }
              })
              .catch(err => {
                if (__DEV__) {
                  console.error(
                    `WebViewReader: Failed to get next chapter after ${appendedChapterId}:`,
                    err,
                  );
                }
              });
          }
          break;
        case 'stitched-chapters-cleared':
          // TTS: Stitched chapters were cleared, update chapter context
          // COMPLETE FIX: Now calls getChapter() for full reload (like chapter-transition)
          if (event.data && typeof event.data === 'object') {
            const eventData = event.data as unknown as {
              chapterId: number;
              chapterName: string;
              localParagraphIndex?: number; // The paragraph index in the cleared chapter
            };
            if (__DEV__) {
              console.log(
                `WebViewReader: Stitched chapters cleared to ${eventData.chapterName} (${eventData.chapterId})`,
              );
            }

            // Get the visible chapter from DB
            getDbChapter(eventData.chapterId)
              .then(async visibleChapter => {
                if (!visibleChapter) {
                  if (__DEV__) {
                    console.error(
                      `WebViewReader: Visible chapter ${eventData.chapterId} not found in DB`,
                    );
                  }
                  return;
                }

                if (__DEV__) {
                  console.log(
                    `WebViewReader: Performing full reload for ${visibleChapter.name}`,
                  );
                }

                // Save current paragraph index to MMKV for the visible chapter
                // This ensures when getChapter() triggers HTML reload, the position is restored
                if (
                  eventData.localParagraphIndex !== undefined &&
                  eventData.localParagraphIndex >= 0
                ) {
                  await MMKVStorage.set(
                    `chapter_progress_${eventData.chapterId}`,
                    eventData.localParagraphIndex,
                  );
                  // Small delay to ensure MMKV write is flushed before reload
                  await new Promise(resolve => setTimeout(resolve, 50));
                  if (__DEV__) {
                    console.log(
                      `WebViewReader: Saved paragraph ${eventData.localParagraphIndex} to MMKV for chapter ${eventData.chapterId}`,
                    );
                  }
                }

                // CRITICAL: Update TTS controller's prevChapterIdRef BEFORE reload
                // This ensures TTS commands use the correct chapterId during/after reload
                if (__DEV__) {
                  console.log(
                    `WebViewReader: Updating TTS prevChapterIdRef from ${tts.prevChapterIdRef.current} to ${visibleChapter.id}`,
                  );
                }
                tts.prevChapterIdRef.current = visibleChapter.id;

                // START INVISIBLE TRANSITION
                // Hide WebView before reload to prevent visual flash
                setIsTransitioning(true);
                transitionReadyRef.current = false;
                if (__DEV__) {
                  console.log(
                    'WebViewReader: Started invisible transition for TTS trim',
                  );
                }

                // Call getChapter() to properly update ALL state
                // This matches the behavior of scroll-triggered trim (chapter-transition)
                // getChapter() updates: chapter, chapterText, nextChapter, prevChapter
                await getChapter(visibleChapter);
                if (__DEV__) {
                  console.log(
                    `WebViewReader: getChapter() called for ${visibleChapter.name} (${visibleChapter.id})`,
                  );
                }
                // Note: setIsTransitioning(false) is called in onLoadEnd after scroll restoration
              })
              .catch(err => {
                if (__DEV__) {
                  console.error(
                    `WebViewReader: Failed to handle TTS stitched clear for ${eventData.chapterId}:`,
                    err,
                  );
                }
                setIsTransitioning(false);
                // Add recovery: show toast to inform user
                showToastMessage('Failed to process chapter transition');
              });
          }
          break;
        case 'chapter-transition':
          // DOM Stitching: Chapter was trimmed and we've transitioned to a new chapter
          // This handler saves position and calls getChapter() to properly update all state
          if (event.data && typeof event.data === 'object') {
            const eventData = event.data as unknown as {
              previousChapterId: number;
              currentChapterId: number;
              currentChapterName: string;
              loadedChapters: number[];
              currentParagraphIndex: number;
              reason: string;
            };
            if (__DEV__) {
              console.log(
                `WebViewReader: Chapter transition - ${eventData.previousChapterId} -> ${eventData.currentChapterId} (${eventData.currentChapterName}), paragraph: ${eventData.currentParagraphIndex}, reason: ${eventData.reason}`,
              );
            }

            // Save current paragraph index to MMKV for the NEW chapter
            // This ensures when getChapter() triggers HTML reload, the position is restored
            if (
              eventData.currentParagraphIndex !== undefined &&
              eventData.currentParagraphIndex >= 0
            ) {
              MMKVStorage.set(
                `chapter_progress_${eventData.currentChapterId}`,
                eventData.currentParagraphIndex,
              );
              if (__DEV__) {
                console.log(
                  `WebViewReader: Saved paragraph ${eventData.currentParagraphIndex} to MMKV for chapter ${eventData.currentChapterId}`,
                );
              }
            }

            // Mark the previous chapter as 100% read before switching
            if (eventData.reason === 'trim') {
              saveProgress(100);
              if (__DEV__) {
                console.log(
                  `WebViewReader: Marked previous chapter ${eventData.previousChapterId} as 100% read`,
                );
              }
            }

            // START INVISIBLE TRANSITION
            // Hide WebView before reload to prevent visual flash
            setIsTransitioning(true);
            transitionReadyRef.current = false;
            if (__DEV__) {
              console.log('WebViewReader: Started invisible transition');
            }

            // Get the current chapter from DB and call getChapter() to properly update all state
            // getChapter() updates: chapter, chapterText, nextChapter, prevChapter
            getDbChapter(eventData.currentChapterId)
              .then(async currentChapter => {
                if (!currentChapter) {
                  if (__DEV__) {
                    console.error(
                      `WebViewReader: Current chapter ${eventData.currentChapterId} not found in DB`,
                    );
                  }
                  return;
                }

                // The initialSavedParagraphIndex will read from MMKV and restore position
                await getChapter(currentChapter);
                if (__DEV__) {
                  console.log(
                    `WebViewReader: getChapter() called for ${currentChapter.name} (${currentChapter.id})`,
                  );
                }
                // Note: setIsTransitioning(false) is called in onLoadEnd after scroll restoration
              })
              .catch(err => {
                if (__DEV__) {
                  console.error(
                    `WebViewReader: Failed to handle chapter transition to ${eventData.currentChapterId}:`,
                    err,
                  );
                }
                setIsTransitioning(false);
                // Add recovery: show toast to inform user
                showToastMessage('Failed to process chapter transition');
              });
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
      novel?.pluginId,
      novel?.id,
      prevChapter,
      setAdjacentChapter,
      getChapter,
    ],
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      <WebView
        ref={webViewRef}
        style={{
          backgroundColor: readerSettings.theme,
          // During chapter transition, hide WebView to prevent visual flash
          opacity: isTransitioning ? 0 : 1,
        }}
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

          // Sync nextChapter/prevChapter with React state
          // This fixes the issue where HTML is generated before adjacent chapters are updated
          webViewRef.current?.injectJavaScript(`
            if (window.reader) {
              window.reader.nextChapter = ${JSON.stringify(nextChapter ? { id: nextChapter.id, name: nextChapter.name } : null)};
              window.reader.prevChapter = ${JSON.stringify(prevChapter ? { id: prevChapter.id, name: prevChapter.name } : null)};
            }
            true;
          `);

          // END INVISIBLE TRANSITION after a brief delay for scroll to complete
          // The delay allows the initial scroll (to savedParagraphIndex) to finish
          if (isTransitioning) {
            setTimeout(() => {
              setIsTransitioning(false);
              if (__DEV__) {
                console.log('WebViewReader: Invisible transition complete');
              }
            }, 200); // Optimized delay (reduced from 350ms) for faster transitions
          }

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
        currentChapterName={tts.ttsScrollPromptData?.currentChapterName}
        visibleChapterName={tts.ttsScrollPromptData?.visibleChapterName}
        isStitched={tts.ttsScrollPromptData?.isStitched}
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
