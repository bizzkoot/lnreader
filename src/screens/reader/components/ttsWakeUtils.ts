/**
 * Helper utilities for TTS wake/resume behavior tests.
 */

/**
 * Computes the initial paragraph index from multiple sources.
 * Picks the highest available index (most recent progress).
 *
 * @param dbIndex - Index from database (may be stale due to async saves)
 * @param mmkvIndex - Index from MMKV fast storage
 * @param ttsStateIndex - Index from TTS state (most recent)
 * @returns The highest valid index, or -1 if all sources are negative/missing
 */
export function computeInitialIndex(
  dbIndex?: number,
  mmkvIndex?: number,
  ttsStateIndex?: number,
): number {
  const d = typeof dbIndex === 'number' ? dbIndex : -1;
  const m = typeof mmkvIndex === 'number' ? mmkvIndex : -1;
  const t = typeof ttsStateIndex === 'number' ? ttsStateIndex : -1;
  return Math.max(d, m, t, -1);
}

/**
 * Builds a TTS batch starting from the given index.
 *
 * @param paragraphs - Array of paragraph texts to speak
 * @param startIndex - Index to start from (default: 0)
 * @returns Object with startIndex, textsToSpeak, and utteranceIds
 * @throws Error if paragraphs is not an array
 */
export function buildBatch(
  paragraphs: string[],
  startIndex?: number,
): { startIndex: number; textsToSpeak: string[]; utteranceIds: string[] } {
  if (!Array.isArray(paragraphs)) {
    throw new Error('paragraphs must be an array');
  }
  const idx = Math.max(0, typeof startIndex === 'number' ? startIndex : 0);
  const textsToSpeak = paragraphs.slice(idx);
  const utteranceIds = textsToSpeak.map(
    (_, i) => `chapter_XXX_utterance_${idx + i}`,
  );
  return { startIndex: idx, textsToSpeak, utteranceIds };
}

/**
 * Parameters for shouldIgnoreSaveEvent.
 */
export interface ShouldIgnoreSaveEventParams {
  /** Time since chapter transition in milliseconds */
  timeSinceTransition?: number;
  /** Chapter ID of the save event */
  eventChapterId?: number | string;
  /** Current chapter ID */
  currentChapterId?: number | string;
  /** Incoming paragraph index from save event */
  incomingIdx?: number;
  /** Current paragraph index */
  currentIdx?: number;
  /** Latest known paragraph index */
  latestIdx?: number;
  /** Grace period in milliseconds (default: 1000) */
  graceMs?: number;
}

/**
 * Determines whether a save event should be ignored.
 *
 * @param params - Save event parameters
 * @returns true if the save should be ignored, false otherwise
 */
export function shouldIgnoreSaveEvent(
  params: ShouldIgnoreSaveEventParams,
): boolean {
  const {
    timeSinceTransition = Number.POSITIVE_INFINITY,
    eventChapterId,
    currentChapterId,
    incomingIdx = -1,
    currentIdx = -1,
    latestIdx = -1,
    graceMs = 1000,
  } = params;

  if (eventChapterId !== undefined && eventChapterId !== currentChapterId) {
    return true;
  }

  if (timeSinceTransition < graceMs) {
    if (eventChapterId === undefined) return true;

    if (typeof incomingIdx === 'number' && incomingIdx >= 0) {
      if (latestIdx >= 0 && incomingIdx < latestIdx) return true;
      if (incomingIdx === 0 && Math.max(currentIdx, latestIdx) > 0) return true;
    }
  }

  return false;
}
