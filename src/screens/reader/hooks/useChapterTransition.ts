/**
 * useChapterTransition Hook
 *
 * Manages chapter ID transitions, grace periods, and WebView sync state.
 *
 * @module reader/hooks/useChapterTransition
 * @dependencies NONE (Independent effect)
 */
/* eslint-disable no-console */

import { useEffect, RefObject } from 'react';

/**
 * Media navigation direction for confirmation logic
 */
export type MediaNavDirection = 'PREV' | 'NEXT' | null;

/**
 * Chapter transition parameters
 *
 * @property chapterId - Current chapter ID (from: useTTSController props)
 * @property refs - Mutable refs for transition tracking
 *   - prevChapterIdRef: Previous chapter ID (from: useTTSController local)
 *   - chapterTransitionTimeRef: Grace period timestamp (from: useTTSController local)
 *   - isWebViewSyncedRef: WebView sync state (from: useTTSController local)
 *   - mediaNavSourceChapterIdRef: Media nav source chapter (from: useTTSController local)
 *   - mediaNavDirectionRef: Media nav direction (from: useTTSController local)
 */
export interface ChapterTransitionParams {
  chapterId: number;
  refs: {
    prevChapterIdRef: RefObject<number>;
    chapterTransitionTimeRef: RefObject<number>;
    isWebViewSyncedRef: RefObject<boolean>;
    mediaNavSourceChapterIdRef: RefObject<number | null>;
    mediaNavDirectionRef: RefObject<MediaNavDirection>;
  };
}

/**
 * Hook to manage chapter transitions and WebView sync state.
 *
 * **Timing Logic:**
 * - Immediately: Update prevChapterIdRef, set grace period timestamp, mark WebView unsynced
 * - After 300ms: Mark WebView as synced
 * - After 2300ms: Clear media nav tracking (300ms + 2000ms)
 *
 * **Cleanup:** Clears sync timer on unmount or chapter change
 *
 * @example
 * useChapterTransition({
 *   chapterId: chapter.id,
 *   refs: {
 *     prevChapterIdRef,
 *     chapterTransitionTimeRef,
 *     isWebViewSyncedRef,
 *     mediaNavSourceChapterIdRef,
 *     mediaNavDirectionRef,
 *   },
 * });
 */
export function useChapterTransition(params: ChapterTransitionParams): void {
  const { chapterId, refs } = params;

  useEffect(() => {
    console.log(
      `useTTSController: Chapter changed to ${chapterId} (prev: ${refs.prevChapterIdRef.current})`,
    );

    // Update chapter ID ref IMMEDIATELY
    refs.prevChapterIdRef.current = chapterId;

    // Set grace period timestamp to ignore stale save events from old chapter
    refs.chapterTransitionTimeRef.current = Date.now();

    // Mark WebView as unsynced initially (new WebView loading)
    refs.isWebViewSyncedRef.current = false;

    // Short delay to allow WebView to stabilize, then mark as synced
    const syncTimer = setTimeout(() => {
      refs.isWebViewSyncedRef.current = true;
      console.log(
        `useTTSController: WebView marked as synced for chapter ${chapterId}`,
      );

      // Clear media navigation tracking after successful transition
      if (refs.mediaNavSourceChapterIdRef.current) {
        console.log(
          `useTTSController: Clearing media nav tracking (source: ${refs.mediaNavSourceChapterIdRef.current})`,
        );
        // Small delay before clearing to allow confirmation logic to run
        setTimeout(() => {
          refs.mediaNavSourceChapterIdRef.current = null;
          refs.mediaNavDirectionRef.current = null;
        }, 2000);
      }
    }, 300);

    return () => clearTimeout(syncTimer);
  }, [chapterId, refs]); // refs now safe - memoized in useTTSController to prevent re-runs
}
