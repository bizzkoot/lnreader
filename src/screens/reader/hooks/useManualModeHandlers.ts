/**
 * useManualModeHandlers Hook
 *
 * Handlers for TTS manual mode dialog.
 * Extracted from useTTSController.ts (Phase 1, Step 7)
 *
 * @module reader/hooks/useManualModeHandlers
 */

import { useCallback, RefObject } from 'react';
import WebView from 'react-native-webview';
import TTSHighlight from '@services/TTSHighlight';

/**
 * Manual mode handlers parameters
 */
export interface ManualModeHandlersParams {
  webViewRef: RefObject<WebView | null>;
  showToastMessage: (message: string) => void;
  refreshChaptersFromContext: () => void;
  refs: {
    isTTSReadingRef: RefObject<boolean>;
    isTTSPlayingRef: RefObject<boolean>;
    hasUserScrolledRef: RefObject<boolean>;
  };
  callbacks: {
    hideManualModeDialog: () => void;
  };
}

/**
 * Manual mode handlers interface
 */
export interface ManualModeHandlers {
  handleStopTTS: () => void;
  handleContinueFollowing: () => void;
}

/**
 * Custom hook that provides manual mode handlers
 *
 * @param params - Manual mode handlers parameters
 * @returns Manual mode handlers
 */
export function useManualModeHandlers(
  params: ManualModeHandlersParams,
): ManualModeHandlers {
  const {
    webViewRef,
    showToastMessage,
    refreshChaptersFromContext,
    refs: { isTTSReadingRef, isTTSPlayingRef, hasUserScrolledRef },
    callbacks: { hideManualModeDialog },
  } = params;

  /**
   * Handle stop TTS - switch to manual reading mode
   */
  const handleStopTTS = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.handleManualModeDialog) {
        window.tts.handleManualModeDialog('stop');
      }
      true;
    `);
    isTTSReadingRef.current = false;
    isTTSPlayingRef.current = false;
    hasUserScrolledRef.current = false;
    TTSHighlight.stop();

    // ✅ NEW: Sync chapter list immediately on TTS stop
    setTimeout(() => {
      refreshChaptersFromContext();
    }, 100);

    showToastMessage('Switched to manual reading mode');
    hideManualModeDialog();
  }, [
    webViewRef,
    showToastMessage,
    refreshChaptersFromContext,
    hideManualModeDialog,
    isTTSReadingRef,
    isTTSPlayingRef,
    hasUserScrolledRef,
  ]);

  /**
   * Handle continue following - resume TTS and keep following
   */
  const handleContinueFollowing = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      if (window.tts && window.tts.handleManualModeDialog) {
        window.tts.handleManualModeDialog('continue');
      }
      true;
    `);
    hideManualModeDialog();
  }, [webViewRef, hideManualModeDialog]);

  return {
    handleStopTTS,
    handleContinueFollowing,
  };
}

export default useManualModeHandlers;
