/**
 * useScrollSyncHandlers Hook
 *
 * Handlers for TTS scroll synchronization dialog.
 * Extracted from useTTSController.ts (Phase 1, Step 6)
 *
 * @module reader/hooks/useScrollSyncHandlers
 */

import { useCallback, RefObject } from 'react';
import WebView from 'react-native-webview';
import { TTSScrollPromptData } from '../types/tts';

/**
 * Scroll sync handlers parameters
 */
export interface ScrollSyncHandlersParams {
  webViewRef: RefObject<WebView | null>;
  refs: {
    ttsScrollPromptDataRef: RefObject<TTSScrollPromptData | null>;
  };
  callbacks: {
    hideScrollSyncDialog: () => void;
  };
}

/**
 * Scroll sync handlers interface
 */
export interface ScrollSyncHandlers {
  handleTTSScrollSyncConfirm: () => void;
  handleTTSScrollSyncCancel: () => void;
}

/**
 * Custom hook that provides scroll sync handlers
 *
 * @param params - Scroll sync handlers parameters
 * @returns Scroll sync handlers
 */
export function useScrollSyncHandlers(
  params: ScrollSyncHandlersParams,
): ScrollSyncHandlers {
  const {
    webViewRef,
    refs: { ttsScrollPromptDataRef },
    callbacks: { hideScrollSyncDialog },
  } = params;

  /**
   * Handle TTS scroll sync confirm - move TTS to visible position
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
    hideScrollSyncDialog();
  }, [webViewRef, ttsScrollPromptDataRef, hideScrollSyncDialog]);

  /**
   * Handle TTS scroll sync cancel - keep TTS at current position
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
    hideScrollSyncDialog();
  }, [webViewRef, ttsScrollPromptDataRef, hideScrollSyncDialog]);

  return {
    handleTTSScrollSyncConfirm,
    handleTTSScrollSyncCancel,
  };
}

export default useScrollSyncHandlers;
