/**
 * useTTSUtilities Hook
 *
 * Utility functions for TTS operations.
 * Extracted from useTTSController.ts (Phase 1, Step 3)
 *
 * @module reader/hooks/useTTSUtilities
 */

import { useCallback, RefObject } from 'react';
import WebView from 'react-native-webview';
import TTSHighlight from '@services/TTSHighlight';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { extractParagraphs } from '@utils/htmlParagraphExtractor';
import { validateAndClampParagraphIndex } from '../components/ttsHelpers';
import { ChapterInfo, NovelInfo } from '@database/types';
import { ChapterReaderSettings } from '@hooks/persisted/useSettings';
import { TTSQueueState, TTSPersistenceState } from '../types/tts';

/**
 * TTS utilities parameters
 */
export interface TTSUtilitiesParams {
  novel: NovelInfo;
  chapter: ChapterInfo;
  html: string;
  webViewRef: RefObject<WebView | null>;
  readerSettingsRef: RefObject<ChapterReaderSettings>;
  refs: {
    currentParagraphIndexRef: RefObject<number>;
    totalParagraphsRef: RefObject<number>;
    latestParagraphIndexRef: RefObject<number>;
    isTTSPausedRef: RefObject<boolean>;
    isTTSPlayingRef: RefObject<boolean>;
    hasUserScrolledRef: RefObject<boolean>;
    ttsQueueRef: RefObject<TTSQueueState>;
    isTTSReadingRef: RefObject<boolean>;
    lastTTSChapterIdRef: RefObject<number | null>;
  };
}

/**
 * TTS utilities interface
 */
export interface TTSUtilities {
  updateTtsMediaNotificationState: (nextIsPlaying: boolean) => void;
  updateLastTTSChapter: (id: number) => void;
  restartTtsFromParagraphIndex: (targetIndex: number) => Promise<void>;
  resumeTTS: (storedState: TTSPersistenceState) => void;
}

/**
 * Custom hook that provides TTS utility functions
 *
 * @param params - TTS utilities parameters
 * @returns TTS utility functions
 */
export function useTTSUtilities(params: TTSUtilitiesParams): TTSUtilities {
  const {
    novel,
    chapter,
    html,
    webViewRef,
    readerSettingsRef,
    refs: {
      currentParagraphIndexRef,
      totalParagraphsRef,
      latestParagraphIndexRef,
      isTTSPausedRef,
      isTTSPlayingRef,
      hasUserScrolledRef,
      ttsQueueRef,
      isTTSReadingRef,
      lastTTSChapterIdRef,
    },
  } = params;

  /**
   * Update TTS media notification state
   */
  const updateTtsMediaNotificationState = useCallback(
    (nextIsPlaying: boolean) => {
      try {
        const novelName = novel?.name ?? 'LNReader';
        const chapterLabel = chapter.name || `Chapter ${chapter.id}`;

        const paragraphIndex = Math.max(0, currentParagraphIndexRef.current);
        const totalParagraphs = Math.max(0, totalParagraphsRef.current);

        TTSHighlight.updateMediaState({
          novelName,
          chapterLabel,
          chapterId: chapter.id,
          paragraphIndex,
          totalParagraphs,
          isPlaying: nextIsPlaying,
        }).catch(() => {
          // Best-effort: notification updates should never break TTS
        });
      } catch {
        // ignore
      }
    },
    [
      chapter.id,
      chapter.name,
      novel?.name,
      currentParagraphIndexRef,
      totalParagraphsRef,
    ],
  );

  /**
   * Update last TTS chapter ID in MMKV storage
   */
  const updateLastTTSChapter = useCallback(
    (id: number) => {
      lastTTSChapterIdRef.current = id;
      MMKVStorage.set('lastTTSChapterId', id);
    },
    [lastTTSChapterIdRef],
  );

  /**
   * Restart TTS from a specific paragraph index
   */
  const restartTtsFromParagraphIndex = useCallback(
    async (targetIndex: number) => {
      const paragraphs = extractParagraphs(html);
      if (!paragraphs || paragraphs.length === 0) return;

      const clamped = validateAndClampParagraphIndex(
        targetIndex,
        paragraphs.length,
        'media control seek',
      );

      // Stop audio completely before restarting from new position
      // Note: speakBatch() will transition to STARTING state, preventing false onQueueEmpty
      await TTSHighlight.stop();

      const remaining = paragraphs.slice(clamped);
      const ids = remaining.map(
        (_, i) => `chapter_${chapter.id}_utterance_${clamped + i}`,
      );

      ttsQueueRef.current = {
        startIndex: clamped,
        texts: remaining,
      };

      currentParagraphIndexRef.current = clamped;
      latestParagraphIndexRef.current = clamped;
      isTTSPausedRef.current = false;
      isTTSPlayingRef.current = true;
      hasUserScrolledRef.current = false;

      await TTSHighlight.speakBatch(remaining, ids, {
        voice: readerSettingsRef.current.tts?.voice?.identifier,
        pitch: readerSettingsRef.current.tts?.pitch || 1,
        rate: readerSettingsRef.current.tts?.rate || 1,
      });

      isTTSReadingRef.current = true;
      updateTtsMediaNotificationState(true);
    },
    [
      chapter.id,
      html,
      readerSettingsRef,
      ttsQueueRef,
      currentParagraphIndexRef,
      latestParagraphIndexRef,
      isTTSPausedRef,
      isTTSPlayingRef,
      hasUserScrolledRef,
      isTTSReadingRef,
      updateTtsMediaNotificationState,
    ],
  );

  /**
   * Resume TTS from stored state
   */
  const resumeTTS = useCallback(
    (storedState: TTSPersistenceState) => {
      webViewRef.current?.injectJavaScript(`
        window.tts.restoreState({ 
          shouldResume: true,
          paragraphIndex: ${storedState.paragraphIndex},
          autoStart: true
        });
        true;
      `);
    },
    [webViewRef],
  );

  return {
    updateTtsMediaNotificationState,
    updateLastTTSChapter,
    restartTtsFromParagraphIndex,
    resumeTTS,
  };
}

export default useTTSUtilities;
