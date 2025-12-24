import { useCallback, MutableRefObject } from 'react';
import { getRecentReadingChapters } from '@database/queries/ChapterQueries';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const confirmLog = createRateLimitedLogger('useTTSConfirmationHandler', {
  windowMs: 1500,
});

interface TTSConfirmationHandlerParams {
  novelId: number;
  chapterId: number;
  latestParagraphIndexRef: MutableRefObject<number | undefined>;
  lastTTSPauseTimeRef: MutableRefObject<number | undefined>;
  pendingResumeIndexRef: MutableRefObject<number>;
  dialogState: {
    setConflictingChapters: (
      conflicts: Array<{ id: number; name: string; paragraph: number }>,
    ) => void;
    setShowChapterSelectionDialog: (show: boolean) => void;
    showResumeDialog: () => void;
  };
  handleResumeCancel: () => void;
  updateLastTTSChapter: (id: number) => void;
}

interface TTSConfirmationHandler {
  handleRequestTTSConfirmation: (savedIndex: number) => Promise<void>;
}

/**
 * Hook: useTTSConfirmationHandler
 *
 * Purpose: Handles Smart Resume logic and chapter conflict detection
 *
 * Responsibilities:
 * - Smart Resume grace period (3 seconds)
 * - Detect user scroll vs saved position conflicts
 * - Query recent reading chapters for conflicts
 * - Show appropriate dialog (resume or chapter selection)
 *
 * Dependencies:
 * - Phase 2 Step 2: handleResumeCancel
 * - Database: getRecentReadingChapters, updateLastTTSChapter
 * - MMKV: chapter progress storage
 */
export const useTTSConfirmationHandler = ({
  novelId,
  chapterId,
  latestParagraphIndexRef,
  lastTTSPauseTimeRef,
  pendingResumeIndexRef,
  dialogState,
  handleResumeCancel,
  updateLastTTSChapter,
}: TTSConfirmationHandlerParams): TTSConfirmationHandler => {
  /**
   * Handle request TTS confirmation
   */
  const handleRequestTTSConfirmation = useCallback(
    async (savedIndex: number) => {
      const currentRef = latestParagraphIndexRef.current;
      const timeSinceLastPause =
        Date.now() - (lastTTSPauseTimeRef.current || 0);
      const inGracePeriod = timeSinceLastPause < 3000;

      if (
        !inGracePeriod &&
        currentRef !== undefined &&
        currentRef >= 0 &&
        Math.abs(currentRef - savedIndex) > 5
      ) {
        confirmLog.debug(
          'smart-resume-cancel',
          `Smart Resume - User manually scrolled to ${currentRef}. Ignoring saved index ${savedIndex}`,
        );
        handleResumeCancel();
        return;
      }

      try {
        const conflicts = await getRecentReadingChapters(novelId, 4);
        const relevantConflicts = conflicts.filter(c => c.id !== chapterId);

        if (relevantConflicts.length > 0) {
          const conflictsData = relevantConflicts.map(c => ({
            id: c.id,
            name: c.name || `Chapter ${c.chapterNumber}`,
            paragraph: MMKVStorage.getNumber(`chapter_progress_${c.id}`) || 0,
          }));

          dialogState.setConflictingChapters(conflictsData);
          pendingResumeIndexRef.current = savedIndex;
          dialogState.setShowChapterSelectionDialog(true);
          return;
        }
      } catch {
        // Ignore errors, proceed to start TTS
      }

      updateLastTTSChapter(chapterId);
      pendingResumeIndexRef.current = savedIndex;
      dialogState.showResumeDialog();
    },
    [
      novelId,
      chapterId,
      latestParagraphIndexRef,
      lastTTSPauseTimeRef,
      pendingResumeIndexRef,
      handleResumeCancel,
      updateLastTTSChapter,
      dialogState,
    ],
  );

  return {
    handleRequestTTSConfirmation,
  };
};
