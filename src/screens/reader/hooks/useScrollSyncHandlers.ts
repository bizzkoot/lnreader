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
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const syncLog = createRateLimitedLogger('useScrollSyncHandlers', {
  windowMs: 1500,
});

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
      const { visibleIndex, isResume, isStitched } =
        ttsScrollPromptDataRef.current;

      // If stitched mode, calculate chapter-local index and set restart intent
      if (isStitched) {
        syncLog.debug(
          'stitched-mode',
          `Stitched mode - calculating chapter info for paragraph ${visibleIndex}`,
        );

        webViewRef.current?.injectJavaScript(`
          (function() {
            // Get chapter info for the visible paragraph
            const chapterInfo = window.reader.getChapterInfoForParagraph(${visibleIndex});

            if (!chapterInfo) {
              console.error('useScrollSyncHandlers: Failed to get chapter info for paragraph ${visibleIndex}');
              return;
            }

            console.log('useScrollSyncHandlers: Chapter info:', JSON.stringify(chapterInfo));
            
            // Set restart intent with chapter ID and local index
            if (window.reader && window.reader.setTTSRestartIntent) {
              window.reader.setTTSRestartIntent(
                chapterInfo.chapterId, 
                chapterInfo.localIndex, 
                ${isResume}
              );
            }
            
            // Trigger clear manually - auto-restart will handle TTS after 200ms
            if (window.reader && window.reader.clearStitchedChapters) {
              window.reader.clearStitchedChapters();
            }
          })();
          true;
        `);
      } else {
        // Normal single-chapter mode - no stitched clear needed
        webViewRef.current?.injectJavaScript(`
          if (window.tts && window.tts.changeParagraphPosition) {
            window.tts.changeParagraphPosition(${visibleIndex});
            ${isResume ? 'window.tts.resume(true);' : ''}
          }
          true;
        `);
      }
    }
    ttsScrollPromptDataRef.current = null;
    hideScrollSyncDialog();
  }, [webViewRef, ttsScrollPromptDataRef, hideScrollSyncDialog]);

  /**
   * Handle TTS scroll sync cancel - keep TTS at current position
   */
  const handleTTSScrollSyncCancel = useCallback(() => {
    if (ttsScrollPromptDataRef.current) {
      const { currentIndex, isResume, isStitched } =
        ttsScrollPromptDataRef.current;

      // If stitched mode, need to scroll back to current TTS position and set restart intent
      if (isStitched) {
        syncLog.debug(
          'stitched-keep-position',
          `Stitched mode - keeping current position ${currentIndex}`,
        );

        webViewRef.current?.injectJavaScript(`
          (function() {
            // Get chapter info for the current TTS paragraph
            const chapterInfo = window.reader.getChapterInfoForParagraph(${currentIndex});

            if (!chapterInfo) {
              console.error('useScrollSyncHandlers: Failed to get chapter info for paragraph ${currentIndex}');
              return;
            }

            console.log('useScrollSyncHandlers: Current chapter info:', JSON.stringify(chapterInfo));
            
            // Scroll back to current TTS position before clearing
            const readableElements = window.reader.getReadableElements();
            if (readableElements && readableElements[${currentIndex}]) {
              if (window.tts && window.tts.scrollToElement) {
                window.tts.scrollToElement(readableElements[${currentIndex}]);
              }
            }
            
            // Set restart intent with chapter ID and local index
            if (window.reader && window.reader.setTTSRestartIntent) {
              window.reader.setTTSRestartIntent(
                chapterInfo.chapterId, 
                chapterInfo.localIndex, 
                ${isResume}
              );
            }
            
            // Trigger clear manually - auto-restart will handle TTS after 200ms
            if (window.reader && window.reader.clearStitchedChapters) {
              window.reader.clearStitchedChapters();
            }
          })();
          true;
        `);
      } else {
        // Normal single-chapter mode
        if (isResume) {
          webViewRef.current?.injectJavaScript(`
            if (window.tts && window.tts.resume) {
              window.tts.resume(true);
            }
            true;
          `);
        }
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
