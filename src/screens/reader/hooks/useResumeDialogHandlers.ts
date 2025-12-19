/**
 * useResumeDialogHandlers Hook
 *
 * Manages resume dialog actions: confirm, cancel, restart.
 *
 * @module reader/hooks/useResumeDialogHandlers
 * @dependencies
 *   - Phase 1: utilities.resumeTTS
 *   - Phase 1: dialogState.hideResumeDialog
 * @provides
 *   - handleResumeConfirm (used by: useTTSController return, useTTSConfirmationHandler)
 *   - handleResumeCancel (used by: useTTSConfirmationHandler) ← KEY OUTPUT
 *   - handleRestartChapter (used by: useTTSController return)
 */
/* eslint-disable no-console */

import { useCallback, RefObject } from 'react';
import WebView from 'react-native-webview';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { TTSPersistenceState } from '../types/tts';

/**
 * Resume dialog handlers parameters
 *
 * @property chapterId - Current chapter ID (from: useTTSController props)
 * @property chapterTtsState - Persisted TTS state JSON (from: useTTSController props)
 * @property webViewRef - WebView reference (from: useTTSController local)
 * @property refs - Mutable refs for position tracking
 *   - pendingResumeIndexRef: Pending resume position (from: useTTSController local)
 *   - latestParagraphIndexRef: Latest known position (from: useTTSController local)
 * @property callbacks - Functions from other hooks
 *   - resumeTTS: Start TTS from given state (from: Phase 1 useTTSUtilities)
 *   - hideResumeDialog: Hide resume dialog (from: Phase 1 useDialogState)
 */
export interface ResumeDialogHandlersParams {
  chapterId: number;
  chapterTtsState: string | null | undefined;
  webViewRef: RefObject<WebView | null>;
  refs: {
    pendingResumeIndexRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
  };
  callbacks: {
    resumeTTS: (state: TTSPersistenceState) => void;
    hideResumeDialog: () => void;
  };
}

/**
 * Resume dialog handler functions
 */
export interface ResumeDialogHandlers {
  handleResumeConfirm: () => void;
  handleResumeCancel: () => void;
  handleRestartChapter: () => void;
}

/**
 * Hook providing resume dialog handlers.
 *
 * **handleResumeConfirm**: Resolves position from 3 sources (max of ref, MMKV, prop), then calls resumeTTS
 * **handleResumeCancel**: Injects JS to start TTS from beginning (window.tts.hasAutoResumed = true)
 * **handleRestartChapter**: Injects JS to start from first readable element
 *
 * @example
 * const resumeDialogHandlers = useResumeDialogHandlers({
 *   chapterId: chapter.id,
 *   chapterTtsState: chapter.ttsState,
 *   webViewRef,
 *   refs: {
 *     pendingResumeIndexRef,
 *     latestParagraphIndexRef,
 *   },
 *   callbacks: {
 *     resumeTTS: utilities.resumeTTS,
 *     hideResumeDialog: dialogState.hideResumeDialog,
 *   },
 * });
 */
export function useResumeDialogHandlers(
  params: ResumeDialogHandlersParams,
): ResumeDialogHandlers {
  const { chapterId, chapterTtsState, webViewRef, refs, callbacks } = params;

  const handleResumeConfirm = useCallback(() => {
    const mmkvValue =
      MMKVStorage.getNumber(`chapter_progress_${chapterId}`) ?? -1;
    const refValue = refs.latestParagraphIndexRef.current ?? -1;
    const savedIndex = refs.pendingResumeIndexRef.current;
    const lastReadParagraph = Math.max(refValue, mmkvValue, savedIndex);

    refs.pendingResumeIndexRef.current = lastReadParagraph;
    refs.latestParagraphIndexRef.current = lastReadParagraph;

    const ttsState = chapterTtsState ? JSON.parse(chapterTtsState) : {};
    if (__DEV__) {
      console.log(
        'useTTSController: Resuming TTS. Resolved index:',
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
    callbacks.resumeTTS({
      ...ttsState,
      paragraphIndex: lastReadParagraph,
      timestamp: Date.now(),
    });
  }, [chapterId, chapterTtsState, refs, callbacks]);

  const handleResumeCancel = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      window.tts.hasAutoResumed = true;
      window.tts.start();
    `);
  }, [webViewRef]);

  const handleRestartChapter = useCallback(() => {
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
    callbacks.hideResumeDialog();
  }, [webViewRef, callbacks]);

  return {
    handleResumeConfirm,
    handleResumeCancel,
    handleRestartChapter,
  };
}
