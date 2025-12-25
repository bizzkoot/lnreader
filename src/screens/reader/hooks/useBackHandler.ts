import { useCallback, RefObject, MutableRefObject } from 'react';
import WebView from 'react-native-webview';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '@navigators/types';

const backLog = createRateLimitedLogger('useBackHandler', { windowMs: 1500 });

interface BackHandlerParams {
  chapterId: number;
  webViewRef: RefObject<WebView | null>;
  saveProgress: (progress: number) => void;
  navigation: StackNavigationProp<RootStackParamList>;
  showExitDialog: boolean;
  showChapterSelectionDialog: boolean;
  refs: {
    isTTSReadingRef: MutableRefObject<boolean>;
    currentParagraphIndexRef: MutableRefObject<number>;
    latestParagraphIndexRef: MutableRefObject<number | undefined>;
  };
  callbacks: {
    handleStopTTS: () => void;
  };
}

interface BackHandler {
  handleBackPress: () => boolean;
}

/**
 * Hook: useBackHandler
 *
 * Purpose: Handle Android back button during TTS
 *
 * Responsibilities:
 * - Allow dialogs to handle back press first
 * - Save TTS position and exit when TTS playing
 * - Check gap when TTS paused (>5 paragraphs = show exit dialog)
 * - Inject JavaScript to determine visible vs TTS position gap
 *
 * Dependencies:
 * - Phase 1: handleStopTTS from useManualModeHandlers
 * - Phase 1: showExitDialog, showChapterSelectionDialog from useDialogState
 */
export const useBackHandler = ({
  chapterId,
  webViewRef,
  saveProgress,
  navigation,
  showExitDialog,
  showChapterSelectionDialog,
  refs,
  callbacks,
}: BackHandlerParams): BackHandler => {
  /**
   * Handle back press - returns true if handled
   */
  const handleBackPress = useCallback((): boolean => {
    if (showExitDialog || showChapterSelectionDialog) {
      return false;
    }

    if (refs.isTTSReadingRef.current) {
      const ttsPosition = refs.currentParagraphIndexRef.current ?? 0;
      backLog.info(
        'back-while-playing',
        `Back pressed while TTS playing. Saving TTS position: ${ttsPosition}`,
      );

      callbacks.handleStopTTS();
      saveProgress(ttsPosition);
      navigation.goBack();
      return true;
    }

    const lastTTSPosition = refs.latestParagraphIndexRef.current ?? -1;

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
               chapterId: ${chapterId},
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
    chapterId,
    webViewRef,
    saveProgress,
    navigation,
    refs,
    callbacks,
  ]);

  return {
    handleBackPress,
  };
};
