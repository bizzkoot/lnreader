export type SaveEvent = {
  data?: number | string;
  paragraphIndex?: number;
  chapterId?: number;
};

export const shouldIgnoreSaveEvent = (
  event: SaveEvent,
  opts: {
    pendingDeletion: boolean;
    chapterTransitionTime: number;
    currentChapterId: number;
    isTTSReading: boolean;
    currentIdx: number;
    latestIdx: number;
  },
) => {
  if (opts.pendingDeletion) return true;

  // Discard events for other chapters
  if (event.chapterId !== undefined && event.chapterId !== opts.currentChapterId) return true;

  // During active TTS, only allow saves with a paragraphIndex (TTS is source-of-truth)
  if (opts.isTTSReading) {
    if (event.paragraphIndex === undefined) return true;
    if (typeof event.paragraphIndex === 'number' && opts.currentIdx >= 0 && event.paragraphIndex < opts.currentIdx - 1) return true;
  }

  const GRACE_PERIOD_MS = 1000;
  const timeSinceTransition = Date.now() - opts.chapterTransitionTime;

  if (timeSinceTransition < GRACE_PERIOD_MS) {
    if (event.chapterId === undefined) return true;

    const incomingIdx = typeof event.paragraphIndex === 'number' ? event.paragraphIndex : -1;
    if (incomingIdx >= 0) {
      if (opts.latestIdx >= 0 && incomingIdx < opts.latestIdx) return true;
      if (incomingIdx === 0 && Math.max(opts.currentIdx, opts.latestIdx) > 0) return true;
    }
  }

  return false;
};
