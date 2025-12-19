/**
 * useSyncDialogHandlers Hook
 *
 * Handlers for wake sync error recovery dialog.
 * Extracted from useTTSController.ts (Phase 1, Step 5)
 *
 * @module reader/hooks/useSyncDialogHandlers
 */

import { useCallback, RefObject } from 'react';
import { getChapter as getChapterFromDb } from '@database/queries/ChapterQueries';
import { ChapterInfo } from '@database/types';
import { SyncDialogStatus } from '../types/tts';

/**
 * Sync dialog handlers parameters
 */
export interface SyncDialogHandlersParams {
  getChapter: (chapter: ChapterInfo) => void;
  refs: {
    syncRetryCountRef: RefObject<number>;
    wakeChapterIdRef: RefObject<number | null>;
    pendingScreenWakeSyncRef: RefObject<boolean>;
  };
  callbacks: {
    setSyncDialogStatus: (status: SyncDialogStatus) => void;
    setSyncDialogVisible: (visible: boolean) => void;
  };
}

/**
 * Sync dialog handlers interface
 */
export interface SyncDialogHandlers {
  handleSyncRetry: () => void;
}

/**
 * Custom hook that provides sync dialog handlers
 *
 * @param params - Sync dialog handlers parameters
 * @returns Sync dialog handlers
 */
export function useSyncDialogHandlers(
  params: SyncDialogHandlersParams,
): SyncDialogHandlers {
  const {
    getChapter,
    refs: { syncRetryCountRef, wakeChapterIdRef, pendingScreenWakeSyncRef },
    callbacks: { setSyncDialogStatus, setSyncDialogVisible },
  } = params;

  /**
   * Handle sync retry - attempt to navigate to correct chapter again
   */
  const handleSyncRetry = useCallback(() => {
    syncRetryCountRef.current = 0;
    if (wakeChapterIdRef.current) {
      pendingScreenWakeSyncRef.current = true;
      setSyncDialogStatus('syncing');
      getChapterFromDb(wakeChapterIdRef.current)
        .then(savedChapter => {
          if (savedChapter) {
            getChapter(savedChapter);
          } else {
            setSyncDialogStatus('failed');
          }
        })
        .catch(() => {
          setSyncDialogStatus('failed');
        });
    } else {
      setSyncDialogVisible(false);
    }
  }, [
    getChapter,
    syncRetryCountRef,
    wakeChapterIdRef,
    pendingScreenWakeSyncRef,
    setSyncDialogStatus,
    setSyncDialogVisible,
  ]);

  return { handleSyncRetry };
}

export default useSyncDialogHandlers;
