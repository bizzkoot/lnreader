/**
 * useRefSync Hook
 *
 * Syncs refs with props to avoid stale closures in long-lived event listeners.
 * Extracted from useTTSController.ts (Phase 1, Step 2)
 *
 * @module reader/hooks/useRefSync
 */

import { useEffect, RefObject } from 'react';
import { ChapterInfo } from '@database/types';

/**
 * Ref sync parameters
 */
export interface RefSyncParams {
  /** Current chapter progress */
  progress: number;
  /** Save progress callback */
  saveProgress: (
    progress: number,
    paragraphIndex?: number,
    ttsState?: string,
  ) => void;
  /** Next chapter info */
  nextChapter: ChapterInfo | null | undefined;
  /** Navigate chapter callback */
  navigateChapter: (direction: 'NEXT' | 'PREV') => void;
  /** Refs to sync */
  refs: {
    progressRef: RefObject<number>;
    saveProgressRef: RefObject<
      (progress: number, paragraphIndex?: number, ttsState?: string) => void
    >;
    nextChapterRef: RefObject<ChapterInfo | null | undefined>;
    navigateChapterRef: RefObject<(direction: 'NEXT' | 'PREV') => void>;
  };
}

/**
 * Custom hook that keeps refs synced with props
 *
 * This is critical for event listeners that are created once on mount
 * with empty dependency arrays. The listeners need access to the current
 * callback functions (which change per chapter) via refs.
 *
 * @param params - Ref sync parameters
 */
export function useRefSync(params: RefSyncParams): void {
  const {
    progress,
    saveProgress,
    nextChapter,
    navigateChapter,
    refs: { progressRef, saveProgressRef, nextChapterRef, navigateChapterRef },
  } = params;

  // Sync progress ref
  useEffect(() => {
    progressRef.current = progress;
  }, [progress, progressRef]);

  // Sync saveProgress ref
  useEffect(() => {
    saveProgressRef.current = saveProgress;
  }, [saveProgress, saveProgressRef]);

  // Sync nextChapter and navigateChapter refs
  useEffect(() => {
    nextChapterRef.current = nextChapter;
    navigateChapterRef.current = navigateChapter;
  }, [nextChapter, navigateChapter, nextChapterRef, navigateChapterRef]);
}

export default useRefSync;
