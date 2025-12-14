/* eslint-disable no-console */
import { useCallback, MutableRefObject } from 'react';
import {
  getChapter as getChapterFromDb,
  markChaptersBeforePositionRead,
  resetFutureChaptersProgress,
} from '@database/queries/ChapterQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import { ChapterGeneralSettings } from '@hooks/persisted/useSettings';

interface ChapterSelectionHandlerParams {
  novel: NovelInfo;
  chapter: ChapterInfo;
  chapterGeneralSettingsRef: MutableRefObject<ChapterGeneralSettings>;
  pendingResumeIndexRef: MutableRefObject<number>;
  dialogState: {
    setShowChapterSelectionDialog: (show: boolean) => void;
    showResumeDialog: () => void;
  };
  showToastMessage: (message: string) => void;
  updateLastTTSChapter: (id: number) => void;
  getChapter: (chapter: ChapterInfo) => void;
}

interface ChapterSelectionHandler {
  handleSelectChapter: (targetChapterId: number) => Promise<void>;
}

/**
 * Hook: useChapterSelectionHandler
 *
 * Purpose: Handle chapter selection from conflict dialog
 *
 * Responsibilities:
 * - Handle same chapter selection (mark chapters read, reset progress)
 * - Handle different chapter selection (switch chapter, reset progress)
 * - Show resume dialog if pending resume index exists
 *
 * Dependencies:
 * - Phase 1 utilities: updateLastTTSChapter
 * - Database: getChapterFromDb, markChaptersBeforePositionRead, resetFutureChaptersProgress
 */
export const useChapterSelectionHandler = ({
  novel,
  chapter,
  chapterGeneralSettingsRef,
  pendingResumeIndexRef,
  dialogState,
  showToastMessage,
  updateLastTTSChapter,
  getChapter,
}: ChapterSelectionHandlerParams): ChapterSelectionHandler => {
  /**
   * Handle select chapter from conflict dialog
   */
  const handleSelectChapter = useCallback(
    async (targetChapterId: number) => {
      dialogState.setShowChapterSelectionDialog(false);

      if (targetChapterId === chapter.id) {
        if (chapter.position !== undefined) {
          await markChaptersBeforePositionRead(novel.id, chapter.position);
        }
        const resetMode =
          chapterGeneralSettingsRef.current.ttsForwardChapterReset || 'none';
        if (resetMode !== 'none') {
          await resetFutureChaptersProgress(novel.id, chapter.id, resetMode);
          showToastMessage(`Future progress reset: ${resetMode}`);
        }

        updateLastTTSChapter(chapter.id);

        if (pendingResumeIndexRef.current >= 0) {
          dialogState.showResumeDialog();
        }
      } else {
        const targetChapter = await getChapterFromDb(targetChapterId);
        if (targetChapter) {
          if (targetChapter.position !== undefined) {
            await markChaptersBeforePositionRead(
              novel.id,
              targetChapter.position,
            );
          }
          const resetMode =
            chapterGeneralSettingsRef.current.ttsForwardChapterReset || 'none';
          if (resetMode !== 'none') {
            await resetFutureChaptersProgress(
              novel.id,
              targetChapter.id,
              resetMode,
            );
          }

          updateLastTTSChapter(targetChapter.id);
          getChapter(targetChapter);
        }
      }
    },
    [
      novel.id,
      chapter.id,
      chapter.position,
      chapterGeneralSettingsRef,
      showToastMessage,
      updateLastTTSChapter,
      pendingResumeIndexRef,
      dialogState,
      getChapter,
    ],
  );

  return {
    handleSelectChapter,
  };
};
